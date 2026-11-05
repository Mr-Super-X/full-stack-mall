# Web Vitals 使用规范

> **当前状态（v1.0.1）**：4 项核心指标**已采集**，但**未接上报端点**。dev 模式默认通过控制台徽章（`showBadge`）直接观察；prod 默认 noop（不上报任何端点）。后续与运维约定 URL 与协议后，在 `main.ts` 一行接入。

## 1. 4 项核心指标

| 指标                                 | 含义                 | good 阈值 | 衡量维度    |
| ------------------------------------ | -------------------- | --------- | ----------- |
| **LCP**（Largest Contentful Paint）  | 首屏最大内容渲染时间 | ≤ 2500ms  | 加载性能    |
| **INP**（Interaction to Next Paint） | 交互到下一帧的延迟   | ≤ 200ms   | 交互响应    |
| **CLS**（Cumulative Layout Shift）   | 累计布局偏移分数     | ≤ 0.1     | 视觉稳定性  |
| **TTFB**（Time to First Byte）       | 首字节到达时间       | ≤ 800ms   | 网络/服务端 |

参考：[web.dev/vitals](https://web.dev/vitals/)（Google 官方权威定义）。

> **FCP**（First Contentful Paint）：**当前不支持**——`WebVitalName` 仅 `'LCP' | 'INP' | 'CLS' | 'TTFB'` 4 项，REGISTRY 也只注册这 4 项；传 FCP 会命中 `undefined` handler 被 catch warn。如需扩展：在 `WebVitalName` 联合类型加 `'FCP'` + REGISTRY 补 `FCP: onFCP` 一项。

## 2. 数据流向

```
首次加载 / 用户交互
  ↓
web-vitals 库采集（PerformanceObserver API）
  ↓
packages/shared/src/plugins/webVitals.ts 中转
  ├── dev: showBadge 控制台徽章（GitHub 风格，按 rating 切换颜色，默认）
  └── prod: 默认 noop，由 options.report 自定义
       ├── Sentry: setMeasurement
       ├── Ga: gtag('event', metric.name)
       └── 自有 APM: navigator.sendBeacon
```

采集与上报**解耦**——本插件只采集并提供回调，业务方在 `main.ts` 一行决定怎么上报。

> dev 模式默认 reporter 用 `@vv/shared`（`utils/consoleBadge`）的 `showBadge`，输出形如
> `性能监控 · Web Vitals · LCP` + 数值 + 评级（good / needs-improvement / poor）的徽章，
> 比 `console.info` 更便于视觉区分（颜色按 rating 切换：good 绿 / 需改进黄 / 差红）。

## 3. 接入示例

### 3.1 Sentry

```ts
app.use(Plugins, {
  webVitals: {
    report: (metric) => {
      Sentry.setMeasurement(metric.name, metric.value, 'millisecond')
    },
  },
})
```

### 3.2 Google Analytics 4

```ts
app.use(Plugins, {
  webVitals: {
    report: (metric) => {
      gtag('event', metric.name, {
        value: Math.round(metric.value),
        metric_rating: metric.rating,
      })
    },
  },
})
```

### 3.3 自有 APM（POST JSON / sendBeacon）

```ts
app.use(Plugins, {
  webVitals: {
    report: (metric) => {
      const body = JSON.stringify({
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        url: location.href,
        ts: Date.now(),
      })
      // sendBeacon 在页面卸载时仍能发出请求，比 fetch 可靠
      navigator.sendBeacon('/api/apm/web-vitals', body)
    },
  },
})
```

### 3.4 仅本地观察（默认行为）

不动 `main.ts` 即可。dev 模式启动后浏览器控制台会输出 GitHub 风格徽章：

```
性能监控 · Web Vitals · LCP   1820ms · good              (绿底徽章)
性能监控 · Web Vitals · INP   145ms  · good              (绿底徽章)
性能监控 · Web Vitals · CLS   0.04  · good               (绿底徽章)
性能监控 · Web Vitals · TTFB  380ms · good               (绿底徽章)
```

> 实现细节见 `packages/shared/src/plugins/webVitals.ts` 的 `defaultReporter`：用 `packages/shared/src/utils/consoleBadge.ts`
> 的 `showBadge(label, value, labelColor, valueColor)` 渲染（label 深紫 #6b21a8，性能监控语义）。

prod 模式默认 noop，不会有任何外发请求。

## 4. 关闭采集

如果某环境不想采集（如内部演示环境）：

```ts
app.use(Plugins, { webVitals: false })
```

完全跳过 webVitals 注册；`web-vitals` 库的 PerformanceObserver 监听也不会启动（install 时未触发 onXxx）。

## 5. 上报协议选型（待接入时决策）

| 方案                        | 优点                              | 缺点                         |
| --------------------------- | --------------------------------- | ---------------------------- |
| `fetch` + `keepalive: true` | 灵活（可 POST JSON、可加 header） | 仍受网络异常影响             |
| `navigator.sendBeacon`      | 页面卸载时仍可发出                | 只能 POST、Content-Type 受限 |
| `new Image().src`           | 兼容性最好                        | 仅 GET、字段塞 URL           |
| Sentry SDK                  | 自带聚合/告警                     | 引入 Sentry 体积与依赖       |

**推荐**：通用场景用 `sendBeacon`（卸载可靠）；已用 Sentry 则用 `setMeasurement`（天然聚合）。

## 6. 上报 endpoint 待接入说明

> **未实现**：本版本不上报到任何端点。
>
> **原因**：上报端点 URL、协议、聚合服务由运维与可观测性团队约定，前端不预设。
>
> **接入成本**：业务在 `main.ts` 的 `app.use(Plugins, { webVitals: { report: ... } })` 加一行即可，无需改本插件。

## 7. 扩展：自定义指标子集

如需只采集部分指标（如暂不接 CLS）：

```ts
app.use(Plugins, {
  webVitals: {
    metrics: ['LCP', 'TTFB'], // 只采 2 项
    report: (metric) => {
      /* ... */
    },
  },
})
```

新指标 web-vitals 库升级时自动可用，无需改本插件（REGISTRY 表 + new handler 一行）。

## 8. 自测指引

未接入上报端点前的自测方式：

1. `pnpm dev`
2. 打开 Chrome DevTools → Console
3. 触发页面加载、点击按钮让 INP 触发
4. 应看到「性能监控 · Web Vitals · LCP」等彩色徽章输出

E2E 自测（接入端点后）：用 Playwright 模拟导航 + 点击，断言 post 请求有 `name` 字段。

---

_文档版本：v1.0.1 | 编写日期：2026-07-23 | 最后更新：2026-09-04（dev 默认 reporter 已改为 showBadge 徽章）| 配套包：`web-vitals@^6.2.1`（pnpm catalog 单版本源）_
