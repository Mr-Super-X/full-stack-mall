import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import type { MallHomeContent } from '../apis/index'
import MallToast from '../components/MallToast.vue'
import HomeIndex from './index.vue'

// mock API 层：index.vue 现在走后端 API（useMallHome），不碰真实 http
vi.mock('../apis/index', () => ({
  h5MallApi: {
    getHome: vi.fn(),
  },
}))

// 首页区块组件树可能经 useAppRouter 跳转：测试环境无 registerAppRouter 注册的实例，
// 覆盖该导出防"router 实例未注册"（importOriginal 保留 barrel 其余真实导出如 useRequest）。
// mockPushByName 为模块级单例：工厂每次返回新 vi.fn 会断言不到调用。
const { mockPushByName } = vi.hoisted(() => ({ mockPushByName: vi.fn() }))

vi.mock('@vv/shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vv/shared')>()),
  useAppRouter: () => ({ pushByName: mockPushByName, replaceByName: vi.fn(), back: vi.fn() }),
}))

import { h5MallApi } from '../apis/index'

const mockHome: MallHomeContent = {
  notice: '新客立减 ¥30 · 全场满 ¥299 顺丰包邮 · 7 天无理由退换',
  banners: [],
  categories: [
    { id: 1, name: '今日上新', icon: 'spark', sort: 1 },
    { id: 2, name: '女装', icon: 'dress-s', sort: 2 },
  ],
  flash: {
    title: '限时甄选（每日 10:00–22:00）',
    items: [
      {
        id: 7,
        name: '云朵感圆领针织',
        price: 189,
        originPrice: 259,
        imageUrl: null,
        tag: '-27%',
        sellingPoint: '软糯',
        garm: 'sweater',
        sales: 2000,
        ownerType: 'PLATFORM',
        saleMode: 'NORMAL',
        conditionGrade: 'NEW',
      },
    ],
  },
  news: [
    {
      id: 10,
      name: '陶土色垂感风衣',
      price: 399,
      originPrice: null,
      imageUrl: null,
      tag: '本季主打',
      sellingPoint: '棉 100%',
      garm: 'trench',
      sales: 900,
      ownerType: 'PLATFORM',
      saleMode: 'NORMAL',
      conditionGrade: 'NEW',
    },
  ],
  recommend: [
    {
      id: 5,
      name: '陶白条纹 T 恤 · 有机棉',
      price: 99,
      originPrice: null,
      imageUrl: null,
      tag: null,
      sellingPoint: '有机棉',
      garm: 'tshirt',
      sales: 5200,
      ownerType: 'PLATFORM',
      saleMode: 'NORMAL',
      conditionGrade: 'NEW',
    },
  ],
}

describe('h5-mall 商城首页（API 驱动）', () => {
  it('渲染全部区块且公告 / 品牌可见', async () => {
    vi.mocked(h5MallApi.getHome).mockResolvedValue(mockHome)

    const w = mount(HomeIndex)
    // 等 API 返回
    await vi.waitFor(() => expect(w.text()).toContain('限时甄选'))

    // 区块标题齐全
    for (const title of ['限时甄选', '新品上架', '为你推荐']) {
      expect(w.text()).toContain(title)
    }
    expect(w.text()).toContain('新客立减 ¥30')
    expect(w.text()).toContain('拙衣')
    // 商品卡数量 = mock 数据条数（recommend 1 条）
    expect(w.findAll('.vv-mall-goods__gcard')).toHaveLength(1)
  })

  it('点「加入购物袋」：跳详情页选规格（自营文案）', async () => {
    vi.mocked(h5MallApi.getHome).mockResolvedValue(mockHome)
    mockPushByName.mockClear()

    const w = mount(HomeIndex)
    await vi.waitFor(() => expect(w.text()).toContain('为你推荐'))

    const addBtn = w.findAll('button').find((b) => b.text() === '加入购物袋')!
    await addBtn.trigger('click')

    // 加购需规格 id（productItemId）——首页卡无规格维度，统一跳详情页选规格
    expect(mockPushByName).toHaveBeenCalledWith('H5MallDetail', { id: 5 })
  })

  it('寄卖商品卡按钮文案为「立即购买」', async () => {
    vi.mocked(h5MallApi.getHome).mockResolvedValue({
      ...mockHome,
      recommend: [{ ...mockHome.recommend[0]!, ownerType: 'CONSIGNMENT' }],
    })

    const w = mount(HomeIndex)
    await vi.waitFor(() => expect(w.text()).toContain('为你推荐'))

    expect(w.findAll('button').some((b) => b.text() === '立即购买')).toBe(true)
  })

  it('点商品卡：跳商品详情页 H5MallDetail（带商品 id）', async () => {
    vi.mocked(h5MallApi.getHome).mockResolvedValue(mockHome)
    mockPushByName.mockClear()

    const w = mount(HomeIndex)
    await vi.waitFor(() => expect(w.text()).toContain('限时甄选'))

    // 限时甄选横滑卡（mock 首条 id=7）
    const card = w.find('.vv-mall-flash__item')!
    await card.trigger('click')

    expect(mockPushByName).toHaveBeenCalledWith('H5MallDetail', { id: 7 })
  })

  it('点金刚区品类：跳商品列表页 H5MallList', async () => {
    vi.mocked(h5MallApi.getHome).mockResolvedValue(mockHome)
    mockPushByName.mockClear()

    const w = mount(HomeIndex)
    await vi.waitFor(() => expect(w.text()).toContain('限时甄选'))

    const cat = w.find('.vv-mall-cats__cat')!
    await cat.trigger('click')

    expect(mockPushByName).toHaveBeenCalledWith('H5MallList')
  })

  it('收藏切换：aria-pressed 翻转 + Toast 文案跟随', async () => {
    vi.mocked(h5MallApi.getHome).mockResolvedValue(mockHome)

    const w = mount(HomeIndex)
    await vi.waitFor(() => expect(w.text()).toContain('为你推荐'))

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
    vi.mocked(h5MallApi.getHome).mockResolvedValue(mockHome)

    const w = mount(HomeIndex)
    await vi.waitFor(() => expect(w.text()).toContain('为你推荐'))

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

  it('倒计时文本为 HH:MM:SS 格式', async () => {
    vi.mocked(h5MallApi.getHome).mockResolvedValue(mockHome)

    const w = mount(HomeIndex)
    await vi.waitFor(() => expect(w.text()).toContain('限时甄选'))
    expect(w.find('.vv-mall-flash__timer').text()).toMatch(/^\d{2}:\d{2}:\d{2}$/)
  })
})
