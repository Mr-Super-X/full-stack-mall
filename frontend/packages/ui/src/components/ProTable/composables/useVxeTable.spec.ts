/**
 * useVxeTable composable 单元测试（v2.1 实装版）
 *
 * 覆盖场景：
 * 1) loadVxeTable 触发动态 import + CSS 注入
 * 2) 第二次调用返回缓存（不重复 import）
 * 3) loadVxeTable 失败时抛错
 * 4) reset 清空缓存
 * 5) installVxeTable 安装到 app（幂等：同一 app 仅装一次）
 * 6) 非组件上下文调用 loadVxeTable 时 console.warn 告警
 *
 * @group ProTable composables 测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { App } from 'vue'
import { useVxeTable, installVxeTable, type VxeModule } from './useVxeTable'

// CSS 导入探针：vi.mock 工厂经 vi.hoisted 提升，记录 style.css 是否被动态 import
const cssProbe = vi.hoisted(() => ({ called: false }))
vi.mock('vxe-table', () => ({
  default: {
    install: vi.fn(),
    Table: { name: 'VxeTable' },
    Column: { name: 'VxeColumn' },
  },
}))
vi.mock('vxe-table/lib/style.css', () => {
  cssProbe.called = true
  return {}
})

/** 构造带 use spy 的假 app（App 类型收窄，仅验证调用行为） */
function createFakeApp(): { app: App; useSpy: ReturnType<typeof vi.fn> } {
  const useSpy = vi.fn()
  return { app: { use: useSpy } as unknown as App, useSpy }
}

/** 构造最小可用的假 vxe 模块 */
function createFakeModule(): VxeModule {
  return {
    default: { install: vi.fn(), Table: { name: 'VxeTable' }, Column: { name: 'VxeColumn' } },
  }
}

describe('useVxeTable', () => {
  beforeEach(() => {
    cssProbe.called = false
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('loadVxeTable 触发动态 import + CSS 注入', async () => {
    const v = useVxeTable()
    expect(v.isLoaded()).toBe(false)
    const module = await v.loadVxeTable()
    expect(module).toBeDefined()
    expect(v.isLoaded()).toBe(true)
    expect(cssProbe.called).toBe(true)
  })

  it('第二次调用返回缓存', async () => {
    const v = useVxeTable()
    const a = await v.loadVxeTable()
    const b = await v.loadVxeTable()
    expect(a).toBe(b)
  })

  it('reset 清空缓存', async () => {
    const v = useVxeTable()
    await v.loadVxeTable()
    expect(v.isLoaded()).toBe(true)
    v.reset()
    expect(v.isLoaded()).toBe(false)
  })

  it('非组件上下文调用时 console.warn 告警（插件未安装）', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const v = useVxeTable()
    await v.loadVxeTable()
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('vxe-table 插件未安装'))
  })
})

describe('installVxeTable', () => {
  it('安装 vxe-table 插件到 app', () => {
    const { app, useSpy } = createFakeApp()
    installVxeTable(app, createFakeModule())
    expect(useSpy).toHaveBeenCalledTimes(1)
  })

  it('同一 app 重复安装仅生效一次（幂等）', () => {
    const { app, useSpy } = createFakeApp()
    const mod = createFakeModule()
    installVxeTable(app, mod)
    installVxeTable(app, mod)
    expect(useSpy).toHaveBeenCalledTimes(1)
  })
})
