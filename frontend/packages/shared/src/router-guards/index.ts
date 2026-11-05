/**
 * 守卫骨架 barrel（@vv/shared）。
 *
 * 四段独立可测的纯函数守卫 + 编排器 + 白名单判定谓词。
 * app 侧的编排入口（如 admin 的 router/guards/auth.ts）按自身顺序串接，
 * 并注入 app 私有的白名单数据 / 远程菜单加载器。
 *
 * @group 路由：守卫骨架
 */
export * from './composable.ts'
export * from './login.ts'
export * from './visibility.ts'
export * from './permission.ts'
export * from './whitelist.ts'
