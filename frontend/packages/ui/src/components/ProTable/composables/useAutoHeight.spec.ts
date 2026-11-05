/**
 * useAutoHeight 单元测试 —— v3.1 表格区自适应视口高度
 *
 * 覆盖矩阵：
 * - 未启用：maxHeight 恒 null（不绑定 ElTable prop）
 * - 启用：mounted 后首测（nextTick）按算法计算 maxHeight
 * - 算法：视口高 - 根容器 top - 搜索区 - 工具栏 - 分页器 - 固定间距 - offset
 * - window resize 触发重算
 * - 极端窄视口：maxHeight 钳制下限（MIN_TABLE_HEIGHT）
 * - jsdom 无 ResizeObserver：守卫路径不抛错（window resize 监听仍生效）
 *
 * @group ProTable composables
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref, nextTick, effectScope } from 'vue'
import { useAutoHeight } from './useAutoHeight'

/**
 * 构造 mock 根容器：getBoundingClientRect + 按选择器返回子区域高度。
 * childCount：2026-09-18 review 后间距按 root 实际渲染子元素数动态算，
 * 夹具须显式声明（默认 4 = search/header/AsyncState/pagination 四区域三间距 → 36px）
 */
function mockRoot(top: number, heights: Record<string, number>, childCount = 4): HTMLElement {
  const els = new Map<string, HTMLElement>()
  for (const [selector, height] of Object.entries(heights)) {
    els.set(selector, { getBoundingClientRect: () => ({ height }) } as unknown as HTMLElement)
  }
  return {
    getBoundingClientRect: () => ({ top, height: 0 }),
    querySelector: (sel: string) => els.get(sel) ?? null,
    childElementCount: childCount,
  } as unknown as HTMLElement
}

/** innerHeight 可写化（jsdom 默认 768，测试需要精确控制视口高） */
function stubInnerHeight(value: number): void {
  Object.defineProperty(window, 'innerHeight', { value, configurable: true })
}

function withScope<T>(fn: () => T): { result: T; dispose: () => void } {
  const scope = effectScope()
  const result = scope.run(fn)!
  return { result, dispose: () => scope.stop() }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useAutoHeight', () => {
  it('未启用：maxHeight 恒 null', () => {
    const { result, dispose } = withScope(() =>
      useAutoHeight({ enabled: false, rootEl: ref(mockRoot(100, {})) })
    )
    expect(result.maxHeight.value).toBeNull()
    dispose()
  })

  it('启用：首测计算 maxHeight（算法：视口 - top - 子区域 - 固定间距 - offset）', async () => {
    stubInnerHeight(900)
    // v3.1.4 review：选择器由编排层注入，测试同步改用 selectors 选项
    // （与生产路径一致，避免测试与生产双份 BEM 字符串漂移）
    const root = mockRoot(100, {
      '.vv-pro-table-search': 60,
      '.vv-pro-table-header': 40,
      '.el-pagination': 32,
    })
    const { result, dispose } = withScope(() =>
      useAutoHeight({
        enabled: true,
        rootEl: ref(root),
        offset: 10,
        selectors: {
          search: '.vv-pro-table-search',
          header: '.vv-pro-table-header',
        },
      })
    )
    await nextTick()
    // 900 - 100 - 60 - 40 - 32 - 36(固定间距) - 10(offset) = 622
    expect(result.maxHeight.value).toBe(622)
    dispose()
  })

  it('v3.1.4：未传 selectors.search 时搜索区高度按 0 算（无静默默认字符串）', async () => {
    stubInnerHeight(900)
    const root = mockRoot(100, { '.el-pagination': 32 })
    const { result, dispose } = withScope(() =>
      useAutoHeight({
        enabled: true,
        rootEl: ref(root),
        selectors: { header: '.vv-pro-table-header' },
      })
    )
    await nextTick()
    // 900 - 100 - 0(未传 search) - 0(mockRoot 没 header) - 32 - 36 = 732
    expect(result.maxHeight.value).toBe(732)
    dispose()
  })

  it('window resize 触发重算', async () => {
    stubInnerHeight(900)
    const root = mockRoot(100, {})
    const { result, dispose } = withScope(() => useAutoHeight({ enabled: true, rootEl: ref(root) }))
    await nextTick()
    expect(result.maxHeight.value).toBe(900 - 100 - 36)
    stubInnerHeight(700)
    window.dispatchEvent(new Event('resize'))
    await nextTick()
    expect(result.maxHeight.value).toBe(700 - 100 - 36)
    dispose()
  })

  it('极端窄视口：maxHeight 钳制下限 100', async () => {
    stubInnerHeight(150)
    const root = mockRoot(100, {})
    const { result, dispose } = withScope(() => useAutoHeight({ enabled: true, rootEl: ref(root) }))
    await nextTick()
    // 150 - 100 - 36 = 14 → 钳制到 100
    expect(result.maxHeight.value).toBe(100)
    dispose()
  })

  it('未挂载（rootEl null）：不抛错，maxHeight 保持 null', async () => {
    stubInnerHeight(900)
    const { result, dispose } = withScope(() => useAutoHeight({ enabled: true, rootEl: ref(null) }))
    await nextTick()
    expect(result.maxHeight.value).toBeNull()
    window.dispatchEvent(new Event('resize'))
    await nextTick()
    expect(result.maxHeight.value).toBeNull()
    dispose()
  })

  it('jsdom 无 ResizeObserver：守卫路径不抛错', () => {
    stubInnerHeight(900)
    const root = mockRoot(0, {})
    // jsdom 默认不提供 ResizeObserver —— enabled 分支 typeof 守卫应直接跳过
    expect(() =>
      withScope(() => useAutoHeight({ enabled: true, rootEl: ref(root) })).dispose()
    ).not.toThrow()
  })

  it('scope dispose 移除 window resize 监听', async () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    stubInnerHeight(900)
    const { result, dispose } = withScope(() =>
      useAutoHeight({ enabled: true, rootEl: ref(mockRoot(0, {})) })
    )
    await nextTick()
    dispose()
    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function))
    expect(result.maxHeight.value).not.toBeNull()
  })
})
