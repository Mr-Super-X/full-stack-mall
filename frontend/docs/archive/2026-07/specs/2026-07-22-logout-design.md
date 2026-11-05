# Logout 现代化重构 — 设计说明

> 日期：2026-07-22
> 范围：`src/store/modules/user.ts` / `src/api/http.ts` / `src/composables/useLogout.ts`（新增）/ `src/components/layout/Header.vue` / `src/modules/dashboard/views/Index.vue` / `mock/auth.ts` / `src/locales/{zh-CN,en-US}.ts` / 新增测试

## 一、目标与背景

### 现状问题

| #   | 问题                                                                                                                     | 位置                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| 1   | `logout()` 不调后端 `/auth/logout` 接口                                                                                  | `src/store/modules/user.ts:26-31`       |
| 2   | 裸 `localStorage.removeItem('token')`，绕开 `utils/storage.ts` 约定（不调 `Session.remove('token')` + `clearCookies()`） | 同上                                    |
| 3   | 不重置路由模块级状态（`dynamicLoaded` / `currentToken`）                                                                 | `src/router/guards/auth.ts:26-27`       |
| 4   | 不取消进行中的请求 → 退出后接口响应到达处理器可能跳两次登录页                                                            | —                                       |
| 5   | Header 退出按钮无确认弹窗（误触即退）+ 无 loading 态                                                                     | `src/components/layout/Header.vue:15`   |
| 6   | Dashboard 页面无退出入口                                                                                                 | `src/modules/dashboard/views/Index.vue` |
| 7   | mock 缺失 `/api/auth/logout`                                                                                             | `mock/auth.ts`                          |

### 设计目标

1. **悲观退出**：先等后端 `/auth/logout` 成功，再清前端状态
2. **失败留原页**：依赖 `http.ts` 拦截器已有的 toast + 抛 ApiError，不清本地
3. **二次确认**：ElMessageBox.confirm 防误触
4. **Loading 态**：避免双击重复触发
5. **全栈清理**：token / cookies / ref / 路由状态 / 路由跳转
6. **取消在途请求**：AbortController 单例，logout 时统一 abort
7. **Dashboard 退出入口**：顶部右上加按钮
8. **保留非认证状态**：theme-mode 等 pinia 持久化偏好不动

## 二、目标态架构

```
User click (Header / Dashboard)
  ↓
useLogout().confirmLogout()
  ├─ ElMessageBox.confirm → 取消 → return
  └─ 确认：
       loggingOut = true
       try:
         await userStore.logout()
       finally:
         loggingOut = false
  ↓
userStore.logout()  (悲观)
  ├─ await authApi.logout()  ← POST /api/auth/logout
  │    ├─ 业务码 0 → 返回 void
  │    ├─ 业务码非 0 → http.ts 拦截器 toast + 抛 ApiError → 中断
  │    └─ 15s 内 axios timeout → toast "网络异常" + 抛 ApiError → 中断
  └─ 清理（仅成功路径）：
       ├─ Session.remove('token') + clearCookies()
       ├─ token.value = '' / profile.value = null / permissions.value = []
       ├─ globalAbort.abort('logout')  ← 取消进行中请求
       ├─ resetRouterState()  ← 重置 router 模块级状态
       └─ router.push('/login')
  ↓
Login page
```

## 三、模块设计

### 3.1 `src/api/global-abort.ts`（新增）

```ts
/**
 * 全局 AbortController 单例。
 * 用于 logout 等需要"一次性取消所有在途请求"的场景。
 */
class GlobalAbortController {
  private controller = new AbortController()

  get signal(): AbortSignal {
    return this.controller.signal
  }

  reset(): void {
    if (this.controller.signal.aborted) {
      this.controller = new AbortController()
    }
  }

  abort(reason?: string): void {
    if (!this.controller.signal.aborted) {
      this.controller.abort(reason)
    }
  }
}

export const globalAbort = new GlobalAbortController()

/**
 * 合并多个 AbortSignal，任一触发即中止。
 */
export function chainSignals(...signals: (AbortSignal | undefined)[]): AbortSignal {
  const filtered = signals.filter((s): s is AbortSignal => s !== undefined)
  if (filtered.length === 0) {
    return new AbortController().signal // 永不 abort 的占位
  }
  if (filtered.length === 1) return filtered[0]!
  return AbortSignal.any(filtered)
}
```

### 3.2 `src/api/http.ts`（改造）

请求拦截器中追加 signal 合并：

```ts
instance.interceptors.request.use((config) => {
  const token = Session.get<string>('token')
  if (typeof token === 'string' && token.length > 0) {
    config.headers.set('Authorization', `Bearer ${token}`)
  }
  // 合并 per-request signal + globalAbort signal
  config.signal = chainSignals(config.signal, globalAbort.signal)
  return config
})
```

### 3.3 `src/store/modules/user.ts`（改造）

```ts
import { authApi } from '@/api/modules/auth'
import { Session, clearCookies } from '@/utils/storage'
import { globalAbort } from '@/api/global-abort'
import { resetRouterState } from '@/router/guards/auth'
import { useRouterStore } from './router'

export const useUserStore = defineStore('user', () => {
  const token = ref<string>(Session.get<string>('token') ?? '')
  const profile = ref<UserProfile | null>(null)
  const permissions = ref<string[]>([])

  const isLoggedIn = computed(() => !!token.value)

  async function login(credentials: LoginPayload) {
    const { token: t } = await authApi.login(credentials)
    token.value = t
    Session.set('token', t)
    await fetchProfile()
  }

  async function fetchProfile() {
    const p = await authApi.fetchProfile()
    profile.value = p
    permissions.value = p.permissions
  }

  /**
   * 悲观退出：
   * 1. 先 await 后端 /auth/logout（失败抛 ApiError 中断）
   * 2. 成功才清本地状态 + 跳转登录页
   */
  async function logout(): Promise<void> {
    await authApi.logout() // 失败由 http.ts 拦截器统一处理（toast + 抛 ApiError）
    Session.remove('token')
    clearCookies()
    token.value = ''
    profile.value = null
    permissions.value = []
    globalAbort.abort('logout')
    resetRouterState()
    // useRouterStore.reset() 仅在 store 已实现该方法时调用；
    // 实施前先读 src/store/modules/router.ts 确认；若不存在则跳过此步。
    const routerStore = useRouterStore()
    if (typeof routerStore.reset === 'function') {
      routerStore.reset()
    }
    const router = useRouter()
    await router.push('/login')
  }

  return { token, profile, permissions, isLoggedIn, login, fetchProfile, logout }
})
```

### 3.4 `src/composables/useLogout.ts`（新增）

```ts
import { ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import { useUserStore } from '@/store/modules/user'

export function useLogout() {
  const userStore = useUserStore()
  const loggingOut = ref(false)

  async function confirmLogout(): Promise<void> {
    try {
      await ElMessageBox.confirm('确定退出登录吗？', '提示', {
        confirmButtonText: '退出',
        cancelButtonText: '取消',
        type: 'warning',
      })
    } catch {
      // 用户取消
      return
    }

    loggingOut.value = true
    try {
      await userStore.logout()
    } finally {
      loggingOut.value = false
    }
  }

  return { loggingOut, confirmLogout }
}
```

### 3.5 `src/components/layout/Header.vue`（改造）

```vue
<script setup lang="ts">
import { createNamespace } from '@utils/bem'
import { useLogout } from '@/composables/useLogout'

const bem = createNamespace('header-bar')
const { loggingOut, confirmLogout } = useLogout()
</script>

<template>
  <div :class="[bem.b(), 'flex-between', bem.is('logged-out', false)]">
    <span :class="bem.e('user')">Admin</span>
    <el-button :class="bem.e('action')" :loading="loggingOut" text @click="confirmLogout">
      退出
    </el-button>
  </div>
</template>
```

### 3.6 `src/modules/dashboard/views/Index.vue`（改造）

顶部右上加退出按钮，与 Header 互为补充（场景上下文退出）。

### 3.7 `mock/auth.ts`（改造）

新增 `/api/auth/logout`：

```ts
{
  url: '/api/auth/logout',
  method: 'post',
  timeout: 100,
  response: () => ({ code: 0, message: 'ok', data: null }),
}
```

### 3.8 `src/locales/{zh-CN,en-US}.ts`（改造）

新增 key：

```ts
logout: {
  confirm: '确定退出登录吗？',
  confirmButton: '退出',
  cancelButton: '取消',
  success: '已退出登录',
}
```

## 四、不变性约束

- 不引入新依赖（复用 ElMessageBox / AbortController / Session）
- 文件行数 ≤ 400 行；组件类 ≤ 300 行；展示组件 ≤ 200 行；函数 ≤ 80 行
- 无 `any` / `as never`
- 不动 theme-mode 等 pinia 持久化状态
- `modules/*.ts` 业务 API 层零改动（`authApi.logout()` 已存在）
- 不复制参考项目实现：全栈借鉴本项目现有模块（http / cancel / storage）

## 五、错误处理矩阵

| 场景                       | 行为                                                             | 用户感知           |
| -------------------------- | ---------------------------------------------------------------- | ------------------ |
| 用户在 ElMessageBox 点取消 | `loggingOut` 不变，不调 store.logout                             | 无变化             |
| `/auth/logout` 业务码非 0  | 拦截器 toast + 抛 ApiError；store.logout 中断；本地状态保留      | 弹错误提示，留原页 |
| 网络中断 / 15s 超时        | 拦截器 toast "网络异常"；同上                                    | 弹错误提示，留原页 |
| 双击退出                   | 第二次点击时 `loggingOut === true`，按钮 disabled                | 无感               |
| 退出后浏览器后退           | 路由守卫（`isLoggedIn === false`）→ 跳 /login                    | 自然拦截           |
| 退出时 in-flight 请求      | `globalAbort.abort()` → axios 抛 cancel error，调用方 catch 静默 | 退干净             |
| theme-mode / i18n locale   | 不动                                                             | 用户偏好保留       |

## 六、验证清单

- [ ] `pnpm test src/store src/composables src/api/global-abort src/api/http` 全绿
- [ ] `pnpm type-check` 通过
- [ ] `pnpm lint` 通过
- [ ] 手动跑：登录 → 点 Header 退出 → 看到 confirm → 确认 → toast "已退出" → 跳 /login
- [ ] 手动跑：登录 → 打开 Network throttle slow 3G → 点退出 → 看到 loading → 15s 后弹错 → 留原页
- [ ] 手动跑：登录 → 同时触发多个慢请求 → 点退出 → Network 面板显示所有 in-flight 请求 canceled
- [ ] 手动跑：登录 → 进 Dashboard → 点 Dashboard 退出按钮 → 同样行为
- [ ] 手动跑：退出 → 关浏览器 → 重开 → 仍是 light mode（theme-mode 持久化生效）

## 七、风险与回退

| 风险                                          | 缓解                                                                                  |
| --------------------------------------------- | ------------------------------------------------------------------------------------- |
| `useRouterStore().reset()` 不存在或语义不一致 | 先看实现；若不匹配则只调 `resetRouterState()`，不调 store.reset                       |
| `AbortSignal.any()` 浏览器兼容                | target 浏览器均为现代浏览器（Chrome 100+ / Firefox 100+ / Safari 15+），无需 polyfill |
| `globalAbort` 单例状态泄漏                    | 仅在 logout 时调用 `.abort()`，下次登录后请求自然通过新 controller                    |

回退方案：

```bash
# 回退 store 与 composable
git checkout HEAD~ -- src/store/modules/user.ts src/components/layout/Header.vue src/api/http.ts
rm src/api/global-abort.ts src/composables/useLogout.ts
```

## 八、关联文件清单

```
src/api/global-abort.ts                    新增
src/api/global-abort.spec.ts               新增
src/api/http.ts                            改造（请求拦截器注入 signal）
src/api/http.spec.ts                       可能补充 signal 合并用例
src/store/modules/user.ts                  改造（logout 改 async + 悲观）
src/store/modules/user.spec.ts             新增
src/composables/useLogout.ts               新增
src/composables/useLogout.spec.ts          新增
src/components/layout/Header.vue           改造（用 composable + loading）
src/modules/dashboard/views/Index.vue      改造（顶部右上退出按钮）
mock/auth.ts                               改造（加 /api/auth/logout）
src/locales/zh-CN.ts                       改造（加 logout 翻译）
src/locales/en-US.ts                       改造（加 logout 翻译）
src/router/guards/auth.ts                  已有 resetRouterState，无需改动
docs/superpowers/specs/2026-07-22-logout-design.md  本文档
docs/superpowers/plans/2026-07-22-logout.md          实施计划（writing-plans 输出）
CHANGELOG.md                               追加
```

文档版本：v1.0 | 2026-07-22
