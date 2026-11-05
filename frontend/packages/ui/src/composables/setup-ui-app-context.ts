/**
 * @vv/ui 全局运行时装配入口 —— 各 app main.ts 的 setup 回调统一调它（bootstrapApp 收尾段）。
 *
 * 组合 ui 包所有「必须在 app.use(...) 全部完成之后」的初始化：
 * - setDialogAppContext：弹窗族（useDialog/useConfirm）脱离宿主组件树渲染时的
 *   appContext 来源（Pinia / i18n / EP 组件解析）
 * - initNetworkBanner：全局网络错误反馈（横幅 + 业务 toast 兜底）的命令式挂载
 *
 * 单点演进（OCP）：ui 侧新增全局命令式能力只改本函数，6 app main.ts 零感知——
 * 避免每加一项全局能力就在 6 个入口各铺一行（P6 装配收敛精神的 ui 侧延伸）。
 *
 * @see [`./useDialog.ts`](./useDialog.ts) setDialogAppContext
 * @see [`./useNetworkBanner.ts`](./useNetworkBanner.ts) initNetworkBanner
 * @group 应用装配
 */
import type { App } from 'vue'
import { setDialogAppContext } from './useDialog.ts'
import { initNetworkBanner } from './useNetworkBanner.ts'

export function setupUiAppContext(app: App): void {
  setDialogAppContext(app)
  initNetworkBanner()
}
