# useRequest 三态请求使用规范

> **文档版本**：v1.2.0 | **最后更新**：2026-09-11
> **能力来源**：`packages/shared/src/composables/useRequest.ts`（215 行）+ `packages/shared/src/composables/useRequest.spec.ts`
> **状态**：v1.2 在 v1.1 基础上新增「快速重复点击竞态保护」机制说明 + 修正 `useRequestReturn.aborted` 字段（实际为 `Ref<boolean>`，旧版误写 `Ref<...>`） + 补全「与 useRequest 配合 AsyncState」最佳实践段。接口、返回值、行为细节以 `packages/shared/src/composables/useRequest.ts` 为准；如有差异以源码为准。

---

## 📋 概述

`useRequest(fetcher, options?)` 是 **VueUse useFetch 风格的三态请求封装**，对齐业界最流行 API 设计（~6M 下载/月）。

适用场景：**业务组件需要"加载中 / 成功 / 失败"三态数据**——比手写 `ref + await request()` + `loading` + `error` 状态机更简洁。

---

## 🎯 何时使用

| 场景                     | 用 `useRequest`   | 用 `AsyncState` 组件 | 用 `request()` 直接调 |
| ------------------------ | ----------------- | -------------------- | --------------------- |
| 组件首屏拉数据           | ✓                 | ✓（配合 useRequest） | —                     |
| 关键词搜索（响应式触发） | ✓（watch 选项）   | —                    | —                     |
| 流式响应                 | ✗（不支持）       | —                    | `requestStream`       |
| 一次性操作（如提交）     | ✗                 | —                    | ✓（直接 await）       |
| 多接口聚合               | ✗（单一 fetcher） | —                    | Promise.all           |

---

## 🚀 基础用法

### 单次拉取（onMounted 自动）

```vue
<script setup lang="ts">
import { useRequest } from '@vv/shared' // 或由 AutoImport 自动注入，免 import
import { equipmentApi } from '@api/modules/equipment'

const { data, loading, error, isEmpty, refresh } = useRequest(() =>
  equipmentApi.getList({ page: 1, pageSize: 20 })
)
</script>

<template>
  <AsyncState :loading="loading" :error="error" :is-empty="isEmpty">
    <div v-for="item in data?.list ?? []" :key="item.id">{{ item.name }}</div>
  </AsyncState>
</template>
```

### 响应式触发（关键词变化自动重拉）

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useRequest } from '@vv/shared' // 或由 AutoImport 自动注入，免 import

const keyword = ref('')

const { data } = useRequest(
  () => equipmentApi.search({ keyword: keyword.value }),
  { watch: [keyword] } // keyword 变化自动重拉
)
</script>
```

### SSR / 缓存预填

```ts
const { data } = useRequest(() => userApi.getById(id.value), {
  initialData: { id: 0, name: '加载中...' }, // SSR 预填，避免闪烁
  immediate: false, // 手动控制触发时机
})
```

### 主动取消（路由切换 / 组件卸载）

```ts
const { cancel, aborted } = useRequest(() => slowApi.fetch())

onBeforeRouteLeave(() => cancel()) // 路由切换取消
onUnmounted(() => cancel()) // 组件卸载保险
```

---

## 📦 返回值

```ts
interface UseRequestReturn<T, P> {
  data: Ref<T | null> // 响应数据
  loading: Ref<boolean> // 是否正在加载
  error: Ref<UseRequestError | null> // 错误对象（含 flags）
  isEmpty: ComputedRef<boolean> // non-loading + non-error + data===null
  statusCode: Ref<number | null> // HTTP 状态码
  aborted: Ref<boolean> // 是否被主动取消
  execute: (...args: P) => Promise<void> // 手动触发
  refresh: (...args: P) => Promise<void> // 同 execute（语义化别名）
  cancel: () => void // 主动取消 in-flight 请求
}
```

`UseRequestError.flags` 自动识别：

| Flag                 | 触发条件                                                | 业务处理建议           |
| -------------------- | ------------------------------------------------------- | ---------------------- |
| `err.isAborted`      | `cancel()` 主动取消                                     | 静默（不 toast）       |
| `err.isTimeout`      | axios code `ECONNABORTED`                               | 提示"网络超时，请重试" |
| `err.isNetworkError` | axios code `ERR_NETWORK` / `ECONNREFUSED` / `ENOTFOUND` | 提示"网络异常"         |
| 其它                 | 业务错误 / HTTP 5xx                                     | 走 ApiError.message    |

---

## 🔄 行为细节

### 1. 取消语义

`useRequest` 内部用 AbortController 跟踪 in-flight 请求：

- 快速重复点击（同一组件内）→ 取消上一次的 Promise + 立即发新一次
- 主动 `cancel()` → 当前请求 abort，结果丢弃
- 组件 unmount 时**不会自动 cancel**（业务侧需手写 `onUnmounted(() => cancel())`）

### 2. 取消后 error 处理

```ts
// 取消时 error.value 不会设为 axios 错误，而是构造轻量错误：
const cancelErr: UseRequestError = new Error('Request aborted')
cancelErr.isAborted = true
```

业务侧用 `err.isAborted` 判断后静默处理（不 toast）。

### 3. watch 选项（替代旧名 deps）

```ts
// 推荐：与 Vue watch API 对齐
useRequest(fetcher, { watch: [keyword, status] })

// 旧名（仍可使用，v2 兼容）
useRequest(fetcher, { deps: [keyword] })
```

### 4. 与 useRequest 配合 AsyncState

`AsyncState` 组件接收 `loading / error / isEmpty` 三个 prop。`useRequest` 返回这三个 ref，组合即"三态完整闭环"。

---

## 🆚 决策表

| 场景               | 推荐方案                                                   |
| ------------------ | ---------------------------------------------------------- |
| 列表首屏           | `useRequest` + `<AsyncState>`                              |
| 关键词搜索         | `useRequest` + `{ watch: [keyword] }`                      |
| 表单提交（一次性） | 直接 `await request()`，无需 useRequest                    |
| 流式数据           | `requestStream`（不支持 useRequest）                       |
| 详情页（动态参数） | `useRequest(() => api.getById(id.value), { watch: [id] })` |
| 聚合多接口         | `Promise.all([api1, api2])` 配 manual 模式                 |

---

## ⚠️ 已知限制

1. **不与 `cache` 集成**：`useRequest` 内部 fetcher 直接调 `request<T>()`，可通过 fetcher 显式传 `cache: { ttl }`
2. **不支持流式**：`useRequest` 是一次性 fetch 语义；流式用 `requestStream`
3. **不持久化**：组件 unmount 后 `data` 消失；如需持久化用 Pinia store

---

## 📚 速查

```ts
// 最小可运行
const { data, loading, error, refresh } = useRequest(() => api.getList())
```

---

_相关源码：`packages/shared/src/composables/useRequest.ts` + `packages/shared/src/composables/useRequest.spec.ts`_
_对齐参考：[VueUse useFetch](https://vueuse.org/core/usefetch/)_
_配合使用：`<AsyncState>` 组件 / `@api/validator` / `@api/cancel`_
