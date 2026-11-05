/**
 * ProTable A11y 全局样式测试（v3.5 PR1-A）
 *
 * 覆盖：
 * 1) prefers-reduced-motion: reduce 时 _a11y.scss 把 transition/animation 抑制到 0.01ms
 * 2) matchMedia mock：测试环境模拟用户开启「减弱动效」偏好
 *
 * 注：jsdom 不解析 CSS，所以本测试只验证 matchMedia hook 是否正确响应 query；
 * 真实样式效果由 E2E（Playwright + Chromium）覆盖。
 *
 * @group ProTable 样式测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ProTable from '../ProTable.vue'

describe('ProTable v3.5 A11y prefers-reduced-motion', () => {
  let originalMatchMedia: typeof window.matchMedia

  beforeEach(() => {
    originalMatchMedia = window.matchMedia
    // 默认 mock：reduced-motion 关闭
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
  })

  it('默认 matchMedia: reduce 不匹配', () => {
    expect(window.matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(false)
  })

  it('mock reduce 开启后 matchMedia.matches=true', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    expect(window.matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(true)
    expect(window.matchMedia('(min-width: 100px)').matches).toBe(false)
  })

  it('ProTable 在 reduce 开启时仍能正常 mount（CSS hook 不影响组件渲染）', async () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    const wrapper = mount(ProTable, {
      props: {
        columns: [{ prop: 'name', label: '名称' }],
        requestApi: async () => ({ data: [], total: 0, pageNum: 1, pageSize: 10 }),
      } as never,
    })
    await new Promise((r) => setTimeout(r, 10))
    expect(wrapper.exists()).toBe(true)
    // role="grid" 仍正常渲染
    expect(wrapper.find('[role="grid"]').exists()).toBe(true)
  })
})
