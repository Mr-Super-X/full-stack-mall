// h5-mall 搜索 API 层（热搜词/联想词/埋点等搜索增强端点；keyword 结果搜索复用列表接口）。

import { request } from '@api/http'

/** 搜索埋点载荷：搜索完成（带 resultCount）与点击结果（带 clickProductId）共用 */
export interface MallSearchTrackPayload {
  keyword: string
  /** 结果数（点击埋点不传） */
  resultCount?: number
  /** 点击的商品 id（搜索埋点不传） */
  clickProductId?: number
}

export const h5SearchApi = {
  /** 热搜词（匿名；近 7 天有结果搜索词 Top 8，日志不足时后端回退运营常量） */
  hotWords: () => request<string[]>({ url: '/mall/search/hot-words', method: 'get' }),

  /** 搜索联想词（≤10 个商品名；keyword 经后端 sanitize，纯符号返回空数组） */
  suggest: (keyword: string) =>
    request<string[]>({ url: '/mall/search/suggest', method: 'get', params: { keyword } }),

  /** 搜索埋点（匿名；失败静默——日志型接口不阻塞搜索主流程） */
  track: (payload: MallSearchTrackPayload) =>
    request<null>({ url: '/mall/search/track', method: 'post', data: payload }),
}
