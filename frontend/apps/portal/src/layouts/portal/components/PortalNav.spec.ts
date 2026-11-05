import { mount } from '@vue/test-utils'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import PortalNav from './PortalNav.vue'
import { PORTAL_NAV } from '@/layouts/portal/config/nav'

describe('PortalNav 锚点导航', () => {
  let scrollIntoViewMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // jsdom 未实现 scrollIntoView，手动 stub（组件点击锚点会调用）
    scrollIntoViewMock = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoViewMock
  })

  it('1. 渲染全部导航项链接，href 指向锚点', () => {
    const w = mount(PortalNav, { props: { items: PORTAL_NAV } })
    const links = w.findAll('a')
    expect(links).toHaveLength(PORTAL_NAV.length)
    for (let i = 0; i < links.length; i++) {
      expect(links[i].attributes('href')).toBe(PORTAL_NAV[i].anchor)
    }
    expect(w.text()).toContain('产品')
  })

  it('2. 点击导航项平滑滚动到对应锚点并高亮当前项', async () => {
    const target = document.createElement('section')
    target.id = 'features'
    document.body.appendChild(target)

    const w = mount(PortalNav, { props: { items: PORTAL_NAV }, attachTo: document.body })
    const link = w.findAll('a')[1] // 产品
    await link.trigger('click')

    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1)
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
    expect(link.classes()).toContain('is-active')
    expect(w.findAll('a')[0].classes()).not.toContain('is-active')

    target.remove()
    w.unmount()
  })

  it('3. 初始高亮第一项（jsdom 无 IntersectionObserver，scroll-spy 静默跳过）', () => {
    const w = mount(PortalNav, { props: { items: PORTAL_NAV } })
    expect(w.findAll('a')[0].classes()).toContain('is-active')
  })
})
