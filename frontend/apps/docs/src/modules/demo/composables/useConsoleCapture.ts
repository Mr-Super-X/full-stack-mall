/**
 * useConsoleCapture —— 在组件生命周期内捕获 console.error / console.warn
 *
 * 应用场景：错误诊断 demo 让用户能"在页面上"看到 XForm 触发的警告，不必打开 DevTools
 *
 * 设计原则：
 * - **同步 hook**（关键）：hook 必须在 setup 函数体同步执行，**不依赖 onMounted**
 *   - 原因：XForm 在 `useXFormComposer` 的 `watch(props.schema, ..., { immediate: true })`
 *     同步触发 schema 校验，子组件 setup 阶段立即调 `console.warn('[XForm]...')`；
 *     如果 hook 装在 onMounted，会晚于子组件 setup（父 mounted 是最后一步），错过早期日志。
 *   - 同步 hook 确保父组件 setup 完成后到子组件 setup 之间 console 已被接管。
 * - **onUnmounted 还原**：避免污染全局 console（多个 demo 同时挂载时链式还原仍然正确——每次 hook 保存"当前 console"作为自己的 original）
 * - **上限**：内存保留最近 50 条（FIFO），单条 500 字截断（防内存爆 / 防页面卡顿）
 * - **过滤**：可选 prefix 仅捕获包含此前缀的日志（XForm 内部统一以 "[XForm]" 起头）
 * - **单一职责**：只捕获 + 暴露数据，渲染由调用方决定（用 ConsoleLogPanel）
 *
 * 使用：
 * ```ts
 * const { logs, clear } = useConsoleCapture('[XForm]')
 * ```
 */
// onUnmounted / ref 由 unplugin-auto-import 注入（§1.6）；类型 Ref 须显式 type import
import type { Ref } from 'vue'

export interface CapturedLog {
  level: 'error' | 'warn'
  message: string
  timestamp: number
}

const MAX_LOGS = 50
const MAX_MSG_LENGTH = 500

export interface UseConsoleCaptureReturn {
  /** reactive 日志数组，按时间顺序（FIFO 丢弃超出） */
  logs: Ref<CapturedLog[]>
  /** 清空 logs */
  clear: () => void
}

export function useConsoleCapture(prefix?: string): UseConsoleCaptureReturn {
  const logs = ref<CapturedLog[]>([])

  // 同步 hook：必须在 setup 函数体内同步执行（在 Vue 生命周期之前完成 console 接管）
  // 闭包内保存当前 console 引用作为自己的 original（链式 hook 时还原到调用前的版本）
  const originalError = console.error.bind(console)
  const originalWarn = console.warn.bind(console)

  function stringify(v: unknown): string {
    if (typeof v === 'string') return v
    if (v instanceof Error) return v.message
    try {
      return JSON.stringify(v) ?? String(v)
    } catch {
      return String(v)
    }
  }

  function capture(level: 'error' | 'warn', ...args: unknown[]): void {
    const message = args.map(stringify).join(' ')
    if (prefix && !message.includes(prefix)) return

    const truncated =
      message.length > MAX_MSG_LENGTH ? `${message.slice(0, MAX_MSG_LENGTH)}...[已截断]` : message

    logs.value.push({ level, message: truncated, timestamp: Date.now() })
    if (logs.value.length > MAX_LOGS) {
      logs.value.splice(0, logs.value.length - MAX_LOGS)
    }
  }

  // 同步接管 console（不放在 onMounted——那会晚于子组件 setup）
  console.error = (...args: unknown[]) => {
    capture('error', ...args)
    originalError(...args)
  }
  console.warn = (...args: unknown[]) => {
    capture('warn', ...args)
    originalWarn(...args)
  }

  onUnmounted(() => {
    // 还原到自己保存的 original（链式 hook 时会还原到上一个 hook 版本）
    console.error = originalError
    console.warn = originalWarn
  })

  function clear(): void {
    logs.value = []
  }

  return { logs, clear }
}
