/**
 * 项目插件统一注册入口（auth）——薄封装。
 *
 * 单源装配逻辑归 @vv/shared 的 createAppPlugins 工厂（P6 下沉：5 app
 * plugins/index.ts 同构收敛）。auth 无 h5 布局（viewport meta 在 index.html
 * 静态声明），工厂缺省不装配 remAdaptation。
 *
 * @see [`./errorHandler.ts`](./errorHandler.ts) 全局错误处理（薄封装）
 * @see [`./webVitals.ts`](./webVitals.ts) 性能指标采集（薄封装）
 * @group 插件：注册入口
 */
import { createAppPlugins } from '@vv/shared'

export default createAppPlugins()
