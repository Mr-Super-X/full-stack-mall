<script setup lang="ts">
/**
 * XFormDebugBanner —— Dev-only debug banner
 *
 * 显示 schema 校验错误与安全扫描结果，浮动在右下角，可折叠；点 X 关闭整个 banner。
 *
 * 三态 viewState（2026-09-16 review 优化）：
 * 原来用两个 boolean ref（collapsed + dismissed），实际三态互斥。
 * 合并为单一 viewState: 'open' | 'collapsed' | 'dismissed'，响应式开销减半。
 *
 * 交互增强（2026-09-18 三视角审查 F5）：
 * - keyPath 序列化为 element-plus 风格路径（items[0].name），数字段用 [n] 下标，
 *   与 async-validator / ElForm 报错格式一致，降低跨工具排查的翻译成本
 * - 点击错误项 → emit('locate', path)，XForm 侧 scrollToField 滚到对应字段
 * - 「复制全部」按钮：一键复制纯文本错误清单到剪贴板（反馈 copied 1.5s）
 * - 色板走 EP CSS 变量（F6），暗色模式随主题切换
 *
 * @group XForm 组件
 */
import { computed, ref } from 'vue'

interface ValidationError {
  keyPath: (string | number)[]
  message: string
}

type ViewState = 'open' | 'collapsed' | 'dismissed'

const props = defineProps<{
  validateErrors: ValidationError[]
  forbiddenErrors: string[]
  /** asyncOptions 位于不支持位置（formItem.slots / array.itemSchema 内）的字段清单（仅 dev） */
  asyncOptionsWarnings?: string[]
}>()

const emit = defineEmits<{
  /** 点击错误项 —— path 为 EP 风格路径（如 items[0].name），供 scrollToField 定位 */
  locate: [path: string]
}>()

const viewState = ref<ViewState>('open')
/** 「复制全部」成功反馈 —— 1.5s 后复位 */
const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | undefined

const total = computed(
  () =>
    props.validateErrors.length +
    props.forbiddenErrors.length +
    (props.asyncOptionsWarnings?.length ?? 0)
)
const visible = computed(() => viewState.value !== 'dismissed' && total.value > 0)

/**
 * keyPath → element-plus 风格路径（F5）
 *
 * 与 async-validator 报错格式对齐：首段直出，数字段用 [n] 下标（数组下标），
 * 字符串段用 .name 连接；空路径显示 (root)。
 * 例：['items', 0, 'name'] → 'items[0].name'
 */
function formatKeyPath(keyPath: (string | number)[]): string {
  if (keyPath.length === 0) return '(root)'
  return keyPath.reduce<string>((acc, seg) => {
    if (typeof seg === 'number') return `${acc}[${seg}]`
    return acc === '' ? seg : `${acc}.${seg}`
  }, '')
}

/** 供模板渲染 EP 风格路径（key 保持 index 稳定，值预计算避免模板内重复拼接） */
const errorsWithPath = computed(() =>
  props.validateErrors.map((e) => ({ ...e, path: formatKeyPath(e.keyPath) }))
)

/** 纯文本错误清单 —— 复制到剪贴板的内容（每行一条：path: message） */
const plainTextReport = computed(() =>
  errorsWithPath.value.map((e) => `${e.path}: ${e.message}`).join('\n')
)

/**
 * 复制全部错误 —— clipboard API 优先，jsdom/非安全上下文无 API 时降级 execCommand；
 * 两者都失败仅 console.warn（dev 工具，不值得打断用户弹错误）
 */
async function copyAll(): Promise<void> {
  let ok = false
  try {
    await navigator.clipboard.writeText(plainTextReport.value)
    ok = true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = plainTextReport.value
      document.body.appendChild(ta)
      ta.select()
      ok = document.execCommand('copy')
      ta.remove()
    } catch (e) {
      console.warn('[XFormDebugBanner] 复制失败', e)
    }
  }
  if (!ok) return
  copied.value = true
  if (copiedTimer) clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => {
    copied.value = false
  }, 1500)
}

// 卸载清理 copied 复位 timer —— 防组件销毁后回调写入死 ref
onUnmounted(() => {
  if (copiedTimer) clearTimeout(copiedTimer)
})
</script>

<template>
  <Teleport to="body" v-if="visible">
    <div v-if="viewState === 'open'" :class="$style.panel" role="alert">
      <header :class="$style.header">
        <strong>XForm 调试面板（{{ total }} 项问题）</strong>
        <span :class="$style.actions">
          <button
            type="button"
            :class="$style.btn"
            :aria-label="copied ? '已复制' : '复制全部错误'"
            @click="copyAll"
          >
            {{ copied ? '✓ 已复制' : '复制全部' }}
          </button>
          <button type="button" :class="$style.btn" @click="viewState = 'collapsed'">收起</button>
          <button
            type="button"
            :class="$style.btn"
            aria-label="关闭"
            @click="viewState = 'dismissed'"
          >
            ×
          </button>
        </span>
      </header>
      <ul :class="$style.list">
        <!-- 可点击定位（F5）：点击项 → emit locate，XForm 侧 scrollToField -->
        <li
          v-for="(e, i) in errorsWithPath"
          :key="`v${i}`"
          :class="[$style.item, $style.clickable]"
          role="button"
          tabindex="0"
          :title="`点击定位到 ${e.path}`"
          @click="emit('locate', e.path)"
          @keydown.enter="emit('locate', e.path)"
        >
          <code>{{ e.path }}</code>
          : {{ e.message }}
        </li>
        <li v-for="(e, i) in forbiddenErrors" :key="`f${i}`" :class="$style.item">
          <code>{{ e }}</code>
        </li>
        <li v-for="(e, i) in asyncOptionsWarnings" :key="`a${i}`" :class="$style.item">
          ⚠ {{ e }}：asyncOptions 位于不支持的位置（formItem.slots / array.itemSchema
          内），请求不会发起
        </li>
      </ul>
    </div>
    <button
      v-else
      type="button"
      :class="$style.fab"
      :aria-label="`XForm 调试面板 ${total} 项问题`"
      @click="viewState = 'open'"
    >
      ⚠ XForm 调试 ({{ total }})
    </button>
  </Teleport>
</template>

<style module>
/* 色板走 EP warning 系 CSS 变量（F6）——暗色/自定义主题随 element-plus 切换 */
.panel {
  position: fixed;
  right: 16px;
  bottom: 16px;
  width: 480px;
  max-width: calc(100vw - 32px);
  max-height: 50vh;
  overflow: auto;
  background: var(--el-color-warning-light-9);
  border: 1px solid var(--el-color-warning-light-5);
  border-radius: 6px;
  box-shadow: var(--el-box-shadow);
  z-index: var(--z-index-debug-banner);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', monospace;
  font-size: 13px;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--el-color-warning-light-5);
  background: var(--el-color-warning-light-8);
}
.actions {
  display: flex;
  gap: 4px;
}
.btn {
  border: 1px solid var(--el-border-color);
  background: var(--el-bg-color);
  border-radius: 4px;
  padding: 2px 8px;
  cursor: pointer;
  font-size: 12px;
  color: var(--el-text-color-regular);
}
.btn:hover {
  background: var(--el-fill-color-light);
}
.list {
  margin: 0;
  padding: 8px 12px;
  list-style: none;
}
.item {
  padding: 4px 0;
  border-bottom: 1px dashed var(--el-color-warning-light-7);
  word-break: break-all;
  color: var(--el-text-color-primary);
}
.item:last-child {
  border-bottom: none;
}
.item code {
  background: var(--el-color-warning-light-8);
  padding: 1px 4px;
  border-radius: 2px;
  font-size: 12px;
  margin-right: 4px;
}
.clickable {
  cursor: pointer;
}
.clickable:hover {
  background: var(--el-color-warning-light-8);
}
.fab {
  position: fixed;
  right: 16px;
  bottom: 16px;
  background: var(--el-color-warning);
  color: var(--el-color-white);
  border: none;
  border-radius: 20px;
  padding: 8px 16px;
  font-size: 13px;
  cursor: pointer;
  box-shadow: var(--el-box-shadow);
  z-index: var(--z-index-debug-banner);
}
.fab:hover {
  background: var(--el-color-warning-dark-2);
}
</style>
