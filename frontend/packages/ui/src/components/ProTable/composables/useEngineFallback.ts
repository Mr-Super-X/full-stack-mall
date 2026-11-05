/**
 * useEngineFallback —— 引擎回退状态管理（v3.0.3 新增）
 *
 * 背景：vxe-table 引擎在 setup 阶段被锁定（resolveEngine 一次性解析），但 vxe
 * 模块是动态加载（import()），加载失败时需要在运行时回退到 element-plus。
 * 这与"setup 锁定"语义冲突 —— 解决方案是把回退态从 engineRef 抽出来，
 * 用一个独立的 fallbackEngineRef 标记回退后的引擎，覆盖初始 engineRef。
 *
 * 同时承担：
 * - 兜底 UI 提示（console.warn）
 * - emit 通知父组件（通过 onFallback 回调，避免 composable 依赖组件实例）
 * - 单元测试（纯逻辑，无 view 依赖）
 *
 * @see [`../adapters/engine`](../adapters/engine.ts) 引擎工厂
 * @group ProTable composables
 */
import { computed, ref, type Ref } from 'vue'
import type { TableEngine } from '../types'

export interface UseEngineFallbackOptions {
  /** 初始引擎（来自 resolveEngine） */
  initialEngine: Ref<TableEngine>
  /** 回退回调（emit engine-fallback 给父组件） */
  onFallback?: (reason: string) => void
  /** 自定义 warn 输出（测试时可注入 spy；默认 console.warn） */
  warn?: (message: string) => void
}

export interface UseEngineFallbackReturn {
  /** 当前生效引擎（fallback 后切到 element-plus） */
  effectiveEngine: Ref<TableEngine>
  /** 触发回退的 handler（绑定到子组件 @engine-fallback） */
  handleEngineFallback: (reason?: string) => void
}

const DEFAULT_FALLBACK_REASON = 'vxe-table 模块加载失败，已自动回退 element-plus 引擎'

/**
 * 工厂函数。命名 export 而非 default export —— 与项目其他 composable 风格一致，
 * 便于 IDE 跳转 + 自动导入（unplugin-auto-import 已配 @/composables/*）。
 */
export function useEngineFallback(opts: UseEngineFallbackOptions): UseEngineFallbackReturn {
  const { initialEngine, onFallback, warn = console.warn } = opts

  /** 回退标记：null 表示未回退，非 null 表示已切到该引擎 */
  const fallbackEngineRef = ref<TableEngine | null>(null)

  /** 当前生效引擎 —— fallback 标记优先 */
  const effectiveEngine = computed<TableEngine>(
    () => fallbackEngineRef.value ?? initialEngine.value
  )

  /**
   * 触发回退：标记 fallbackEngineRef、emit、warn 兜底。
   * 调用幂等：第二次调用不重复 warn/emit（防父组件 mount/unmount 抖动场景）。
   */
  function handleEngineFallback(reason: string = DEFAULT_FALLBACK_REASON): void {
    if (fallbackEngineRef.value === 'element-plus') return
    fallbackEngineRef.value = 'element-plus'
    warn(`[ProTable] ${reason}`)
    onFallback?.(reason)
  }

  return {
    effectiveEngine,
    handleEngineFallback,
  }
}
