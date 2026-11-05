// webVitals 插件类型声明（与 webVitals.ts 配套，@vv/shared 单源）
//
// 下沉说明：原仅 apps/admin 持有本文件（其余 4 app 从未有），随插件实现一并
// 收敛到 shared——vue 组件级 webVitals 配置的类型增强在所有 app 口径一致

import type { WebVitalsOptions } from './webVitals.ts'

declare module 'vue' {
  interface ComponentCustomOptions {
    /**
     * 注册 Web Vitals 采集 + 自定义上报。
     *
     * @example
     *   app.use(webVitalsPlugin, {
     *     report: (metric) => {
     *       // Sentry / Ga / 自有 APM 任选其一
     *     },
     *   })
     */
    webVitals?: WebVitalsOptions
  }
}

/** 类型与 .ts 一致，导出供外部 import。 */
export type { WebVitalsOptions }
