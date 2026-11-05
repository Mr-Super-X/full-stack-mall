/**
 * 应用入口（big 数据大屏站）：装配编排收敛至 @vv/shared bootstrapApp 工厂。
 *
 * big 差异点：无 src/plugins 目录（big-demo 为纯静态 mock 展示页，渲染错误由
 * App.vue 的 ErrorBoundary 兜底）——bootstrapApp 省略 plugins 参数即跳过；
 * 无远程菜单 / tags-view / 登录守卫（全站公开）。装配顺序契约固化在工厂 JSDoc。
 *
 * 浏览器基线（必须在所有自定义样式之前）；
 * Element Plus 样式由 ElementPlusResolver({ importStyle: 'css' }) 按需注入。
 *
 * @see [`./App.vue`](./App.vue) 根组件
 * @see [`./router`](./router/index.ts) 路由
 * @group 应用入口
 */
import App from './App.vue'
import router from './router'
import pinia from './store'
import i18n from '@locales'
import Directives from '@directives'
import { createGlobalComponents } from '@vv/ui'
// ui 全局运行时装配入口（弹窗 appContext + 网络错误反馈）
import { setupUiAppContext } from '@vv/ui/composables/setup-ui-app-context'
import { bootstrapApp } from '@vv/shared'
import '@vv/ui/app-styles'
// 端级样式层（tokens / UI 库覆盖骨架）：公共层之后的覆盖位，见 docs/49 §5
import '@/styles/index.scss'

await bootstrapApp({
  rootComponent: App,
  router,
  pinia,
  i18n,
  title: '数据大屏',
  globalComponents: createGlobalComponents(),
  directives: Directives,
  // big 无 src/plugins 目录：省略 plugins 参数（工厂跳过该 use）
  loadMockServer: () => import('@mock/mockProdServer'),
  setup: setupUiAppContext,
})
