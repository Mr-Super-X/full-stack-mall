/**
 * 应用入口（admin 中后台主干业务端）：装配编排收敛至 @vv/shared bootstrapApp 工厂。
 *
 * 原逐字重复的装配序列（brandColor → title → assertNoMockInProd → createApp →
 * prod-mock → use 序列 → setDialogAppContext → mount）已单源化至工厂（P6 装配
 * 编排层收敛：6 app main.ts 仅标题/插件 presence 有差异），顺序契约固化在
 * 工厂 JSDoc（prod-mock 必须先于 use(router)、setup 收尾必须在所有 use 之后）。
 * 本文件只保留 app 差异数据：根组件 / router / pinia / i18n / 默认标题 / 插件 /
 * mock 加载回调 / setDialogAppContext 收尾。
 *
 * 浏览器样式基线四件套（normalize.css → virtual:uno.css → @vv/ui/styles/index.scss
 * → element-plus dark/css-vars.css）已随 @vv/shared app-styles 模块下沉单源
 * （2026-10-23，原 6 app main.ts 逐字重复；2026-11-03 补第四件 EP 暗色变量）；
 * Element Plus 样式由 vite.config.ts 的 ElementPlusResolver({ importStyle: 'css' }) 按需注入。
 *
 * @see [`./App.vue`](./App.vue) 根组件
 * @see [`./router`](./router/index.ts) 路由
 * @see [`./store`](./store/index.ts) Pinia
 * @group 应用入口
 */
import App from './App.vue'
import router from './router'
import pinia from './store'
// i18n 实例自 P1-3 起归 @vv/shared（@locales 别名指向包源码）
import i18n from '@locales'
import Directives from '@directives'
import Plugins from '@plugins'
// 全局组件注册工厂归 @vv/ui；shared 不得反向依赖 ui，实例由 app 侧创建后经参数注入
import { createGlobalComponents } from '@vv/ui'
// ui 全局运行时装配入口（弹窗 appContext + 网络错误反馈），经 setup 收尾参数注入
import { setupUiAppContext } from '@vv/ui/composables/setup-ui-app-context'
// 装配编排工厂（P6 收敛：6 app main.ts 逐字同构段单源，顺序契约固化在工厂内）
import { bootstrapApp } from '@vv/shared'
// 浏览器样式基线四件套（normalize/uno/全局 scss/EP dark css-vars，顺序即契约）单源在 @vv/ui app-styles
import '@vv/ui/app-styles'
// 端级样式层（tokens / UI 库覆盖骨架）：公共层之后的覆盖位，见 docs/49 §5
import '@/styles/index.scss'

await bootstrapApp({
  rootComponent: App,
  router,
  pinia,
  i18n,
  // 首屏标题占位走 i18n app.title 键（2026-10-28 i18n 审计接线；登录后由路由 meta.title 覆盖）
  title: i18n.global.t('app.title'),
  globalComponents: createGlobalComponents(),
  directives: Directives,
  plugins: Plugins,
  // @mock 别名仅 app 编译上下文可解析，模块加载以回调注入（同 prod-mock 下沉模式）
  loadMockServer: () => import('@mock/mockProdServer'),
  // ui 全局装配收尾：必须在所有 app.use 之后（工厂收尾段保证）
  setup: setupUiAppContext,
})
