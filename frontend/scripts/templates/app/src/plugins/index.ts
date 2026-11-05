/**
 * 项目插件统一注册入口（__APP_NAME__）——薄封装。
 *
 * 单源装配逻辑归 @vv/shared 的 createAppPlugins 工厂（P6 下沉：各 app
 * plugins/index.ts 同构收敛）。无 h5 布局（viewport meta 在 index.html
 * 静态声明），工厂缺省不装配 remAdaptation。
 *
 * @group 插件：注册入口
 */
import { createAppPlugins } from '@vv/shared'

export default createAppPlugins()
