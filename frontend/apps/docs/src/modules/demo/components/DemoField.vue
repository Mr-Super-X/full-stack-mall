<script setup lang="ts">
/**
 * 单个示例的容器（对标 element-plus 官网演示风格）
 *
 * 布局：默认收起代码区——顶部"实例效果" + 底部工具栏（显示代码/复制），
 * 点"显示代码"展开高亮代码区。带平滑过渡（JS hooks 测量实际高度）。
 *
 * 渲染策略：v-show 保留 DOM，省去重复高亮的 CPU；Transition 配合 JS hooks
 * 设 max-height = scrollHeight，动画最自然。展开后 max-height 改 'none'
 * 适应长内容（不限制最大高度）。
 *
 * 安全：v-html 渲染 hljs 输出的 HTML。hljs 输出只含 span class，
 * demo 模块的代码源是项目自身 .vue 文件（受信任），不构成 XSS。
 */
import { DocumentCopy, Check, ArrowDown, ArrowUp } from '@element-plus/icons-vue'
import hljs from 'highlight.js/lib/core'
import xml from 'highlight.js/lib/languages/xml'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import css from 'highlight.js/lib/languages/css'
import scss from 'highlight.js/lib/languages/scss'
import 'highlight.js/styles/github.css'

hljs.registerLanguage('xml', xml)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('css', css)
hljs.registerLanguage('scss', scss)

type Language = 'xml' | 'javascript' | 'typescript' | 'css' | 'scss'

const props = defineProps<{
  /** 源码字符串（推荐用 Vite `?raw` 导入） */
  code: string
  /** 高亮语言（默认 xml，兼容 .vue 模板） */
  language?: Language
  /** 示例标题（渲染在示例区上方；不传则不渲染标题栏——兼容既有 demo 的纯 attrs 用法） */
  label?: string
}>()

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const highlighted = computed<string>(() => {
  try {
    return hljs.highlight(props.code, { language: props.language ?? 'xml' }).value
  } catch (err) {
    console.warn('[DemoField] 高亮失败，降级为原文:', err)
    return escapeHtml(props.code)
  }
})

// —— 展开/收起状态 ——
const expanded = ref(false)

function beforeEnter(el: Element) {
  if (el instanceof HTMLElement) {
    el.style.maxHeight = '0'
    el.style.opacity = '0'
  }
}
function enter(el: Element, done: () => void) {
  if (el instanceof HTMLElement) {
    el.style.maxHeight = el.scrollHeight + 'px'
    el.style.opacity = '1'
    el.addEventListener('transitionend', done, { once: true })
  } else {
    done()
  }
}
function afterEnter(el: Element) {
  // 展开后取消 max-height 限制，避免内容动态变化时（如字体加载完）被截断
  if (el instanceof HTMLElement) el.style.maxHeight = 'none'
}
function beforeLeave(el: Element) {
  // leave 钩子从 'none' 切到具体像素值，否则 transition 不生效
  if (el instanceof HTMLElement) el.style.maxHeight = el.scrollHeight + 'px'
}
function leave(el: Element, done: () => void) {
  if (el instanceof HTMLElement) {
    el.style.maxHeight = '0'
    el.style.opacity = '0'
    el.addEventListener('transitionend', done, { once: true })
  } else {
    done()
  }
}

// —— 复制反馈 ——
const copied = ref(false)
let resetTimer: ReturnType<typeof setTimeout> | null = null

async function copyCode() {
  try {
    await navigator.clipboard.writeText(props.code)
    copied.value = true
    if (resetTimer) clearTimeout(resetTimer)
    resetTimer = setTimeout(() => {
      copied.value = false
      resetTimer = null
    }, 2000)
  } catch (err) {
    console.warn('[DemoField] 复制失败，请手动选中复制:', err)
  }
}

const bem = createNamespace('demo-field')
</script>

<template>
  <div :class="bem.b()">
    <div v-if="label" :class="bem.e('label')">{{ label }}</div>

    <div v-if="$slots.default" :class="bem.e('demo')">
      <slot />
    </div>

    <div :class="bem.e('toolbar')">
      <el-button
        link
        size="small"
        :icon="expanded ? ArrowUp : ArrowDown"
        @click="expanded = !expanded"
      >
        {{ expanded ? '隐藏代码' : '显示代码' }}
      </el-button>
      <div :class="bem.e('spacer')" />
      <el-button link size="small" :icon="copied ? Check : DocumentCopy" @click="copyCode">
        {{ copied ? '已复制' : '复制' }}
      </el-button>
    </div>

    <Transition
      @before-enter="beforeEnter"
      @enter="enter"
      @after-enter="afterEnter"
      @before-leave="beforeLeave"
      @leave="leave"
    >
      <div v-show="expanded" :class="bem.e('code-wrap')">
        <pre :class="bem.e('pre')"><code v-html="highlighted" /></pre>
      </div>
    </Transition>
  </div>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-field {
  border: 1px solid var(--el-border-color-lighter, #ebeef5);
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
  margin-bottom: 20px;

  &__label {
    padding: 10px 16px;
    border-bottom: 1px solid var(--el-border-color-lighter, #ebeef5);
    background: #fff;
    font-size: 14px;
    font-weight: 600;
    color: var(--el-text-color-primary, #303133);
  }

  &__demo {
    padding: 16px;
  }

  &__toolbar {
    display: flex;
    align-items: center;
    padding: 6px 12px;
    border-top: 1px solid var(--el-border-color-lighter, #ebeef5);
    background: #fafafa;
  }

  &__spacer {
    flex: 1;
  }

  &__code-wrap {
    overflow: hidden;
    transition:
      max-height 0.3s ease,
      opacity 0.2s ease;
  }

  &__pre {
    margin: 0;
    padding: 12px 16px;
    background: #fafafa;
    border-top: 1px solid var(--el-border-color-lighter, #ebeef5);
    font-family: 'Fira Code', 'Cascadia Code', 'Consolas', 'Menlo', monospace;
    font-size: 12px;
    line-height: 1.6;
    color: #303133;
    overflow-x: auto;
    white-space: pre;
  }
}
</style>
