# 请求层评估与增量重构 — 设计说明

> 日期：2026-07-22
> 范围：`src/api/` 全部

## 一、目标

> 取其精华去其糟粕——只参考参考项目的优秀设计，自己实现，融合社区最佳实践

参考项目 `D:\personal\vue3-admin\src\request` 借鉴要点：

1. **单一 axios 实例 + 拦截器分层**（职责清晰）
2. **方法集合（get/post/put/delete/...）**：调用直观
3. **50ms 时间窗口合并**：抗并发抖动

应规避的糟粕：

1. **写请求默认合并**（POST/PUT/PATCH/DELETE 一刀切 → 掩盖失败）
2. **`any` 滥用**（8 处）
3. **业务码不解包**（响应拦截器只处理 HTTP 状态码文案）
4. **Token 写死**（无真实持久化）
5. **`as never` 逃类型**
6. **环境变量前缀不一致**（`VUE_APP_*` vs `VITE_*`）
7. **无自动化测试**

## 二、目标态架构

```
src/api/
├── http.ts           # axios 实例 + 拦截器 + request<T>（改造 + 强化类型）
├── types/
│   ├── api.d.ts      # ApiResponse<T>（已存在，未变）
│   └── error.ts      # ApiError（新增）
├── cancel.ts         # AbortController 工具集（新增）
├── retry.ts          # withRetry + isIdempotent（新增）
├── deduper.ts        # withDedup（新增，仅 GET/HEAD 默认合并）
└── modules/          # auth/menu/user（不变，业务零迁移）
```

## 三、设计要点

### 1. `http.ts` 类型强化

| 旧                                             | 新                                                                                |
| ---------------------------------------------- | --------------------------------------------------------------------------------- |
| `((response) => { ... }) as never`             | 拆为 `onResponseFulfilled(response): AxiosResponse<...>`，签名天然满足 axios 类型 |
| 数据解包在拦截器                               | 数据解包下沉到 `request<T>()` 的 `.then(res => res.data.data)`，职责清晰          |
| 错误抛裸 `Error`                               | 统一抛 `ApiError`（code/status/message/url/cause）                                |
| `localStorage.getItem('token')`                | `Session.get<string>('token')`，对齐 storage 命名空间                             |
| HTTP 401 仅 `localStorage.removeItem('token')` | 同时 `Session.remove('token')` + `clearCookies()`                                 |

### 2. `deduper.ts` 写请求白名单

```ts
shouldDedup(config, opts) // 返回 0 = 不合并，>0 = 窗口毫秒
```

- 默认 `methods: ['get', 'head']`；
- 写操作（POST/PUT/PATCH/DELETE）默认 `shouldDedup → 0`，绝对不合并；
- 调用方可通过 `dedup: 'never' | 'auto' | number` 覆盖；
- 同 `key`（method + url + sortedParams + sortedData）的请求共享 Promise，windowMs 后清空桶。

### 3. `retry.ts` 幂等保护

```ts
withRetry(fn, { retries: 2, baseDelay: 300, backoff: 2, shouldRetry? })
isIdempotent(method, { idempotent? })
```

- 仅对 GET/HEAD/OPTIONS（默认）或 `idempotent: true` 启用；
- 默认 `shouldRetry`：ApiError.status >= 500 才重试（避免对 4xx 重试）；
- `withRetry` 不感知 axios，业务侧自己调用：`withRetry(() => request<T>({...}), { retries: 2 })`。

### 4. `cancel.ts` AbortController 集成

```ts
createAbort(reason?)        // AbortHandle = { signal, abort() }
withAbort(handle)           // → { signal } 注入 axios config
linkAbort(ext, local)       // 外部信号触发本地 abort
```

### 5. `types/error.ts` ApiError

```ts
class ApiError extends Error {
  code: number // 业务码或 HTTP 状态码
  status: number | undefined // HTTP 状态码（业务错误时为 undefined）
  url: string | undefined
  cause: unknown // 原始 axios 错误
}
```

`isApiError(err: unknown)` 类型守卫。

## 四、不变性约束

- 行数：所有新文件 ≤ 150 行（实测 ≤ 110 行）
- 无 `any` / `as never`（http.ts 与全部 spec.ts）
- 业务侧 `modules/*.ts` 零改动
- 不引入新依赖（仅复用 `axios` + `js-cookie` + 原生 `AbortController`）
- 不复制参考项目源码：仅借鉴"50ms 合并"思想，deduper 自行实现

## 五、验证清单

- [x] `pnpm test src/api` → 39/39 通过
- [x] `pnpm type-check` → 通过
- [x] `pnpm lint src/api` → 通过
- [ ] 手动跑登录 → Dashboard → 用户列表 → 退出，确认 401 跳转 + 并发去重 + 路由切换取消
- [ ] `pnpm build` 成功，体积报告无明显回退

## 六、后续可选

- 在 store/composable 中按需接入 `withRetry` / `createAbort`（本期未启用，避免作用域蔓延）
- mock 增加 `idempotent: true` 测试用例
