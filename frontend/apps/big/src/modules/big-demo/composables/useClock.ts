/**
 * 大屏标题栏实时时钟（1s 步进，格式 YYYY-MM-DD HH:mm:ss）。
 *
 * 1920 标准页与 9000 超宽页共用（两份重复代码收敛于此）。
 * 用 onScopeDispose 而非 onUnmounted：绑定 effect scope，组件卸载自动清理，
 * 且 composable 可在单测的 effectScope() 中直接验证清理行为。
 *
 * @group 业务模块：BigDemo
 */
// onScopeDispose / readonly / ref 由 unplugin-auto-import 注入（§1.6）；类型 Ref 须显式 type import
import type { Ref } from 'vue'
import { dayjs } from '@vv/shared'

const CLOCK_FORMAT = 'YYYY-MM-DD HH:mm:ss'

/** 实时时钟：返回只读时间字符串 ref，scope 销毁时停止步进 */
export function useClock(): Readonly<Ref<string>> {
  const clock = ref(dayjs().format(CLOCK_FORMAT))
  const timer = setInterval(() => {
    clock.value = dayjs().format(CLOCK_FORMAT)
  }, 1000)
  onScopeDispose(() => clearInterval(timer))
  return readonly(clock)
}
