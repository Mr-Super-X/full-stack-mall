# 流式请求使用规范

> **文档版本**：v1.0.1 | **最后更新**：2026-09-04
> **能力来源**：`packages/shared/src/api/stream.ts`（CHANGELOG 未记录，2026-07-24 审计补齐文档；2026-09-04 同步 httpOnly 改造）
>
> ⚠️ **已知不一致（2026-08-12 httpOnly 改造遗留）**：`requestStream` 当前仍走 `Authorization: Bearer <Session.get('token')>` 头，但 httpOnly 模式下 Session 不再持有 token（凭证由后端 `Set-Cookie: HttpOnly` 下发，前端 JS 不可读）。见 §2 与 §已知问题。

---

## 📋 概述

`requestStream<T>()` 是项目内置的流式请求工具，基于 `fetch` + `ReadableStream`，**不走 axios**（axios 不支持 SSE / NDJSON 流的精细控制）。

适用场景：

- **AI chat 流式输出**：每收到一段 token 立即渲染
- **日志流**：服务端按行推送日志（NDJSON）
- **实时通知**：SSE 长连接

---

## 🎯 三种流格式

| 格式               | 触发                 | 数据形态                        | 典型用途                 |
| ------------------ | -------------------- | ------------------------------- | ------------------------ |
| `auto`（**默认**） | 自动检测首行 `data:` | 自适应                          | 不确定后端格式时         |
| `sse`（显式）      | 每行以 `data:` 开头  | 字符串 JSON + `[DONE]` 结束标记 | OpenAI / Claude 风格 SSE |
| `ndjson`           | 每行一个 JSON        | 纯 JSON（无前缀）               | 日志流 / 事件流          |

---

## 🚀 基础用法

### SSE 流（AI chat）

```ts
import { requestStream } from '@api/stream'

const handle = requestStream<ChatChunk>({
  url: '/ai/chat/stream',
  method: 'POST',
  data: { prompt: '写一首诗' },
  format: 'sse', // 显式指定；不写则默认 auto
  onMessage: (chunk) => {
    console.log('收到 chunk:', chunk.content)
    // 业务侧维护累积响应：responseText += chunk.content
  },
  onError: (err) => console.error('流错误:', err),
})

// 主动终止（如用户点"停止生成"）
button.onClick = () => handle.cancel()

// 等流结束
await handle.done
```

### NDJSON 流（日志）

```ts
const handle = requestStream<LogEvent>({
  url: '/logs/stream?service=auth',
  format: 'ndjson',
  onMessage: (event) => logStore.push(event),
})
```

### 取消外部 signal 联动

```ts
import { createAbort, linkAbort } from '@api/cancel'

const localCtrl = createAbort()
const handle = requestStream({
  url: '/ai/stream',
  signal: localCtrl.signal, // 外部信号：与 handle.cancel 任一触发都会终止
  onMessage: (chunk) => {
    /* ... */
  },
})

// 路由切换 + 组件卸载双触发：useLinkAbort 把组件 unmount 联动进来
onUnmounted(() => localCtrl.abort('component-unmounted'))
```

---

## ⚠️ 注意事项

### 1. 失败语义：onError + done 双通道

```ts
const handle = requestStream({
  url: '/ai/stream',
  onMessage: (chunk) => {
    /* ... */
  },
  onError: (err) => {
    // 网络错误 / 解析失败 / 流中断都会触发
    showToast('流连接异常')
  },
})

await handle.done // done 永远 resolve（不 reject）；错误通过 onError 回调
```

`done` 不抛异常——错误**只在 onError 回调中传递**。这是与 axios `request()` 的关键区别。

### 2. Auth 自动注入（**当前与 httpOnly 模式不一致，待修复**）

`requestStream` 内部自动读 `Session.get('token')` 并加 `Authorization: Bearer <token>` 头。
**该行为与 `http.ts` 已不一致**：

- `http.ts` 在 2026-08-12 httpOnly 改造后改为 `withCredentials: true`，由浏览器自动携带 cookie，不再读 Session
- `requestStream` **尚未切换**——仍读 Session（httpOnly 模式下永远是 null），且未配 `credentials: 'include'`
- 因此 httpOnly 模式下流式请求**无法携带凭证**（cookie 不会随 fetch 发出，Session.get('token') 也拿不到值）

> 计划修复方向：把 `stream.ts` 第 83-84 行的 `Session.get('token') + Authorization` 改为 fetch 的 `credentials: 'include'`（与 http.ts 一致）；目前临时方案是业务侧在 url 上拼 token query 参数（**仅限流式端点内部网络**，不推荐公网）。详见 §已知问题。

### 3. 解析容错

单行 JSON 解析失败时 `onError` 触发，**流不中断**（容忍单条脏数据）。如果后端偶尔推一行非 JSON 也不会让整个流崩溃。

### 4. dev 模式 / prod 模式

dev 模式下 Vite 代理可转发 SSE；prod 部署需 nginx 配置：

```nginx
location /api/ai/ {
  proxy_pass http://backend;
  proxy_buffering off;  # SSE 必须关闭缓冲
  proxy_set_header Connection '';
  proxy_http_version 1.1;
}
```

> 本地 `pnpm dev:gateway` 的 node 网关（scripts/node-gateway.ts）流式 pipe 无缓冲，
> 无需任何 SSE 专属配置——上表仅为「未来切回 nginx / 生产自建网关」的部署参考。

#### dev 下的 SSE mock（2026-10-26 落地）

`packages/mock/src/stream.ts` 提供 `POST /api/ai/chat/stream` 的流式 mock：`rawResponse`
**挂起式**逐 chunk 推送（`await` 挂起期间 connect 中间件不返回、res 全程受控——
Promise 在 res.end() 后才 resolve；客户端断连须监听 `req.on('close')` 清理定时器，
两条约束同 mock/auth.ts 的 setTimeout 404 事故根因）。配套演示：**docs app `<base>/demo/stream-request`**（base 取决于各 app VITE_BASE/base
配置，`/docs` 仅为仓库目录名而非路由段；requestStream 打字机累积 / handle.cancel() 停止 /
onError 重试三态）。

**仅 dev 可用**：prod 的 `createProdMockServer` 是 mockjs XHR 劫持——不拦截
stream.ts 的 fetch（且 rawResponse 在 client 侧被静默忽略），gh-pages 上流演示不可用
（demo 组件以提示文案降级）。prod 豁免登记在 `scripts/check-mock-wiring.ts` 的
`PROD_INLINE_EXEMPT`（豁免语义与 auth 的 rawResponse 一致且更彻底：fetch 穿透
意味着内联 response 形态也无济于事）。

---

## 🆚 vs `request<T>()`

| 维度     | `request<T>()`              | `requestStream<T>()`                                      |
| -------- | --------------------------- | --------------------------------------------------------- |
| 通信模式 | 一问一答                    | 服务器主动推                                              |
| 错误处理 | `try/catch` 捕获 ApiError   | `onError` 回调 + `done` Promise                           |
| 数据形态 | 单个 T                      | 多个 T（按消息）                                          |
| 底层     | axios + withCredentials     | fetch + ReadableStream（**未配 credentials: 'include'**） |
| Auth 头  | cookie 自动携带（httpOnly） | Session Bearer（**httpOnly 模式下失效**）                 |
| 取消     | AbortController             | `handle.cancel()`                                         |

---

## 📚 速查

```ts
// 最小可运行 SSE 示例
const handle = requestStream<{ content: string }>({
  url: '/chat',
  method: 'POST',
  data: { q: 'hi' },
  onMessage: ({ content }) => (responseText += content),
})
await handle.done
```

## 🐛 已知问题

### I1. httpOnly 模式下 Auth 失效（2026-08-12 改造遗留）

- **现象**：httpOnly 模式下调用 `requestStream`，后端收到请求但拿不到用户身份（cookie 未随 fetch 发出 + Session.get('token') 永远返回 null）
- **根因**：`packages/shared/src/api/stream.ts:86-87` 仍走 `Session.get('token') + Authorization Bearer`，与 `http.ts` 已切换到 `withCredentials: true` 不一致
- **临时方案**（按需评估）：
  - 业务侧在 url 上拼接 token query 参数（仅限可信内网，**不推荐公网**）
  - 或后端单独开放 SSE 端点的免鉴权白名单（适用于 AI 演示场景）
- **彻底修复**：把 `stream.ts` 第 89-95 行 `fetchImpl(...)` 调用改为带 `credentials: 'include'`，移除 Session.get('token') 那两行（参照 http.ts 的 `withCredentials: true`）

---

_相关源码：`packages/shared/src/api/stream.ts` + `packages/shared/src/api/stream.spec.ts`_
_相关能力：`@api/cancel`（AbortController 工具；`@api` 别名 → `packages/shared/src/api`，跨包根 barrel 刻意不聚合 api）_
_相关待办：`stream.ts` Auth 改造（与 http.ts 对齐 httpOnly 模式）—— 见 §I1_
