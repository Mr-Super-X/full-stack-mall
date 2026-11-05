/**
 * 项目插件统一注册入口（h5）——薄封装。
 *
 * 单源装配逻辑归 @vv/shared 的 createAppPlugins 工厂（P6 下沉：5 app
 * plugins/index.ts 同构收敛）。h5 全站移动端，需 viewport meta 幂等确保
 * （index.html 已静态声明，双保险），故工厂参数 remAdaptation: true；
 * html fontSize 激活/恢复不在此处——由 layouts/h5 组件生命周期驱动
 * （见 remAdaptation.ts 头注释）。
 *
 * @see [`./errorHandler.ts`](./errorHandler.ts) 全局错误处理（薄封装）
 * @see [`./webVitals.ts`](./webVitals.ts) 性能指标采集（薄封装）
 * @see [`./remAdaptation.ts`](./remAdaptation.ts) viewport meta 幂等确保（薄封装）
 * @group 插件：注册入口
 */
import { createAppPlugins } from '@vv/shared'

export default createAppPlugins({ remAdaptation: true })
