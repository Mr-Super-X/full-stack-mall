/**
 * Web Vitals 采集插件——薄封装。
 *
 * 单源实现归 @vv/shared（P6 下沉：5 app 120 行逐字拷贝收敛，spec 随包单源——
 * 原仅 admin 有 webVitals.spec，其余 4 app 跑同一份代码却零测试）。
 * 本文件仅保持 `./webVitals` 相对 import 路径不变（plugins/index.ts 零改动），
 * 并原样透出 WebVitalsOptions / WebVitalName 类型供潜在消费方引用。
 *
 * @see [`./index.ts`](./index.ts) 插件统一注册入口（createAppPlugins 工厂产物）
 * @group 插件：性能监控
 */
import { webVitalsPlugin } from '@vv/shared'

export type { WebVitalsOptions, WebVitalName } from '@vv/shared'
export default webVitalsPlugin
