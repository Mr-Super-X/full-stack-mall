/**
 * @vv/shared 全局 store barrel：app / user / theme / dict + Pinia 实例工厂。
 *
 * 注意：仅聚合跨 app 共享的 4 个 store 与 createAppPinia（装配单源，P5 下沉——
 * 原 6 app 的 createPinia + persistedstate 逐字拷贝收敛）；
 * tags-view（多页签）与 router-ui（路由 UI 态）是 admin 私有，留在
 * apps/admin/src/store/modules/，由 admin 的 store/index.ts 合并出口。
 *
 * @group 状态管理
 */
export * from './modules/app.ts'
export * from './modules/user.ts'
export * from './modules/theme.ts'
export * from './modules/dict.ts'
export * from './createAppPinia.ts'
