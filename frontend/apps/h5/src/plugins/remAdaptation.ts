/**
 * REM 适配插件（viewport meta 幂等确保）——薄封装。
 *
 * 单源实现归 @vv/shared（P5 下沉：admin / h5 双逐字拷贝收敛）。
 * h5 的 index.html 已静态声明 viewport meta（双保险，content 与单源 VIEWPORT_CONTENT
 * 保持一致）；fontSize 激活/恢复由 `src/layouts/h5/config/rem.ts` 承担（绑定 h5 layout
 * 组件生命周期，路由挂 h5 layout 即获得能力），故意不在本插件 install 执行。
 *
 * @see [`src/layouts/h5/config/rem.ts`](../layouts/h5/config/rem.ts) fontSize 激活/恢复
 * @see [`./index.ts`](./index.ts) 插件统一注册入口
 * @group 插件：REM 适配
 */
import { remAdaptationPlugin, ensureViewportMeta } from '@vv/shared'

export { ensureViewportMeta }
export default remAdaptationPlugin
