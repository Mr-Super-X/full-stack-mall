<script setup lang="ts">
/**
 * SchemaField —— 字段级渲染容器
 *
 * 字段级重渲隔离：XForm 模板里 <component :is="renderToComponent(node)"> 在父组件 render effect
 * 中执行，内部的 get(model, name) 被父组件追踪 ——任一字段输入都触发全表单 vnode 重建。
 * 下沉到本组件后，每个字段的 render effect 独立追踪自己的 get(model)，
 * 输入单字段只重渲该字段，其余字段的 vnode 完全不动。
 *
 * 容错设计（2026-09-15 review）：
 * 1. 双重容错：
 *    a. safeRender computed try/catch 捕获 renderFn 同步 throw
 *    b. onErrorCaptured 捕获子组件 patch 阶段 throw
 *    关键：onErrorCaptured 通过 tick counter 让 computed 重新求值，返回 undefined
 *    让 template 重渲染走占位 UI 而非继续渲染已 throw 的 component
 * 2. 恢复机制（2026-09-16 review 新增）：watch props.node / props.renderFn 换代时
 *    重置 renderError —— 否则异步组件注册完成 / schema 热更新后字段永久锁定在
 *    「字段渲染失败」占位，底层问题已修复也无法恢复
 * 3. #default scoped slot —— 消费方按节点名替换渲染
 * 4. 显式 Props interface —— IDE hover 展开完整类型
 *
 * el-form 的 provide/inject 沿组件祖先链传递，中间多一层组件不影响 ElFormItem 注册。
 *
 * @group XForm 组件
 */
import type { VNode } from 'vue'
import type { SchemaNode } from '../types'
// ref / computed / onErrorCaptured 由 unplugin-auto-import 注入（CLAUDE.md §1.6）—— 2026-09-16 review 收敛

/** Props 类型 —— 集中声明便于 IDE hover 展开 + 子组件 props 校验 */
type SchemaFieldProps = {
  node: SchemaNode
  renderFn: (node: SchemaNode) => VNode | string | VNode[] | undefined
}

const props = defineProps<SchemaFieldProps>()

defineOptions({ name: 'XFormSchemaField' })

/**
 * patch 阶段错误状态 —— 由 onErrorCaptured 填充，watch 恢复（见下方 watch）
 */
const renderError = ref<Error | null>(null)

/**
 * tick counter —— 冗余触发器，保证 onErrorCaptured 后 computed 必定重算
 *
 * computed 已直接订阅 renderError.value（见下方 rendered），但保留 tick 双保险：
 * 早期 vue 3.x 版本对「computed 内读取的 ref 由外部钩子写入」的调度存在时序差异，
 * tick++ 显式制造一次依赖变化，确保各 vue 版本下 patch 失败后占位 UI 都能稳定出现。
 *
 * 与 renderError 的写入顺序无先后要求：Vue 3 调度器合并同一同步块内的多次 ref
 * 写入到同一次 flush，computed 在下一次求值时同时读取两者的最终值。
 *
 * ⚠️ 不要删除此 ref —— 移除后 RichTextEditor 等全局组件首次渲染在部分 vue
 * 版本下会出现空白 VNode（历史回归，见 2026-09-16 修复记录）。
 */
const tick = ref(0)

/**
 * 错误恢复 —— props.node / props.renderFn 换代时重置 renderError
 *
 * 业务场景：异步组件首次渲染时尚未注册 → onErrorCaptured 锁定占位；
 * 组件注册完成后 schema 引用替换，若不解锁，字段将永久显示「渲染失败」，
 * 即使底层问题已修复。此处复位 renderError + tick，让 rendered computed
 * 重新执行 renderFn，字段随下一次 patch 恢复正常。
 *
 * 防抖：仅当 renderError 有值时才 tick++，避免正常场景下的无效重算。
 */
watch(
  () => [props.node, props.renderFn] as const,
  () => {
    if (!renderError.value) return
    renderError.value = null
    tick.value++
  }
)

/**
 * node 属性写回重渲兜底 —— deep watch props.node，任一属性变化时 tick++ 触发本字段重渲
 *
 * 为什么需要：renderNode 是普通函数（非 computed），其内 renderFn 递归创建的子树 VNode
 * 含多层 slot 闭包（Card → renderToComponentWithGrid → 字段 label/hidden 在 ElCard patch 期
 * 的 slot 调用栈里才被读取）。这导致 SchemaField 自身 render effect 同步执行期**读不到**
 * 深层子字段的 node.label / node.hidden —— 这些属性的响应式订阅记在第三方组件（ElCard）
 * 的 effect 上，reaction 写回时无法可靠驱动整棵子树重建（2026-09-18 用户反馈
 * xform-expression demo「功能都失效」根因：reaction 写回正确但 DOM 不刷新）。
 * 之前用 computed 包裹时，computed 的 deps 容器会收纳这些深层读取并挂到本组件 effect，
 * 改动后该机制丢失 —— 此处用 deep watch 重建等价订阅。
 *
 * 成本：每个 SchemaField 一个 deep watcher；node 属性实际变化时才 tick++（渲染兜底）。
 *
 * ⚠️ watch 为浅源（() => props.node）+ deep:true —— 递归监听整棵子树 reactive node。
 */
watch(
  () => props.node,
  () => {
    tick.value++
  },
  { deep: true }
)

/**
 * 渲染输出 —— 用函数而非 computed 包裹 renderFn 调用
 *
 * ⚠️ 不能用 computed：renderFn 内可能含 applyDirectives → withDirectives，后者要求
 * 活跃渲染上下文（currentRenderingInstance !== null）。computed 求值可能在 watch
 * flush / 副作用阶段，此时 rendering instance 已清空 → withDirectives 守卫命中
 * 警告 + 跳过指令挂载（2026-09-18 用户反馈 xform-directives demo 控制台警告根因）。
 * 真正的组件 render() 函数执行期渲染上下文必定活跃，故用普通函数 + 模板内调
 * {{ renderNode() }} 触发组件重渲染时重新执行（依赖通过 props.renderFn 闭包自动追踪）。
 *
 * 依赖：props.node / props.renderFn（renderFn 内访问 model → 字段级响应式追踪）
 * + tick（patch 阶段 throw 重置触发器）
 *
 * 关键：catch 块内**不写 ref**（vue/no-side-effects-in-computed-properties 禁用），
 * 仅 console 留痕 + 返回 undefined —— template 通过 `renderNode() === undefined` 走占位 div
 *
 * ⭐ 返回值三态语义（2026-09-18 修 xform-field-permission「permission:hidden 误报渲染失败」）：
 * - VNode | string → 正常渲染
 * - null → **合法空渲染**（permission 'hidden' / node.ignore / 无组件映射等 renderFn 正常返回
 *   undefined 的场景）——template 走 `<component :is="null">` 渲染为空，**不显示错误占位**
 * - undefined → **渲染失败**（renderFn 同步 throw / patch 阶段 renderError）——template 显示占位
 *
 * 为什么必须区分：renderFn 对 permission 'hidden' 合法返回 undefined（字段不渲染），
 * 与 renderFn throw 的 undefined 在旧 `!renderNode()` 判定下无法区分，导致 hidden 字段
 * 被误报「字段渲染失败」。permission hidden 是「按设计消失」，不是「渲染出错」。
 *
 * 返回类型 narrow 为 VNode | string | null | undefined：模板 <component :is="...">
 * 接受 null 渲染空节点；renderFn 返回数组形态属于上游约定违规，取首项或忽略
 */
function renderNode(): VNode | string | null | undefined {
  void tick.value // 建立 tick 依赖，让 onErrorCaptured 能触发重算
  if (renderError.value) return undefined // patch 阶段已出错：返回 undefined 走占位
  try {
    const result = props.renderFn(props.node)
    if (Array.isArray(result)) {
      // 数组形态不直接渲染：透传首项（首项 undefined → 合法空）
      return result[0] ?? null
    }
    // renderFn 正常返回 undefined/null（permission hidden / ignore / 无组件）→ 合法空渲染
    return result ?? null
  } catch (err) {
    // dev 留痕；prod 静默 —— 不写 renderError (避免 vue/no-side-effects-in-computed-properties)
    // sync throw 后返回 undefined（区别于合法空 null），template 走占位 div
    if (import.meta.env.DEV) {
      console.error(
        `[XForm][SchemaField] renderFn failed for node "${props.node.name ?? '<unnamed>'}"`,
        err
      )
    }
    return undefined
  }
}

/**
 * 捕获子组件 patch 阶段的 throw —— 阻止冒泡到外层 ErrorBoundary
 *
 * 时机：Vue patch 子组件时执行其 render function / setup，若 throw 触发此钩子。
 * renderError 与 tick 在同一同步块内写入 —— Vue 3 调度器合并同一块内的
 * 多次 ref 写入到同一次 flush，computed 在下一次求值时同时看到两个更新，
 * 二者无先后顺序依赖。
 *
 * 返回 false 阻止 Vue 继续向上传播（否则外层 ErrorBoundary 会接管并渲染错误页）。
 */
onErrorCaptured((err) => {
  renderError.value = err instanceof Error ? err : new Error(String(err))
  tick.value++
  if (import.meta.env.DEV) {
    console.error(
      `[XForm][SchemaField] patch failed for node "${props.node.name ?? '<unnamed>'}"`,
      err
    )
  }
  return false
})
</script>

<template>
  <!--
    扩展插槽：消费方可按 node.name 替换渲染
    <SchemaField :node="node" :render-fn="renderFn">
      <template #default="{ node }">
        <MyCustomWrapper v-if="node.name === 'special'" />
      </template>
    </SchemaField>
  -->
  <slot :node="props.node">
    <!--
      三选一渲染（2026-09-18 修 permission:hidden 误报）：
      1. patch 阶段 throw（renderError 有值）→ 占位 div
      2. renderFn 同步 throw（renderNode() === undefined）→ 占位 div
      3. renderNode() 返回 null → **合法空渲染**（permission 'hidden' / ignore / 无组件映射）
         <component :is="null"> 渲染为空，不显示占位
      4. 正常 VNode | string → <component :is="renderNode()" />
    -->
    <div
      v-if="renderError || renderNode() === undefined"
      :data-xform-error="props.node.name"
      class="x-form-render-error"
      role="alert"
      aria-live="polite"
    >
      字段渲染失败（详见 console）
    </div>
    <component v-else :is="renderNode()" />
  </slot>
</template>

<style lang="scss">
/* 字段渲染失败占位 —— 顶层选择器，不嵌套到组件根类（SchemaField 无根 class）
   不依赖 el-message 减少外部样式影响 */
.x-form-render-error {
  padding: 8px 12px;
  border: 1px dashed var(--el-color-danger);
  color: var(--el-color-danger);
  font-size: 12px;
  border-radius: 4px;
  background: var(--el-color-danger-light-9);
}
</style>
