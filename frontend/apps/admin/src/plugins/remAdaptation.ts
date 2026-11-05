/**
 * REM 适配插件（viewport meta 幂等确保）——薄封装。
 *
 * 单源实现归 @vv/shared（P5 下沉：admin / h5 双逐字拷贝收敛）。
 * admin 的 index.html **不**静态声明 viewport meta，依赖本插件 install 时创建
 * （app.use 序列先于 app.mount，首帧渲染前 meta 已就位）——故 admin 确需保留本插件；
 * fontSize 激活/恢复在 apps/h5 的 layouts/h5/config/rem.ts（绑定 h5 layout 生命周期），
 * 故意不在 install 执行（install 时全局设置会泄漏，h5 页返回后台时残留内联样式挤压布局）。
 *
 * @see [`./index.ts`](./index.ts) 插件统一注册入口
 * @group 插件：REM 适配
 */
import { remAdaptationPlugin, ensureViewportMeta } from '@vv/shared'

export { ensureViewportMeta }
export default remAdaptationPlugin
