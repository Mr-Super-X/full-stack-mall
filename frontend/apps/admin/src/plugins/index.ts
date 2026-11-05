/**
 * 项目插件统一注册入口（admin）——薄封装。
 *
 * 单源装配逻辑归 @vv/shared 的 createAppPlugins 工厂（P6 下沉：5 app
 * plugins/index.ts 同构收敛）。admin 的 index.html 无静态 viewport meta，
 * 依赖 remAdaptation 插件 install 时创建（确需保留，故工厂参数 remAdaptation: true）。
 *
 * @see [`./errorHandler.ts`](./errorHandler.ts) 全局错误处理（薄封装）
 * @see [`./webVitals.ts`](./webVitals.ts) 性能指标采集（薄封装）
 * @see [`./remAdaptation.ts`](./remAdaptation.ts) viewport meta 幂等确保（薄封装）
 * @group 插件：注册入口
 */
import { createAppPlugins } from '@vv/shared'

export default createAppPlugins({ remAdaptation: true })
