/**
 * Web Vitals 客户端采集（@vv/shared 单源）。
 *
 * 文件角色：4 项核心 Web Vitals 指标注册插件的跨 app 单源实现
 * （原 apps/{admin,auth,portal,h5,docs} 的 plugins/webVitals.ts 五份逐字拷贝，
 * P6 收敛于此——消 ~540 行重复 + 4 app 零测试盲区，spec 随包单源）。
 *
 * 设计要点：
 *   - 4 项核心指标（LCP / INP / CLS / TTFB）；FCP 可选启用
 *   - dev 模式：默认 console 徽章输出（showBadge，GitHub 风格）便于开发者立即观察
 *   - prod 模式：默认 noop（不上报到任何端点）；业务通过 options.report 自定义
 *   - 上报 endpoint **未实现**——后端协议未定，业务后续接入见 docs/12-web-vitals使用规范.md
 *
 * 为何不上报到自家端点：
 *   - 上报协议（fetch / sendBeacon / image ping）和端点 URL 需与运维约定
 *   - 采集与上报解耦：web-vitals 库负责采，业务层只在 options.report 里加一行
 *
 * 接入示例（见 docs/12 完整版本）：
 *   ```ts
 *   app.use(webVitalsPlugin, {
 *     report: (metric) => {
 *       // Sentry: Sentry.setMeasurement(metric.name, metric.value)
 *       // Ga: gtag('event', metric.name, { value: metric.value })
 *       // 自有 APM: navigator.sendBeacon('/apm/web-vitals', JSON.stringify(metric))
 *     },
 *   })
 *   ```
 *
 * @see [`../utils/consoleBadge.ts`](../utils/consoleBadge.ts) dev 模式徽章输出
 * @see [`./index.ts`](./index.ts) createAppPlugins 插件统一注册工厂
 * @group 插件：性能监控
 */

import type { App } from 'vue'
import { onCLS, onINP, onLCP, onTTFB, type Metric } from 'web-vitals'
import { showBadge } from '../utils/consoleBadge.ts'

/** 4 项核心指标；FCP 可选加入（开发期调试用） */
export type WebVitalName = 'LCP' | 'INP' | 'CLS' | 'TTFB'

export interface WebVitalsOptions {
  /**
   * 自定义上报回调。不传则默认在 dev 模式 console 徽章输出，prod 模式 noop。
   *
   * @example Sentry
   *   report: (m) => Sentry.setMeasurement(m.name, m.value)
   *
   * @example 自有 APM
   *   report: (m) => navigator.sendBeacon('/api/perf', JSON.stringify(m))
   */
  report?: (metric: Metric) => void
  /** 选择监控的指标子集；默认全 4 项 */
  metrics?: ReadonlyArray<WebVitalName>
}

const ALL_METRICS: ReadonlyArray<WebVitalName> = ['LCP', 'INP', 'CLS', 'TTFB']

/**
 * 默认 reporter：dev 模式用 showBadge 输出 GitHub 风格徽章，按 rating 切换颜色；
 * prod 模式 noop。
 *
 * 设计取舍：未接入端点前不让数据"偷偷打到某处"，避免未审查数据外发。
 */

/** 评级 → 颜色（参考 web.dev web vitals 阈值配色）。 */
const RATING_COLOR: Record<Metric['rating'], string> = {
  good: '#0e9f6e', // 绿（≥ good 阈值）
  'needs-improvement': '#eab308', // 黄（介于 good 与 poor 之间）
  poor: '#dc2626', // 红（≥ poor 阈值）
}

/** 指标名 → 单位（CLS 是无单位分数，其余为毫秒）。 */
function formatMetricValue(metric: Metric): string {
  const unit = metric.name === 'CLS' ? '' : 'ms'
  // CLS 保留 2 位小数（如 0.04），其余整数毫秒
  const rounded = Math.round(metric.value * 100) / 100
  return unit ? `${rounded}${unit}` : `${rounded}`
}

function defaultReporter(metric: Metric): void {
  if (!import.meta.env.DEV) return

  const rating = metric.rating
  const color = RATING_COLOR[rating]
  // value 同时含数值 + 评级文字（不要只靠颜色，颜色不便于读屏与复制）
  const value = `${formatMetricValue(metric)} · ${rating}`
  // label 用深紫（性能监控语义），与 GlobalComponents（深灰）拉开视觉差
  showBadge(`性能监控 · Web Vitals · ${metric.name}`, value, '#6b21a8', color)
}

/** 路由表：把字符串 name 映射到 web-vitals 的注册函数。避免 switch 串到 install 主体。 */
const REGISTRY = {
  LCP: onLCP,
  INP: onINP,
  CLS: onCLS,
  TTFB: onTTFB,
} as const satisfies Record<WebVitalName, (cb: (m: Metric) => void) => void>

export default {
  /**
   * Vue 插件 install：把 4 项指标的回调注册到 web-vitals 库。
   *
   * @example
   *   app.use(webVitalsPlugin, { report: (m) => myReporter(m) })
   */
  install(_app: App, options: WebVitalsOptions = {}): void {
    const reporter = options.report ?? defaultReporter
    const metrics = options.metrics ?? ALL_METRICS

    for (const name of metrics) {
      const handler = REGISTRY[name]
      try {
        handler(reporter)
      } catch (err) {
        // 单项指标注册失败不阻塞其他指标
        if (import.meta.env.DEV) {
          console.warn(`[WebVitals] 注册 ${name} 失败：`, err)
        }
      }
    }
  },
}
