/**
 * user 模块公开出口（barrel re-export）。
 *
 * 外部消费方统一从 `@/modules/user` 引入，模块内部 store / views / routes 不对外暴露。
 *
 * @see [`./store`](./store/index.ts) 模块私有 store
 * @see [`./routes`](./routes/index.ts) 路由定义
 * @group 业务模块：User
 */
export { useUserListStore } from './store'
