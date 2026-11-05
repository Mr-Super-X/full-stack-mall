# 会话续期、请求取消与全局兜底 使用规范

> **文档版本**：v3.0.0 | **最后更新**：2026-09-04
> **能力来源**：`packages/shared/src/api/token-refresh.ts` + `packages/shared/src/api/global-abort.ts` + `packages/shared/src/api/cancel.ts` + `packages/shared/src/store/modules/user.ts`
> **配套阅读**：`docs/19-Pinia store使用规范.md`（user store 字段）、`docs/07-路由模块设计.md`（守卫链）、`docs/23-权限设计.md`（权限链路）
>
> **v3.0 重写说明**：文件名沿用"token"是因为历史检索习惯；**项目 2026-08-12 已完成 httpOnly 改造，前端不再持有 token**。本文档按真实架构重写：标题改为"会话续期"，所有"token 注入/读取/存 Session"描述改为"凭证 cookie + sessionStorage 登录标记"。

---

## 📋 四件套速览

| 能力                     | 文件                             | 触发场景                          | 业务侧感知                                  |
| ------------------------ | -------------------------------- | --------------------------------- | ------------------------------------------- |
| **会话续期**             | `token-refresh.ts`               | 401 业务码                        | 完全无感（自动重发原请求，cookie 自动携带） |
| **Global Abort**         | `global-abort.ts`                | logout / 凭证失效                 | 完全无感                                    |
| **AbortController 工具** | `cancel.ts`                      | 路由切换 / 组件卸载               | 按需使用 `createAbort()`                    |
| **本地状态兜底**         | `useUserStore.resetLocalState()` | refresh 失败 / `fetchProfile` 401 | 调用方负责跳转登录页                        |

---

## 一、认证模型（httpOnly 模式）

> **本节是后续所有章节的基础**。如果只看一节，请看这里。

```text
登录：前端 POST /auth/login → 后端 Set-Cookie: <凭证>; HttpOnly; SameSite=Lax
       前端 JS 完全拿不到 cookie 内容，只能让浏览器自动携带
       前端同时写 sessionStorage 登录标记（key: 'auth'，boolean，仅用于守卫同步判断）
请求：axios withCredentials: true → 浏览器自动携带 cookie，前端 JS 不经手凭证
续期：401 → refreshSession()（并发去重）→ 后端 Set-Cookie 新凭证 → 原请求重发（cookie 自动带新凭证）
失效：refresh 失败 → performLogout() 兜底（toast + 清登录标记 + 整页跳统一登录应用 `${VITE_AUTH_ORIGIN}/login?redirect=...`）
退出：useUserStore().logout() 乐观退出（先清本地态 + abort + resetAuthGuard，后端 logout fire-and-forget）
```

### 1.1 与传统 token 模式的关键差异

| 维度           | 传统 token 模式                    | 本项目 httpOnly 模式（2026-08-12 起）                     |
| -------------- | ---------------------------------- | --------------------------------------------------------- |
| 凭证存储位置   | 前端 `Session.set('token', x)`     | 后端 HttpOnly cookie（前端 JS 不可读）                    |
| 请求头         | `Authorization: Bearer <jwt>`      | 不注入 header，cookie 由浏览器自动携带                    |
| 刷新机制       | 用 refresh_token 换新 access_token | refreshSession() 让后端 Set-Cookie 新凭证                 |
| 前端能否登出   | 直接 `remove('token')`             | 不能（HttpOnly cookie JS 删不了），需后端 logout          |
| HMR / 刷新恢复 | 读 `Session.get('token')`          | 读 `Session.get('auth')` 标记 + `fetchProfile()` 重新校验 |
| 前端判定登录态 | `!!token`                          | `Session.get<boolean>('auth') === true`                   |

### 1.2 后端接入要求（必须）

- **必须**配 `Access-Control-Allow-Credentials: true`
- **不能**用 `Access-Control-Allow-Origin: *`（跨域部署时需明确 origin）
- 凭证 cookie 配 `HttpOnly; SameSite=Lax`（Lax 已能覆盖大多数 SPA + API 跨域场景）
- 退出接口必须返回 `Set-Cookie: <凭证名>=; Max-Age=0`（前端无法主动清除）

### 1.3 关键事实清单（2026-09-04 校对）

| 事实                                                                         | 来源                                                         |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 凭证 cookie **由后端 Set**，前端不持有、不读取、不存储                       | `packages/shared/src/utils/storage.ts:10-18`（storage 注释） |
| 登录标记 key 是 `'auth'`（sessionStorage，boolean）                          | `packages/shared/src/utils/storage.ts:104-107`               |
| axios 实例 `withCredentials: true`                                           | `packages/shared/src/api/http.ts:132`                        |
| **没有 `applyAuthHeader` 函数**（Bearer header 注入已被移除）                | `packages/shared/src/api/http.ts:135-203`（请求拦截器链）    |
| login 响应体不再含 `token` 字段                                              | `packages/shared/src/api/modules/auth.ts:6`（JSDoc）         |
| user store **不持有 `token` 字段**，认证态用 `authenticated: boolean`        | `packages/shared/src/store/modules/user.ts:42`               |
| `useUserStore` **没有 `persist` 字段**（httpOnly 凭证与 pinia persist 无关） | `packages/shared/src/store/modules/user.ts`                  |

---

## 二、会话续期（httpOnly 模式下的"refresh"）

### 2.1 设计要点

```ts
// packages/shared/src/api/token-refresh.ts:4-15（注释原文）
// - 并发去重：同一时刻只发一个 refresh 请求；并发 401 共享结果
// - httpOnly 凭证：refresh 成功后新 token 由后端 Set-Cookie: HttpOnly 自动写入，
//   前端 JS 拿不到也无需拿到 token 字符串——refreshSession 只负责"让凭证续期"，
//   续期成功后调用方直接重发原请求（cookie 自动携带新凭证）
// - 配置化：endpoint + 自定义 refresh 函数可配（后端契约确定后调整）
// - 失败传播：refresh 失败时抛出，由调用方（http.ts）决定后续行为（清标记 + 跳登录页）
```

### 2.2 关键函数

| 函数                         | 用途                                     | 文件:行号                                      |
| ---------------------------- | ---------------------------------------- | ---------------------------------------------- |
| `refreshSession()`           | 单例 refresh 入口（并发去重 + 失败传播） | `packages/shared/src/api/token-refresh.ts:89`  |
| `configureTokenRefresh(cfg)` | 自定义 endpoint + refresh 函数           | `packages/shared/src/api/token-refresh.ts:67`  |
| `_getCurrentConfig()`        | 读生效配置（refresh 端点 URL 判定）      | `packages/shared/src/api/token-refresh.ts:114` |
| `_resetRefreshing()`         | 清空 refresh 状态（**仅测试用**）        | `packages/shared/src/api/token-refresh.ts:109` |

### 2.3 默认配置

```ts
// packages/shared/src/api/token-refresh.ts:37-53
const DEFAULT_CONFIG: Required<TokenRefreshConfig> = {
  url: '/auth/refresh', // 相对 baseURL
  refresh: async () => {
    const baseURL = getAPIBaseURL() ?? ''
    await axios.post(
      `${baseURL}${currentConfig.url}`,
      {},
      {
        timeout: 15000,
        withCredentials: true, // ← 关键：浏览器自动携带旧凭证 cookie
      }
    )
  },
}
```

> **当前默认实现是占位**（`token-refresh.ts:14` 注释："当前 refresh 接口契约暂未与后端确认"）。**生产部署前**通过 `configureTokenRefresh()` 配置实际端点。

### 2.4 自定义 refresh 端点

```ts
// apps/admin/src/main.ts（应用启动时调一次，各 app 同理）
import { configureTokenRefresh } from '@api/token-refresh'

configureTokenRefresh({
  url: '/v2/auth/refresh-token', // 后端实际端点
  refresh: async () => {
    await fetch('/api/v2/auth/refresh-token', {
      method: 'POST',
      credentials: 'include', // ← 必须 include，否则 cookie 不带
    })
  },
})
```

### 2.5 自动 401 续期（`request<T>` 包裹层）

```ts
// packages/shared/src/api/http.ts:418-437（catch 块内 401 续期 + 单次 retry）
try {
  const res = await instance.request(...)
  // ...
} catch (err) {
  // 401 自动 refresh + retry（仅一次）：
  // refreshSession 成功后新凭证已由后端 Set-Cookie 写入，重发原请求自动携带
  if (
    err instanceof ApiError &&
    (err.code === 401 || err.code === BusinessCode.UNAUTHORIZED) &&
    !config._retried &&
    !isRefreshRequestUrl(config.url) && // refresh 端点本身 401 不再触发 refresh
    !isLoginRequestUrl(config.url) // 登录请求 401（如密码错误）不走 refresh 链（2026-10-28 修复）
  ) {
    try {
      await refreshSession()
      config._retried = true
      return await request<T>(config) // 递归重发
    } catch {
      // refresh 失败：登出 + 抛出原 ApiError
      await performLogout()
    }
  }
  throw err
}
```

### 2.6 并发去重

```ts
// packages/shared/src/api/token-refresh.ts:78-100（refreshingPromise 声明 + refreshSession）
let refreshingPromise: Promise<void> | null = null

export async function refreshSession(): Promise<void> {
  if (!refreshingPromise) {
    refreshingPromise = doRefresh()
  }
  try {
    await refreshingPromise
  } catch (err) {
    refreshingPromise = null // 失败时清空状态，下次重试可重新发起
    throw err
  }
}
```

同一时刻只发一个 refresh 请求：多个 401 同时触发时共享 Promise。**refresh 失败清空状态**，允许后续请求再次触发（不会"锁死"）。

### 2.7 失败兜底：`performLogout()` vs `resetLocalState()`

> 关键差异：两条路径**互不重叠**，文档必须分清。

| 路径                          | 触发场景                               | 副作用                                                                                                                             | 来源                                               |
| ----------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `http.ts::performLogout()`    | refresh 失败（凭证彻底失效，无法续期） | toast + `Session.remove('auth')` + 整页跳统一登录应用 `${VITE_AUTH_ORIGIN}/login?redirect=...`（auth/redirect.ts，非 router.push） | `packages/shared/src/api/http.ts:271-284`          |
| `userStore.resetLocalState()` | logout 主动退出 / `fetchProfile` 401   | 清标记 + `globalAbort.abort('logout')` + 经 `registerLocalStateResetHook` 注入的复位钩子 + `globalAbort.reset()`                   | `packages/shared/src/store/modules/user.ts:86-102` |

**为什么 http.ts 不直接调 `resetLocalState()`？**

- `resetLocalState()` 抛不出错，但 http.ts 必须在 refresh 失败后**继续抛出原 ApiError** 给业务侧（让业务能 catch + 上报）
- http.ts 与 user store **解耦**：避免 store 反向依赖 http.ts 形成循环
- http.ts 的兜底用最小组件：`Session.remove` + 路由跳转（业务侧也能感知）

### 2.8 ⚠️ 常见误区

| ❌ 误区                                | ✅ 实际行为                                                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| "我需要在前端读 token 拿去调别的 API"  | **读不到**。需要别的 API 时也走本项目 `axios` 实例，cookie 自动携带                                           |
| "我需要在 Session 存一份 token 备用"   | **不需要**。登录标记 `'auth'` 已足够；token 字符串前端永远不会拿到                                            |
| "我能在前端主动退出（清 cookie）"      | **不能**。HttpOnly cookie JS 删不了；必须走 `authApi.logout()` 让后端 `Set-Cookie: Max-Age=0`                 |
| "refresh 失败后能拿到一个明确的错误码" | **没有**。refresh 失败会触发 `performLogout()` 弹 toast + 跳登录页；原 ApiError 仍被抛出但业务通常 catch 不到 |
| "轮询 token 剩余有效期主动刷新"        | **没有也不需要**。401 触发式 refresh，无需前端读 token                                                        |

---

## 三、Global Abort（Logout 统一取消）

### 3.1 设计要点

```ts
// packages/shared/src/api/global-abort.ts:1-7
// 全局 AbortController 单例 + signal 合并工具。
// 用途：logout 等需要"一次性取消所有在途请求"的场景。
// 单例 signal 注入 http.ts 请求拦截器，logout 时统一 abort()。
```

### 3.2 工作流

```ts
// packages/shared/src/api/http.ts:142-147（applyAbortSignal，请求拦截器调用）
function applyAbortSignal(config: AxiosRequestConfig): void {
  config.signal = chainSignals(
    config.signal as unknown as AbortSignal | undefined,
    globalAbort.signal as AbortSignal | undefined
  ) as GenericAbortSignal
}

// packages/shared/src/store/modules/user.ts:86-102（resetLocalState 经钩子注入，
// 守卫状态 / 路由 UI store 复位不再内联——shared 包不反向依赖 app）
// admin 接线点：apps/admin/src/router/guards/auth.ts:38-40（registerLocalStateResetHook）
function resetLocalState(): void {
  Session.remove('auth')
  authenticated.value = false
  profile.value = null
  permissions.value = []
  globalAbort.abort('logout') // ← 所有在途请求立即取消
  // 逐个调用 app 侧经 registerLocalStateResetHook 注册的复位钩子
  // （单钩子失败不阻断其余）
  for (const hook of localStateResetHooks) {
    try {
      hook()
    } catch (err) {
      console.warn('[user] 登录态复位钩子执行失败（已跳过）:', err)
    }
  }
  globalAbort.reset() // ← 为下次登录创建新 controller
}
```

### 3.3 `globalAbort` 三方法

| 方法             | 用途                                        | 文件:行号                                    |
| ---------------- | ------------------------------------------- | -------------------------------------------- |
| `signal`         | 给 axios 请求拦截器注入的合并 signal        | `packages/shared/src/api/global-abort.ts:14` |
| `abort(reason?)` | 幂等取消（已 aborted 时再调用不抛错）       | `packages/shared/src/api/global-abort.ts:26` |
| `reset()`        | 仅在 `aborted === true` 时创建新 controller | `packages/shared/src/api/global-abort.ts:19` |

### 3.4 signal 合并工具

```ts
// packages/shared/src/api/global-abort.ts:45-52
export function chainSignals(...signals: (AbortSignal | undefined)[]): AbortSignal {
  const filtered = signals.filter((s): s is AbortSignal => s !== undefined)
  if (filtered.length === 0) return new AbortController().signal // 占位（永不 abort）
  if (filtered.length === 1) return filtered[0]!
  return AbortSignal.any(filtered) // 任一触发即中止
}
```

> **业务侧通常不需要直接用**——`http.ts` 自动给每个请求注入 `globalAbort.signal`。
>
> 但如需"路由切换时取消本页未完成请求"，应配合下一节的 `createAbort()` / `linkAbort()`。

---

## 四、AbortController 工具（`cancel.ts`）

### 4.1 基础用法

```ts
import { createAbort, withAbort } from '@api/cancel'

const ctrl = createAbort()
const result = await request({ url: '/slow', method: 'get', ...withAbort(ctrl) })

// 主动取消（带 reason 便于排查）
ctrl.abort('user-cancelled')
```

### 4.2 路由切换 + 组件卸载双触发

```ts
import { createAbort, linkAbort } from '@api/cancel'
import { onBeforeRouteLeave, onUnmounted } from 'vue-router'

const localCtrl = createAbort()
const route = useRoute()

onBeforeRouteLeave(() => {
  localCtrl.abort('route-leaving') // 路由切换：取消当前页未完成请求
})

onUnmounted(() => {
  localCtrl.abort('component-unmounted') // 组件卸载：保险
})

async function fetchData() {
  return request({ url: '/data', signal: localCtrl.signal })
}
```

### 4.3 流式请求的 signal 联动

```ts
import { requestStream } from '@api/stream'
import { createAbort, linkAbort } from '@api/cancel'

const localCtrl = createAbort()
const handle = requestStream({
  url: '/ai/stream',
  signal: localCtrl.signal, // 任一 abort 都会终止流
  onMessage: (chunk) => {
    /* ... */
  },
})

onUnmounted(() => localCtrl.abort())
```

---

## 五、🆚 决策表

| 需求                    | 用什么                                            |
| ----------------------- | ------------------------------------------------- |
| 401 自动重试            | 无需任何代码（`request<T>` 默认行为）             |
| 自定义 refresh 端点     | `configureTokenRefresh({...})` 在 `main.ts`       |
| Logout 取消在途请求     | 无需任何代码（`userStore.logout()` 自动）         |
| 凭证失效兜底            | `userStore.resetLocalState()`（守卫 / logout 用） |
| refresh 失败兜底        | `http.ts performLogout()`（业务侧无需介入）       |
| 单次请求主动取消        | `createAbort()` + `withAbort()`                   |
| 路由切换取消            | `createAbort()` + `onBeforeRouteLeave`            |
| 组件卸载取消            | `createAbort()` + `onUnmounted`                   |
| 外部 signal 联动本地    | `linkAbort(external, local)`                      |
| 401 后业务侧 catch 报错 | `err instanceof ApiError && err.code === 401`     |

---

## 六、📚 速查

```ts
// 最小可运行：组件级 cancel
const ctrl = createAbort()
onUnmounted(() => ctrl.abort())
const data = await request({ url: '/x', signal: ctrl.signal })

// 最小可运行：路由切换 cancel
onBeforeRouteLeave(() => ctrl.abort('route-leaving'))
```

---

## 七、修订记录

| 版本   | 日期       | 变更                                                                                                                                                                                               |
| ------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v1.0.0 | 2026-07-xx | 初版：基于 Bearer token + `getValidToken()`                                                                                                                                                        |
| v2.0.0 | 2026-08-12 | httpOnly 改造，refresh 契约从 `getValidToken()` 变为 `refreshSession()`（部分章节）                                                                                                                |
| v3.0.0 | 2026-09-04 | **整文档按 httpOnly 模式重写**：去掉 Bearer header 注入描述；新增"认证模型"基础章节；明确 `performLogout()` vs `resetLocalState()` 两条兜底路径的差异；移除"轮询 token 剩余有效期"等已不可能的描述 |

---

_相关源码：`packages/shared/src/api/token-refresh.ts` + `packages/shared/src/api/global-abort.ts` + `packages/shared/src/api/cancel.ts` + `packages/shared/src/store/modules/user.ts`_
_相关测试：3 个 `.spec.ts` 共 28 用例（token-refresh 9 + cancel 7 + global-abort 12）_
_当前限制：默认 refresh 端点是占位（`/auth/refresh`），后端契约确定后需调 `configureTokenRefresh()`_
