# Zod 请求校验使用规范

> **文档版本**：v1.0.1 | **最后更新**：2026-09-04
> **能力来源**：`packages/shared/src/api/validator.ts`（CHANGELOG 未记录，2026-07-24 审计补齐文档；2026-09-04 同步测试用例）

---

## 📋 概述

`requestValidated(schema, config)` 在 `request<T>()` 之上叠加 **Zod schema 运行时校验**。后端接口返回的 JSON 与 TS 类型不一致时**启动期/首次请求即失败**，而不是等用户操作时崩。

---

## 🎯 何时使用

| 场景                               | 用 `request<T>()` | 用 `requestValidated(schema, config)` |
| ---------------------------------- | ----------------- | ------------------------------------- |
| 内部已知接口、稳定契约             | ✓                 | —                                     |
| 后端契约可能漂移 / 新接口          | —                 | ✓                                     |
| 关键数据（用户信息、权限码、配置） | —                 | ✓                                     |
| 列表分页（量大、字段多）           | ✓（fail-soft）    | 可选（fail-hard）                     |
| 流式响应（stream）                 | ✗（不支持）       | ✗（不支持）                           |

---

## 🚀 基础用法

### 单 endpoint 校验

```ts
import { z } from 'zod'
import { requestValidated } from '@api/validator'

const EquipmentSchema = z.object({
  id: z.number(),
  deviceName: z.string(),
  status: z.enum(['online', 'offline', 'maintenance']),
  createdAt: z.string().datetime(),
})

const item = await requestValidated(EquipmentSchema, {
  url: '/equipment/1',
  method: 'get',
})
// item 类型：z.infer<typeof EquipmentSchema> = { id: number; deviceName: string; ... }
```

### 列表校验（嵌套 Pagination）

```ts
const EquipmentListSchema = z.object({
  list: z.array(EquipmentSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
})

const page = await requestValidated(EquipmentListSchema, {
  url: '/equipment/list',
  method: 'get',
  params: { page: 1, pageSize: 20 },
  usePageAdapter: true,
})
```

### 复用 schema

```ts
// apps/<a>/src/modules/equipment/types.ts
export const EquipmentSchema = z.object({/* ... */})
export type Equipment = z.infer<typeof EquipmentSchema>

// 业务组件
import { requestValidated } from '@api/validator'
import { EquipmentSchema, type Equipment } from '@/modules/equipment/types'

const data: Equipment = await requestValidated(EquipmentSchema, { url: '/equipment/1' })
```

---

## ⚠️ 失败行为

校验失败时**抛 ApiError**（`code: 500, message: "数据格式异常：<details>"`），**不 toast**（避免吓到用户）。

`http.ts` 响应拦截器会拦截到 console.error，详情在 dev 模式可见：

```
[validator] schema 验证失败: id: expected number, received string; status: invalid enum value
```

> 实现细节（`packages/shared/src/api/validator.ts`）：错误信息取前 3 条 issue（避免堆栈过长），格式为 `<path>: <message>`；多条用 `; ` 拼接。

业务侧 try/catch 即可拿到 ApiError：

```ts
try {
  const data = await requestValidated(EquipmentSchema, { url: '/equipment/1' })
} catch (err) {
  // err instanceof ApiError && err.code === 500
  // 推荐：上报到 errorHandler.report(err, { source: 'equipment-detail' })
}
```

---

## ✅ 真实接入案例：auth 响应契约（P1，2026-10-27）

`packages/shared/src/api/modules/auth.ts` 的 `login` / `fetchProfile` 已接入——schema 与 API **同址声明**（`loginResultSchema` / `userProfileSchema`），`LoginResult` / `UserProfile` 类型经 `z.infer` 推导（类型与运行时校验同源）。响应漂移在 API 边界抛 `ApiError(code=500)`（详细 issues 记 console.error，不 toast、不打印密码/cookie）。mock 经 `import type` 消费推导类型，保持零运行时依赖。

要点：

- 用 `.passthrough()` 保留后端新增字段（前向兼容，不裁剪未知键）——见上文「字段扩展」节的取舍
- 只读响应接口适合首批发试点；菜单递归 schema（部分非法项跳过的容错语义）暂不接
- `silent` 探测标记（`fetchProfile({ silent: true })`）原样透传 HTTP 层，schema 层不吞错误语义

---

## 🧩 高级用法

### 1. zod 内置 transformer（类型转换）

```ts
const QuerySchema = z.object({
  page: z.coerce.number(), // "1" → 1
  keyword: z.string().optional(), // undefined 也合法
  createdAt: z.string().datetime().nullable(), // null 合法
})
```

### 2. 字段扩展（后端多返回字段）

```ts
const EquipmentSchema = z
  .object({
    id: z.number(),
    deviceName: z.string(),
  })
  .passthrough() // 后端多返回的字段保留，不抛错
```

### 3. 与 useRequest 组合

```ts
import { useRequest } from '@vv/shared' // 或由 AutoImport 自动注入，免 import
import { requestValidated } from '@api/validator'

const { data, error, loading } = useRequest(() =>
  requestValidated(EquipmentSchema, { url: '/equipment/list' })
)
```

---

## 📚 速查

```ts
// 最小可运行示例
import { z } from 'zod'
import { requestValidated } from '@api/validator'

const UserSchema = z.object({ id: z.number(), name: z.string() })
const user = await requestValidated(UserSchema, { url: '/user/1' })
```

---

## 🆚 vs `request<T>()` vs `validator()`

| 维度     | `request<T>`      | `requestValidated`             | `validator()`    |
| -------- | ----------------- | ------------------------------ | ---------------- |
| 校验时机 | 编译期（TS 类型） | 运行时（HTTP 响应后）          | 任意             |
| 校验工具 | TS 类型（静态）   | Zod schema                     | Zod schema       |
| 失败行为 | 编译错误          | 抛 ApiError + console.error    | 抛 ApiError      |
| 业务场景 | 日常调用          | 关键接口 / 新接口 / 不稳定契约 | 已有数据二次校验 |

## 🧪 单测覆盖

`packages/shared/src/api/validator.spec.ts` 5 例：

- validate（基础 4 例）：合法数据通过 / 非法数据抛 ApiError（code=500）/ 多层 path 错误格式化 / 多个错误只取前 3 个
- requestValidated（包装 1 例）：mock http 模块后验证响应

---

_相关源码：`packages/shared/src/api/validator.ts`（66 行）+ `packages/shared/src/api/validator.spec.ts`（5 例）_
_相关依赖：[Zod](https://zod.dev) v4（`^4.4.3`，package.json）_
