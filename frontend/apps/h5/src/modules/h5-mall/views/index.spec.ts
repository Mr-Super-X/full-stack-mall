import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import MallToast from '../components/MallToast.vue'
import { MALL_GOODS, MALL_NOTICE } from '../config/mall'
import HomeIndex from './index.vue'

describe('h5-mall 商城首页（smoke + 交互）', () => {
  it('渲染全部区块且公告 / 品牌可见', () => {
    const w = mount(HomeIndex)
    // 区块标题齐全
    for (const title of ['限时甄选', '新品上架', '为你推荐']) {
      expect(w.text()).toContain(title)
    }
    expect(w.text()).toContain(MALL_NOTICE)
    expect(w.text()).toContain('拙衣')
    // 商品卡数量 = 静态数据条数
    expect(w.findAll('.vv-mall-goods__gcard')).toHaveLength(MALL_GOODS.length)
  })

  it('点「加入购物袋」：角标 +1 且 Toast 弹出', async () => {
    const w = mount(HomeIndex)
    const addBtn = w.findAll('button').find((b) => b.text() === '加入购物袋')!
    await addBtn.trigger('click')

    expect(w.findComponent(MallToast).props('visible')).toBe(true)
    expect(w.findComponent(MallToast).props('message')).toBe('已加入购物袋')
    // Tabbar 购物袋角标出现数字 1
    expect(w.find('.vv-mall-tabbar__cartn').text()).toBe('1')
  })

  it('收藏切换：aria-pressed 翻转 + Toast 文案跟随', async () => {
    const w = mount(HomeIndex)
    // 收藏按钮以 aria-label 标识（chips 亦用 aria-pressed，须按 label 区分）
    const favBtn = w.find('button[aria-label*="收藏"]')!
    expect(favBtn.attributes('aria-pressed')).toBe('false')

    await favBtn.trigger('click')
    expect(w.findComponent(MallToast).props('message')).toBe('已加入心愿单')

    const again = w.find('button[aria-label*="收藏"]')!
    expect(again.attributes('aria-pressed')).toBe('true')
    await again.trigger('click')
    expect(w.findComponent(MallToast).props('message')).toBe('已取消收藏')
  })

  it('筛选 chips 选中态互斥切换', async () => {
    const w = mount(HomeIndex)
    // 默认「推荐」选中
    expect(
      w
        .findAll('button')
        .find((b) => b.text() === '推荐')!
        .attributes('aria-pressed')
    ).toBe('true')

    const skirtChip = w.findAll('button').find((b) => b.text() === '裙装')!
    await skirtChip.trigger('click')
    expect(
      w
        .findAll('button')
        .find((b) => b.text() === '裙装')!
        .attributes('aria-pressed')
    ).toBe('true')
    expect(
      w
        .findAll('button')
        .find((b) => b.text() === '推荐')!
        .attributes('aria-pressed')
    ).toBe('false')
  })

  it('倒计时文本为 HH:MM:SS 格式', () => {
    const w = mount(HomeIndex)
    expect(w.find('.vv-mall-flash__timer').text()).toMatch(/^\d{2}:\d{2}:\d{2}$/)
  })
})
