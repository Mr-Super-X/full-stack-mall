import { describe, expect, it } from 'vitest'

import {
  MALL_CATS,
  MALL_CHIPS,
  MALL_FLASH,
  MALL_GOODS,
  MALL_NEWS,
  MALL_NOTICE,
  MALL_TABS,
  MALL_TOPIC,
} from './mall'

describe('h5-mall 静态数据完整性', () => {
  it('公告为非空字符串', () => {
    expect(MALL_NOTICE.length).toBeGreaterThan(0)
  })

  it('金刚区 6 项且不重复', () => {
    expect(MALL_CATS).toHaveLength(6)
    expect(new Set(MALL_CATS.map((c) => c.label)).size).toBe(6)
  })

  it('限时 / 新品 / 推荐商品数据合法（价格正数、色块档位与线稿齐全）', () => {
    for (const item of [...MALL_FLASH, ...MALL_NEWS, ...MALL_GOODS]) {
      expect(item.price).toBeGreaterThan(0)
      expect(['a', 'b', 'c']).toContain(item.ph)
      expect(item.garm.length).toBeGreaterThan(0)
    }
    // 限时品必须有原价且原价高于现价
    for (const item of MALL_FLASH) {
      expect(item.originPrice).toBeGreaterThan(item.price)
      expect(item.tag).toMatch(/^-\d+%$/)
    }
    // 推荐商品 id 唯一（收藏态以 id 为主键）
    expect(new Set(MALL_GOODS.map((g) => g.id)).size).toBe(MALL_GOODS.length)
  })

  it('专题字段齐全', () => {
    expect(MALL_TOPIC.title).toContain('第 12 期')
    expect(MALL_TOPIC.artText).toBe('拾贰')
  })

  it('chips 首项为「推荐」；tabbar 恰为 4 项且含购物袋', () => {
    expect(MALL_CHIPS[0]).toBe('推荐')
    expect(MALL_TABS).toHaveLength(4)
    expect(MALL_TABS.map((t) => t.key)).toEqual(['home', 'grid', 'bag', 'user'])
  })
})
