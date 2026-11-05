/**
 * 应用启动装配编排工厂（@vv/shared 单源）。
 *
 * 文件角色：bootstrapApp——原 6 个 app 的 main.ts 中逐字重复的装配编排段
 * （createApp 前后约 60 行 × 6 份，grep 实证仅标题/插件 presence 有差异）
 * 的单源实现。P5 已下沉纯函数段（injectBrandColor / initDocumentTitle /
 * setupProdMockIfNeeded），本文件收敛最后的编排层：装配「顺序契约」
 * 整体固化在此，任何 app 不得自行重排（重排即破坏时序防线）。
 *
 * 装配顺序（顺序敏感，逐段锁定原因）：
 * 1. injectBrandColor → initDocumentTitle：必须在 createApp 之前完成，
 *    避免首屏品牌色闪烁 / 标题短暂停留 index.html 静态默认值
 * 2. assertNoMockInProd：prod 环境防 mock 残留的防御层扩展点
 * 3. createApp(rootComponent)
 * 4. await setupProdMockIfNeeded(loadMockServer)：必须先于 app.use(router)——
 *    router install 即触发初始导航，守卫首屏请求与 main.ts 后续语句并行执行；
 *    挂接晚于 use 则请求先于 mockjs 激活发出，穿透到静态服务器
 *    （SPA fallback 返回 HTML → 资源不存在 toast）
 * 5. app.use 序列：pinia → router → i18n → globalComponents → directives → plugins
 * 6. await setup(app) 收尾（6 app 固定传 setDialogAppContext）：必须在所有
 *    app.use 之后——_context.provides 由插件 install 写入，命令式弹窗
 *    （useDialog 纯 JS 调用动态挂载）依赖它访问 Pinia/Router/全局组件
 * 7. mount('#app')
 *
 * 依赖注入而非硬编码别名（与 prod-mock 下沉同裁决）：
 * - @directives / @plugins 是 app 私有别名（app-aliases.ts），shared 包独立
 *   type-check 解析不到，Directives / Plugins 实例由调用方传入
 * - createGlobalComponents / setDialogAppContext 归 @vv/ui——shared 不得反向
 *   依赖 ui（§2.1 依赖方向铁律），必须经参数注入
 * - @mock 别名仅 app 编译上下文可解析，loadMockServer 以回调注入
 *
 * @see [`./app-bootstrap.ts`](./app-bootstrap.ts) 首屏前置纯函数段（品牌色 / 标题）
 * @see [`./prod-mock.ts`](./prod-mock.ts) prod-mock 挂接守卫（调用位置强约束）
 * @group 应用入口：装配编排
 */
import { createApp } from 'vue'
import type { App, Component, Plugin } from 'vue'
import type { Router } from 'vue-router'
import type { Pinia } from 'pinia'
import { injectBrandColor, initDocumentTitle } from './app-bootstrap.ts'
import { assertNoMockInProd } from './api/mock-guard.ts'
import { setupProdMockIfNeeded } from './prod-mock.ts'
import type { ProdMockServerModule } from './prod-mock.ts'

/** bootstrapApp 装配参数：app 差异数据 + 经参数注入的 app 级模块 */
export interface BootstrapOptions {
  /** 根组件（各 app 的 App.vue） */
  rootComponent: Component
  /** app 路由实例（各 app src/router/index.ts 产物） */
  router: Router
  /** Pinia 根实例（各 app src/store/index.ts 产物） */
  pinia: Pinia
  /**
   * i18n 实例（@locales 产物，vue-i18n Composition 模式）。契约是
   * 「可被 app.use 的 Vue 插件」而非具体泛型实例——vue-i18n 的 Messages /
   * Locale 泛型随各 app 文案类型变化（Composer 对二者不变），按 Plugin 结构
   * 类型接收才能兼容所有 app 的 createI18n 返回类型
   */
  i18n: Plugin
  /** 首屏 document.title 占位值（VITE_APP_TITLE 缺省时的兜底；包内不硬编码 app 名） */
  title: string
  /**
   * 指令统一注册插件（@directives 别名产物——import.meta.glob 自动注册，
   * 仅 Vite 上下文可执行，shared barrel 刻意不聚合，故经参数注入）
   */
  directives: Plugin
  /**
   * 全局组件注册插件（@vv/ui createGlobalComponents() 产物；shared 不得反向
   * 依赖 ui，实例由调用方创建后传入——调用即注册，无运行时状态）
   */
  globalComponents: Plugin
  /** 可选 app 私有插件（@plugins 别名产物；big 无 src/plugins 目录，省略即跳过） */
  plugins?: Plugin | Plugin[]
  /**
   * 加载 @mock/mockProdServer 的回调——app 侧固定传
   * `() => import('@mock/mockProdServer')`（别名仅 app 编译上下文可解析，
   * 同 setupProdMockIfNeeded 的回调注入模式）
   */
  loadMockServer: () => Promise<ProdMockServerModule>
  /**
   * 收尾装配：在全部 app.use 之后、mount 之前调用（6 app 固定传
   * setDialogAppContext——必须在 provides 写入完成后捕获 appContext）
   */
  setup?: (app: App) => void | Promise<void>
}

/**
 * 按固化顺序装配并挂载 app（6 app main.ts 编排单源）。
 *
 * 顺序即契约：brandColor/title（createApp 之前）→ assertNoMockInProd →
 * createApp → prod-mock（先于 use(router)）→ use 序列 → setup 收尾 → mount。
 * 各步原因见文件头装配顺序注释；任一步漂移都会击穿对应时序防线。
 *
 * @param options 装配参数（差异数据 + 注入的 app 级模块，见 {@link BootstrapOptions}）
 * @see 各 app src/main.ts 调用点（top-level await，唯一语句）
 */
export async function bootstrapApp(options: BootstrapOptions): Promise<void> {
  const {
    rootComponent,
    router,
    pinia,
    i18n,
    title,
    directives,
    globalComponents,
    plugins,
    loadMockServer,
    setup,
  } = options

  // 1-2. 首屏前置两步 + prod 防御层：均须在 createApp 之前（防首屏闪烁/标题占位）
  injectBrandColor()
  initDocumentTitle(title)
  assertNoMockInProd()

  // 3. 创建应用实例
  const app = createApp(rootComponent)

  // 4. prod-mock 挂接：必须先于 app.use(router)（router install 即触发初始导航，
  //    挂接晚于 use 则守卫首屏请求穿透到静态服务器，SPA fallback 返回 HTML → 404 toast）
  await setupProdMockIfNeeded(loadMockServer)

  // 5. 装配序列（顺序即契约）：pinia → router → i18n → 全局组件 → 指令 → app 私有插件
  app.use(pinia)
  app.use(router)
  app.use(i18n)
  app.use(globalComponents)
  app.use(directives)
  if (plugins) {
    for (const plugin of Array.isArray(plugins) ? plugins : [plugins]) {
      app.use(plugin)
    }
  }

  // 6. 收尾扩展点：必须在所有 app.use 之后（_context.provides 由插件 install 写入，
  //    setDialogAppContext 依赖完整 appContext 才能服务命令式弹窗）
  await setup?.(app)

  // 7. 挂载
  app.mount('#app')
}
