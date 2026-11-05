<script setup lang="ts">
/**
 * 演示 SchemaField 安全渲染 —— renderFn 抛错时降级到错误占位 UI
 *
 * 场景：业务自定义组件内部 throw（如网络请求未捕获 / props 引用不存在方法），
 * 旧实现会让整张 XForm 崩溃；新版 safeRender（SchemaField.vue 改造点）兜底，
 * 仅出错字段降级为占位，其余字段正常渲染。
 *
 * 验证点：
 * 1. `broken` 字段渲染时 throw → dev console 出现 `[XForm][SchemaField] render failed`
 * 2. UI：broken 字段显示红色虚线占位 "字段渲染失败（详见 console）"
 * 3. UI：同 schema 内 `name` / `email` 字段正常渲染，不受 broken 影响
 * 4. prod 模式 console 静默，仅显示占位 UI
 */
import { h, defineComponent } from 'vue'
import { ElInput, ElMessage } from 'element-plus'
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import ApiTable from '../../components/ApiTable.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import { renderRecoveryItems } from './configs/xform-demos-api'
import xFormRenderRecoverySource from './XFormRenderRecovery.vue?raw'
import ModelPreview from '../../components/ModelPreview.vue'

const { bem, formRef, onReset, copySchema } = useXFormDemo({
  name: 'render-recovery',
  schema: () => schema,
  model: () => model,
})

/**
 * BrokenInput —— 故意抛错的演示组件
 *
 * 模拟真实业务场景：自定义组件内部异步初始化失败但未捕获错误（如挂载时调网络接口）。
 * XForm 渲染层（render-schema-node.ts）调用 component() 时触发 throw。
 *
 * SchemaField.safeRender 接住错误 → 降级到 <div class="x-form-render-error">，
 * 整张 XForm 不会崩溃，其他字段照常渲染。
 */
const BrokenInput = defineComponent({
  name: 'BrokenInput',
  props: {
    modelValue: { type: String, default: '' },
  },
  setup() {
    return (): unknown => {
      // 真实场景：组件挂载时调网络接口 throw 但未捕获
      throw new Error('BrokenInput 挂载时模拟 throw（演示 SchemaField.safeRender 容错）')
      // 下方 h() 在 TS 看来不可达；显式 h() 调用保留以满足编译推断（实际运行时不会执行到这里）
      return h(ElInput, {}) as never
    }
  },
})

const schema: SchemaNode = {
  column: 1,
  children: [
    {
      label: '姓名',
      name: 'name',
      component: 'Input',
      props: { placeholder: '正常字段 1', clearable: true },
    },
    {
      label: '邮箱',
      name: 'email',
      component: 'Input',
      props: { placeholder: '正常字段 2', clearable: true },
    },
    {
      label: '故障字段',
      name: 'broken',
      component: 'BrokenInput', // 通过 components prop 注册 → schema 自动解析
      props: { placeholder: '点击不会出现崩溃' },
    },
  ],
}

const model = reactive<Record<string, unknown>>({
  name: '',
  email: '',
  broken: '',
})

/** 占位 className 检查：断言 broken 字段渲染降级后占位元素含 x-form-render-error class
 *  用户可以此验证 SchemaField.safeRender 兜底是否生效（与 dev mode console.error 双重确认） */
function checkErrorPlaceholderClass(): void {
  const placeholders = document.querySelectorAll<HTMLElement>('.x-form-render-error')
  const count = placeholders.length
  if (count === 0) {
    ElMessage.warning('未找到占位元素——broken 字段可能未触发 throw')
    return
  }
  // 输出每个占位元素的 className + 父字段名（含 data-attribute 方便定位）
  placeholders.forEach((el, idx) => {
    console.log(
      `[XFormRenderRecovery] 占位 #${idx + 1} className="${el.className}" parent="${el.parentElement?.tagName ?? 'unknown'}"`
    )
  })
  ElMessage.success(`找到 ${count} 个占位元素（class 包含 x-form-render-error），详情见 Console`)
}

const tocItems = [
  { id: 'demo-render-recovery', label: '字段渲染失败降级演示' },
  { id: 'api-render-recovery', label: 'SchemaField.safeRender 行为速查' },
]

useDocToc(tocItems)

const introductions = [
  'SchemaField.safeRender 包裹 renderFn 调用：业务自定义组件 throw 时降级到占位 UI',
  '占位 UI：红色虚线 + 错误字段名 (class=x-form-render-error)，便于定位',
  'dev 模式：console.error 留痕（[XForm][SchemaField] render failed for node "..."）',
  'prod 模式：console 静默，仅显示占位 UI（节省性能开销）',
  '同一 schema 内正常字段照常渲染，broken 字段的 throw 被边界隔离',
  '验证步骤：点击下方「检查占位 className」按钮 → console 输出 broken 字段占位元素的 className（含 x-form-render-error）',
]
</script>

<template>
  <DemoFrame
    title="SchemaField 安全渲染 —— 单字段 throw 不污染全表单"
    source="src/components/form-schema/components/SchemaField.vue"
    :introductions="introductions"
  >
    <section id="demo-render-recovery">
      <DemoField label="故障字段降级演示" :code="xFormRenderRecoverySource">
        <XForm ref="formRef" :schema="schema" :model="model" :components="{ BrokenInput }" />
        <div :class="bem.e('actions')">
          <el-button @click="onReset">重置</el-button>
          <el-button @click="copySchema">复制 schema</el-button>
          <el-button type="info" plain @click="checkErrorPlaceholderClass">
            检查占位 className
          </el-button>
        </div>
        <ModelPreview :model="model" />
      </DemoField>
    </section>

    <ApiTable
      title="SchemaField.safeRender 行为速查"
      :items="renderRecoveryItems"
      anchor="api-render-recovery"
    />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-render-recovery {
  &__actions {
    margin-top: 16px;
    display: flex;
    gap: 8px;
  }
}
</style>
