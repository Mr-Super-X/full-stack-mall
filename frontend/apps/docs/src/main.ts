/**
 * 应用入口（docs demo 文档站）：装配编排收敛至 @vv/shared bootstrapApp 工厂。
 *
 * docs 差异点：无远程菜单（菜单即 demo 路由静态注册）、无 tags-view；demo 内
 * useDialog / useConfirm 命令式弹窗在用，保留 setDialogAppContext 收尾。
 * 装配顺序契约固化在工厂 JSDoc。
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
// i18n 实例归 @vv/shared（@locales 别名指向包源码）；demo 的 XFormI18n 等示例在用
import i18n from '@locales'
import Directives from '@directives'
import Plugins from '@plugins'
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
  title: '组件示例文档',
  globalComponents: createGlobalComponents(),
  directives: Directives,
  plugins: Plugins,
  loadMockServer: () => import('@mock/mockProdServer'),
  setup: setupUiAppContext,
})
