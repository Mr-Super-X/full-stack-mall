<script setup lang="ts">
/**
 * XFormErrorToastItem —— 单条错误 toast 卡片
 *
 * 纯展示组件（props.event + emits.dismiss），无状态。
 * 值格式化抽离到 utils/format-error-value.ts 以便单测与复用。
 *
 * 优化（2026-09-16 review）：details 的值元数据（display/tooltip）经 computed 预计算，
 * 原模板在 :title 与插值处各调一次 getValueMeta —— 同一值重复 JSON.stringify。
 * 现 display/tooltip 共享同一 ValueMeta，兑现「同一对象只 stringify 一次」的约定。
 *
 * 用户语义分层（2026-09-18 三视角审查 F3）：SCHEMA_VALIDATE_FAILED 这类 code 与
 * @source 对终端用户零信息价值 —— 标题主体改为 userMessage ?? message；
 * code/source 仅 dev（import.meta.env.DEV）以弱化 meta 行呈现，prod 完全不渲染。
 * 色板同步 EP CSS 变量（F6），暗色模式随主题自动切换。
 *
 * @group XForm 组件
 */
import type { FormErrorEvent, FormErrorSeverity } from '../composables/use-form-error-bus'
import { getValueMeta, type ValueMeta } from '../utils/format-error-value'
// computed 由 unplugin-auto-import 注入（CLAUDE.md §1.6）

const props = defineProps<{
  event: FormErrorEvent
}>()

const emit = defineEmits<{
  dismiss: [id: string]
}>()

/** 严重等级 → 图标查表 —— 比 switch 更纯，值命中 */
const SEVERITY_ICONS: Readonly<Record<FormErrorSeverity, string>> = {
  error: '✕',
  warn: '⚠',
  info: 'ℹ',
}

/** toast 标题主体 —— 用户语义优先（F3），dev 语义 message 兜底 */
const headline = computed(() => props.event.userMessage ?? props.event.message)

/**
 * dev 标记 —— 模板表达式不支持 import.meta（SFC parser sourceType 限制），
 * script 取值后供模板 v-if 使用：code/source meta 行仅 dev 渲染（F3）
 */
const isDev = import.meta.env.DEV

/**
 * details + 值元数据预计算 —— 每次 events 变化仅序列化一次
 *
 * meta 为 undefined 表示该 detail 无 value 字段（与原模板 v-if="d.value !== undefined" 判定一致）
 */
interface DetailWithMeta {
  field: string
  message: string
  meta: ValueMeta | undefined
}

const detailsWithMeta = computed<DetailWithMeta[]>(() =>
  (props.event.details ?? []).map((d) => ({
    field: d.field,
    message: d.message,
    meta: d.value !== undefined ? getValueMeta(d.value) : undefined,
  }))
)
</script>

<template>
  <li :class="[$style.toast, $style[event.severity]]">
    <span :class="$style.icon" aria-hidden="true">{{ SEVERITY_ICONS[event.severity] }}</span>
    <div :class="$style.body">
      <header :class="$style.title">
        <span :class="$style.message">{{ headline }}</span>
      </header>
      <ul v-if="detailsWithMeta.length" :class="$style.detailList">
        <!-- d.field 在 schema 校验中唯一，作为 :key 比 index 更稳定 -->
        <li v-for="(d, i) in detailsWithMeta" :key="d.field ?? i" :class="$style.detailItem">
          <code :class="$style.detailField">{{ d.field }}</code>
          <span :class="$style.detailMsg">{{ d.message }}</span>
          <span v-if="d.meta" :class="$style.detailValue" :title="`字段当前值：${d.meta.tooltip}`">
            = {{ d.meta.display }}
          </span>
        </li>
      </ul>
      <p v-else-if="event.fields?.length" :class="$style.fields">
        字段：
        <code v-for="f in event.fields" :key="f">{{ f }}</code>
      </p>
      <!-- dev-only meta：code/source 服务排错而非终端用户（F3），prod 零渲染 -->
      <p v-if="isDev" :class="$style.meta">
        <code :class="$style.code">{{ event.code }}</code>
        <span v-if="event.source" :class="$style.source">@{{ event.source }}</span>
      </p>
    </div>
    <button
      type="button"
      :class="$style.close"
      :aria-label="`关闭 ${event.code}`"
      @click="emit('dismiss', event.id)"
    >
      ×
    </button>
  </li>
</template>

<style module>
/* 色板全部走 EP CSS 变量（F6）——暗色/自定义主题随 element-plus 自动切换 */
.toast {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  background: var(--el-bg-color);
  border-radius: 6px;
  box-shadow: var(--el-box-shadow);
  font-size: 13px;
  line-height: 1.5;
  animation: slideIn 180ms ease-out;
}
.error {
  border-left: 3px solid var(--el-color-danger);
}
.warn {
  border-left: 3px solid var(--el-color-warning);
}
.info {
  border-left: 3px solid var(--el-color-primary);
}
.icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: var(--el-color-white);
}
.error .icon {
  background: var(--el-color-danger);
}
.warn .icon {
  background: var(--el-color-warning);
}
.info .icon {
  background: var(--el-color-primary);
}
.body {
  flex: 1;
  min-width: 0;
}
.title {
  margin: 0 0 4px;
}
.message {
  margin: 0;
  color: var(--el-text-color-primary);
  word-break: break-word;
}
.meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 6px 0 0;
}
.code {
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 11px;
  padding: 1px 5px;
  background: var(--el-fill-color-light);
  border-radius: 3px;
  color: var(--el-text-color-secondary);
}
.source {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
.fields {
  margin: 4px 0 0;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
.fields code {
  background: var(--el-fill-color-lighter);
  padding: 1px 4px;
  border-radius: 3px;
  margin-right: 4px;
  font-family: ui-monospace, SFMono-Regular, monospace;
}
.detailList {
  margin: 6px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.detailItem {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 12px;
  line-height: 1.4;
  flex-wrap: wrap;
}
.detailField {
  background: var(--el-fill-color-lighter);
  padding: 1px 5px;
  border-radius: 3px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}
.detailMsg {
  color: var(--el-text-color-primary);
  word-break: break-word;
  flex: 1;
  min-width: 0;
}
.detailValue {
  color: var(--el-text-color-placeholder);
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 11px;
  background: var(--el-fill-color-light);
  padding: 1px 4px;
  border-radius: 3px;
  cursor: help;
  flex-shrink: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.close {
  flex-shrink: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--el-text-color-placeholder);
  font-size: 18px;
  line-height: 1;
  padding: 0 4px;
  border-radius: 3px;
}
.close:hover {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
}
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
</style>
