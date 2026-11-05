<script setup lang="ts">
/**
 * XFormElNotificationHost —— errorBus events → ElNotification 的命令式桥接组件
 *
 * 角色：XFormErrorToastSlot demo 的 slot 接管实现，演示「业务用 ElNotification
 * 替换默认 XFormErrorToast」的完整闭环。
 *
 * 为什么需要桥接而非声明式 v-for：
 * ElNotification 是命令式服务组件，模板里声明式 <ElNotification v-for> 会把通知
 * 内容内联渲染在 slot 所在 DOM（表单内部），而不是 body 右上角浮层——
 * 这是旧版 demo 的错误用法。正确姿势是 watch events 变化，对新增事件
 * 命令式调用 ElNotification()（其内部自带 teleport to body + 堆叠管理）。
 *
 * 已知边界（slot 契约限制，见 docs/24 §Slots）：
 * toastContainer slot 仅注入 { events }，errorBus.dismiss 不可达——
 * 本组件只负责「新事件 → 弹窗」单向接管，不回写 dismissed 标记；
 * errorBus 内部最多保留 5 条事件（MAX_EVENTS 截断），不 dismiss 无副作用。
 *
 * @group XForm demo 工具
 */
import { ElNotification } from 'element-plus'
import type { FormErrorEvent } from '@vv/ui/components/form-schema/composables/use-form-error-bus.ts'

const { events } = defineProps<{
  /** errorBus 当前事件列表（XForm toastContainer slot 注入，shallowRef 整体替换） */
  events: FormErrorEvent[]
}>()

/**
 * 已通知事件 id 集合 —— errorBus 数组整体替换语义下，新 id 即新事件；
 * events 被截断（errorBus 保留最近 5 条）时同步修剪，防 Set 无界增长
 */
const notifiedIds = new Set<string>()

// watch props.events：errorBus 每次 report 都整体替换新数组，浅引用观察即可命中
watch(
  () => events,
  (list) => {
    const currentIds = new Set(list.map((e) => e.id))
    for (const id of notifiedIds) {
      if (!currentIds.has(id)) notifiedIds.delete(id)
    }
    for (const e of list) {
      if (notifiedIds.has(e.id)) continue
      notifiedIds.add(e.id)
      notify(e)
    }
  },
  { immediate: true }
)

/**
 * 弹单条 ElNotification —— 标题带错误码便于对照文档，正文遵循
 * F3 用户语义分层（userMessage 优先，dev 语义的 message 兜底），
 * 与默认容器 XFormErrorToastItem 的展示策略一致
 */
function notify(e: FormErrorEvent): void {
  ElNotification({
    title: `[${e.code}]`,
    message: e.userMessage ?? e.message,
    type: e.severity === 'error' ? 'error' : e.severity === 'warn' ? 'warning' : 'info',
    position: 'top-right',
    duration: 5000,
  })
}
</script>

<template>
  <span hidden aria-hidden="true" />
</template>
