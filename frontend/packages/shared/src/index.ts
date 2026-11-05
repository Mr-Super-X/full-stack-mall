/**
 * @vv/shared 根 barrel。
 *
 * 消费场景：unplugin-auto-import 的 `from: '@vv/shared'` 包名注入
 * （useAuth / useRequest / useDict / useAppRouter / createNamespace 等），
 * 以及 app 侧少量 `import { ... } from '@vv/shared'` 直接引用。
 *
 * ⚠️ 宿主前置条件：本包是 workspace 源码直链包（非 npm 发布包），源码内 composable/store
 * 依赖宿主 vite 装配还原编译期注入（auto-import 清单 / optimizeDeps.exclude / VITE_BEM_PREFIX）——
 * 换宿主前必须逐项落实，详见包 README.md「宿主装配契约」，缺任一项模块求值即 ReferenceError。
 *
 * 刻意不聚合：
 * - `./locales`（模块加载即 createI18n 副作用 + default export，app 经 `@locales` 别名消费）
 * - `./directives`（index 是 import.meta.glob 自动注册插件，仅 Vite 上下文可执行）
 * - `./api`（http.ts 模块加载即创建 axios 实例挂拦截器，按需在 app 内经 `@api/*` 别名消费）
 *
 * 具名子路径出口（package.json exports 的 `./store` / `./router-guards`）：与根 barrel
 * 重复暴露同一模块——动机是给历史深路径 import / vi.mock 说明符留兼容位（mock 按解析
 * 路径生效），新代码一律走根 barrel（CLAUDE.md §1.6.2 首选 barrel 立场）
 *
 * @group 包出口
 */
export * from './utils/index.ts'
export * from './enums/httpEnum.ts'
export * from './enums/roleEnum.ts'
export * from './types/dict.ts'
// ProTable requestApi 契约（P0 审查：mock↔ui 共享类型下沉单源，ui 侧 re-export 兼容存量）
export * from './types/pro-table.ts'
export * from './composables/useAuth.ts'
export * from './composables/useRequest.ts'
export * from './composables/useDict.ts'
export * from './composables/useTheme.ts'
export * from './composables/useAppRouter.ts'
export * from './app-router.ts'
export * from './router-title.ts'
// 6 app 骨架零差异段单源化（P5）：router base 解析 / 统一 scroll 行为 / prod-mock 挂接守卫
export * from './router/base.ts'
// catch-all 404 兜底路由工厂（原 6 app 逐字拷贝收敛，根治 h5 残留 docs 文案漂移）
export * from './router/fallback.ts'
// 路由创建编排工厂（P6 装配层收敛）：createRouter 配置 / registerAppRouter DI / 白名单守卫
export * from './router/create-router.ts'
// 模块 routeNames 递归提取单源（重复性审查：5 app 三份拷贝 + 变体 + 字面量收敛）
export * from './router/route-names.ts'
export * from './prod-mock.ts'
// 首屏装配段（P5 骨架下沉）：品牌色 CSS 变量注入 / document.title 占位初始化
// （6 app main.ts 逐字重复段单源化，默认标题由调用方传入）
export * from './app-bootstrap.ts'
// 应用启动装配编排工厂（P6 装配层收敛）：main.ts createApp 前后编排段 6 份拷贝单源，
// 顺序契约固化在工厂内（品牌色/title → prod-mock 先于 use(router) → use 序列 → setup 收尾 → mount）
export * from './app-mount.ts'
export * from './store/index.ts'
export * from './router-guards/index.ts'
// 跨应用统一登录协议（P4）：redirectToAuthLogin / resolvePostLoginRedirect
export * from './auth/redirect.ts'
// 契约类型侧例外（2026-10-26 测试审计 #2）：api 模块「值加载」有副作用（http.ts 建
// axios 实例）故不聚合值导出；但 LoginResult / UserProfile / UserItem 等契约类型是纯
// 类型——export type 编译期擦除零运行时成本，经 barrel 暴露给 mock 数据类型挂钩等消费方
export type { LoginResult, UserProfile } from './api/modules/auth.ts'
export type { UserItem, UserListParams } from './api/modules/user.ts'
export type { RemoteMenuItem } from './api/modules/menu.ts'
// REM 适配 viewport 幂等插件（P5 下沉：admin / h5 双拷贝收敛单源；模块加载无副作用，install 才碰 DOM）
export { default as remAdaptationPlugin, ensureViewportMeta } from './plugins/remAdaptation.ts'
// 全局插件族单源（P6 下沉：5 app errorHandler/webVitals 逐字拷贝收敛；模块加载无副作用，install 才接 DOM/指标库）
export { default as errorHandlerPlugin } from './plugins/errorHandler.ts'
export { default as webVitalsPlugin } from './plugins/webVitals.ts'
// 插件统一注册入口工厂（P6：5 app plugins/index.ts 同构收敛，remAdaptation 装配由工厂参数控制）
export { createAppPlugins } from './plugins/index.ts'
export type { CreateAppPluginsOptions } from './plugins/index.ts'
export type { ErrorHandlerOptions, PluginsOptions } from './plugins/errorHandler.d'
export type { WebVitalsOptions, WebVitalName } from './plugins/webVitals.ts'
