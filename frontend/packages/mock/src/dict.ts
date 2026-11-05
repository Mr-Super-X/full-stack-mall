// 字典 mock 数据（动态路由版）。
//
// ⚠️ vite-plugin-mock 3.0.2 不给 response 传 `params` —— 动态路由参数（:code）
// 被合并进 `query` 字段（requestMiddleware: `query = urlMatch(reqUrl).params`），
// response 签名是 `{ url, body, query, headers }`。读 `params.code` 会得到
// undefined → DICT_DATA[undefined] 抛 TypeError 打崩 dev server（已实测）。
// 所以这里从 `query.code` 取，并对缺失做防御返回 404。
//
// 单条动态路由 /mock/dict/:code 服务所有字典 —— 新增字典只需在 DICT_DATA 加键值
//（字典数据表见 ./dict-data.ts，单源，prod 静态展开消费）。
// viteMockServe 扫描整个 mock/ 目录自动注册，本文件无须在 src/index.ts 手动聚合。
//
// 响应契约：{ code, message, data: DictItem[] }，data 即字典数组
//（DictItem 定义见 @vv/shared types/dict.ts，前端主导、后端配合实现）。

import type { MockMethod } from 'vite-plugin-mock'

import { DICT_DATA } from './dict-data'

export default [
  {
    url: '/mock/dict/:code',
    method: 'get',
    timeout: 100,
    // ⚠️ 从 query.code 取路径参数（vite-plugin-mock 把 :code 合并进 query，见文件头注释）
    response: ({ query }: { query: { code?: string } }) => {
      const code = query.code
      if (!code) {
        return { code: 400, message: '缺少字典 code 参数', data: [] }
      }
      const list = DICT_DATA[code]
      // 未知字典返回 404 + 空数组：前端 store 拿到空数组降级渲染，不崩溃
      return list
        ? { code: 200, message: 'ok', data: list }
        : { code: 404, message: `字典 ${code} 不存在`, data: [] }
    },
  },
] as MockMethod[]
