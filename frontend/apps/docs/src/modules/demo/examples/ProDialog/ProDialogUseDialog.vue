<script setup lang="ts">
/**
 * ProDialog 命令式用法演示页（useDialog Hook）。
 *
 * 覆盖验证点：
 * 1. open() 返回 Promise：点「确定」resolve，取消/X/ESC reject（DialogCancelledError）
 * 2. open(contentProps) 透传给内容组件；setProps 实时更新已打开弹窗的 props
 * 3. 句柄复用：confirm/cancel 关闭后再 open，第二次 Promise 必须正常结算
 *    （回归 code-reviewer #1 CRITICAL：settled 标志未复位会导致第二次永久挂起）
 * 4. appContext 继承：动态挂载的内容组件内使用 el-* 组件、useRoute()，
 *    能正常渲染即证明拿到了主应用上下文（全局组件 + Router）
 *
 * 内容组件用页面内联 defineComponent + h() 实现——examples 目录下所有 .vue 都会被
 * import.meta.glob 注册成路由，单独建内容组件文件会产生多余路由页；
 * 内联组件也恰好演示 useDialog「接收任意组件对象」的能力。
 */
import { ElInput, ElTag } from 'element-plus'
// useDialog 与 DialogCancelledError 由 unplugin-auto-import 全局注入（详见 CLAUDE.md §1.6）
// DialogCancelledError 是 class 名，AutoImport 仅注入函数；此处保留具名 import 仅用于 instanceof
import { DialogCancelledError } from '@vv/ui/composables/useDialog'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'

const bem = createNamespace('demo-pro-dialog-hook')

/** 命令式弹窗的内容组件：props 经 open(contentProps) 注入，内部消费 appContext */
const DemoContent = defineComponent({
  name: 'ProDialogDemoContent',
  props: {
    /** 问候对象姓名（contentProps 透传验证用） */
    userName: { type: String, default: '访客' },
  },
  setup(props) {
    const route = useRoute() // vue-router（AutoImport 注入）
    const input = ref('')
    return () =>
      h('div', { class: bem.e('content') }, [
        h('p', { class: bem.e('content-line') }, `你好，${props.userName}！`),
        // el-tag 全局可用 = 主应用 appContext（全局组件注册）继承成功
        h(
          ElTag,
          { type: 'success', class: bem.e('content-line') },
          () => 'el-tag 正常渲染 = 全局组件上下文已继承'
        ),
        // useRoute() 有值 = Router 上下文继承成功
        h('p', { class: bem.e('content-line') }, `useRoute().path = ${route.path}`),
        h(ElInput, {
          modelValue: input.value,
          'onUpdate:modelValue': (v: string) => (input.value = v),
          placeholder: '输入内容验证内容组件内响应式',
        }),
        h('p', { class: bem.e('content-line') }, `输入内容：${input.value || '（空）'}`),
      ])
  },
})

// —— 1. open() 的 Promise 语义 ——
const basicResult = ref('尚未操作')
const basicDialog = useDialog(DemoContent, { title: '命令式弹窗（基础）', width: '460px' })

async function openBasic() {
  basicResult.value = '弹窗已打开，等待确认或取消…'
  try {
    await basicDialog.open()
    basicResult.value = '✅ Promise resolved —— 你点了「确定」'
  } catch (error) {
    basicResult.value =
      error instanceof DialogCancelledError
        ? '❌ Promise rejected（DialogCancelledError）—— 你点了「取消 / X / ESC」'
        : '❌ 未知错误'
  }
}

const SNIPPET_BASIC = `const dialog = useDialog(EditForm, { title: '编辑用户' })
try {
  await dialog.open({ userId: 1 })   // 点「确定」resolve
} catch (e) {
  if (e instanceof DialogCancelledError) { /* 用户取消 */ }
}`

// —— 2. contentProps 透传 + setProps 实时更新 ——
const propsResult = ref('尚未操作')
const titleDraft = ref('动态标题（打开后可改）')
const propsDialog = useDialog(DemoContent, { title: '命令式弹窗（动态 props）', width: '460px' })

async function openProps() {
  propsResult.value = '弹窗已打开'
  try {
    await propsDialog.open({ userName: '小明（来自 open 的 contentProps）' })
    propsResult.value = '已确认'
  } catch {
    propsResult.value = '已取消'
  }
}

function applyTitle() {
  // 弹窗打开状态下改标题，应立即生效
  propsDialog.setProps({ title: titleDraft.value })
  propsResult.value = `setProps 已调用：title =「${titleDraft.value}」`
}

const SNIPPET_PROPS = `// 打开时透传内容组件 props
dialog.open({ userName: '小明' })
// 打开过程中实时改弹窗自身 props
dialog.setProps({ title: '新标题' })`

// —— 3. 句柄复用（CRITICAL 回归点）——
const reuseCount = ref(0)
const reuseResult = ref('尚未操作')
const reuseDialog = useDialog(DemoContent, { title: '句柄复用回归', width: '460px' })

async function openReuse() {
  reuseCount.value += 1
  try {
    await reuseDialog.open({ userName: `第 ${reuseCount.value} 次打开` })
    reuseResult.value = `第 ${reuseCount.value} 次：✅ 已确认并正常结算`
  } catch {
    reuseResult.value = `第 ${reuseCount.value} 次：❌ 已取消并正常结算`
  }
}

const SNIPPET_REUSE = `// 同一个句柄反复 open（settled 标志必须随 open 复位）
await dialog.open()  // 确认关闭
await dialog.open()  // 第二次必须正常 resolve/reject，不能永久挂起`

// —— 4. useConfirm：取消即 resolve(false)，无须 try/catch ——
const confirmResult = ref('尚未操作')
const dangerResult = ref('尚未操作')

async function handleSimpleConfirm() {
  // 一行表达：if 不成立 → 用户取消，直接 return（再不会有 Uncaught in promise）
  if (
    !(await useConfirm({
      content: '这是一条普通确认，点击确定后下方状态会更新。',
      title: '系统提示',
    }))
  ) {
    confirmResult.value = '↩ 用户取消（resolve false，无需 try/catch）'
    return
  }
  confirmResult.value = '✅ 用户确认（resolve true）'
}

async function handleDangerConfirm() {
  // danger: true = 确认按钮转红 + 警告图标，等价于手写 { type:'warning', confirmButtonType:'danger' }
  if (
    !(await useConfirm({
      content: '此操作将永久删除该记录，且不可恢复。',
      title: '危险操作',
      danger: true,
      confirmButtonText: '删除',
      cancelButtonText: '再想想',
    }))
  ) {
    dangerResult.value = '↩ 用户取消'
    return
  }
  dangerResult.value = '✅ 已确认删除（控制台应无 Uncaught in promise 警告）'
}

const SNIPPET_CONFIRM_BASIC = `// 取消 resolve(false) 而非 reject，故无须 try/catch
const confirmed = await useConfirm('确定删除吗？')
if (!confirmed) return
await api.remove(id)`

const SNIPPET_CONFIRM_DANGER = `// danger 预设：确认按钮转红 + 警告图标
await useConfirm({
  content: '此操作不可恢复',
  title: '危险操作',
  danger: true,
  confirmButtonText: '删除',
})`

const tocItems = [
  { id: 'demo-command-basic', label: 'open() 的 Promise 语义' },
  { id: 'demo-command-props', label: 'contentProps + setProps' },
  { id: 'demo-command-reuse', label: '句柄复用（回归点）' },
  { id: 'demo-command-confirm', label: 'useConfirm：取消即 resolve(false)' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="ProDialog 命令式调用（useDialog）"
    source="src/composables/useDialog.ts"
    :introductions="[
      'useDialog(内容组件, 选项) 返回 { open, close, setProps, isOpen }，纯 JS/TS 即可唤起弹窗。',
      'open() 返回 Promise：点「确定」resolve；取消 / X / ESC / 遮罩 reject（DialogCancelledError）。',
      '动态挂载的弹窗通过 setup 期捕获 + main.ts 注册的双保险拿到主应用 appContext，内容组件内可直接用全局组件和 Router。',
    ]"
  >
    <section id="demo-command-basic">
      <DemoField :code="SNIPPET_BASIC" label="① open() 的 Promise 语义">
        <div :class="bem.e('controls')">
          <el-button type="primary" @click="openBasic">唤起弹窗</el-button>
        </div>
        <el-alert
          :title="basicResult"
          :type="basicResult.startsWith('✅') ? 'success' : 'info'"
          :closable="false"
        />
        <p :class="bem.e('tip')">
          弹窗内容就是本页内联的 DemoContent 组件——同时观察内容区是否正常渲染（appContext
          验证见组件内部）。
        </p>
      </DemoField>
    </section>

    <section id="demo-command-props">
      <DemoField :code="SNIPPET_PROPS" label="② contentProps 透传 + setProps 实时更新">
        <div :class="bem.e('controls')">
          <el-button type="primary" @click="openProps">唤起弹窗</el-button>
          <el-input
            v-model="titleDraft"
            :class="bem.e('title-input')"
            size="small"
            placeholder="输入新标题"
          />
          <el-button @click="applyTitle">setProps 改标题</el-button>
        </div>
        <el-alert :title="propsResult" type="info" :closable="false" />
        <p :class="bem.e('tip')">
          弹窗保持打开时点「setProps 改标题」，标题应立即变化；内容组件收到的 userName
          应显示「小明（来自 open 的 contentProps）」。
        </p>
      </DemoField>
    </section>

    <section id="demo-command-reuse">
      <DemoField :code="SNIPPET_REUSE" label="③ 句柄复用：确认/取消后再 open（CRITICAL 回归点）">
        <div :class="bem.e('controls')">
          <el-button type="primary" @click="openReuse">第 {{ reuseCount + 1 }} 次唤起</el-button>
          <el-tag>已打开 {{ reuseCount }} 次</el-tag>
        </div>
        <el-alert :title="reuseResult" type="warning" :closable="false" />
        <p :class="bem.e('tip')">
          每次打开后任意确认或取消关闭，再点按钮唤起下一次——若第二次弹窗卡死或结果不更新， 说明
          settled 复位逻辑回归。
        </p>
      </DemoField>
    </section>

    <section id="demo-command-confirm">
      <DemoField
        :code="SNIPPET_CONFIRM_BASIC"
        label="④ useConfirm：取消 resolve(false)，无须 try/catch"
      >
        <p :class="bem.e('tip')">
          对比上方 useDialog 的 try/catch + DialogCancelledError 模式—— useConfirm 把取消统一重塑为
          resolve(false)，业务代码无需异常捕获路径， 且彻底消除控制台 `Uncaught (in promise) cancel`
          噪音。
        </p>
        <div :class="bem.e('controls')">
          <el-button type="primary" @click="handleSimpleConfirm">普通确认</el-button>
        </div>
        <el-alert
          :title="confirmResult"
          :type="confirmResult.startsWith('✅') ? 'success' : 'info'"
          :closable="false"
        />
        <p :class="bem.e('tip')">
          点击「取消」或按 ESC / 点遮罩 → 状态显示「resolve false」，控制台应 0 警告。
        </p>
      </DemoField>

      <DemoField :code="SNIPPET_CONFIRM_DANGER" label="⑤ useConfirm danger 预设：危险操作高亮">
        <div :class="bem.e('controls')">
          <el-button type="danger" @click="handleDangerConfirm">危险操作</el-button>
        </div>
        <el-alert
          :title="dangerResult"
          :type="dangerResult.startsWith('✅') ? 'success' : 'warning'"
          :closable="false"
        />
        <p :class="bem.e('tip')">
          弹窗应显示红色「删除」按钮 + 黄色警告图标，按钮文案已被显式字段覆盖。
        </p>
      </DemoField>
    </section>
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-pro-dialog-hook {
  &__controls {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }

  &__title-input {
    width: 220px;
  }

  &__tip {
    margin: 8px 0 0;
    font-size: 12px;
    line-height: 1.7;
    color: var(--el-text-color-secondary);
  }

  &__content {
    line-height: 1.8;
  }

  &__content-line {
    margin: 0 0 8px;
  }
}
</style>
