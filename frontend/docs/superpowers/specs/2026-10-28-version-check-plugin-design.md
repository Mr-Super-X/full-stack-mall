# 生产页面版本检测插件（可插拔）设计稿

> **日期**：2026-10-28
> **状态**：设计已批准（用户三节确认），待写实施计划
> **背景**：gh-pages 六应用聚合部署（`dist/<app>/` + 各自 base），用户长时间停留在生产页面时不感知新版本发布，点击新路由可能命中已被删除的旧 chunk 白屏。

---

## 1. 目标与非目标

### 1.1 目标

- 在既有 `createAppPlugins` 工厂体系下新增**第 4 个 Vue 插件** `versionCheck`，6 app 零改动默认拥有检测能力
- 双机制覆盖：
  - **主动轮询**：定时 fetch `version.json` 比对 `buildId`，变化时触发 `onUpdate`
  - **被动兜底**：`ChunkLoadError` 监听（轮询间隔内刚好点到新 chunk 的场景）
- 插件**零 UI 依赖**（`@vv/shared` 不引入 Element Plus），通知经 `onUpdate` 回调注入
- 构建侧 vite 插件生成 `version.json`（含 `buildId` + `builtAt`），多 app 各自独立

### 1.2 非目标（YAGNI）

- 不做 WS/SSE 实时推送（gh-pages 静态托管做不到，轮询是唯一普适路径）
- 不做强制刷新（`location.reload()` 由业务回调自行决定）
- 不做 service worker / PWA 离线缓存
- 不进 AutoImport 注入清单（低频 API，不污染 setup 全局作用域；与 §1.6 既有裁决一致）
- 不新增 npm 依赖（fetch 原生 / `node:fs` 写文件）

---

## 2. 关键决策记录

| 决策点 | 结论 | 理由 |
|--------|------|------|
| 检测机制 | 轮询 `version.json` 为主 + `ChunkLoadError` 兜底 | gh-pages 静态托管只支持静态文件；两机制互补 |
| 通知方式 | 回调注入（`onUpdate` / `onChunkError`），默认 noop | 保持 `@vv/shared` 零 EP 依赖，与 webVitals 同风格 |
| 装配形态 | 工厂双侧默认装配 | runtime 进 `createAppPlugins` 默认开（`options.versionCheck === false` 可关）；vite 侧进 `createViteConfig` 默认开 |
| 轮询 dev 行为 | 默认不启动（HMR 即热更新）；`enabled: true` 可强制 | dev server 无 `version.json`，轮询只会 404 |
| 基线存储 | 模块级 `let` 变量，**不落 localStorage** | 避免基线跨版本残留导致"永远不提示" |
| buildId 来源 | `process.env.VITE_BUILD_ID` → 兜底 `Date.now().toString(36)+random` | CI 可注入 git sha 可追溯；本地构建兜底唯一 |

---

## 3. 文件清单

| # | 路径 | 操作 | 职责 |
|---|------|------|------|
| 1 | `packages/shared/src/plugins/versionCheck.ts` | 新增 | runtime Vue 插件（轮询 + ChunkLoadError 兜底） |
| 2 | `packages/shared/src/plugins/versionCheck.spec.ts` | 新增 | runtime 单测（fake timers + mock fetch） |
| 3 | `packages/config/src/version-check-vite.ts` | 新增 | vite 插件：`closeBundle` 往 outDir 写 `version.json` |
| 4 | `packages/config/src/version-check-vite.spec.ts` | 新增 | vite 插件单测（临时目录验证产物） |
| 5 | `packages/shared/src/plugins/index.ts` | 修改 | `createAppPlugins` 工厂加第 4 装配项 |
| 6 | `packages/config/src/create-vite-config.ts` | 修改 | 装配 version-check-vite 插件（`apply: 'build'` 生效） |

**依赖方向合规**：`@vv/shared` ∥ `@vv/config` 并列上游、互不依赖；均不依赖 `@vv/ui` / `@vv/mock`；不新增 npm 依赖。

---

## 4. 数据流

### 4.1 构建时

```
vite build
  └─ version-check-vite 插件 closeBundle 钩子
       └─ 往 outDir 写 version.json（与 index.html 同级）
            { "buildId": "<VITE_BUILD_ID | 兜底>", "builtAt": "<ISO 8601>" }
```

`build:pages` 聚合构建时 6 app 独立 outDir（`dist/<app>/`），`version.json` 各自生成互不覆盖；落地页（`dist/index.html`）无 `version.json`，不参与检测。

### 4.2 运行时

```
app.use 装配（默认开）
  ├─ 轮询主机制
  │    ├─ dev 模式默认不启动（enabled 强制可开）
  │    ├─ 定时器默认 5min；document.hidden 暂停、visible 恢复并立即补一次
  │    ├─ fetch(`${import.meta.env.BASE_URL}version.json?_t=${Date.now()}`,
  │    │        { cache: 'no-store' })
  │    │      ↑ BASE_URL 由 vite 按 app 注入（gh-pages 为 /vue3-vite-project/<app>/）
  │    ├─ 首次响应 → 建立基线 buildId（模块级变量）
  │    └─ buildId 变化 → 触发 onUpdate({ oldId, newId })
  │
  └─ ChunkLoadError 兜底
       ├─ window 'error' + 'unhandledrejection' 双监听
       ├─ 匹配 /ChunkLoadError|Failed to fetch dynamically imported module|
       │        Importing a module script failed|error loading dynamically imported module/i
       └─ 命中 → onChunkError(err)，缺省回落 onUpdate
```

### 4.3 发版瞬间三种用户状态

| 状态 | 触发路径 | 结果 |
|------|---------|------|
| 用户挂在页面上 | 下一轮轮询发现 buildId 变化 | `onUpdate` → 业务弹通知 |
| 轮询间隔内点新路由 | 懒加载 chunk 404 → ChunkLoadError | `onChunkError` → 缺省回落 `onUpdate` |
| 用户已刷新 | 新基线建立 | 正常 |

---

## 5. Options 契约

```ts
export interface VersionInfo {
  /** 旧版本基线；chunk-error 触发时无版本信息，为 null */
  oldId: string | null
  /** 新版本 buildId；chunk-error 时为 null */
  newId: string | null
  /** 触发源：轮询比对 / chunk 懒加载失败兜底 */
  source: 'poll' | 'chunk-error'
}

export interface VersionCheckOptions {
  /** 轮询间隔（ms）。缺省 5min */
  intervalMs?: number
  /**
   * 发现版本更新时回调（业务注入通知实现）。
   * 缺省 noop；dev 模式缺省 console.warn 提示（与 webVitals 徽章同风格）。
   * chunk-error 兜底缺省也回落到此回调（source: 'chunk-error'，id 为 null）
   */
  onUpdate?: (info: VersionInfo) => void
  /** ChunkLoadError 兜底独立回调。缺省回落到 onUpdate */
  onChunkError?: (err: Error) => void
  /** 强制启用（dev 模式调试用；prod 无需传） */
  enabled?: boolean
  /** version.json 请求路径。缺省 `${import.meta.env.BASE_URL}version.json` */
  path?: string
}
```

## 6. 默认值矩阵

| 项 | 缺省值 | 理由 |
|---|--------|------|
| `intervalMs` | `5 * 60 * 1000` | 后台系统发版频率低；平衡及时性与负载 |
| 轮询 dev 行为 | 不启动 | HMR 即热更新 |
| `cache` | `'no-store'` + `?_t=${Date.now()}` | 双保险防 gh-pages CDN 缓存 |
| buildId 源 | `VITE_BUILD_ID` → `Date.now().toString(36)+random` | CI 注入 git sha 可追溯 |
| 基线存储 | 模块级 `let` | 不落 localStorage 防跨版本残留 |
| 页面 hidden | 暂停定时器，visible 恢复并立即补一次 | 后台 tab 不浪费请求 |
| `onChunkError` 缺省 | 回落 `onUpdate` | 一套回调覆盖双机制 |

## 7. 错误处理矩阵（全部静默降级，绝不影响业务）

| 失败点 | 行为 | dev 表现 |
|--------|------|---------|
| fetch 网络抖动 / 404 | 本次跳过，等下一轮 | `console.warn` |
| `JSON.parse` 失败 | 本次跳过 | `console.warn` |
| `buildId` 字段缺失 | 视为无效响应跳过 | `console.warn` |
| 兜底监听器自身异常 | try-catch 包裹 | 不抛 |

---

## 8. 测试矩阵

### 8.1 `versionCheck.spec.ts`（runtime，12-14 用例）

| 分组 | 用例 |
|------|------|
| 轮询基线 | 首次响应建立基线不调 onUpdate；二次响应 buildId 相同不调 |
| 轮询触发 | buildId 变化触发 onUpdate 且携带 `{oldId, newId}` |
| 轮询频率 | `advanceTimersByTime(5min)` 触发 1 次 fetch；自定义 `intervalMs` 生效 |
| 静默降级 | fetch reject / JSON.parse 抛错 / 缺 buildId 字段 → 均不抛、不调 onUpdate |
| dev 行为 | `import.meta.env.DEV` 默认不启动；`enabled: true` 强制启动 |
| visibility | `document.hidden` 暂停；`visible` 恢复并立即补一次 |
| 路径 | 默认 `BASE_URL + 'version.json'`；自定义 `path` 生效；URL 带 cache-busting |
| ChunkLoadError | 4 种 message 各匹配 1 例 / 不匹配不误报 / 缺省回落 onUpdate / 自定义 onChunkError 独立调用 |

### 8.2 `version-check-vite.spec.ts`（构建插件，4-5 用例）

| 分组 | 用例 |
|------|------|
| 产物生成 | 临时 outDir 触发 `closeBundle` → version.json 存在且 schema 合法 |
| buildId 优先级 | `VITE_BUILD_ID` 注入 → 优先采用；未注入 → 兜底格式非空 |
| 重复构建 | 同 outDir 二次构建文件被覆盖（无残留） |

---

## 9. 文档与变更记录

| 项 | 落点 |
|---|------|
| 使用规范 | `docs/44-版本检测插件使用规范.md`（接入示例 + CI 注入 git sha 示例） |
| CHANGELOG | 「未发布」区新增 feat 节 |
| README | 顶部最近更新 + §相关文档表补 docs/45 |
| CLAUDE.md | **不改**——插件属 packages/shared 内部实现，不触碰 §1.6 AutoImport 清单 |

---

## 10. 验证门禁

实施完成后：

1. `pnpm test`（turbo 拓扑序全绿，新增 spec 全过）
2. `pnpm type-check` / `pnpm lint`
3. `pnpm build` 真实构建 → 人工核验 `dist/<app>/version.json` 存在且 schema 合法
4. `pnpm build:pages` → 核验 6 app 各自 `version.json` 互不覆盖
5. CDP 浏览器冒烟（dev 模式 `enabled: true` 强制路径）

---

## 11. 合规自查（对照 §2 Lockdown）

| 检查项 | 结果 |
|--------|------|
| 依赖方向 | shared ∥ config 并列，互不依赖 ✅ |
| 不新增 npm 依赖 | fetch 原生 / `node:fs` 内置 ✅ |
| `@vv/shared` 零 EP 依赖 | 回调注入裁决 ✅ |
| 不新增/删除/重命名 workspace 路径 | 仅往既有目录加文件 ✅ |
| 新 plugin 带 spec | §4 #11 满足 ✅ |
| CHANGELOG 同步 | §4 #12 满足 ✅ |
