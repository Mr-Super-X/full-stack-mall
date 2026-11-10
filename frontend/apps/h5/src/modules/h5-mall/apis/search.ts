// h5-mall 搜索 API 层（热搜词等搜索增强端点；keyword 搜索复用列表接口）。

import { request } from '@api/http'

export const h5SearchApi = {
  /** 热搜词（匿名；运营位常量 8 词） */
  hotWords: () => request<string[]>({ url: '/mall/search/hot-words', method: 'get' }),
}
