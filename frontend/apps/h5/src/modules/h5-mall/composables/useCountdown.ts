// ref / onScopeDispose 由 unplugin-auto-import 注入 setup 全局作用域（CLAUDE.md §1.6）

/**
 * 限时甄选倒计时：指向每日 targetHour 点（默认 22:00），当前时刻已过则指向次日。
 *
 * 返回格式化串 `HH:MM:SS`；组件卸载时自动清理 interval。
 *
 * @param targetHour 每日截止小时（0–23，默认 22）
 * @returns remaining 响应式倒计时文本
 */
export function useCountdown(targetHour = 22): { remaining: Ref<string> } {
  const remaining = ref('--:--:--')

  const pad = (n: number): string => (n < 10 ? `0${n}` : `${n}`)

  /** 由 now 推出下一个截止时刻（今日 targetHour 已过则取明日） */
  function nextEnd(now: Date): Date {
    const end = new Date(now)
    end.setHours(targetHour, 0, 0, 0)
    if (now.getTime() > end.getTime()) end.setDate(end.getDate() + 1)
    return end
  }

  function tick(): void {
    const now = new Date()
    const seconds = Math.max(0, Math.floor((nextEnd(now).getTime() - now.getTime()) / 1000))
    remaining.value = `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`
  }

  tick()
  const timer = setInterval(tick, 1000)
  onScopeDispose(() => clearInterval(timer))

  return { remaining }
}
