/**
 * 插件统一注册入口工厂（@vv/shared 单源）。
 *
 * 文件角色：createAppPlugins 工厂——原 5 app 的 plugins/index.ts 四份同构
 * （auth/docs/portal 29 行逐字一致）+ admin/h5 各带一段 remAdaptation 装配，
 * P6 收敛为「工厂参数控制装配项」的单源形态，各 app plugins/index.ts 退化为
 * 一行薄封装（export default createAppPlugins(...))。
 *
 * 装配规则：
 * - errorHandler / webVitals 所有 app 默认装配（传 false 可关）
 * - remAdaptation 仅工厂参数 remAdaptation: true 时装配（admin / h5 使用；
 *   viewport meta 幂等确保，fontSize 激活归 apps/h5 的 layouts/h5 生命周期）
 *
 * 用法（各 app main.ts 经 @plugins 别名消费本工厂产物）：
 * ```ts
 * // apps/<a>/src/plugins/index.ts
 * export default createAppPlugins({ remAdaptation: true }) // admin / h5
 * export default createAppPlugins() // auth / portal / docs / big(未用)
 * ```
 *
 * @see [`./errorHandler.ts`](./errorHandler.ts) 全局错误处理
 * @see [`./webVitals.ts`](./webVitals.ts) 性能指标采集
 * @see [`./remAdaptation.ts`](./remAdaptation.ts) viewport meta 幂等确保
 * @group 插件：注册入口
 */
import type { App } from 'vue'
import errorHandlerPlugin from './errorHandler.ts'
import webVitalsPlugin from './webVitals.ts'
import remAdaptationPlugin from './remAdaptation.ts'
import versionCheckPlugin from './versionCheck.ts'
import type { PluginsOptions } from './errorHandler.d'

/** createAppPlugins 工厂参数：决定装配哪些 app 差异插件 */
export interface CreateAppPluginsOptions {
  /** 装配 remAdaptation（viewport meta 幂等确保）。仅 admin / h5 传 true */
  remAdaptation?: boolean
}

/**
 * 创建插件统一注册入口（Vue 插件形态，直接 app.use 使用）。
 *
 * 返回类型用结构化 ObjectPlugin 而非 vue 的 Plugin 联合——联合含函数插件分支，
 * 会让消费方 `.install` 调用报 possibly-undefined；装配项固定，结构签名更精确。
 *
 * @param factoryOptions.remAdaptation - 是否装配 REM 适配插件；缺省 false
 * @returns Vue 插件（install 内按序注册 errorHandler → webVitals → [remAdaptation]）
 */
export function createAppPlugins(factoryOptions: CreateAppPluginsOptions = {}): {
  install(app: App, options?: PluginsOptions): void
} {
  const withRemAdaptation = factoryOptions.remAdaptation ?? false

  return {
    install(app: App, options: PluginsOptions = {}): void {
      // 1. 全局错误处理（默认启用；传 false 可关闭）
      if (options.errorHandler !== false) {
        app.use(errorHandlerPlugin, options.errorHandler)
      }

      // 2. Web Vitals 采集（默认启用；dev 模式 console 徽章、prod 默认 noop）
      //    上报 endpoint 待接入——业务方在 options.webVitals.report 自定义
      if (options.webVitals !== false) {
        app.use(webVitalsPlugin, options.webVitals)
      }

      // 3. REM 适配（H5）：viewport meta 幂等确保（仅工厂显式装配时注册；
      //    默认启用，install 级关闭走 options.remAdaptation === false）
      if (withRemAdaptation && options.remAdaptation !== false) {
        app.use(remAdaptationPlugin)
      }

      // 4. 版本检测（默认启用；传 false 可关）——轮询 version.json 比对 buildId +
      //    ChunkLoadError 兜底；dev 模式默认不启动（HMR 即热更新）
      if (options.versionCheck !== false) {
        app.use(versionCheckPlugin, options.versionCheck)
      }
    },
  }
}
