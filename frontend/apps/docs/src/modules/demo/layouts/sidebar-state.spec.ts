/**
 * sidebar-state 单元测试
 * 覆盖：模块初始读取 Local / 非法值兜底 / watch 写回 / 拖拽高频写 debounce 合并
 *
 * 注意：sidebar-state.ts 是模块级单例（注册即写 watch），
 * 每个 case 用 vi.resetModules 重置模块缓存再 import，保证 watch 实例干净
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

beforeEach(() => {
  // 清掉 storage 避免跨用例污染 + 模块单例残留
  window.localStorage.clear()
  window.sessionStorage.clear()
  vi.resetModules()
  vi.useRealTimers()
})

afterEach(() => {
  vi.useRealTimers()
  window.localStorage.clear()
  window.sessionStorage.clear()
})

/** 动态 import（必须用 await import 路径字符串才能触发 vi.resetModules 的重加载） */
async function importFresh(): Promise<typeof import('./sidebar-state')> {
  return import('./sidebar-state')
}

// 文件级 timeout 15000（默认 5000）：本 spec 经 vi.resetModules + 动态 import 每用例重评估
// import 图——turbo 全量/系统高负载下 vite-node 转换缓存冷启动可击穿 5s 阈值（2026-10-26 与
// 2026-10-29 两次全量跑偶发单例超时、单跑必过，属负载竞态非逻辑回归）。重评估量级小
// （@vv/shared/utils 轻量具名子路径），15s 上限不改变测试语义
describe('sidebar-state（持久化升级版）', () => {
  it('初始读取：Local 有合法数字时直接采用', async () => {
    window.localStorage.setItem(
      (import.meta.env.VITE_STORAGE_NAMESPACE || 'vue3-vite-project') + ':demo-sidebar-width',
      JSON.stringify(280)
    )
    const { sidebarWidth } = await importFresh()
    expect(sidebarWidth.value).toBe(280)
  })

  it('初始读取：Local 无值时兜底默认值 200', async () => {
    const { sidebarWidth } = await importFresh()
    expect(sidebarWidth.value).toBe(200)
  })

  it('初始读取：Local 值为字符串时兜底默认值（防止脏数据崩组件）', async () => {
    window.localStorage.setItem(
      (import.meta.env.VITE_STORAGE_NAMESPACE || 'vue3-vite-project') + ':demo-sidebar-width',
      JSON.stringify('not-a-number')
    )
    const { sidebarWidth } = await importFresh()
    expect(sidebarWidth.value).toBe(200)
  })

  it('初始读取：Local 值为 null 时兜底默认值', async () => {
    window.localStorage.setItem(
      (import.meta.env.VITE_STORAGE_NAMESPACE || 'vue3-vite-project') + ':demo-sidebar-width',
      'null'
    )
    const { sidebarWidth } = await importFresh()
    expect(sidebarWidth.value).toBe(200)
  })

  it('初始读取：Local 值为浮点数时四舍五入', async () => {
    window.localStorage.setItem(
      (import.meta.env.VITE_STORAGE_NAMESPACE || 'vue3-vite-project') + ':demo-sidebar-width',
      JSON.stringify(287.6)
    )
    const { sidebarWidth } = await importFresh()
    expect(sidebarWidth.value).toBe(288)
  })

  it('watch 触发写回：sidebarWidth 变化后 debounce 写 Local', async () => {
    const { sidebarWidth } = await importFresh()
    expect(sidebarWidth.value).toBe(200) // 初始 default
    vi.useFakeTimers()
    sidebarWidth.value = 250
    await nextTick()
    // debounce 期内未写
    expect(
      window.localStorage.getItem(
        (import.meta.env.VITE_STORAGE_NAMESPACE || 'vue3-vite-project') + ':demo-sidebar-width'
      )
    ).toBeNull()
    // 推进 300ms 触发写回
    vi.advanceTimersByTime(300)
    expect(
      JSON.parse(
        window.localStorage.getItem(
          (import.meta.env.VITE_STORAGE_NAMESPACE || 'vue3-vite-project') + ':demo-sidebar-width'
        )!
      )
    ).toBe(250)
  })

  it('拖拽高频写 debounce 合并：连续修改只写最后一次', async () => {
    const { sidebarWidth } = await importFresh()
    vi.useFakeTimers()
    // 模拟拖拽 mousemove 连续触发：250（t=0）→ 260（t=100）→ 280（t=200）
    // 每次修改 clearTimeout 重置 300ms 阈值，最终在 t=500 落盘
    sidebarWidth.value = 250
    await nextTick()
    vi.advanceTimersByTime(100)
    sidebarWidth.value = 260
    await nextTick()
    vi.advanceTimersByTime(100)
    sidebarWidth.value = 280
    await nextTick()
    // t=200，距最近一次修改 0ms，未达 300ms 阈值
    expect(
      window.localStorage.getItem(
        (import.meta.env.VITE_STORAGE_NAMESPACE || 'vue3-vite-project') + ':demo-sidebar-width'
      )
    ).toBeNull()
    // 推进 299ms（仍差 1ms 不到阈值）—— 写入仍未触发
    vi.advanceTimersByTime(299)
    expect(
      window.localStorage.getItem(
        (import.meta.env.VITE_STORAGE_NAMESPACE || 'vue3-vite-project') + ':demo-sidebar-width'
      )
    ).toBeNull()
    // 推进最后 1ms 跨过 300ms 阈值 → 写入最后值 280
    vi.advanceTimersByTime(1)
    expect(
      JSON.parse(
        window.localStorage.getItem(
          (import.meta.env.VITE_STORAGE_NAMESPACE || 'vue3-vite-project') + ':demo-sidebar-width'
        )!
      )
    ).toBe(280)
  })

  it('跨模块加载保持一致：A 模块写入 → B 模块 reload 读到新值', async () => {
    const a = await importFresh()
    vi.useFakeTimers()
    a.sidebarWidth.value = 320
    await nextTick()
    vi.advanceTimersByTime(300)
    expect(
      JSON.parse(
        window.localStorage.getItem(
          (import.meta.env.VITE_STORAGE_NAMESPACE || 'vue3-vite-project') + ':demo-sidebar-width'
        )!
      )
    ).toBe(320)
    // 模拟应用刷新 / 切换 tab 回到 demo 路由
    vi.resetModules()
    const b = await importFresh()
    expect(b.sidebarWidth.value).toBe(320)
  })
}, 15000)
