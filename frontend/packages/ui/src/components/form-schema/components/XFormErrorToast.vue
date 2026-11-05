<script setup lang="ts">
/**
 * XFormErrorToast —— user-facing 错误提示容器
 *
 * 渲染 XFormErrorEvent 列表为右上角浮窗 toast：
 * - 由 XForm 的 showErrorToast prop 控制（enabled=true 时渲染）——
 *   默认关闭、显式传参开启，与运行环境（dev/prod）无关
 * - 关闭时 errorBus 仍保留 console 留痕 + prod 上报点扩展位，仅可视化层不渲染
 *
 * 与 XFormDebugBanner 的区别：
 * - DebugBanner 聚焦 schema 校验错误 + 安全扫描（静态分析产物）
 * - ErrorToast 聚焦运行时错误（crossValidator 失败 / 表达式解析失败 / 组件名无效等）
 *
 * 体验层（2026-09-18 三视角审查 F4）：
 * - 自动消失：新 toast 7s 后自动 dismiss（用户不必逐条点 ×；error 常驻会堆积遮挡内容）
 * - TransitionGroup 进出过渡：slideIn / slideOut 对称，消除硬消失跳变
 * - 超量聚合：可见 toast 超过 MAX_INLINE 条后，其余聚合为一张「还有 N 条」卡片
 *   + 全部关闭按钮，避免长错误流把列表顶出屏幕
 *
 * a11y 决策（以代码为准）：
 * - 模板使用 `role="alert" aria-live="polite"`
 * - role="alert" 隐式 aria-live="assertive"，
 *   但显式声明的 aria-live="polite" 会**覆盖**默认值
 * - 采用 polite 让屏阅读器在当前朗读**停顿时**才播报新 toast，
 *   适合持续 toast 流（不会反复打断用户正在听的菜单项）
 * - 若业务希望"立即打断"，可通过 toastContainer slot 替换容器
 *
 * @group XForm 组件
 */
import type { FormErrorEvent } from '../composables/use-form-error-bus'
import XFormErrorToastItem from './XFormErrorToastItem.vue'
// computed / watch / onUnmounted 由 unplugin-auto-import 注入（CLAUDE.md §1.6）

const { events, enabled } = defineProps<{
  events: FormErrorEvent[]
  /** 是否启用可视化 —— 由 XForm 的 showErrorToast prop 控制（默认关闭） */
  enabled: boolean
}>()

const emit = defineEmits<{
  dismiss: [id: string]
  dismissAll: []
}>()

/** 可见 toast 直接渲染上限 —— 超出部分聚合为一张卡片（F4 超量聚合） */
const MAX_INLINE = 3
/** 自动消失时长 —— 7s 足够阅读一条错误详情，又不会在屏幕上长期占位（F4） */
const AUTO_DISMISS_MS = 7_000

/**
 * 未 dismiss 的事件 —— computed 缓存避免 v-for 内 filter 每次 patch 重复执行
 *
 * 短路优化：events 全部 dismissed 时直接返回同长度 0 数组,减少下游 v-for diff 成本
 */
const visibleEvents = computed(() =>
  events.some((e) => !e.dismissed) ? events.filter((e) => !e.dismissed) : []
)

/** 前 MAX_INLINE 条直接渲染；其余聚合数量交给尾部卡片 */
const inlineEvents = computed(() => visibleEvents.value.slice(0, MAX_INLINE))
const overflowCount = computed(() => Math.max(0, visibleEvents.value.length - MAX_INLINE))

/**
 * 自动消失定时器表 —— 新事件入列启动、手动 dismiss/组件卸载清理
 *
 * 以 id 为 key（而非数组下标），事件被 errorBus 物理移除后 id 不再出现，
 * watch 的 cleanup 无法覆盖「已启动但未触发」的定时器，故保留 Map 手动管理
 */
const autoTimers = new Map<string, ReturnType<typeof setTimeout>>()

/**
 * 新可见事件 → 7s 后自动 dismiss（F4）
 *
 * 同步对新增 id 建 timer、对消失 id 清 timer —— errorBus.dismiss 走外部
 * （用户点 × 或 dismissAll）后事件带 dismissed 标记仍在数组里，
 * visibleEvents 不再包含它，此处负责清掉它的 pending timer 防泄漏
 */
watch(
  () => visibleEvents.value.map((e) => e.id).join('|'),
  (_ids, _prev, onCleanup) => {
    const currentIds = new Set(visibleEvents.value.map((e) => e.id))
    // 清掉已不可见事件的 pending timer（手动 dismiss / 父组件移除场景）
    for (const [id, t] of autoTimers) {
      if (!currentIds.has(id)) {
        clearTimeout(t)
        autoTimers.delete(id)
      }
    }
    // 新增 id 建 timer（手动 dismiss 由 errorBus 改 dismissed 标记，timer 触发时
    // 再 dismiss 一次是幂等操作 —— dismissed 置 true + 重置 30s 清理窗口，无副作用）
    for (const e of visibleEvents.value) {
      if (!autoTimers.has(e.id)) {
        autoTimers.set(
          e.id,
          setTimeout(() => {
            autoTimers.delete(e.id)
            emit('dismiss', e.id)
          }, AUTO_DISMISS_MS)
        )
      }
    }
    onCleanup(() => {
      for (const t of autoTimers.values()) clearTimeout(t)
      autoTimers.clear()
    })
  },
  { immediate: true }
)

onUnmounted(() => {
  for (const t of autoTimers.values()) clearTimeout(t)
  autoTimers.clear()
})
</script>

<template>
  <!-- v-if 用 events.length（非 visibleEvents.length）保持原行为契约：
       测试要求「所有事件 dismissed=true 时 ul 仍渲染，仅无 li 子元素」 -->
  <Teleport to="body" v-if="enabled && events.length > 0">
    <TransitionGroup tag="ul" :class="$style.stack" role="alert" aria-live="polite" name="toast">
      <XFormErrorToastItem
        v-for="e in inlineEvents"
        :key="e.id"
        :event="e"
        @dismiss="emit('dismiss', $event)"
      />
      <!-- 超量聚合卡片（F4）：第 MAX_INLINE 条起不再逐条渲染，一张卡汇总 + 一键全关 -->
      <li v-if="overflowCount > 0" :class="[$style.toast, $style.overflow]" key="overflow">
        <div :class="$style.overflowBody">
          <strong>还有 {{ overflowCount }} 条错误</strong>
          <p :class="$style.overflowHint">
            共 {{ visibleEvents.length }} 条，点击查看调试面板定位详情
          </p>
        </div>
        <button type="button" :class="$style.closeAll" @click="emit('dismissAll')">全部关闭</button>
      </li>
    </TransitionGroup>
  </Teleport>
</template>

<style module>
.stack {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: var(--z-index-debug-toast);
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 420px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
/* TransitionGroup 进出过渡（F4）——与 ToastItem 的 slideIn keyframes 对称 */
.stack :global(.toast-enter-active) {
  transition:
    opacity 180ms ease-out,
    transform 180ms ease-out;
}
.stack :global(.toast-leave-active) {
  transition:
    opacity 180ms ease-in,
    transform 180ms ease-in;
}
.stack :global(.toast-enter-from),
.stack :global(.toast-leave-to) {
  opacity: 0;
  transform: translateX(20px);
}
/* 聚合卡片与 toast 项同风格的容器底（F4）——色板走 EP 变量（F6） */
.overflow {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  background: var(--el-bg-color);
  border-left: 3px solid var(--el-color-warning);
  border-radius: 6px;
  box-shadow: var(--el-box-shadow);
  font-size: 13px;
  line-height: 1.5;
}
.overflowBody {
  flex: 1;
  min-width: 0;
}
.overflowBody strong {
  color: var(--el-text-color-primary);
}
.overflowHint {
  margin: 2px 0 0;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
.closeAll {
  flex-shrink: 0;
  border: 1px solid var(--el-border-color);
  background: var(--el-bg-color);
  color: var(--el-text-color-regular);
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
}
.closeAll:hover {
  background: var(--el-fill-color-light);
}
</style>
