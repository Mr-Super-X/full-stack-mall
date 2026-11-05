/**
 * 字典 API —— `/api/dict/:code` 的唯一请求出口。
 *
 * 为什么走项目 request<T>（http.ts 封装）而非裸 axios / fetch：
 * - CLAUDE.md §1.5 / §4 #3：业务代码禁止直接 import axios，统一走 request 封装
 * - 免费获得 http 拦截器能力：30s GET 内存缓存（防抖池之前的第一层请求合并）、
 *   401 自动刷新重试、统一错误处理
 *
 * @see [`../../types/dict.ts`](../../types/dict.ts) DictItem 契约定义（前端主导）
 * @see [`../../composables/useDict.ts`](../../composables/useDict.ts) 业务侧推荐入口
 * @group 业务 API：字典
 */

import { request } from '../http'
import type { DictItem } from '../../types/dict.ts'

export const dictApi = {
  /**
   * 按字典 code 拉取全部字典项（如 `'gender'` / `'user_status'`）。
   *
   * 业务侧不要直接调本方法 —— 用 `useDict(code)` composable：
   * - store 层 5min 内存缓存 + Promise 防抖池（多组件并发自动合并为一次请求）
   * - lazy fetch（setup 阶段自动触发），失败降级为空数组
   *
   * @param code 字典 code（URL 路径参数，对应后端 `/api/dict/:code`）
   *
   * @group 业务 API：字典
   */
  getDict: (code: string) =>
    request<DictItem[]>({
      url: `/dict/${code}`,
      method: 'get',
      // http 层 30s TTL 内存缓存：防抖池之外的第一层请求合并（相同 url 不重复发）
      cache: { ttl: 30 },
    }),
}
