import type { MockMethod } from 'vite-plugin-mock'
import { paginate, generateUsers } from './_utils'

// 注意：mock response 必须是**同步函数**。详见 mock/auth.ts 顶部注释。
const ALL_USERS = generateUsers(50)

export default [
  {
    url: '/mock/user/list',
    method: 'get',
    timeout: 200,
    response: ({
      query,
    }: {
      // 分页参数契约与 @vv/shared api 层 UserListParams 对齐（2026-10-26 测试审计 H1）：
      // api 发 page/pageSize，原 mock 读 pageIndex 致 mock 环境翻页永远第 1 页
      query: { page?: string; pageSize?: string; keyword?: string }
    }) => {
      const page = Number(query.page) || 1
      const pageSize = Number(query.pageSize) || 10
      const keyword = query.keyword?.toLowerCase() ?? ''
      const filtered = keyword
        ? ALL_USERS.filter((u) => u.name.toLowerCase().includes(keyword))
        : ALL_USERS
      return { code: 200, message: 'ok', data: paginate(filtered, page, pageSize) }
    },
  },
  {
    url: '/mock/user/:id',
    method: 'get',
    timeout: 100,
    response: ({ params }: { params: { id: string } }) => {
      const user = ALL_USERS.find((u) => u.id === Number(params.id))
      return user
        ? { code: 200, message: 'ok', data: user }
        : { code: 404, message: '用户不存在', data: null }
    },
  },
] as MockMethod[]
