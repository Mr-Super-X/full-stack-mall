/**
 * 应用入口（h5 移动端）：装配编排收敛至 @vv/shared bootstrapApp 工厂。
 *
 * h5 差异点：plugins 内含 remAdaptation 装配（h5 layout 生命周期驱动 fontSize
 * 激活，插件本体只做 viewport meta 幂等确保）。装配顺序契约固化在工厂 JSDoc。
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
import Plugins from '@plugins'
import { createGlobalComponents } from '@vv/ui'
// ui 全局运行时装配入口（弹窗 appContext + 网络错误反馈）
import { setupUiAppContext } from '@vv/ui/composables/setup-ui-app-context'
import { bootstrapApp } from '@vv/shared'
import '@vv/ui/app-styles'
// 端级样式层（ui-overwrite.scss 承载 vant 4 主题变量覆盖，自 layouts/h5/styles/ 归位，docs/49 §5）
import '@/styles/index.scss'

await bootstrapApp({
  rootComponent: App,
  router,
  pinia,
  i18n,
  title: 'H5 移动端',
  globalComponents: createGlobalComponents(),
  directives: Directives,
  plugins: Plugins,
  loadMockServer: () => import('@mock/mockProdServer'),
  setup: setupUiAppContext,
})
