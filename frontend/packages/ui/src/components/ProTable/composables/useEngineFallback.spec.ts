/**
 * useEngineFallback 单元测试
 *
 * 覆盖矩阵（v3.0.3 新增 composable）：
 * - 默认状态：effectiveEngine === initialEngine
 * - 触发回退后：effectiveEngine === 'element-plus'（即便 initialEngine 后续被改也不变）
 * - 幂等性：第二次调用不重复 warn / onFallback
 * - 自定义 reason 字符串透传给 warn + onFallback
 * - 自定义 warn 注入（测试用 spy 替代 console.warn）
 * - onFallback 回调同步触发
 * - console.warn 兜底（无 warn 参数时用 console.warn）
 *
 * @group ProTable composables
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { useEngineFallback } from './useEngineFallback'

describe('useEngineFallback', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('初始 effectiveEngine 等于 initialEngine', () => {
    const engineRef = ref<'element-plus' | 'vxe-table'>('vxe-table')
    const { effectiveEngine } = useEngineFallback({ initialEngine: engineRef })
    expect(effectiveEngine.value).toBe('vxe-table')
  })

  it('调用 handleEngineFallback 后 effectiveEngine 切到 element-plus', () => {
    const engineRef = ref<'element-plus' | 'vxe-table'>('vxe-table')
    const { effectiveEngine, handleEngineFallback } = useEngineFallback({
      initialEngine: engineRef,
    })
    handleEngineFallback()
    expect(effectiveEngine.value).toBe('element-plus')
  })

  it('initialEngine 后续变化不会覆盖已回退的 effectiveEngine（fallbackEngineRef 优先）', () => {
    const engineRef = ref<'element-plus' | 'vxe-table'>('vxe-table')
    const { effectiveEngine, handleEngineFallback } = useEngineFallback({
      initialEngine: engineRef,
    })
    handleEngineFallback()
    // 即使 initialEngine 后被外部改回 vxe-table，effectiveEngine 仍锁定为 element-plus
    engineRef.value = 'vxe-table'
    expect(effectiveEngine.value).toBe('element-plus')
  })

  it('未回退时 initialEngine 变化 → effectiveEngine 跟踪（computed 派生）', () => {
    const engineRef = ref<'element-plus' | 'vxe-table'>('vxe-table')
    const { effectiveEngine } = useEngineFallback({ initialEngine: engineRef })
    expect(effectiveEngine.value).toBe('vxe-table')
    engineRef.value = 'element-plus'
    expect(effectiveEngine.value).toBe('element-plus')
  })

  it('handleEngineFallback 默认 reason 走 DEFAULT_FALLBACK_REASON', () => {
    const engineRef = ref<'element-plus' | 'vxe-table'>('vxe-table')
    const onFallback = vi.fn()
    const { handleEngineFallback } = useEngineFallback({
      initialEngine: engineRef,
      onFallback,
    })
    handleEngineFallback()
    expect(onFallback).toHaveBeenCalledTimes(1)
    expect(onFallback).toHaveBeenCalledWith('vxe-table 模块加载失败，已自动回退 element-plus 引擎')
  })

  it('handleEngineFallback 接受自定义 reason 透传', () => {
    const engineRef = ref<'element-plus' | 'vxe-table'>('vxe-table')
    const onFallback = vi.fn()
    const warn = vi.fn()
    const { handleEngineFallback } = useEngineFallback({
      initialEngine: engineRef,
      onFallback,
      warn,
    })
    handleEngineFallback('自定义失败原因：网络超时')
    expect(warn).toHaveBeenCalledWith('[ProTable] 自定义失败原因：网络超时')
    expect(onFallback).toHaveBeenCalledWith('自定义失败原因：网络超时')
  })

  it('幂等性：第二次调用 handleEngineFallback 不重复 warn/onFallback', () => {
    const engineRef = ref<'element-plus' | 'vxe-table'>('vxe-table')
    const onFallback = vi.fn()
    const warn = vi.fn()
    const { handleEngineFallback } = useEngineFallback({
      initialEngine: engineRef,
      onFallback,
      warn,
    })
    handleEngineFallback()
    handleEngineFallback()
    handleEngineFallback()
    expect(onFallback).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('未传 warn 时使用 console.warn 兜底', () => {
    const engineRef = ref<'element-plus' | 'vxe-table'>('vxe-table')
    const { handleEngineFallback } = useEngineFallback({ initialEngine: engineRef })
    handleEngineFallback('测试兜底')
    expect(console.warn).toHaveBeenCalledTimes(1)
    expect(console.warn).toHaveBeenCalledWith('[ProTable] 测试兜底')
  })

  it('未传 onFallback 时不抛错', () => {
    const engineRef = ref<'element-plus' | 'vxe-table'>('vxe-table')
    const warn = vi.fn()
    const { handleEngineFallback } = useEngineFallback({ initialEngine: engineRef, warn })
    expect(() => handleEngineFallback()).not.toThrow()
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('engineRef 默认值 element-plus + handleEngineFallback 后保持 element-plus', () => {
    // 边界：初始就是 element-plus 时，回退调用后 effectiveEngine 仍为 element-plus（幂等保护自然满足）
    const engineRef = ref<'element-plus' | 'vxe-table'>('element-plus')
    const onFallback = vi.fn()
    const warn = vi.fn()
    const { effectiveEngine, handleEngineFallback } = useEngineFallback({
      initialEngine: engineRef,
      onFallback,
      warn,
    })
    handleEngineFallback()
    expect(effectiveEngine.value).toBe('element-plus')
    expect(onFallback).toHaveBeenCalledTimes(1) // 仍触发一次（业务上有可能是从 vxe 动态切换后回退）
  })
})
