# Vue 3 + Vite + TS 脚手架设计

> **变更摘要**：基于 create-vue 官方模板改造的 Feature-Sliced 风格脚手架，预置 Element Plus、UnoCSS、i18n、Mock、Vitest，按全局/模块双层状态管理。

| 属性     | 值                           |
| -------- | ---------------------------- |
| 项目代号 | vue3-vite-project            |
| 创建日期 | 2026-07-17                   |
| 版本     | v1.0.0                       |
| 状态     | 设计已批准，待 writing-plans |
| 实施路径 | 基于 create-vue 改造         |
| 目标读者 | 前端开发、Code Review        |

---

## TL;DR

用 `pnpm create vue@latest` 生成官方 Vue 3 + Vite 6 + TS 模板，再按 Feature-Sliced 风格改造：每个业务模块（auth、user、dashboard）独立自治，全局 store 只放跨模块共享状态，预置三态异步组件、Axios 拦截器、vite-plugin-mock、Vitest 示例。**重点是模块边界铁律 + 防御性 UI 三态 + 不依赖后端即可独立跑通**。

---

## 1. 背景与目标

### 1.1 项目背景

`vue3-vite-project` 是工贸统一登录方向的门户前端，需要支持：

- 多业务模块（认证、用户管理、仪表盘，后续扩展）
- 中后台交互模式（表格、表单、权限控制）
- 国际化（中英文切换）
- 不依赖后端即可联调（前端先行）

### 1.2 脚手架目标

| 目标          | 衡量标准                                 |
| ------------- | ---------------------------------------- |
| **模块独立**  | 每个模块可独立开发、独立测试、独立部署   |
| **状态清晰**  | 全局 vs 模块状态边界明确，无交叉依赖     |
| **防御性 UI** | 每个异步组件显式 Loading/Error/Empty     |
| **可 Mock**   | 不启动后端即可完整跑通业务流程           |
| **可测试**    | 预置 Vitest + 示例，业务代码按需补充测试 |
| **可扩展**    | CSS、状态、UI 库都不锁定单一方案         |

### 1.3 范围控制（YAGNI）

**显式不包含**（避免为"未来可能用到"增加复杂度）：

- ESLint / Prettier 配置（用户选择不装）
- Playwright E2E（脚手架阶段不预置）
- Sentry 错误监控（留 TODO 接口，后续接入）
- Docker / CI 配置（基础设施层独立）
- 权限指令 v-permission（保留目录，但不实现）
- i18n 词条（仅留 zh-CN/en-US 空文件，按需填充）

---

## 2. 技术栈与依赖

| 维度           | 选型                    | 版本范围               | 决策依据          |
| -------------- | ----------------------- | ---------------------- | ----------------- |
| **核心框架**   | Vue                     | `^3.5.x`               | 最新稳定版        |
| **构建工具**   | Vite                    | `^6.x`                 | HMR < 50ms        |
| **语言**       | TypeScript              | `^5.6.x`               | strict 模式       |
| **包管理器**   | pnpm                    | `>=9.x`                | 架构指定          |
| **Node 要求**  | Node.js                 | `>=20.19` 或 `>=22.12` | Vite 6 要求       |
| **UI 组件库**  | element-plus            | `^2.8.x`               | 用户澄清选择      |
| **原子化 CSS** | unocss                  | `^0.65.x`              | 用户目录指定      |
| **预处理器**   | sass                    | `^1.80.x`              | Element Plus 主题 |
| **状态管理**   | pinia                   | `^2.2.x`               | Vue 3 官方推荐    |
| **路由**       | vue-router              | `^4.4.x`               | 文件级懒加载      |
| **国际化**     | vue-i18n                | `^10.x`                | Composition API   |
| **网络层**     | axios                   | `^1.7.x`               | 拦截器封装        |
| **API Mock**   | vite-plugin-mock        | `^3.x`                 | 用户澄清选择      |
| **测试框架**   | vitest                  | `^2.1.x`               | Vite 生态原生     |
| **测试工具**   | @vue/test-utils + jsdom | `^2.4.x` / `^25.x`     | 组件测试          |
| **类型工具**   | @types/node             | `^22.x`                | Node 环境类型     |

### 2.1 npm 包验证（CLAUDE.md 强制）

实施阶段执行 `npm view <package>` 验证每个包存在性与版本：

- `npm view element-plus versions --json`
- `npm view unocss versions --json`
- `npm view vite-plugin-mock versions --json`
- 等等

**铁律**：禁止凭记忆写包名或版本号。

---

## 3. 决策记录

### 3.1 关键澄清（来自 brainstorming 阶段）

| #   | 问题              | 决策                                      | 影响                   |
| --- | ----------------- | ----------------------------------------- | ---------------------- |
| 1   | UI 组件库         | **Element Plus**                          | 主题、图标、按需引入   |
| 2   | 状态管理边界      | **全局只放跨模块共享状态**                | Feature-Sliced 标准    |
| 3   | CSS 方案          | **同时支持 scss、less、UnoCSS、原生 css** | 全栈预处理器支持       |
| 4   | 国际化            | **需要**                                  | 装 vue-i18n + locales/ |
| 5   | API Mock          | **vite-plugin-mock**                      | mock/ 目录 + vite 配置 |
| 6   | 测试              | **预置 Vitest + 示例**                    | 装依赖 + 示例测试      |
| 7   | ESLint + Prettier | **不装**                                  | 不增加心智负担         |
| 8   | 脚手架创建路径    | **A. 基于 create-vue 改造**               | 官方保障 + 业务定制    |

### 3.2 设计中的次级决策

| #   | 问题                  | 决策                                                                   |
| --- | --------------------- | ---------------------------------------------------------------------- |
| 9   | Element Plus 引入方式 | unplugin-vue-components + unplugin-auto-import（按需）                 |
| 10  | TS 模式               | strict 全开（含 noUncheckedIndexedAccess、exactOptionalPropertyTypes） |
| 11  | 路由解耦              | `props: true` 解耦，避免 `useRoute()` 直读                             |
| 12  | views/ 兜底层         | 仅留 `.gitkeep`，所有页面进 modules                                    |
| 13  | build/ 目录           | 放 Vite 插件细粒度配置（按需扩展）                                     |
| 14  | 测试文件位置          | 与源码同级（`format.ts` → `format.spec.ts`）                           |
| 15  | 覆盖率门槛            | 70%（脚手架阶段宽松，业务阶段提到 80%）                                |
| 16  | 错误页位置            | `modules/error/views/`（业务模块同级）                                 |
| 17  | Playwright            | 脚手架不预置（后续按需加）                                             |
| 18  | Sentry                | 留 TODO 接口，不集成                                                   |
| 19  | Mock 示例数据         | 预置（admin/123456 登录、用户列表）                                    |
| 20  | Swagger 对接          | 不预置（后续可加 swagger-to-mock）                                     |

---

## 4. 目录结构

```
vue3-vite-project/
├── .vscode/                    # 编辑器配置
├── public/                     # 不经构建的静态资源
├── build/                      # Vite 插件与打包优化（按需扩展）
│
├── src/
│   ├── api/                    # 网络请求层
│   │   ├── http.ts             # Axios 实例
│   │   ├── modules/
│   │   │   ├── auth.ts
│   │   │   └── user.ts
│   │   └── types/
│   │       └── api.d.ts        # 通用响应包装
│   │
│   ├── assets/
│   │   ├── images/
│   │   ├── icons/
│   │   └── styles/
│   │       ├── reset.css
│   │       ├── variables.css
│   │       └── index.scss
│   │
│   ├── components/
│   │   ├── common/             # 通用无业务组件
│   │   ├── layout/             # 布局组件
│   │   ├── business/           # 跨模块业务组件
│   │   ├── __tests__/          # 单元测试
│   │   └── index.ts
│   │
│   ├── composables/
│   │   ├── useTable.ts
│   │   ├── useRequest.ts
│   │   └── useAuth.ts
│   │
│   ├── directives/
│   │   ├── permission.ts       # v-permission（占位）
│   │   └── index.ts
│   │
│   ├── enums/
│   │   ├── httpEnum.ts
│   │   └── roleEnum.ts
│   │
│   ├── layouts/
│   │   ├── default/index.vue
│   │   └── blank/index.vue
│   │
│   ├── locales/
│   │   ├── zh-CN.ts
│   │   ├── en-US.ts
│   │   └── index.ts
│   │
│   ├── modules/                # ⭐ 业务模块
│   │   ├── auth/
│   │   │   ├── views/Login.vue
│   │   │   ├── components/
│   │   │   ├── store/index.ts
│   │   │   └── index.ts
│   │   ├── user/
│   │   ├── dashboard/
│   │   └── error/              # 错误页（403/404/500）
│   │
│   ├── router/
│   │   ├── modules/
│   │   │   ├── auth.ts
│   │   │   └── dashboard.ts
│   │   ├── guards/auth.ts
│   │   └── index.ts
│   │
│   ├── store/                  # 全局状态（仅共享）
│   │   ├── modules/
│   │   │   ├── app.ts          # 侧边栏、语言、主题
│   │   │   └── user.ts         # token、profile、permissions
│   │   └── index.ts
│   │
│   ├── types/
│   │   ├── global.d.ts
│   │   └── env.d.ts
│   │
│   ├── utils/
│   │   ├── format.ts
│   │   ├── storage.ts
│   │   └── validate.ts
│   │
│   ├── views/
│   │   └── .gitkeep            # 兜底层（避免误用）
│   │
│   ├── App.vue
│   ├── main.ts
│   └── vite-env.d.ts
│
├── mock/
│   ├── index.ts
│   ├── _utils.ts
│   ├── auth.ts
│   ├── user.ts
│   └── dashboard.ts
│
├── tests/                      # 跨模块集成测试（可选）
│
├── .env
├── .env.development
├── .env.production
├── index.html
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json               # strict 模式
├── tsconfig.node.json
├── uno.config.ts
└── vite.config.ts
```

---

## 5. 模块边界铁律

> **强制规则**：模块间通信通过 `modules/<m>/index.ts` 暴露的对外接口，不直接 import 内部文件。

| 层级                     | 允许引用                                                 | 不允许引用                   |
| ------------------------ | -------------------------------------------------------- | ---------------------------- |
| `modules/<m>/views`      | 本模块 components、composables、utils、enums、types、api | 其他模块内部、其他模块 views |
| `modules/<m>/components` | 本模块 views、composables、utils                         | 其他模块                     |
| `modules/<m>/store`      | 本模块 api、types                                        | 其他模块 store               |
| `components/common`      | utils、enums、types                                      | 任何 modules/ 内容           |
| `components/business`    | common、utils、enums                                     | 任何 modules/ 内容           |
| `store/modules`（全局）  | api、utils、enums                                        | modules/ 内容                |

**违规检测**：Code Review 阶段必查，违规需拆分或调整边界。

---

## 6. 核心模块设计

### 6.1 `api/http.ts` — Axios 实例

```typescript
// 核心职责：拦截器、错误处理、Loading、Token 注入
import axios, { type AxiosInstance } from 'axios'
import { useAppStore } from '@/store/modules/app'
import { useUserStore } from '@/store/modules/user'

const instance: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 15000,
})

instance.interceptors.request.use((config) => {
  const token = useUserStore().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

instance.interceptors.response.use(
  (response) => {
    const { code, message, data } = response.data
    if (code === 0) return data
    if (code === 401) {
      useUserStore().logout()
      router.push('/login')
    }
    ElMessage.error(message)
    return Promise.reject(new Error(message))
  },
  (error) => {
    // HTTP 错误统一处理（详见第 7 段）
  }
)
```

### 6.2 `store/modules/user.ts` — 全局用户状态

```typescript
export const useUserStore = defineStore('user', () => {
  const token = ref<string>('')
  const profile = ref<UserProfile | null>(null)
  const permissions = ref<string[]>([])

  const isLoggedIn = computed(() => !!token.value)

  async function login(credentials: LoginPayload) {
    const { token: t, profile: p, permissions: perms } = await authApi.login(credentials)
    token.value = t
    profile.value = p
    permissions.value = perms
  }

  // 用于路由守卫刷新用户信息（如 F5 后页面状态恢复）
  async function fetchProfile() {
    const { profile: p, permissions: perms } = await authApi.fetchProfile()
    profile.value = p
    permissions.value = perms
  }

  function logout() {
    token.value = ''
    profile.value = null
    permissions.value = []
  }

  return { token, profile, permissions, isLoggedIn, login, fetchProfile, logout }
})
```

### 6.3 `router/modules/` — 路由分层

```typescript
// router/modules/dashboard.ts
export default {
  path: '/dashboard',
  component: () => import('@/layouts/default/index.vue'),
  children: [
    {
      path: '',
      name: 'Dashboard',
      component: () => import('@/modules/dashboard/views/Index.vue'),
      meta: {
        title: '仪表盘',
        icon: 'odometer',
        requiresAuth: true,
        permissions: ['dashboard:view'],
      },
    },
  ],
}
```

### 6.4 `router/guards/auth.ts` — 路由守卫

```typescript
const WHITE_LIST = ['/login', '/register']

router.beforeEach(async (to, _from, next) => {
  const userStore = useUserStore()
  if (WHITE_LIST.includes(to.path)) return next()

  if (!userStore.isLoggedIn) {
    userStore.token = readTokenFromStorage()
    if (!userStore.token) return next({ path: '/login', query: { redirect: to.fullPath } })
    await userStore.fetchProfile()
  }
  next()
})
```

### 6.5 `composables/useRequest.ts` — 三态请求封装

```typescript
export function useRequest<T, P extends unknown[]>(
  fetcher: (...args: P) => Promise<T>,
  options?: { immediate?: boolean; onError?: (e: Error) => void }
) {
  const data = ref<T | null>(null)
  const loading = ref(false)
  const error = ref<Error | null>(null)
  const isEmpty = computed(() => !loading.value && !error.value && data.value === null)

  async function execute(...args: P) {
    loading.value = true
    error.value = null
    try {
      data.value = await fetcher(...args)
    } catch (e) {
      error.value = e as Error
      options?.onError?.(error.value)
    } finally {
      loading.value = false
    }
  }

  if (options?.immediate !== false) execute()
  return { data, loading, error, isEmpty, execute }
}
```

---

## 7. 错误处理与三态

### 7.1 全局错误架构

```
错误源                拦截层                  展示层              用户感知
─────────────────────────────────────────────────────────────────────
HTTP 网络错误    →   axios 响应拦截器  →  ElMessage       →  Toast 提示
业务 code ≠ 0   →   axios 响应拦截器  →  ElMessage       →  Toast 提示
HTTP 401        →   axios 响应拦截器  →  router.push     →  跳转登录
HTTP 403        →   axios 响应拦截器  →  /403 页         →  权限不足页
HTTP 500        →   axios 响应拦截器  →  /500 页         →  错误页+重试
组件渲染错误    →   errorHandler     →  ErrorBoundary   →  降级 UI
Promise 拒绝    →   onunhandledrej   →  console.error   →  开发期可见
```

### 7.2 三态组件（防御性 UI 强制）

按 CLAUDE.md §四：每个异步组件必须显式 Loading / Error / Empty。

```vue
<!-- components/common/AsyncState.vue -->
<template>
  <div class="async-state">
    <template v-if="loading">
      <slot name="loading"><el-skeleton :rows="3" animated /></slot>
    </template>
    <template v-else-if="error">
      <slot name="error" :error="error" :retry="retry">
        <el-result icon="error" :title="error.message">
          <template #extra><el-button type="primary" @click="retry">重试</el-button></template>
        </el-result>
      </slot>
    </template>
    <template v-else-if="isEmpty">
      <slot name="empty"><el-empty description="暂无数据" /></slot>
    </template>
    <template v-else><slot /></template>
  </div>
</template>
```

### 7.3 HTTP 错误码映射

| 码          | 含义            | 处理                         |
| ----------- | --------------- | ---------------------------- |
| 400         | 参数错误        | Toast 后端 message           |
| 401         | 未登录          | 清空 user store，跳 `/login` |
| 403         | 无权限          | 跳 `/403`                    |
| 404         | 资源不存在      | 跳 `/404`                    |
| 500         | 服务器错误      | 跳 `/500` + 错误上报（TODO） |
| 502/503/504 | 网关/服务不可用 | Toast + 重试                 |
| 网络超时    | timeout         | Toast + 重试                 |

### 7.4 全局异常兜底（main.ts）

```typescript
app.config.errorHandler = (err, _instance, info) => {
  console.error('[Vue Error]', err, info)
  // TODO: Sentry.captureException(err)
}

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Rejection]', event.reason)
})
```

### 7.5 重试策略

| 场景         | 策略                        |
| ------------ | --------------------------- |
| GET 临时失败 | 用户点击重试                |
| 登录态失效   | 不重试，直跳登录            |
| 网络超时     | 自动重试 1 次（500ms 退避） |
| 表单提交失败 | 不自动重试，由用户重提      |

---

## 8. 测试策略

### 8.1 分层

| 层级     | 工具               | 覆盖目标                         |
| -------- | ------------------ | -------------------------------- |
| **单元** | Vitest             | utils、composables、store、enums |
| **组件** | @vue/test-utils    | common 组件、复杂业务组件        |
| **集成** | Vitest             | 跨模块 API 流程                  |
| **E2E**  | Playwright（后续） | 登录、关键流程                   |

### 8.2 目录约定

测试文件与源码同级，命名为 `*.spec.ts`：

```
src/utils/format.ts
src/utils/format.spec.ts
src/composables/useRequest.ts
src/composables/useRequest.spec.ts
```

### 8.3 Vitest 配置

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,vue}'],
      exclude: ['src/**/__tests__/**', 'src/**/index.ts', 'src/main.ts'],
      thresholds: { lines: 70, functions: 70, branches: 60, statements: 70 },
    },
  },
})
```

### 8.4 NPM Scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui"
  }
}
```

### 8.5 预置示例测试（3 个）

- `utils/format.spec.ts` — 单元测试范本（formatDate、formatMoney）
- `composables/useRequest.spec.ts` — Hook 测试范本（loading/error 三态）
- `components/__tests__/HelloWorld.spec.ts` — 组件测试范本

---

## 9. Mock 数据组织

### 9.1 vite-plugin-mock 配置

```typescript
// vite.config.ts
import { viteMockServe } from 'vite-plugin-mock'

viteMockServe({
  mockPath: 'mock',
  enable: true,
  watchFiles: true,
})
```

### 9.2 Mock 目录

```
mock/
├── index.ts
├── _utils.ts                  # delay、paginate、随机数据
├── auth.ts                    # /api/auth/*
├── user.ts                    # /api/user/*
└── dashboard.ts               # /api/dashboard/*
```

### 9.3 数据格式

```typescript
import type { MockMethod } from 'vite-plugin-mock'

export default [
  {
    url: '/api/auth/login',
    method: 'post',
    response: ({ body }) => {
      if (body.username === 'admin' && body.password === '123456') {
        return {
          code: 0,
          message: 'ok',
          data: { token: 'mock-jwt-' + Date.now(), profile: { id: 1, name: 'Admin' } },
        }
      }
      return { code: 401, message: '账号或密码错误', data: null }
    },
  },
] as MockMethod[]
```

### 9.4 环境切换

`.env.development` 预置 `VITE_USE_MOCK=true`，脚手架跑起来即用 Mock。

| 环境             | Mock 状态 | 切换方式                                                                   |
| ---------------- | --------- | -------------------------------------------------------------------------- |
| 开发（默认）     | 启用      | `.env.development` 中 `VITE_USE_MOCK=true`                                 |
| 联调（连真后端） | 关闭      | `.env.development` 改为 `VITE_USE_MOCK=false`，并设置 `VITE_API_BASE_URL`  |
| 生产构建         | 不打包    | `vite.config.ts` 中 `enable: command === 'dev'`，build 时整块 tree-shaking |

### 9.5 默认账号

- 用户名：`admin`
- 密码：`123456`

---

## 10. NPM Scripts（汇总）

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui",
    "type-check": "vue-tsc --noEmit"
  }
}
```

---

## 11. 待办（移交 writing-plans 时核对）

| #   | 事项                   | 优先级 | 备注                 |
| --- | ---------------------- | ------ | -------------------- |
| 1   | 集成 Sentry 错误监控   | P1     | 当前留 TODO          |
| 2   | 实现 v-permission 指令 | P2     | 目录已留占位         |
| 3   | Playwright E2E 接入    | P2     | 业务稳定后           |
| 4   | i18n 词条填充          | P2     | 按业务进展           |
| 5   | Docker + CI/CD         | P3     | 基础设施层           |
| 6   | Swagger 自动生成 Mock  | P3     | 后端稳定后           |
| 7   | 暗色主题切换           | P3     | CSS Variables 已预埋 |

---

## 12. 版本与变更

| 版本   | 日期       | 变更                           |
| ------ | ---------- | ------------------------------ |
| v1.0.0 | 2026-07-17 | 初版设计（brainstorming 输出） |

---

## 附录：CLAUDE.md 规则自检

> 本节记录设计阶段对全局规则的遵循情况

| 条款                   | 状态                            |
| ---------------------- | ------------------------------- |
| §一.1 需求对齐         | ✅ 澄清 7 个关键问题            |
| §一.4 函数 ≤80 行      | ✅ 关键函数已规划拆分           |
| §一.6 单文件 ≤400 行   | ✅ 单组件 ≤300 行约束           |
| §三.1 探索后动手       | ✅ Glob 探索项目状态            |
| §三.3 多文件改动给方案 | ✅ 设计文档先批准               |
| §四 防御性 UI 三态     | ✅ AsyncState 组件 + useRequest |
| §五 注释规范           | ✅ 代码示例含 Why 注释          |
| §六 npm 包验证         | 📋 实施阶段执行                 |
| §七 沟通规则           | ✅ 简体中文 + 决策记录          |
