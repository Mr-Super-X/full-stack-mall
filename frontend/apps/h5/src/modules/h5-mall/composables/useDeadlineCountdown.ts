// ref / onScopeDispose 由 unplugin-auto-import 注入 setup 全局作用域（CLAUDE.md §1.6）

/**
 * 指向任意目标时刻的倒计时（秒杀场结束/开始时间用）。
 *
 * 与 useCountdown（每日固定时点滚动）互补：本组合式面向「具体某一刻」，
 * 归零后 ended=true 并保持 00:00:00，由视图禁用按钮/切换文案。
 *
 * @param target 目标时刻（Date 或 ISO 字符串）
 * @returns remaining `HH:MM:SS` 响应式文本；ended 是否已过期
 */
export function useDeadlineCountdown(target: Date | string): {
  remaining: Ref<string>
  ended: Ref<boolean>
} {
  const remaining = ref('--:--:--')
  const ended = ref(false)
  const targetTime = new Date(target).getTime()

  const pad = (n: number): string => (n < 10 ? `0${n}` : `${n}`)

  function tick(): void {
    const seconds = Math.max(0, Math.floor((targetTime - Date.now()) / 1000))
    ended.value = seconds === 0
    remaining.value = `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`
  }

  tick()
  const timer = setInterval(tick, 1000)
  onScopeDispose(() => clearInterval(timer))

  return { remaining, ended }
}
