/**
 * home 模块公开出口（barrel）。
 *
 * 2026-10-20 企业官网改造：官网为纯静态展示页（文案集中在 `./config/site.ts`），
 * 不再有对外暴露的 store / composable；本文件仅保留模块说明。
 *
 * @see [`./routes`](./routes/index.ts) 路由定义（被 router/auto-register 扫描）
 * @see [`./config/site.ts`](./config/site.ts) 站点文案/数据单源
 * @see [`./views/index.vue`](./views/index.vue) 官网首页入口
 * @group 业务模块：Home
 */
export {}
