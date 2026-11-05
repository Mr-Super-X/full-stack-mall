import { mount } from '@vue/test-utils'
import { describe, expect, it, vi, beforeEach } from 'vitest'

// P4 跨应用统一登录协议：CTA 改 redirectToAuthLogin 整页跳 apps/auth；
// mock 掉真实实现（会赋 location.href + throw AUTH_REDIRECTING）
const { mockRedirectToAuthLogin } = vi.hoisted(() => ({
  mockRedirectToAuthLogin: vi.fn(),
}))
vi.mock('@vv/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vv/shared')>()
  return { ...actual, redirectToAuthLogin: mockRedirectToAuthLogin }
})

import SiteHero from './SiteHero.vue'
import { SITE_HERO } from '../config/site'

describe('SiteHero 官网首屏', () => {
  beforeEach(() => vi.clearAllMocks())

  it('1. 渲染 kicker / 主标题 / 副文案', () => {
    const w = mount(SiteHero)
    expect(w.text()).toContain(SITE_HERO.kicker)
    expect(w.text()).toContain(SITE_HERO.titleLines[0])
    expect(w.text()).toContain(SITE_HERO.subtitle)
  })

  it('2. 两个 CTA 按钮点击均整页跳 apps/auth 统一登录（P4）', async () => {
    const w = mount(SiteHero)
    const btns = w.findAll('button')
    expect(btns).toHaveLength(2)
    await btns[0].trigger('click')
    await btns[1].trigger('click')
    expect(mockRedirectToAuthLogin).toHaveBeenCalledTimes(2)
    expect(mockRedirectToAuthLogin).toHaveBeenCalledWith(window.location.pathname)
  })
})
