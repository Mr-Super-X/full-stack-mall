// errorHandler 插件类型定义（与 errorHandler.ts 配套，@vv/shared 单源）
// 分离类型到 .d.ts：与 directives 同范式
//
// 下沉说明：原 5 app 各自维护一份，且 PluginsOptions 被各 app 裁剪漂移
// （auth/portal/docs 无 remAdaptation 项）——收敛为统一超集类型，
// remAdaptation 开关是否生效由 createAppPlugins 工厂的装配参数决定（见 ./index.ts）

import type { WebVitalsOptions } from './webVitals.ts'
import type { VersionCheckOptions } from './versionCheck.ts'

// ErrorSource / ErrorContext / ErrorReporter 契约随 safeAsync 归 @vv/shared
// （shared 不反向依赖 app 的 plugins）；此处 re-export 保持既有消费方零改动
export type { ErrorSource, ErrorContext, ErrorReporter } from '../utils/safeAsync.ts'

import type { ErrorReporter } from '../utils/safeAsync.ts'

/**
 * errorHandler 插件 options
 */
export interface ErrorHandlerOptions {
  /** 错误上报回调（生产环境接 Sentry/自建日志服务） */
  report?: ErrorReporter
  /** 是否在控制台输出。默认 dev=true / prod=false */
  logToConsole?: boolean
}

/**
 * plugins 聚合 options（createAppPlugins 工厂 install 接收）
 */
export interface PluginsOptions {
  errorHandler?: ErrorHandlerOptions | false
  /** Web Vitals 上报（不传则默认 dev console 徽章 / prod noop；传 false 完全关闭） */
  webVitals?: WebVitalsOptions | false
  /** REM 适配（H5）：viewport meta 幂等确保；传 false 完全关闭。
   *  仅工厂以 remAdaptation: true 装配时生效（缺省不装配，等价无此项） */
  remAdaptation?: false
  /** 版本检测（轮询 version.json + ChunkLoadError 兜底）；不传则按 app 环境默认启用
   *  （dev 关闭 / prod 开启），传 false 完全关闭 */
  versionCheck?: VersionCheckOptions | false
}
