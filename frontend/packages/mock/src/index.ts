import auth from './auth'
import user from './user'
import menu from './menu'
import stream from './stream'

// dev 聚合入口：新增 mock 路由模块时须同步登记 mock/mockProdServer.ts（prod 接线清单），两处不许分叉。
// stream 仅 dev 可用（prod mockjs 不拦 fetch + rawResponse client 忽略），prod 侧由 check-mock-wiring 豁免登记
export default [...auth, ...user, ...menu, ...stream]
