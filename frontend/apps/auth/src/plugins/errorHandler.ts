/**
 * 全局错误处理插件——薄封装。
 *
 * 单源实现归 @vv/shared（P6 下沉：5 app 85 行逐字拷贝收敛，spec 随包单源——
 * 原仅 admin 有 errorHandler.spec，其余 4 app 跑同一份代码却零测试）。
 * 本文件仅保持 `./errorHandler` 相对 import 路径不变（plugins/index.ts 零改动）。
 *
 * @see [`./index.ts`](./index.ts) 插件统一注册入口（createAppPlugins 工厂产物）
 * @group 插件：错误处理
 */
import { errorHandlerPlugin } from '@vv/shared'

export default errorHandlerPlugin
