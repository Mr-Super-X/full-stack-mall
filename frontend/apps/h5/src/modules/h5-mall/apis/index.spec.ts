import { describe, expect, it, vi } from 'vitest'

import type { MallGoodsItem, MallHomeContent, MallProductDetail } from './index'

// mock shared http 层：只拦截 request，验证 url/method/params/usePageAdapter 透传
vi.mock('@api/http', () => ({
  request: vi.fn((config: unknown) => Promise.resolve(config)),
}))

import { request } from '@api/http'
import { h5MallApi } from './index'

describe('h5MallApi', () => {
  it('getHome 请求 /mall/home/content 且不走分页适配', async () => {
    await h5MallApi.getHome()
    expect(request).toHaveBeenCalledWith({
      url: '/mall/home/content',
      method: 'get',
    })
  })

  it('getList 请求 /mall/product/list 并开启分页适配', async () => {
    await h5MallApi.getList({ page: 1, pageSize: 10, keyword: '风衣', sort: 'price_asc' })
    expect(request).toHaveBeenCalledWith({
      url: '/mall/product/list',
      method: 'get',
      params: { page: 1, pageSize: 10, keyword: '风衣', sort: 'price_asc' },
      usePageAdapter: true,
    })
  })

  it('getDetail 拼接商品 id 到路径', async () => {
    await h5MallApi.getDetail(14)
    expect(request).toHaveBeenCalledWith({
      url: '/mall/product/14',
      method: 'get',
    })
  })

  it('login 走 POST /mall/auth/login', async () => {
    await h5MallApi.login({ username: 'seller', password: 'seller123' })
    expect(request).toHaveBeenCalledWith({
      url: '/mall/auth/login',
      method: 'post',
      data: { username: 'seller', password: 'seller123' },
    })
  })

  it('register 走 POST /mall/auth/register', async () => {
    await h5MallApi.register({ username: 'newbie', password: '123456', nickname: '新人' })
    expect(request).toHaveBeenCalledWith({
      url: '/mall/auth/register',
      method: 'post',
      data: { username: 'newbie', password: '123456', nickname: '新人' },
    })
  })

  it('me 走 GET /mall/auth/me', async () => {
    await h5MallApi.me()
    expect(request).toHaveBeenCalledWith({
      url: '/mall/auth/me',
      method: 'get',
    })
  })

  it('logout 走 POST /mall/auth/logout', async () => {
    await h5MallApi.logout()
    expect(request).toHaveBeenCalledWith({
      url: '/mall/auth/logout',
      method: 'post',
    })
  })

  it('类型字段与后端契约一致（TS 编译即校验）', () => {
    const goods: MallGoodsItem = {
      id: 14,
      name: '中古 Chanel CF 黑金牛皮',
      price: 12800,
      originPrice: null,
      imageUrl: 'https://picsum.photos/seed/mall-p14-1/750/750',
      tag: '寄卖',
      sellingPoint: '成色 GOOD',
      garm: 'bag',
      sales: 12,
      ownerType: 'CONSIGNMENT',
      saleMode: 'NORMAL',
      conditionGrade: 'GOOD',
    }
    expect(goods.ownerType).toBe('CONSIGNMENT')
    expect(goods.conditionGrade).toBe('GOOD')

    const detail: MallProductDetail = {
      ...goods,
      categoryId: 5,
      sellerId: 2,
      detailHtml: '<p>经典 CF 中号</p>',
      createTime: '2026-11-06T10:00:00',
      items: [
        {
          id: 33,
          size: null,
          color: '黑金',
          conditionGrade: 'GOOD',
          price: 12800,
          originPrice: null,
          stock: 1,
        },
      ],
      images: ['https://picsum.photos/seed/mall-p14-1/750/750'],
    }
    expect(detail.items).toHaveLength(1)
    expect(detail.sellerId).toBe(2)

    const home: MallHomeContent = {
      notice: '新客立减 ¥30',
      banners: [{ id: 1, title: 'banner', picUrl: 'url', linkUrl: '/h5-mall', sort: 1 }],
      categories: [{ id: 2, name: '女装', icon: 'dress-s', sort: 2 }],
      flash: { title: '限时甄选', items: [goods] },
      news: [goods],
      recommend: [goods],
    }
    expect(home.flash.items[0].conditionGrade).toBe('GOOD')
  })
})
