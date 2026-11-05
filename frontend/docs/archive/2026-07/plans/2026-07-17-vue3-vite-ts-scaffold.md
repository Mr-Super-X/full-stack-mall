# Vue 3 + Vite + TS 脚手架实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 基于 `create-vue` 官方模板改造，建立 Feature-Sliced 风格的中后台脚手架（Element Plus + UnoCSS + Pinia + i18n + Mock + Vitest）。

**Architecture:** 全局只放跨模块共享状态（app、user），业务模块（auth/user/dashboard/error）独立自治；模块边界铁律强制（components/store/views 各层只引用本模块或全局）；三态异步组件 `AsyncState` + `useRequest` composable 防御性 UI。

**Tech Stack:** Vue 3.5 + Vite 6 + TypeScript 5.6 + Element Plus 2.8 + UnoCSS 0.65 + Pinia 2.2 + vue-router 4.4 + vue-i18n 10 + axios 1.7 + vite-plugin-mock 3 + Vitest 2.1

**Spec Reference:** `docs/superpowers/specs/2026-07-17-vue3-vite-ts-scaffold-design.md`

**Prerequisites:**

- Node.js >= 20.19 或 >= 22.12
- pnpm >= 9.x
- 项目根目录：`D:\personal\github\vue3工程模板\vue3-vite-project`

---

## 任务总览

| #   | 任务                                                  | 类型   |
| --- | ----------------------------------------------------- | ------ |
| 1   | 环境准备与验证                                        | 配置   |
| 2   | 初始化 create-vue 基础模板                            | 脚手架 |
| 3   | 安装并验证全部依赖                                    | 配置   |
| 4   | 配置文件（tsconfig、vite、uno、env、vitest）          | 配置   |
| 5   | utils/（format、storage、validate）+ 单测             | TDD    |
| 6   | enums/（httpEnum、roleEnum）                          | 配置   |
| 7   | composables/useRequest + 单测                         | TDD    |
| 8   | types/（global、env）                                 | 配置   |
| 9   | assets/styles/（reset、variables、index.scss）        | 配置   |
| 10  | api/（types、http、modules/auth、modules/user）       | 实现   |
| 11  | directives/（permission 占位）                        | 占位   |
| 12  | store/（app、user、index）                            | 实现   |
| 13  | components/common/（AsyncState、ErrorBoundary）+ 单测 | TDD    |
| 14  | layouts/（default、blank）                            | 实现   |
| 15  | locales/（zh-CN、en-US、index）                       | 实现   |
| 16  | modules/（error、auth、user、dashboard）              | 实现   |
| 17  | router/（modules、guards、index）                     | 实现   |
| 18  | mock/（auth、user、dashboard、_utils）                | 实现   |
| 19  | 预置示例测试 + 最终验证                               | 验证   |

---

## Task 1: 环境准备与验证

**Files:**

- 无文件创建（仅验证环境）

- [ ] **Step 1.1: 检查 Node 版本**

```bash
node --version
```

预期：`v20.19.x` 或 `v22.12.x` 以上。若版本过低，去 https://nodejs.org 下载 LTS。

- [ ] **Step 1.2: 检查 pnpm 版本**

```bash
pnpm --version
```

预期：`9.x` 或更高。若未装：`npm install -g pnpm`

- [ ] **Step 1.3: 确认项目目录为空**

```bash
ls D:\personal\github\vue3工程模板\vue3-vite-project
```

预期：仅含 `.omc/` 目录，无 `package.json`、`src/` 等。

- [ ] **Step 1.4: 确认 cwd**

```bash
cd D:\personal\github\vue3工程模板\vue3-vite-project
pwd
```

预期：`/d/personal/github/vue3工程模板/vue3-vite-project`

---

## Task 2: 初始化 create-vue 基础模板

**Files:**

- 创建：整个项目骨架（package.json、vite.config.ts、tsconfig.json、src/、index.html 等）
- 删除：默认 src/components/、src/assets/、src/views/（后续按 spec 重建）

- [ ] **Step 2.1: 执行 create-vue（精简选项）**

```bash
cd D:\personal\github\vue3工程模板\vue3-vite-project
pnpm create vue@latest . -- --typescript --router --pinia --no-jsx --no-vitest --no-e2e --no-eslint --no-prettier --no-playwright
```

说明：选 TypeScript + Router + Pinia，跳过 Vitest/ESLint/Prettier（后续单独装）。

- [ ] **Step 2.2: 删除默认 src/components/ 和 src/assets/**

```bash
cd D:\personal\github\vue3工程模板\vue3-vite-project
rm -rf src/components src/assets
```

理由：按 spec 用 Feature-Sliced 目录重建。

- [ ] **Step 2.3: 安装基础依赖**

```bash
pnpm install
```

预期：`node_modules/` 创建成功，无报错。

- [ ] **Step 2.4: 验证 dev server 启动**

```bash
timeout 10 pnpm dev
```

预期：终端输出 `Local: http://localhost:5173/`，10s 后停止。

- [ ] **Step 2.5: 提交（项目不是 git 仓库，跳过 git 操作）**

按 CLAUDE.md §七：非 git 仓库不要求 commit。但要确保变更可追溯，本任务结束后检查 `ls` 结果留底。

---

## Task 3: 安装并验证全部依赖

**Files:**

- 修改：`package.json`

- [ ] **Step 3.1: 安装 Element Plus 与自动按需插件**

```bash
pnpm add element-plus @element-plus/icons-vue
pnpm add -D unplugin-vue-components unplugin-auto-import
```

- [ ] **Step 3.2: 安装 UnoCSS**

```bash
pnpm add -D unocss
```

- [ ] **Step 3.3: 安装 sass（Element Plus 主题定制）**

```bash
pnpm add -D sass
```

- [ ] **Step 3.4: 安装 vue-i18n**

```bash
pnpm add vue-i18n@10
```

- [ ] **Step 3.5: 安装 axios**

```bash
pnpm add axios
```

- [ ] **Step 3.6: 安装 vite-plugin-mock**

```bash
pnpm add -D vite-plugin-mock
```

- [ ] **Step 3.7: 安装 Vitest 与测试工具**

```bash
pnpm add -D vitest @vue/test-utils jsdom @vitest/coverage-v8
```

- [ ] **Step 3.8: 安装类型工具**

```bash
pnpm add -D @types/node
```

- [ ] **Step 3.9: 验证全部依赖**

```bash
pnpm list --depth 0
```

预期：包含以下包：

- `vue`, `vue-router`, `pinia`, `element-plus`, `@element-plus/icons-vue`
- `vue-i18n`, `axios`, `unocss`, `vite-plugin-mock`
- 开发依赖：`vite`, `typescript`, `vue-tsc`, `sass`, `vitest`, `@vue/test-utils`, `jsdom`, `@vitest/coverage-v8`, `unplugin-vue-components`, `unplugin-auto-import`, `@types/node`

---

## Task 4: 配置文件

**Files:**

- 修改：`tsconfig.json`、`tsconfig.app.json`
- 创建：`tsconfig.node.json`、`vite.config.ts`、`uno.config.ts`、`vitest.config.ts`、`.env`、`.env.development`、`.env.production`

- [ ] **Step 4.1: 修改 tsconfig.json（开启 strict + 路径别名）**

```json
{
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.node.json" }],
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true
  }
}
```

- [ ] **Step 4.2: 修改 tsconfig.app.json（加 @ 别名）**

在 `compilerOptions` 内加入：

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    },
    "types": ["vite/client", "node"]
  }
}
```

- [ ] **Step 4.3: 创建 tsconfig.node.json**

```json
{
  "extends": "@tsconfig/node22/tsconfig.json",
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "types": ["node"]
  },
  "include": ["vite.config.ts", "vitest.config.ts", "uno.config.ts"]
}
```

（需先装 `@tsconfig/node22`：`pnpm add -D @tsconfig/node22`）

- [ ] **Step 4.4: 重写 vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import UnoCSS from 'unocss/vite'
import { viteMockServe } from 'vite-plugin-mock'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ command }) => ({
  plugins: [
    vue(),
    UnoCSS(),
    AutoImport({
      imports: ['vue', 'vue-router', 'pinia'],
      resolvers: [ElementPlusResolver()],
      dts: 'src/types/auto-imports.d.ts',
    }),
    Components({
      resolvers: [ElementPlusResolver()],
      dts: 'src/types/components.d.ts',
    }),
    viteMockServe({
      mockPath: 'mock',
      enable: command === 'serve',
      watchFiles: true,
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  css: {
    preprocessorOptions: {
      scss: { api: 'modern-compiler' },
      less: { javascriptEnabled: true },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
  },
}))
```

- [ ] **Step 4.5: 创建 uno.config.ts**

```typescript
import { defineConfig, presetUno, presetAttributify } from 'unocss'

export default defineConfig({
  presets: [presetUno(), presetAttributify()],
  theme: {
    colors: {
      primary: 'var(--el-color-primary)',
      success: 'var(--el-color-success)',
      warning: 'var(--el-color-warning)',
      danger: 'var(--el-color-danger)',
    },
  },
  shortcuts: {
    'flex-center': 'flex items-center justify-center',
    'flex-between': 'flex items-center justify-between',
  },
})
```

- [ ] **Step 4.6: 创建 vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{spec,test}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,vue}'],
      exclude: ['src/**/__tests__/**', 'src/**/index.ts', 'src/main.ts', 'src/types/**'],
      thresholds: { lines: 70, functions: 70, branches: 60, statements: 70 },
    },
  },
})
```

- [ ] **Step 4.7: 创建 .env**

```bash
VITE_APP_TITLE=企业中后台管理
```

- [ ] **Step 4.8: 创建 .env.development**

```bash
VITE_API_BASE_URL=/api
VITE_USE_MOCK=true
```

- [ ] **Step 4.9: 创建 .env.production**

```bash
VITE_API_BASE_URL=/api
VITE_USE_MOCK=false
```

- [ ] **Step 4.10: 修改 package.json scripts**

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

- [ ] **Step 4.11: 验证 type-check 通过**

```bash
pnpm type-check
```

预期：无报错（即使文件还没建完，配置文件本身的语法应正确）。

---

## Task 5: utils/ + 单测（TDD）

**Files:**

- 创建：`src/utils/format.ts`、`src/utils/storage.ts`、`src/utils/validate.ts`
- 测试：`src/utils/format.spec.ts`、`src/utils/storage.spec.ts`、`src/utils/validate.spec.ts`

### 5.1 utils/format.ts

- [ ] **Step 5.1.1: 写失败测试**

```typescript
// src/utils/format.spec.ts
import { describe, it, expect } from 'vitest'
import { formatDate, formatMoney, truncate } from './format'

describe('formatDate', () => {
  it('formats ISO date to YYYY-MM-DD', () => {
    expect(formatDate('2026-07-17T10:00:00Z')).toBe('2026-07-17')
  })
  it('returns "-" for invalid input', () => {
    expect(formatDate('invalid')).toBe('-')
  })
  it('handles Date object', () => {
    expect(formatDate(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01-01')
  })
})

describe('formatMoney', () => {
  it('formats number with thousand separators', () => {
    expect(formatMoney(1234567.5)).toBe('1,234,567.50')
  })
  it('returns "0.00" for zero', () => {
    expect(formatMoney(0)).toBe('0.00')
  })
})

describe('truncate', () => {
  it('truncates long string with ellipsis', () => {
    expect(truncate('Hello World', 8)).toBe('Hello...')
  })
  it('returns original if shorter than limit', () => {
    expect(truncate('Hi', 10)).toBe('Hi')
  })
})
```

- [ ] **Step 5.1.2: 运行测试，预期 FAIL**

```bash
pnpm test src/utils/format.spec.ts
```

预期：FAIL with "Cannot find module './format'"。

- [ ] **Step 5.1.3: 实现 format.ts**

```typescript
// src/utils/format.ts
export function formatDate(input: string | Date, fallback = '-'): string {
  const date = typeof input === 'string' ? new Date(input) : input
  if (Number.isNaN(date.getTime())) return fallback
  return date.toISOString().slice(0, 10)
}

export function formatMoney(amount: number): string {
  return amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function truncate(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text
}
```

- [ ] **Step 5.1.4: 运行测试，预期 PASS**

```bash
pnpm test src/utils/format.spec.ts
```

预期：PASS（5 个用例全过）。

### 5.2 utils/storage.ts

- [ ] **Step 5.2.1: 写失败测试**

```typescript
// src/utils/storage.spec.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { storage } from './storage'

describe('storage', () => {
  beforeEach(() => localStorage.clear())

  it('set and get string', () => {
    storage.set('key', 'value')
    expect(storage.get('key')).toBe('value')
  })
  it('returns null for missing key', () => {
    expect(storage.get('missing')).toBe(null)
  })
  it('handles JSON object', () => {
    const obj = { name: 'test', count: 42 }
    storage.set('obj', obj)
    expect(storage.get('obj')).toEqual(obj)
  })
  it('remove deletes key', () => {
    storage.set('k', 'v')
    storage.remove('k')
    expect(storage.get('k')).toBe(null)
  })
  it('respects TTL expiration', async () => {
    storage.set('expiring', 'value', 50)
    expect(storage.get('expiring')).toBe('value')
    await new Promise((r) => setTimeout(r, 100))
    expect(storage.get('expiring')).toBe(null)
  })
})
```

- [ ] **Step 5.2.2: 运行测试，预期 FAIL**

```bash
pnpm test src/utils/storage.spec.ts
```

预期：FAIL。

- [ ] **Step 5.2.3: 实现 storage.ts**

```typescript
// src/utils/storage.ts
interface StorageItem<T> {
  value: T
  expireAt?: number
}

export const storage = {
  set<T>(key: string, value: T, ttlMs?: number): void {
    const item: StorageItem<T> = { value }
    if (ttlMs) item.expireAt = Date.now() + ttlMs
    localStorage.setItem(key, JSON.stringify(item))
  },

  get<T>(key: string): T | null {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    try {
      const item = JSON.parse(raw) as StorageItem<T>
      if (item.expireAt && Date.now() > item.expireAt) {
        localStorage.removeItem(key)
        return null
      }
      return item.value
    } catch {
      return null
    }
  },

  remove(key: string): void {
    localStorage.removeItem(key)
  },
}
```

- [ ] **Step 5.2.4: 运行测试，预期 PASS**

```bash
pnpm test src/utils/storage.spec.ts
```

### 5.3 utils/validate.ts

- [ ] **Step 5.3.1: 写失败测试**

```typescript
// src/utils/validate.spec.ts
import { describe, it, expect } from 'vitest'
import { isEmail, isPhone, isIdCard } from './validate'

describe('isEmail', () => {
  it('accepts valid email', () => {
    expect(isEmail('test@example.com')).toBe(true)
  })
  it('rejects invalid email', () => {
    expect(isEmail('not-an-email')).toBe(false)
  })
})

describe('isPhone', () => {
  it('accepts 11-digit Chinese mobile', () => {
    expect(isPhone('13800138000')).toBe(true)
  })
  it('rejects invalid phone', () => {
    expect(isPhone('12345')).toBe(false)
  })
})

describe('isIdCard', () => {
  it('accepts 18-digit ID', () => {
    expect(isIdCard('110101199003078811')).toBe(true)
  })
  it('rejects invalid ID', () => {
    expect(isIdCard('123')).toBe(false)
  })
})
```

- [ ] **Step 5.3.2: 运行测试，预期 FAIL**

```bash
pnpm test src/utils/validate.spec.ts
```

- [ ] **Step 5.3.3: 实现 validate.ts**

```typescript
// src/utils/validate.ts
export const isEmail = (s: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)

export const isPhone = (s: string): boolean => /^1[3-9]\d{9}$/.test(s)

// 简化版：仅校验格式（18 位 + 末位 X/x）
export const isIdCard = (s: string): boolean => /^\d{17}[\dXx]$/.test(s) || /^\d{15}$/.test(s)
```

- [ ] **Step 5.3.4: 运行测试，预期 PASS**

```bash
pnpm test src/utils/validate.spec.ts
```

---

## Task 6: enums/

**Files:**

- 创建：`src/enums/httpEnum.ts`、`src/enums/roleEnum.ts`

- [ ] **Step 6.1: 创建 httpEnum.ts**

```typescript
// src/enums/httpEnum.ts
export enum HttpStatus {
  OK = 200,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  SERVER_ERROR = 500,
  BAD_GATEWAY = 502,
  SERVICE_UNAVAILABLE = 503,
  GATEWAY_TIMEOUT = 504,
}

export enum BusinessCode {
  SUCCESS = 0,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
}

export enum ContentType {
  JSON = 'application/json',
  FORM_URLENCODED = 'application/x-www-form-urlencoded',
  FORM_DATA = 'multipart/form-data',
}
```

- [ ] **Step 6.2: 创建 roleEnum.ts**

```typescript
// src/enums/roleEnum.ts
export enum RoleEnum {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  USER = 'user',
  GUEST = 'guest',
}

export const ROLE_LABELS: Record<RoleEnum, string> = {
  [RoleEnum.SUPER_ADMIN]: '超级管理员',
  [RoleEnum.ADMIN]: '管理员',
  [RoleEnum.USER]: '普通用户',
  [RoleEnum.GUEST]: '访客',
}
```

---

## Task 7: composables/useRequest + 单测（TDD）

**Files:**

- 创建：`src/composables/useRequest.ts`
- 测试：`src/composables/useRequest.spec.ts`

- [ ] **Step 7.1: 写失败测试**

```typescript
// src/composables/useRequest.spec.ts
import { describe, it, expect, vi } from 'vitest'
import { useRequest } from './useRequest'

describe('useRequest', () => {
  it('transitions loading → success on resolve', async () => {
    const fetcher = vi.fn().mockResolvedValue({ id: 1 })
    const { data, loading, error, execute } = useRequest(fetcher, { immediate: false })

    expect(loading.value).toBe(false)
    expect(data.value).toBe(null)

    const p = execute()
    expect(loading.value).toBe(true)
    await p
    expect(loading.value).toBe(false)
    expect(data.value).toEqual({ id: 1 })
    expect(error.value).toBe(null)
  })

  it('captures error and exposes isEmpty', async () => {
    const fetcher = vi.fn().mockResolvedValue(null)
    const { data, isEmpty, execute } = useRequest(fetcher, { immediate: false })
    await execute()
    expect(data.value).toBe(null)
    expect(isEmpty.value).toBe(true)
  })

  it('invokes onError callback on rejection', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('boom'))
    const onError = vi.fn()
    const { error, execute } = useRequest(fetcher, { immediate: false, onError })
    await execute()
    expect(error.value?.message).toBe('boom')
    expect(onError).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 7.2: 运行测试，预期 FAIL**

```bash
pnpm test src/composables/useRequest.spec.ts
```

- [ ] **Step 7.3: 实现 useRequest.ts**

```typescript
// src/composables/useRequest.ts
import { ref, computed, type Ref, type ComputedRef } from 'vue'

interface UseRequestOptions {
  immediate?: boolean
  onError?: (e: Error) => void
}

interface UseRequestReturn<T, P extends unknown[]> {
  data: Ref<T | null>
  loading: Ref<boolean>
  error: Ref<Error | null>
  isEmpty: ComputedRef<boolean>
  execute: (...args: P) => Promise<void>
}

export function useRequest<T, P extends unknown[] = []>(
  fetcher: (...args: P) => Promise<T>,
  options: UseRequestOptions = {}
): UseRequestReturn<T, P> {
  const data = ref<T | null>(null) as Ref<T | null>
  const loading = ref(false)
  const error = ref<Error | null>(null)
  const isEmpty = computed(() => !loading.value && !error.value && data.value === null)

  async function execute(...args: P): Promise<void> {
    loading.value = true
    error.value = null
    try {
      data.value = await fetcher(...args)
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e))
      options.onError?.(error.value)
    } finally {
      loading.value = false
    }
  }

  if (options.immediate !== false) execute(...([] as unknown as P))
  return { data, loading, error, isEmpty, execute }
}
```

- [ ] **Step 7.4: 运行测试，预期 PASS**

```bash
pnpm test src/composables/useRequest.spec.ts
```

---

## Task 8: types/

**Files:**

- 创建：`src/types/global.d.ts`、`src/types/env.d.ts`
- 自动生成：`src/types/auto-imports.d.ts`、`src/types/components.d.ts`（dev 时自动）

- [ ] **Step 8.1: 创建 global.d.ts**

```typescript
// src/types/global.d.ts
declare global {
  interface Window {
    __APP_VERSION__: string
  }
}

export {}
```

- [ ] **Step 8.2: 创建 env.d.ts**

```typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string
  readonly VITE_API_BASE_URL: string
  readonly VITE_USE_MOCK: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

---

## Task 9: assets/styles/

**Files:**

- 创建：`src/assets/styles/reset.css`、`src/assets/styles/variables.css`、`src/assets/styles/index.scss`

- [ ] **Step 9.1: 创建 reset.css**

```css
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
html,
body {
  height: 100%;
  font-family:
    system-ui,
    -apple-system,
    sans-serif;
}
a {
  color: inherit;
  text-decoration: none;
}
button {
  cursor: pointer;
  border: none;
  background: none;
  font: inherit;
}
ul,
ol {
  list-style: none;
}
img {
  max-width: 100%;
  display: block;
}
```

- [ ] **Step 9.2: 创建 variables.css**

```css
:root {
  --color-primary: #409eff;
  --color-success: #67c23a;
  --color-warning: #e6a23c;
  --color-danger: #f56c6c;

  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;

  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;

  --header-height: 60px;
  --sidebar-width: 220px;
  --sidebar-collapsed-width: 64px;
}
```

- [ ] **Step 9.3: 创建 index.scss**

```scss
@use './reset.css';
@use './variables.css';

// Element Plus 主题变量（按需覆盖）
:root {
  --el-color-primary: var(--color-primary);
}
```

---

## Task 10: api/ 层

**Files:**

- 创建：`src/api/types/api.d.ts`、`src/api/http.ts`、`src/api/modules/auth.ts`、`src/api/modules/user.ts`

- [ ] **Step 10.1: 创建 api.d.ts（响应包装）**

```typescript
// src/api/types/api.d.ts
export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

export interface Pagination<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}
```

- [ ] **Step 10.2: 创建 http.ts（Axios 实例）**

```typescript
// src/api/http.ts
import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'
import { BusinessCode, HttpStatus } from '@/enums/httpEnum'
import type { ApiResponse } from './types/api.d'

const instance: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 15000,
})

instance.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

instance.interceptors.response.use(
  (response) => {
    const body = response.data as ApiResponse<unknown>
    if (body.code === BusinessCode.SUCCESS) return body.data
    if (body.code === BusinessCode.UNAUTHORIZED) {
      ElMessage.error('登录已过期，请重新登录')
      localStorage.removeItem('token')
      window.location.href = '/login'
      return Promise.reject(new Error(body.message))
    }
    ElMessage.error(body.message || '请求失败')
    return Promise.reject(new Error(body.message))
  },
  (error) => {
    const status = error.response?.status
    const msg =
      status === HttpStatus.UNAUTHORIZED
        ? '请先登录'
        : status === HttpStatus.FORBIDDEN
          ? '无权限访问'
          : status === HttpStatus.NOT_FOUND
            ? '资源不存在'
            : status === HttpStatus.SERVER_ERROR
              ? '服务器错误'
              : '网络异常，请稍后重试'
    ElMessage.error(msg)
    return Promise.reject(error)
  }
)

export function request<T>(config: AxiosRequestConfig): Promise<T> {
  return instance.request<unknown, T>(config)
}

export default instance
```

- [ ] **Step 10.3: 创建 auth.ts**

```typescript
// src/api/modules/auth.ts
import { request } from '../http'
import type { ApiResponse } from '../types/api.d'

export interface LoginPayload {
  username: string
  password: string
}
export interface LoginResult {
  token: string
  profile: { id: number; name: string }
}
export interface UserProfile {
  id: number
  name: string
  permissions: string[]
}

export const authApi = {
  login: (data: LoginPayload) =>
    request<LoginResult>({ url: '/api/auth/login', method: 'post', data }),

  fetchProfile: () => request<UserProfile>({ url: '/api/auth/profile', method: 'get' }),

  logout: () => request<void>({ url: '/api/auth/logout', method: 'post' }),
}

// 显式导出 ApiResponse 类型以避免 auto-import 误删
export type { ApiResponse }
```

- [ ] **Step 10.4: 创建 user.ts**

```typescript
// src/api/modules/user.ts
import { request } from '../http'
import type { Pagination } from '../types/api.d'

export interface UserItem {
  id: number
  name: string
  email: string
  role: string
  createdAt: string
}

export interface UserListParams {
  page?: number
  pageSize?: number
  keyword?: string
}

export const userApi = {
  getList: (params: UserListParams) =>
    request<Pagination<UserItem>>({ url: '/api/user/list', method: 'get', params }),

  getById: (id: number) => request<UserItem>({ url: `/api/user/${id}`, method: 'get' }),

  create: (data: Omit<UserItem, 'id' | 'createdAt'>) =>
    request<UserItem>({ url: '/api/user', method: 'post', data }),

  update: (id: number, data: Partial<UserItem>) =>
    request<UserItem>({ url: `/api/user/${id}`, method: 'put', data }),

  remove: (id: number) => request<void>({ url: `/api/user/${id}`, method: 'delete' }),
}
```

---

## Task 11: directives/

**Files:**

- 创建：`src/directives/permission.ts`、`src/directives/index.ts`

- [ ] **Step 11.1: 创建 permission.ts（占位）**

```typescript
// src/directives/permission.ts
// 占位：完整实现待 P2 阶段
// 用法：v-permission="['user:edit']"
import type { Directive } from 'vue'

export const permission: Directive<HTMLElement, string[]> = {
  mounted(el, binding) {
    const required = binding.value
    if (!Array.isArray(required) || required.length === 0) return
    // TODO: 与 useUserStore().permissions 对比
    // 临时占位：始终显示
    console.info('[v-permission] check:', required)
  },
}
```

- [ ] **Step 11.2: 创建 index.ts**

```typescript
// src/directives/index.ts
import type { App } from 'vue'
import { permission } from './permission'

export function setupDirectives(app: App): void {
  app.directive('permission', permission)
}
```

---

## Task 12: store/

**Files:**

- 创建：`src/store/modules/app.ts`、`src/store/modules/user.ts`、`src/store/index.ts`

- [ ] **Step 12.1: 创建 app.ts**

```typescript
// src/store/modules/app.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  const sidebarCollapsed = ref(false)
  const globalLoading = ref(false)
  const locale = ref<'zh-CN' | 'en-US'>('zh-CN')

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }
  function setGlobalLoading(v: boolean) {
    globalLoading.value = v
  }
  function setLocale(l: 'zh-CN' | 'en-US') {
    locale.value = l
  }

  return { sidebarCollapsed, globalLoading, locale, toggleSidebar, setGlobalLoading, setLocale }
})
```

- [ ] **Step 12.2: 创建 user.ts**

```typescript
// src/store/modules/user.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi, type LoginPayload, type UserProfile } from '@/api/modules/auth'

export const useUserStore = defineStore('user', () => {
  const token = ref<string>(localStorage.getItem('token') ?? '')
  const profile = ref<UserProfile | null>(null)
  const permissions = ref<string[]>([])

  const isLoggedIn = computed(() => !!token.value)

  async function login(credentials: LoginPayload) {
    const { token: t, profile: p } = await authApi.login(credentials)
    token.value = t
    localStorage.setItem('token', t)
    await fetchProfile()
  }

  // 用于路由守卫刷新用户信息（如 F5 后页面状态恢复）
  async function fetchProfile() {
    const p = await authApi.fetchProfile()
    profile.value = p
    permissions.value = p.permissions
  }

  function logout() {
    token.value = ''
    profile.value = null
    permissions.value = []
    localStorage.removeItem('token')
  }

  return { token, profile, permissions, isLoggedIn, login, fetchProfile, logout }
})
```

- [ ] **Step 12.3: 创建 index.ts**

```typescript
// src/store/index.ts
import { createPinia } from 'pinia'

const pinia = createPinia()
export default pinia
export * from './modules/app'
export * from './modules/user'
```

---

## Task 13: components/common/（AsyncState、ErrorBoundary）

**Files:**

- 创建：`src/components/common/AsyncState.vue`、`src/components/common/ErrorBoundary.vue`
- 测试：`src/components/common/AsyncState.spec.ts`

### 13.1 AsyncState.vue + 测试（TDD）

- [ ] **Step 13.1.1: 写失败测试**

```typescript
// src/components/common/AsyncState.spec.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AsyncState from './AsyncState.vue'

describe('AsyncState', () => {
  it('shows loading slot when loading is true', () => {
    const wrapper = mount(AsyncState, {
      props: { loading: true, error: null, isEmpty: false },
      slots: { loading: '<div class="custom-loading">Loading...</div>' },
    })
    expect(wrapper.find('.custom-loading').exists()).toBe(true)
  })

  it('shows error slot with retry when error exists', () => {
    const wrapper = mount(AsyncState, {
      props: { loading: false, error: new Error('boom'), isEmpty: false },
      slots: { error: '<button class="retry-btn">重试</button>' },
    })
    expect(wrapper.find('.retry-btn').exists()).toBe(true)
  })

  it('shows empty slot when isEmpty is true', () => {
    const wrapper = mount(AsyncState, {
      props: { loading: false, error: null, isEmpty: true },
      slots: { empty: '<div class="empty-tip">无数据</div>' },
    })
    expect(wrapper.find('.empty-tip').exists()).toBe(true)
  })

  it('shows default slot when all states are normal', () => {
    const wrapper = mount(AsyncState, {
      props: { loading: false, error: null, isEmpty: false },
      slots: { default: '<div class="content">Main</div>' },
    })
    expect(wrapper.find('.content').exists()).toBe(true)
  })
})
```

- [ ] **Step 13.1.2: 运行测试，预期 FAIL**

```bash
pnpm test src/components/common/AsyncState.spec.ts
```

- [ ] **Step 13.1.3: 实现 AsyncState.vue**

```vue
<!-- src/components/common/AsyncState.vue -->
<script setup lang="ts">
interface Props {
  loading: boolean
  error: Error | null
  isEmpty: boolean
}
defineProps<Props>()
const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="async-state">
    <template v-if="loading">
      <slot name="loading"><el-skeleton :rows="3" animated /></slot>
    </template>
    <template v-else-if="error">
      <slot name="error" :error="error" :retry="() => emit('retry')">
        <el-result icon="error" :title="error.message">
          <template #extra>
            <el-button type="primary" @click="emit('retry')">重试</el-button>
          </template>
        </el-result>
      </slot>
    </template>
    <template v-else-if="isEmpty">
      <slot name="empty"><el-empty description="暂无数据" /></slot>
    </template>
    <template v-else>
      <slot />
    </template>
  </div>
</template>
```

- [ ] **Step 13.1.4: 运行测试，预期 PASS**

```bash
pnpm test src/components/common/AsyncState.spec.ts
```

### 13.2 ErrorBoundary.vue

- [ ] **Step 13.2.1: 创建 ErrorBoundary.vue**

```vue
<!-- src/components/common/ErrorBoundary.vue -->
<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue'
const error = ref<Error | null>(null)
onErrorCaptured((err) => {
  error.value = err instanceof Error ? err : new Error(String(err))
  return false
})
function reset() {
  error.value = null
}
</script>

<template>
  <slot v-if="!error" />
  <el-result v-else icon="error" title="组件渲染出错" :sub-title="error.message">
    <template #extra>
      <el-button type="primary" @click="reset">恢复</el-button>
    </template>
  </el-result>
</template>
```

---

## Task 14: layouts/

**Files:**

- 创建：`src/layouts/default/index.vue`、`src/layouts/blank/index.vue`

- [ ] **Step 14.1: 创建 default/index.vue**

```vue
<!-- src/layouts/default/index.vue -->
<script setup lang="ts">
import { useAppStore } from '@/store/modules/app'
const appStore = useAppStore()
</script>

<template>
  <div class="default-layout">
    <aside class="sidebar" :class="{ collapsed: appStore.sidebarCollapsed }">
      <Sidebar />
    </aside>
    <header class="header">
      <Header />
    </header>
    <main class="main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.default-layout {
  display: grid;
  grid-template-areas: 'sidebar header' 'sidebar main';
  grid-template-columns: auto 1fr;
  grid-template-rows: var(--header-height) 1fr;
  height: 100vh;
}
.sidebar {
  grid-area: sidebar;
  width: var(--sidebar-width);
  background: #001529;
  color: #fff;
}
.sidebar.collapsed {
  width: var(--sidebar-collapsed-width);
}
.header {
  grid-area: header;
  border-bottom: 1px solid #eee;
}
.main {
  grid-area: main;
  padding: var(--spacing-md);
  overflow: auto;
}
</style>
```

- [ ] **Step 14.2: 创建占位 Sidebar 和 Header 组件**

```bash
mkdir -p src/components/layout
```

```vue
<!-- src/components/layout/Sidebar.vue -->
<script setup lang="ts">
import { useAppStore } from '@/store/modules/app'
const appStore = useAppStore()
</script>

<template>
  <div class="sidebar-content">
    <h1 v-if="!appStore.sidebarCollapsed">工贸统一登录</h1>
    <button @click="appStore.toggleSidebar">折叠</button>
  </div>
</template>

<style scoped>
.sidebar-content {
  padding: var(--spacing-md);
}
</style>
```

```vue
<!-- src/components/layout/Header.vue -->
<script setup lang="ts">
import { useUserStore } from '@/store/modules/user'
const userStore = useUserStore()
</script>

<template>
  <div class="header-content flex-between">
    <span>{{ userStore.profile?.name ?? '游客' }}</span>
    <el-button text @click="userStore.logout">退出</el-button>
  </div>
</template>

<style scoped>
.header-content {
  padding: 0 var(--spacing-md);
  height: 100%;
}
</style>
```

- [ ] **Step 14.3: 创建 blank/index.vue**

```vue
<!-- src/layouts/blank/index.vue -->
<template>
  <div class="blank-layout">
    <RouterView />
  </div>
</template>

<style scoped>
.blank-layout {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
}
</style>
```

---

## Task 15: locales/

**Files:**

- 创建：`src/locales/zh-CN.ts`、`src/locales/en-US.ts`、`src/locales/index.ts`

- [ ] **Step 15.1: 创建 zh-CN.ts**

```typescript
// src/locales/zh-CN.ts
export default {
  app: { title: '企业中后台管理' },
  common: { confirm: '确认', cancel: '取消', retry: '重试', loading: '加载中...' },
  auth: { login: '登录', logout: '退出', username: '用户名', password: '密码' },
  menu: { dashboard: '仪表盘', user: '用户管理' },
  error: { '403': '无权访问', '404': '页面不存在', '500': '服务器错误' },
}
```

- [ ] **Step 15.2: 创建 en-US.ts**

```typescript
// src/locales/en-US.ts
export default {
  app: { title: 'Emergency Water Portal' },
  common: { confirm: 'Confirm', cancel: 'Cancel', retry: 'Retry', loading: 'Loading...' },
  auth: { login: 'Login', logout: 'Logout', username: 'Username', password: 'Password' },
  menu: { dashboard: 'Dashboard', user: 'User Management' },
  error: { '403': 'Forbidden', '404': 'Not Found', '500': 'Server Error' },
}
```

- [ ] **Step 15.3: 创建 index.ts**

```typescript
// src/locales/index.ts
import { createI18n } from 'vue-i18n'
import zhCN from './zh-CN'
import enUS from './en-US'

export const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'en-US',
  messages: { 'zh-CN': zhCN, 'en-US': enUS },
})

export default i18n
```

---

## Task 16: modules/（error、auth、user、dashboard）

**Files:**

- 创建：`src/modules/error/views/{Forbidden,NotFound,ServerError}.vue`
- 创建：`src/modules/auth/views/Login.vue`、`src/modules/auth/store/index.ts`、`src/modules/auth/index.ts`
- 创建：`src/modules/user/views/List.vue`、`src/modules/user/store/index.ts`、`src/modules/user/index.ts`
- 创建：`src/modules/dashboard/views/Index.vue`、`src/modules/dashboard/store/index.ts`、`src/modules/dashboard/index.ts`

- [ ] **Step 16.1: 创建错误页**

```vue
<!-- src/modules/error/views/Forbidden.vue -->
<template><el-result icon="warning" title="403" sub-title="无权访问此页面" /></template>
```

```vue
<!-- src/modules/error/views/NotFound.vue -->
<template><el-result icon="info" title="404" sub-title="页面不存在" /></template>
```

```vue
<!-- src/modules/error/views/ServerError.vue -->
<template><el-result icon="error" title="500" sub-title="服务器开小差了" /></template>
```

- [ ] **Step 16.2: 创建 auth 模块**

```vue
<!-- src/modules/auth/views/Login.vue -->
<script setup lang="ts">
import { reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/store/modules/user'
import { ElMessage } from 'element-plus'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const form = reactive({ username: 'admin', password: '123456' })
const loading = reactive({ value: false })

async function handleSubmit() {
  loading.value = true
  try {
    await userStore.login(form)
    ElMessage.success('登录成功')
    const redirect = (route.query.redirect as string) ?? '/dashboard'
    router.push(redirect)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <el-card class="login-card">
    <h2>{{ $t('auth.login') }}</h2>
    <el-form @submit.prevent="handleSubmit">
      <el-form-item :label="$t('auth.username')">
        <el-input v-model="form.username" />
      </el-form-item>
      <el-form-item :label="$t('auth.password')">
        <el-input v-model="form.password" type="password" />
      </el-form-item>
      <el-button type="primary" :loading="loading.value" @click="handleSubmit">
        {{ $t('auth.login') }}
      </el-button>
    </el-form>
  </el-card>
</template>

<style scoped>
.login-card {
  width: 400px;
}
</style>
```

```typescript
// src/modules/auth/store/index.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'

// 认证模块私有状态（与全局 user store 互补）
// 当前仅占位，业务扩展时填入
export const useAuthStore = defineStore('module-auth', () => {
  const loginAttempts = ref(0)
  function incrementAttempts() {
    loginAttempts.value++
  }
  function resetAttempts() {
    loginAttempts.value = 0
  }
  return { loginAttempts, incrementAttempts, resetAttempts }
})
```

```typescript
// src/modules/auth/index.ts
export { useAuthStore } from './store'
```

- [ ] **Step 16.3: 创建 user 模块**

```vue
<!-- src/modules/user/views/List.vue -->
<script setup lang="ts">
import { useRequest } from '@/composables/useRequest'
import { userApi, type UserItem } from '@/api/modules/user'
import AsyncState from '@/components/common/AsyncState.vue'

const { data, loading, error, isEmpty, execute } = useRequest(() =>
  userApi.getList({ page: 1, pageSize: 10 })
)
</script>

<template>
  <AsyncState :loading="loading" :error="error" :is-empty="isEmpty" @retry="execute">
    <el-table :data="data?.list ?? []" stripe>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="name" label="姓名" />
      <el-table-column prop="email" label="邮箱" />
      <el-table-column prop="role" label="角色" />
    </el-table>
  </AsyncState>
</template>
```

```typescript
// src/modules/user/store/index.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { UserItem } from '@/api/modules/user'

// 用户管理模块私有状态（列表筛选、表单临时态等）
export const useUserListStore = defineStore('module-user-list', () => {
  const keyword = ref('')
  const selectedRows = ref<UserItem[]>([])
  function setKeyword(k: string) {
    keyword.value = k
  }
  function clearSelection() {
    selectedRows.value = []
  }
  return { keyword, selectedRows, setKeyword, clearSelection }
})
```

```typescript
// src/modules/user/index.ts
export { useUserListStore } from './store'
```

- [ ] **Step 16.4: 创建 dashboard 模块**

```vue
<!-- src/modules/dashboard/views/Index.vue -->
<template>
  <div class="dashboard">
    <h1>{{ $t('menu.dashboard') }}</h1>
    <el-row :gutter="16">
      <el-col :span="8"><el-card>用户总数：128</el-card></el-col>
      <el-col :span="8"><el-card>在线用户：12</el-card></el-col>
      <el-col :span="8"><el-card>今日访问：256</el-card></el-col>
    </el-row>
  </div>
</template>
```

```typescript
// src/modules/dashboard/store/index.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'

// dashboard 模块私有状态（卡片数据等）
export const useDashboardStore = defineStore('module-dashboard', () => {
  const stats = ref({ userCount: 128, onlineCount: 12, todayVisits: 256 })
  return { stats }
})
```

```typescript
// src/modules/dashboard/index.ts
export { useDashboardStore } from './store'
```

---

## Task 17: router/

**Files:**

- 创建：`src/router/modules/auth.ts`、`src/router/modules/dashboard.ts`、`src/router/modules/user.ts`、`src/router/modules/error.ts`、`src/router/guards/auth.ts`、`src/router/index.ts`

- [ ] **Step 17.1: 创建各模块路由**

```typescript
// src/router/modules/auth.ts
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    component: () => import('@/layouts/blank/index.vue'),
    children: [
      {
        path: '',
        name: 'Login',
        component: () => import('@/modules/auth/views/Login.vue'),
        meta: { title: '登录', requiresAuth: false },
      },
    ],
  },
]

export default routes
```

```typescript
// src/router/modules/dashboard.ts
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/dashboard',
    component: () => import('@/layouts/default/index.vue'),
    children: [
      {
        path: '',
        name: 'Dashboard',
        component: () => import('@/modules/dashboard/views/Index.vue'),
        meta: { title: '仪表盘', icon: 'odometer', requiresAuth: true },
      },
    ],
  },
]

export default routes
```

```typescript
// src/router/modules/user.ts
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/user',
    component: () => import('@/layouts/default/index.vue'),
    children: [
      {
        path: 'list',
        name: 'UserList',
        component: () => import('@/modules/user/views/List.vue'),
        meta: { title: '用户管理', icon: 'user', requiresAuth: true, permissions: ['user:view'] },
      },
    ],
  },
]

export default routes
```

```typescript
// src/router/modules/error.ts
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/403',
    name: 'Forbidden',
    component: () => import('@/modules/error/views/Forbidden.vue'),
    meta: { title: '403' },
  },
  {
    path: '/404',
    name: 'NotFound',
    component: () => import('@/modules/error/views/NotFound.vue'),
    meta: { title: '404' },
  },
  {
    path: '/500',
    name: 'ServerError',
    component: () => import('@/modules/error/views/ServerError.vue'),
    meta: { title: '500' },
  },
  { path: '/:pathMatch(.*)*', redirect: '/404' },
]

export default routes
```

- [ ] **Step 17.2: 创建路由守卫**

```typescript
// src/router/guards/auth.ts
import type { Router } from 'vue-router'
import { useUserStore } from '@/store/modules/user'

const WHITE_LIST = ['/login', '/403', '/404', '/500']

export function setupAuthGuard(router: Router): void {
  router.beforeEach(async (to) => {
    const userStore = useUserStore()

    if (WHITE_LIST.includes(to.path)) return true

    if (!userStore.isLoggedIn) {
      const token = localStorage.getItem('token')
      if (!token) return { path: '/login', query: { redirect: to.fullPath } }
      userStore.token = token
      try {
        await userStore.fetchProfile()
      } catch {
        userStore.logout()
        return { path: '/login', query: { redirect: to.fullPath } }
      }
    }

    // 权限校验（如需）
    const requiredPerms = to.meta.permissions as string[] | undefined
    if (requiredPerms?.length) {
      const hasAll = requiredPerms.every((p) => userStore.permissions.includes(p))
      if (!hasAll) return { path: '/403' }
    }

    return true
  })
}
```

- [ ] **Step 17.3: 创建 router/index.ts**

```typescript
// src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router'
import authRoutes from './modules/auth'
import dashboardRoutes from './modules/dashboard'
import userRoutes from './modules/user'
import errorRoutes from './modules/error'
import { setupAuthGuard } from './guards/auth'

export const router = createRouter({
  history: createWebHistory(),
  routes: [...authRoutes, ...dashboardRoutes, ...userRoutes, ...errorRoutes],
})

setupAuthGuard(router)

export default router
```

---

## Task 18: mock/

**Files:**

- 创建：`mock/_utils.ts`、`mock/auth.ts`、`mock/user.ts`、`mock/dashboard.ts`、`mock/index.ts`

- [ ] **Step 18.1: 创建工具**

```typescript
// mock/_utils.ts
export function delay(ms = 300): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function paginate<T>(list: T[], page = 1, pageSize = 10) {
  const start = (page - 1) * pageSize
  return { list: list.slice(start, start + pageSize), total: list.length, page, pageSize }
}

const NAMES = ['张三', '李四', '王五', '赵六', '钱七', '孙八', '周九', '吴十']
const ROLES = ['admin', 'user', 'guest']
export function generateUsers(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: NAMES[i % NAMES.length] ?? `用户${i + 1}`,
    email: `user${i + 1}@example.com`,
    role: ROLES[i % ROLES.length] ?? 'user',
    createdAt: new Date(Date.now() - i * 86400000).toISOString(),
  }))
}
```

- [ ] **Step 18.2: 创建 auth mock**

```typescript
// mock/auth.ts
import type { MockMethod } from 'vite-plugin-mock'
import { delay } from './_utils'

export default [
  {
    url: '/api/auth/login',
    method: 'post',
    response: async ({ body }: { body: { username: string; password: string } }) => {
      await delay()
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
  {
    url: '/api/auth/profile',
    method: 'get',
    response: async () => {
      await delay(100)
      return {
        code: 0,
        message: 'ok',
        data: { id: 1, name: 'Admin', permissions: ['dashboard:view', 'user:view', 'user:edit'] },
      }
    },
  },
] as MockMethod[]
```

- [ ] **Step 18.3: 创建 user mock**

```typescript
// mock/user.ts
import type { MockMethod } from 'vite-plugin-mock'
import { delay, paginate, generateUsers } from './_utils'

const ALL_USERS = generateUsers(50)

export default [
  {
    url: '/api/user/list',
    method: 'get',
    response: async ({
      query,
    }: {
      query: { page?: string; pageSize?: string; keyword?: string }
    }) => {
      await delay()
      const page = Number(query.page) || 1
      const pageSize = Number(query.pageSize) || 10
      const keyword = query.keyword?.toLowerCase() ?? ''
      const filtered = keyword
        ? ALL_USERS.filter((u) => u.name.toLowerCase().includes(keyword))
        : ALL_USERS
      return { code: 0, message: 'ok', data: paginate(filtered, page, pageSize) }
    },
  },
  {
    url: '/api/user/:id',
    method: 'get',
    response: async ({ params }: { params: { id: string } }) => {
      await delay(100)
      const user = ALL_USERS.find((u) => u.id === Number(params.id))
      return user
        ? { code: 0, message: 'ok', data: user }
        : { code: 404, message: '用户不存在', data: null }
    },
  },
] as MockMethod[]
```

- [ ] **Step 18.4: 创建 dashboard mock**

```typescript
// mock/dashboard.ts
import type { MockMethod } from 'vite-plugin-mock'
import { delay } from './_utils'

export default [
  {
    url: '/api/dashboard/stats',
    method: 'get',
    response: async () => {
      await delay(200)
      return {
        code: 0,
        message: 'ok',
        data: { userCount: 128, onlineCount: 12, todayVisits: 256 },
      }
    },
  },
] as MockMethod[]
```

- [ ] **Step 18.5: 创建 index.ts（聚合）**

```typescript
// mock/index.ts
import auth from './auth'
import user from './user'
import dashboard from './dashboard'

export default [...auth, ...user, ...dashboard]
```

---

## Task 19: 最终验证

**Files:**

- 修改：`src/main.ts`（添加 i18n、directives、错误兜底）
- 创建：`src/App.vue`（根组件）

- [ ] **Step 19.1: 重写 src/App.vue**

```vue
<!-- src/App.vue -->
<script setup lang="ts">
import ErrorBoundary from '@/components/common/ErrorBoundary.vue'
</script>

<template>
  <ErrorBoundary>
    <RouterView />
  </ErrorBoundary>
</template>
```

- [ ] **Step 19.2: 重写 src/main.ts**

```typescript
// src/main.ts
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import pinia from './store'
import i18n from './locales'
import { setupDirectives } from './directives'

import 'element-plus/dist/index.css'
import 'virtual:uno.css'
import '@/assets/styles/index.scss'

const app = createApp(App)

app.use(pinia)
app.use(router)
app.use(i18n)
setupDirectives(app)

// 全局错误兜底
app.config.errorHandler = (err, _instance, info) => {
  console.error('[Vue Error]', err, info)
}

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Rejection]', event.reason)
})

app.mount('#app')
```

- [ ] **Step 19.3: 修改 index.html title**

```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>企业中后台管理</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 19.4: 运行 type-check**

```bash
pnpm type-check
```

预期：无报错。

- [ ] **Step 19.5: 运行全部测试**

```bash
pnpm test
```

预期：所有 spec 文件 PASS。

- [ ] **Step 19.6: 启动 dev server 验证**

```bash
timeout 15 pnpm dev
```

预期：`Local: http://localhost:5173/`，无报错。

- [ ] **Step 19.7: 生产构建验证**

```bash
pnpm build
```

预期：生成 `dist/`，无报错。

- [ ] **Step 19.8: 创建 CHANGELOG.md**

```markdown
# Changelog

## v1.0.0 - 2026-07-17

### Added

- 初始化 Vue 3 + Vite 6 + TS 脚手架（基于 create-vue 改造）
- Feature-Sliced 风格目录结构
- Element Plus 2.8 + UnoCSS 0.65
- Pinia 全局状态（仅跨模块共享）+ 模块私有 store
- vue-router 4 + 路由守卫 + 模块懒加载
- vue-i18n 10（zh-CN、en-US）
- Axios 实例 + 拦截器 + 错误归一化
- vite-plugin-mock + 4 个 mock 模块
- Vitest 2.1 + 6 个示例测试
- 三态异步组件 AsyncState
- ErrorBoundary 全局错误兜底
- 模块边界铁律（spec §5）

### Tech

- Node.js >= 20.19 / >= 22.12
- pnpm >= 9.x
- TypeScript strict 模式
```

- [ ] **Step 19.9: 手动验证关键流程**

1. 访问 `/login`，输入 `admin/123456`，验证登录成功跳转 `/dashboard`
2. 访问 `/user/list`，验证表格展示 mock 数据（含三态切换：loading → 数据）
3. 访问 `/403` 路由，验证错误页展示
4. 刷新页面（F5），验证 token 持久化 + 自动登录
5. 访问 `/dashboard`，验证卡片渲染正常（无报错）

---

## 自检清单

完成所有任务后，对照以下清单自检：

- [ ] 19 个 Task 全部完成
- [ ] 6 个测试文件（format、storage、validate、useRequest、AsyncState）全 PASS
- [ ] `pnpm type-check` 无报错
- [ ] `pnpm build` 成功生成 `dist/`
- [ ] 登录流程跑通（admin/123456）
- [ ] CHANGELOG.md 已创建
- [ ] 模块边界铁律未被破坏（components/common/ 不引用 modules/）

---

## 附录：CLAUDE.md 规则自检

| 条款                 | 状态                             |
| -------------------- | -------------------------------- |
| §一.3 函数 ≤80 行    | ✅                               |
| §一.6 单文件 ≤400 行 | ✅                               |
| §三.2 单文件简单修改 | N/A（脚手架创建）                |
| §三.3 多文件给方案   | ✅                               |
| §四 防御性 UI        | ✅ AsyncState + useRequest       |
| §五 注释规范         | ✅ Why 注释                      |
| §六 npm 包验证       | 📋 实施阶段执行 `pnpm view`      |
| §七 沟通规则         | ✅                               |
| §七 非 git 仓库备份  | 📋 实施前创建 `.claude/backups/` |
