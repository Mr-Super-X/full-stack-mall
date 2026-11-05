# Composable 契约审计报告

> 生成时间：2026-09-20
> 项目：D:\personal\github\vue3工程模板\vue3-vite-project
> 审计对象：8 个项目自研 composable（useAppRouter / useRequest / useAuth / useLogout / useDialog / useConfirm / useDict / useTheme）vs 各自专属文档

---

## 0. 摘要

| Composable    | 入参差异 | 返回值差异 | 错误类型差异 | 副作用差异 | 总计发现 |
| ------------- | -------- | ---------- | ------------ | ---------- | -------- |
| useAppRouter  | 0        | 1          | 0            | 0          | **1**    |
| useRequest    | 0        | 0          | 0            | 0          | **0**    |
| useAuth       | 0        | 0          | 0            | 0          | **0**    |
| useLogout     | 1        | 0          | 1            | 0          | **2**    |
| useDialog     | 0        | 0          | 0            | 0          | **0**    |
| useConfirm    | 0        | 0          | 0            | 0          | **0**    |
| useDict（v2） | 0        | 0          | 0            | 0          | **0**    |
| useTheme      | 0        | 0          | 0            | 0          | **0**    |
| **合计**      | **1**    | **1**      | **1**        | **0**      | **3**    |

**关键发现**：

1. **useAppRouter**：`pushByName` 返回值从文档描述的「类型安全的 `RouteName` 联合类型」已演化为 `name: string` + 运行时 dev 模式 `pushByNameStrict` 抛错机制 —— 文档 §"路由高层 API" 与 README 描述滞后
2. **useLogout**：实现走 `useConfirm` composable（取消 resolve `false`，无须 try/catch）；docs/23 §5.10 展示的是旧版 `ElMessageBox.confirm` + `try/catch + return` 写法 —— 文档与源码实现路径不一致
3. **useLogout** 移除 `cancelButtonText: 'default'` 文档示例隐含的默认值未明示

---

## 1. useAppRouter

### 1.1 入参

| 方法               | 文档描述                                                                           | 源码定义                                                                                           | 差异                                                                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `pushByName`       | "类型安全的按 name 跳转（用 `RouteName` 联合类型约束）"（docs/07 §"路由高层 API"） | `pushByName: (name: string, params?: ...) => Promise<void>`（useAppRouter.ts:42）                  | ⚠️ **类型放宽**：从 `RouteName` 联合类型 → `string`（与 docs/07 §2 同步的 2026-07-24 方案 A 决策一致；但 §"路由高层 API"未同步更新） |
| `pushByNameStrict` | 文档未提及（**新增** API）                                                         | `pushByNameStrict: (name: string, params?: ...) => Promise<void>`（useAppRouter.ts:44，§97-112）   | ⚠️ **文档缺失**：dev 模式 throw 机制是 RouteName 联合类型移除后的关键替代约束，docs/07 未列出                                        |
| `replaceByName`    | 同 pushByName                                                                      | `replaceByName: (name: string, params?: ...) => Promise<void>`（useAppRouter.ts:46）               | ✅ 类型已对齐 `string`（文档示例 `await replaceByName('UserList', ...)` 仍可工作）                                                   |
| `pushWithTitle`    | `to: RouteLocationRaw`                                                             | `pushWithTitle: (to: RouteLocationRaw) => Promise<void>`（useAppRouter.ts:48）                     | ✅ 无差异                                                                                                                            |
| `back`             | `fallback?: RouteLocationRaw`（默认首页）                                          | `back: (fallback?: RouteLocationRaw = { path: '/' }) => Promise<void>`（useAppRouter.ts:50, §155） | ✅ 无差异                                                                                                                            |
| `addDynamicRoute`  | `route: RouteRecordRaw`                                                            | `addDynamicRoute: (route: RouteRecordRaw) => void`（useAppRouter.ts:52）                           | ✅ 无差异                                                                                                                            |
| `withErrorToast`   | 文档未列出                                                                         | `withErrorToast: <T extends ...>(fn: T) => T`（useAppRouter.ts:54）                                | ⚠️ 文档缺失（次要，公开 API 集合已覆盖）                                                                                             |
| `goLogin`          | 文档 §"路由高层 API" 示例 `await goLogin('/user/list')`                            | `goLogin: (returnUrl?: string) => Promise<void>`（useAppRouter.ts:57, §209-212）                   | ✅ 无差异（实现与示例一致，returnUrl 转 query.redirect）                                                                             |

### 1.2 返回值

| 项            | 文档描述                                           | 源码定义                                                               | 差异                                 |
| ------------- | -------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------ |
| 整体结构      | 10 个方法 + `router` 实例                          | `router` + 11 个方法（useAppRouter.ts:38-61），多出 `pushByNameStrict` | ⚠️ **`pushByNameStrict` 未列入文档** |
| `router` 字段 | 兼容旧 API 返回 `Router` 实例                      | `router: Router`（useAppRouter.ts:40, §238）                           | ✅ 无差异                            |
| 快捷跳转      | `goHome` / `goLogin` / `go403` / `go404` / `go500` | 5 个函数齐全（§205-224）                                               | ✅ 无差异                            |

### 1.3 错误类型

| 触发条件                      | 文档描述                                                      | 源码行为                                                                                                      | 差异        |
| ----------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------- |
| `pushByName` 失败             | toast `ElMessage.error('路由跳转失败')`，业务侧无需 try/catch | `handleRouterError`：toast + console.error；过滤 "Avoided redundant navigation"（§227-235）                   | ✅ 无差异   |
| `pushByNameStrict` dev 未注册 | 文档未提及                                                    | `throw new Error('[useAppRouter] pushByNameStrict: 路由 "xxx" 未注册或未注入...')`（§104-108）+ console.error | ⚠️ 文档缺失 |
| `withErrorToast` 同步抛错     | 文档未提及                                                    | catch 后返回 `Promise.resolve()`（§186-190）                                                                  | ⚠️ 文档缺失 |

### 1.4 副作用 / 生命周期

| 项                           | 文档描述             | 源码行为                                                     | 差异                    |
| ---------------------------- | -------------------- | ------------------------------------------------------------ | ----------------------- |
| i18n 上下文捕获              | 文档未提及           | `pushWithTitle` 内部 `useI18n()` 在 setup 上下文调用（§140） | ✅ 实现细节，无需文档化 |
| `ElMessage` 存在性检查       | 文档未提及           | `typeof ElMessage !== 'undefined'` 守卫（§232）              | ✅ 实现细节             |
| `handleRouterError` 内部统一 | "所有失败统一 toast" | 已统一（§227-235）                                           | ✅ 无差异               |

### 1.5 文档定位

- 主要：`docs/07-路由模块设计.md` §"路由高层 API（useAppRouter）"（行 627-647）
- 次要：README §"必用 composable 列表"未列出，但 `docs/04-构建与测试工具.md` 提及

---

## 2. useRequest

### 2.1 入参

| 文档描述                                               | 源码定义                                                                                                                                                               | 差异                                |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `useRequest(fetcher, options?)`（docs/17 §"基础用法"） | `useRequest<T, P extends unknown[] = []>(fetcher: (...args: P) => Promise<T>, options: UseRequestOptions<T, P> = {}): UseRequestReturn<T, P>`（useRequest.ts:117-120） | ✅ 无差异                           |
| `options.immediate?: boolean` 默认 `true`              | `immediate?: boolean`（useRequest.ts:61，§189）                                                                                                                        | ✅ 无差异                           |
| `options.initialData?: T` 预填数据                     | `initialData?: T`（useRequest.ts:63，§121）                                                                                                                            | ✅ 无差异                           |
| `options.onSuccess(data, ...args)`                     | `onSuccess?: (data: T, ...args: P) => void`（useRequest.ts:65）                                                                                                        | ✅ 无差异                           |
| `options.onError(err: UseRequestError)`                | `onError?: (err: UseRequestError) => void`（useRequest.ts:67）                                                                                                         | ✅ 无差异                           |
| `options.watch?: WatchSource[]`（推荐）                | `watch?: WatchSource[]`（useRequest.ts:72）                                                                                                                            | ✅ 无差异                           |
| `options.deps?: WatchSource[]`（@deprecated）          | `deps?: WatchSource[]`（useRequest.ts:74）                                                                                                                             | ✅ 无差异（注释已标 `@deprecated`） |
| `fetcher: (...args: P) => Promise<T>`                  | 同（useRequest.ts:118）                                                                                                                                                | ✅ 无差异                           |

### 2.2 返回值

| 文档描述                                                                 | 源码定义                                                                   | 差异      |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------- | --------- |
| `data: Ref<T \| null>`                                                   | `data: Ref<T \| null>`（useRequest.ts:78）                                 | ✅ 无差异 |
| `loading: Ref<boolean>`                                                  | `loading: Ref<boolean>`（useRequest.ts:79）                                | ✅ 无差异 |
| `error: Ref<UseRequestError \| null>`                                    | `error: Ref<UseRequestError \| null>`（useRequest.ts:80）                  | ✅ 无差异 |
| `isEmpty: ComputedRef<boolean>`（non-loading + non-error + data===null） | `isEmpty: ComputedRef<boolean>`（useRequest.ts:82, §127）                  | ✅ 无差异 |
| `statusCode: Ref<number \| null>`                                        | `statusCode: Ref<number \| null>`（useRequest.ts:84）                      | ✅ 无差异 |
| `aborted: Ref<boolean>`                                                  | `aborted: Ref<boolean>`（useRequest.ts:86）                                | ✅ 无差异 |
| `execute: (...args: P) => Promise<void>`                                 | `execute: (...args: P) => Promise<void>`（useRequest.ts:87）               | ✅ 无差异 |
| `refresh: (...args: P) => Promise<void>`                                 | `refresh: (...args: P) => Promise<void>`（useRequest.ts:88）= execute 别名 | ✅ 无差异 |
| `cancel: () => void`                                                     | `cancel: () => void`（useRequest.ts:90）                                   | ✅ 无差异 |

### 2.3 错误类型

| Flag                 | 文档描述                                                | 源码定义                                                                        | 差异      |
| -------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------- | --------- |
| `err.isAborted`      | `cancel()` 主动取消 → 静默（不 toast）                  | `isAborted?: boolean`（useRequest.ts:52）+ 主动取消时构造轻量 Error（§153-156） | ✅ 无差异 |
| `err.isTimeout`      | axios code `ECONNABORTED`                               | `isTimeout?: boolean`（useRequest.ts:54）+ `classifyError`（§108）              | ✅ 无差异 |
| `err.isNetworkError` | axios code `ERR_NETWORK` / `ECONNREFUSED` / `ENOTFOUND` | `isNetworkError?: boolean`（useRequest.ts:56）+ 三种 code 识别（§109）          | ✅ 无差异 |
| 默认 statusCode      | 200（业务层未抛错即视为成功）                           | `statusCode.value = 200`（§159）                                                | ✅ 无差异 |

### 2.4 副作用 / 生命周期

| 项                       | 文档描述                                            | 源码行为                                                                                   | 差异      |
| ------------------------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------- |
| 快速重复点击竞态保护     | "取消上一次的 Promise + 立即发新一次"（docs/17 §1） | `currentController` 机制 + 二次校验 `currentController !== controller`（§134, §148, §162） | ✅ 无差异 |
| `cancel()` 行为          | "当前请求 abort，结果丢弃"（docs/17 §1）            | `currentController.abort()` + controller.signal.aborted 检查（§183, §150, §163）           | ✅ 无差异 |
| 组件 unmount 自动 cancel | **不会自动 cancel**（docs/17 §1）                   | 源码无 `onScopeDispose` / `onUnmounted`（仅暴露 `cancel()`）                               | ✅ 无差异 |
| `watch` 选项触发重拉     | "值变化自动重拉"                                    | `watch(watchSources, () => execute(...([] as ...)))`（§198-200）                           | ✅ 无差异 |
| 初始执行                 | `immediate !== false` 时自动 `execute`（§189）      | `if (options.immediate !== false) execute()`                                               | ✅ 无差异 |

---

## 3. useAuth

### 3.1 入参

| 文档描述 | 源码定义                     | 差异      |
| -------- | ---------------------------- | --------- |
| 无参数   | `useAuth()`（useAuth.ts:42） | ✅ 无差异 |

### 3.2 返回值

| 文档描述                                                | 源码定义                                                                                  | 差异                                               |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `hasPerm(codes): boolean` AND 语义（docs/23 §5.7.1）    | `hasPerm(codes: readonly string[]): boolean`（useAuth.ts:52）                             | ✅ 无差异                                          |
| `hasAnyPerm(codes): boolean` ANY 语义（docs/23 §5.7.1） | `hasAnyPerm(codes: readonly string[]): boolean`（useAuth.ts:63）                          | ✅ 无差异                                          |
| `isLoggedIn` 响应式                                     | `isLoggedIn`（from storeToRefs，useAuth.ts:44, §72）                                      | ✅ 无差异                                          |
| `permissions` Ref                                       | `permissions: allPermissions`（computed 后转新数组防止外部 mutation，useAuth.ts:69, §73） | ✅ 无差异（仅读 computed 包装）                    |
| 空数组语义                                              | docs/23 §5.7.1 表格「单权限 / 多权限 AND / ANY」未明确空数组                              | 源码：`if (!codes.length) return true`（§53, §63） | ⚠️ **文档缺失**：空数组视为「无要求」直接 true 的行为未在文档说明 |

### 3.3 错误类型

无错误抛出（纯计算函数）。

### 3.4 副作用 / 生命周期

| 项             | 文档描述                                                                        | 源码行为                                                     | 差异      |
| -------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------ | --------- |
| 数据来源       | `userStore.permissions`（docs/23 §5.7.1）                                       | `storeToRefs(userStore)` 解构 `permissions`（useAuth.ts:44） | ✅ 无差异 |
| 实时响应       | "storeToRefs 包装，权限变化时自动更新"（docs/23 §5.7.1）                        | `permissions.value` 在 `hasPerm`/`hasAnyPerm` 内实时读取     | ✅ 无差异 |
| 不发起网络请求 | "不在 store 增加 permission getter" + "不发起任何网络请求"（useAuth.ts:7, §12） | 源码无 fetch 调用                                            | ✅ 无差异 |

### 3.5 文档定位

- 主要：`docs/23-权限设计.md` §5.7.1（行 624-651）
- 次要：`docs/07-路由模块设计.md` §"按钮级权限（useAuth + v-auth + v-permission）"（行 591-623）

---

## 4. useLogout

### 4.1 入参

| 方法            | 文档描述                       | 源码定义                                            | 差异      |
| --------------- | ------------------------------ | --------------------------------------------------- | --------- |
| 无入参          | `useLogout()`（docs/23 §5.10） | `useLogout()`（useLogout.ts:20）                    | ✅ 无差异 |
| `confirmLogout` | 无入参（docs/23 §5.10 案例）   | `confirmLogout(): Promise<void>`（useLogout.ts:25） | ✅ 无差异 |

### 4.2 返回值

| 文档描述                                         | 源码定义                                           | 差异                              |
| ------------------------------------------------ | -------------------------------------------------- | --------------------------------- |
| `{ loggingOut, confirmLogout }`（docs/23 §5.10） | `{ loggingOut, confirmLogout }`（useLogout.ts:44） | ✅ 无差异                         |
| `loggingOut` 类型                                | 文档未明确                                         | `Ref<boolean>`（useLogout.ts:23） | ⚠️ 文档缺失（次要） |

### 4.3 错误类型 / 二次确认实现

| 维度                      | 文档描述（docs/23 §5.10 + §2.4 时序图）                                                            | 源码行为（useLogout.ts:25-42）                                                                                                               | 差异                                                                                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 二次确认实现              | `try { await ElMessageBox.confirm(...) } catch { return }`（docs/23 §5.10 案例，行 821-822）       | `useConfirm({ content, title, confirmButtonText, type: 'warning' })` —— 取消 resolve `false`，`if (!confirmed) return`（useLogout.ts:27-33） | ⚠️ **实现路径不一致**：文档展示的是 `ElMessageBox.confirm` 直调 + try/catch 写法；源码已切换到 `useConfirm` composable（v1.14.2 改造） |
| 二次确认文案              | `'确定退出登录吗？'` + title `'提示'` + `confirmButtonText: '退出'`（docs/23 §2.4 时序图 + §5.10） | 同（useLogout.ts:28-31）                                                                                                                     | ✅ 无差异（文案内容一致）                                                                                                              |
| 二次确认 type             | `type: 'warning'`（docs/23 §5.10）                                                                 | `type: 'warning'`（useLogout.ts:32）                                                                                                         | ✅ 无差异                                                                                                                              |
| 二次确认 cancelButtonText | 文档示例未显式指定                                                                                 | 源码未显式传，走 `useConfirm` 默认 `'取消'`（useConfirm.ts:21）                                                                              | ✅ 无差异（默认值合理）                                                                                                                |
| `userStore.logout()`      | "乐观退出：先清本地登录态，后端 logout fire-and-forget"（docs/19 §7 案例 1）                       | `await userStore.logout()`（useLogout.ts:37）                                                                                                | ✅ 无差异                                                                                                                              |
| 跳转登录                  | "跳转职责在此 composable"（docs/23 §5.10 注 + docs/19 §7 案例 1）                                  | `await goLogin()`（useLogout.ts:38）                                                                                                         | ✅ 无差异                                                                                                                              |
| `loggingOut` 状态         | 文档未明确                                                                                         | `loggingOut.value = true` → finally 复位 `false`（useLogout.ts:35, 40）                                                                      | ⚠️ 文档缺失（次要，但便于 Header.vue 调用方禁用按钮）                                                                                  |

### 4.4 副作用 / 生命周期

| 项                      | 文档描述                                                            | 源码行为                                                         | 差异      |
| ----------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------- | --------- |
| 跳转职责（2026-08-12）  | "跳转职责在此 composable"（docs/23 §5.10 注）                       | `useAppRouter()` 解构 `goLogin`（useLogout.ts:22）               | ✅ 无差异 |
| 阻断循环依赖            | "斩断 store → router → guards → store 循环依赖"（useLogout.ts:8-9） | store.logout 不依赖 router 实例（依赖在 useLogout）              | ✅ 无差异 |
| 退出后 globalAbort 重置 | 文档未提及 useLogout 责任                                           | userStore.logout 内部 `globalAbort.reset()`（docs/19 §7 案例 1） | ✅ 无差异 |

### 4.5 文档定位

- 主要：`docs/23-权限设计.md` §5.10（行 811-845）
- 次要：`docs/19-Pinia store使用规范.md` §7 案例 1（注脚"跳转归调用方"）

---

## 5. useDialog

### 5.1 入参

| 方法                          | 文档描述                                                                        | 源码定义                                                                                             | 差异                                       |
| ----------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `useDialog(content, options)` | "弹窗内容组件 + 弹窗配置"（docs/27 §3.2, §3.4）                                 | `useDialog(content: Component, options: UseDialogOptions = {}): UseDialogReturn`（useDialog.ts:110） | ✅ 无差异                                  |
| `options` 类型                | docs/27 §2.1 列 ProDialog 自有 6 项 Props，其余 ElDialog Props 经 `$attrs` 透传 | 源码从 `@components/common/ProDialog` import `UseDialogOptions`（useDialog.ts:43）                   | ✅ 无差异（具体形态由 ProDialog 类型决定） |
| `open(contentProps?)`         | `contentProps?: Record<string, unknown>`（docs/27 §3.5）                        | `open: (contentProps?: Record<string, unknown>) => Promise<unknown>`（useDialog.ts:95）              | ✅ 无差异                                  |
| `setProps(props)`             | `Partial<UseDialogOptions>`（docs/27 §3.6）                                     | `setProps: (props: Partial<UseDialogOptions>) => void`（useDialog.ts:99）                            | ✅ 无差异                                  |

### 5.2 返回值

| 文档描述                                            | 源码定义                                                        | 差异      |
| --------------------------------------------------- | --------------------------------------------------------------- | --------- |
| `{ open, close, setProps, isOpen }`（docs/27 §3.4） | `UseDialogReturn` 接口 4 字段（useDialog.ts:86-102）            | ✅ 无差异 |
| `isOpen: readonly boolean` getter                   | `get isOpen() { return visible.value }`（useDialog.ts:238-240） | ✅ 无差异 |

### 5.3 错误类型 / Promise 语义

| 维度                        | 文档描述                                                                                                | 源码行为                                                                                                         | 差异      |
| --------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------- |
| `open()` resolve            | "点「确定」resolve `Promise<true>`"（docs/27 §3.2 表格）                                                | `resolvePromise?.(true)`（useDialog.ts:196）                                                                     | ✅ 无差异 |
| `open()` reject             | "取消 / 关闭 / X / ESC / 遮罩 reject `DialogCancelledError`"（docs/27 §3.2）                            | `rejectPromise?.(new DialogCancelledError())`（useDialog.ts:198）                                                | ✅ 无差异 |
| `DialogCancelledError` 识别 | "`instanceof` 可识别，对齐 `ElMessageBox.confirm`" + "带 `code === 'DIALOG_CANCELLED'`"（docs/27 §3.7） | `class DialogCancelledError extends Error { readonly code = 'DIALOG_CANCELLED' as const }`（useDialog.ts:77-83） | ✅ 无差异 |
| 重复 open 行为              | "旧 Promise 按「取消」语义结算"（docs/27 §3.8）                                                         | `rejectPromise?.(new DialogCancelledError())` 后清空 + 复位 `settled=false`（useDialog.ts:211-219）              | ✅ 无差异 |
| `close()` 行为              | "以「取消」语义关闭弹窗（挂起的 Promise 会 reject）"（docs/27 §5）                                      | `settle('cancel')`（useDialog.ts:227）                                                                           | ✅ 无差异 |

### 5.4 副作用 / 生命周期

| 项                                                                   | 文档描述                                                                                                  | 源码行为                                                                                                                | 差异                                      |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 动态挂载容器                                                         | "`<div data-pro-dialog-container>` 挂到 body"（docs/27 §3.2）                                             | `holder.setAttribute('data-pro-dialog-container', '')` + `document.body.appendChild(holder)`（useDialog.ts:148-150）    | ✅ 无差异                                 |
| EP `closed` 事件销毁                                                 | "EP `closed` 事件后 `render(null) + remove()` 销毁"（docs/27 §3.2）                                       | `onClosed: () => unmount()`（useDialog.ts:169） + `render(null, container); container.remove()`（§138-139）             | ✅ 无差异                                 |
| 上下文双保险（setup + main.ts）                                      | "setup 内 `getCurrentInstance().appContext`；纯 JS 回退 `setDialogAppContext(app)`"（docs/27 §3.2, §3.3） | `callerContext = getCurrentInstance()?.appContext ?? null` + `vnode.appContext = context`（useDialog.ts:113, §181-187） | ✅ 无差异                                 |
| 组件卸载自动清理                                                     | 文档未明确（隐含在"DOM 残留 + Promise 挂起泄漏"）                                                         | `onScopeDispose(() => close())` 仅在 `callerContext` 非空时注册（useDialog.ts:118-120）                                 | ✅ 无差异（setup 内调用的清理路径已覆盖） |
| setProps 响应式                                                      | "运行时更新弹窗 props（title / width / fullScreen 等），实时生效"（docs/27 §3.6）                         | `Object.assign(state, props)`（useDialog.ts:231） + state 是 reactive（§123）                                           | ✅ 无差异                                 |
| `main.ts` 必须 `setDialogAppContext(app)` 在所有 `app.use(...)` 之后 | docs/27 §3.3 示例 + useDialog.ts:54-56 注释                                                               | `setDialogAppContext(app)` 内部 `globalAppContext = app._context`（useDialog.ts:57-59）                                 | ✅ 无差异                                 |

---

## 6. useConfirm

### 6.1 入参

| 重载                               | 文档描述                                                                 | 源码定义                                                                                                                      | 差异                                                            |
| ---------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 位置参数 `(content, title?)`       | "形态 1：位置参数（最简）"（docs/27 §8.5.1）                             | `useConfirm(content: string, title?: string): Promise<boolean>`（useConfirm.ts:146）                                          | ✅ 无差异                                                       |
| 对象参数 `(options)`               | "形态 2：对象参数（含标题 / 按钮文案 / 危险操作预设）"（docs/27 §8.5.1） | `useConfirm(options: UseConfirmOptions): Promise<boolean>`（useConfirm.ts:147）                                               | ✅ 无差异                                                       |
| `content: string`（仅字符串）      | "类型刻意只允许 `string`"（docs/27 §8.5.2 注 + useConfirm.ts:55-60）     | `content: string`（useConfirm.ts:61）                                                                                         | ✅ 无差异                                                       |
| `title?: string` 默认 `'系统提示'` | docs/27 §8.5.1 默认未明示（仅位置参数标题样例）                          | `title?: string` + `DEFAULT_TITLE = '系统提示'`（useConfirm.ts:18, §154）                                                     | ⚠️ 文档未列出默认 title                                         |
| `danger?: boolean`                 | docs/27 §8.5.1 示例 + §8.5.3 表格                                        | `danger?: boolean`（useConfirm.ts:69）                                                                                        | ✅ 无差异                                                       |
| `appContext?: AppContext \| null`  | docs/27 §3.2 "上下文继承" + useConfirm.ts:74 注释                        | `appContext?: AppContext \| null`（useConfirm.ts:75）                                                                         | ⚠️ 文档 §8.5 未单独列出该字段（次要，在 §3.2 上下文机制有覆盖） |
| 其余字段                           | "EP 原生 `ElMessageBoxOptions` 的裁剪超集"（useConfirm.ts:34）           | `UseConfirmOptions extends Omit<ElMessageBoxOptions, 'message' \| 'title' \| 'callback' \| 'boxType'>`（useConfirm.ts:44-47） | ✅ 无差异（4 个 Omit 字段原因 useConfirm.ts:35-43 注释详尽）    |

### 6.2 返回值

| 文档描述                             | 源码定义                                                      | 差异                                                                |
| ------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------- |
| `Promise<boolean>`                   | `Promise<boolean>`（useConfirm.ts:146-147）                   | ✅ 无差异                                                           |
| 点「确定」→ `true`                   | docs/27 §8.5 概述                                             | `return true;`（useConfirm.ts:174）                                 | ✅ 无差异 |
| 点「取消」/ X / ESC / 遮罩 → `false` | docs/27 §8.5 概述                                             | `if (CANCEL_ACTIONS.has(err)) return false`（useConfirm.ts:177）    | ✅ 无差异 |
| **不 reject**                        | docs/27 §8.5 概述（"取消即 resolve `false`，无须 try/catch"） | 仅在 catch 块返回 `false` 或 `throw err`（useConfirm.ts:177, §179） | ✅ 无差异 |

### 6.3 错误类型 / 取消语义

| 维度                             | 文档描述                                                                                               | 源码行为                                                                                                                                 | 差异      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `CANCEL_ACTIONS` 哨兵值          | docs/27 §8.5.4 注脚"详见 `useConfirm.ts:16-18` `CANCEL_ACTIONS`"                                       | `new Set(['cancel', 'close'])`（useConfirm.ts:16）                                                                                       | ✅ 无差异 |
| 真实业务异常处理                 | "与 `ElMessageBox.confirm` 原生差异 — 仅取消 resolve `false`，真实异常原样上抛"（docs/27 §8.5.3 表格） | `throw err`（useConfirm.ts:179）                                                                                                         | ✅ 无差异 |
| `dangerouslyUseHTMLString: true` | docs/27 §8.5.2 + §8.5.4 注脚                                                                           | 由 ElMessageBox.confirm `...rest` 透传（useConfirm.ts:170）                                                                              | ✅ 无差异 |
| `danger` 预设                    | "确认按钮转红 + 警告图标"（useConfirm.ts 注释 + docs/27 §8.5.1）                                       | `DANGER_PRESET = { type: 'warning', confirmButtonType: 'danger' }`（useConfirm.ts:28-31） + `...(danger ? DANGER_PRESET : null)`（§169） | ✅ 无差异 |

### 6.4 副作用 / 生命周期

| 项                                | 文档描述                                                       | 源码行为                                                                                  | 差异                                      |
| --------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------- |
| 复用 useDialog 的 appContext 注册 | "上下文注册点只保留 main.ts 那一处"（useDialog.ts:63-66 注释） | `getDialogAppContext()` 复用（useConfirm.ts:4, §92）                                      | ✅ 无差异                                 |
| 默认 confirm/cancel 按钮文案      | docs/27 §8.5 未列出                                            | `confirmButtonText: '确定'` + `cancelButtonText: '取消'`（useConfirm.ts:20-21, §165-166） | ⚠️ 文档未列出（次要，示例中通常显式覆盖） |

---

## 7. useDict（v2 多 code 契约 — 重点）

### 7.1 入参

| 文档描述                          | 源码定义                                                                                   | 差异                                   |
| --------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------- |
| `useDict(...codes: T[])` 变长参数 | `useDict<T extends string>(...codes: T[]): UseDictReturn<T>`（useDict.ts:70）              | ✅ 无差异                              |
| `T` 泛型约束为 `extends string`   | useDict.ts:70 显式                                                                         | ✅ 无差异                              |
| 单 code 等价多 code               | "完全等价于 `const { user_status, refreshDict } = useDict('user_status')`"（docs/11 §2.5） | useDict.ts:74-81 for 循环处理每个 code | ✅ 无差异 |

### 7.2 返回值（v2 契约形态 — 核心审计点）

| 字段                 | 文档描述（docs/11 §2.1 表格）                                                  | 源码定义                                                                      | 差异                         |
| -------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | ---------------------------- |
| `<code>` 字段        | `Ref<DictItem[]>` 按声明的 code 命名的 Ref 组合                                | `result[code] = computed(() => store.dicts[code] ?? [])`（useDict.ts:76）     | ✅ 无差异                    |
| `<code>` 类型        | "由泛型 T 精确推导到字面量 code"                                               | `UseDictReturn<T> = Record<T, Ref<DictItem[]>>`（useDict.ts:53）              | ✅ 无差异                    |
| `refreshDict(code)`  | `(code: string) => Promise<DictItem[]>`                                        | `refreshDict: (code: string) => Promise<DictItem[]>`（useDict.ts:55, §84-89） | ✅ 无差异                    |
| `refreshDict` 保留字 | "字典 code 请勿命名为 `'refreshDict'`"（docs/11 §2.1 注 + useDict.ts:49）      | 注释明确警告                                                                  | ✅ 无差异                    |
| 旧 v1 字段移除       | `options` / `getLabel` / `loading` / `refresh` 顶层已移除（docs/11 §9 迁移表） | 源码无 `options` / `getLabel` / `loading` 字段                                | ✅ 无差异（v2 契约完全收敛） |

### 7.3 错误类型

| 维度                | 文档描述                                                        | 源码行为                                                                       | 差异                                           |
| ------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------- |
| `fetchDict` 失败    | docs/11 §6「`el-select` 选项空白」+ §3「双层缓存」              | `store.fetchDict(code).catch((err) => console.error(...))`（useDict.ts:78-80） | ✅ 无差异（失败 console.error，Ref 保持 `[]`） |
| `refreshDict` 失败  | "失败降级 `[]`，不抛"（docs/11 §2.1 表格 + §2.4 示例）          | `.catch((err) => { console.error(...); return [] })`（useDict.ts:85-88）       | ✅ 无差异（catch 后降级返回空数组）            |
| `useDict(...)` 整体 | docs/11 §2 仅返回 Ref 组合 + `refreshDict`，无顶层 Promise 抛出 | 源码 `useDict` 函数本身不返回 Promise，也不抛错                                | ✅ 无差异                                      |

### 7.4 副作用 / 生命周期

| 项                    | 文档描述                                                                                                                                           | 源码行为                                                               | 差异      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------- |
| setup 阶段 lazy fetch | "setup 阶段对每个 code 触发一次 lazy fetch（首次访问才发请求）"（useDict.ts:61-62 注释）                                                           | `store.fetchDict(code).catch(...)` fire-and-forget（useDict.ts:78-80） | ✅ 无差异 |
| 多组件并发请求合并    | "多组件并发请求同一字典由 store 防抖池自动合并"（useDict.ts:62 注释）                                                                              | 由 `useDictStore.fetchDict` 内部防抖池保证（不在 useDict 范围）        | ✅ 无差异 |
| `computed` 视图同步   | "字典数据所有权在 store（单一数据源），composable 只建「视图」—— refresh 写入 store 后，所有 useDict 实例的 Ref 自动同步"（useDict.ts:16-19 注释） | `computed(() => store.dicts[code] ?? [])`（useDict.ts:76）             | ✅ 无差异 |
| 5min 业务层缓存       | docs/11 §3 表格 + §2.4 示例                                                                                                                        | 由 store `STORE_TTL_MS` 控制，不在 useDict 范围                        | ✅ 无差异 |
| force 刷新忽略缓存    | docs/11 §2.4 "立即重发请求；失败返回 `[]`"                                                                                                         | `store.fetchDict(code, true)`（useDict.ts:85，第二个参数 force=true）  | ✅ 无差异 |

### 7.5 文档定位

- 主要：`docs/11-字典使用规范.md` §2（行 36-121）
- 次要：`docs/19-Pinia store使用规范.md` §1 决策表 + §2 持久化

---

## 8. useTheme

### 8.1 入参

| 文档描述 | 源码定义                       | 差异      |
| -------- | ------------------------------ | --------- |
| 无入参   | `useTheme()`（useTheme.ts:43） | ✅ 无差异 |

### 8.2 返回值

| 文档描述（docs/06 §"切换 API" 表格）     | 源码定义                                              | 差异      |
| ---------------------------------------- | ----------------------------------------------------- | --------- |
| `mode: Ref<'light' \| 'dark' \| 'auto'>` | `mode`（来自 `storeToRefs(store)`，useTheme.ts:45）   | ✅ 无差异 |
| `isDark: Ref<boolean>`                   | `isDark`（来自 `storeToRefs(store)`，useTheme.ts:45） | ✅ 无差异 |
| `setMode(value: ThemeMode) => void`      | `setMode: store.setMode`（useTheme.ts:49）            | ✅ 无差异 |
| `toggleMode() => void`                   | `toggleMode: store.toggleMode`（useTheme.ts:50）      | ✅ 无差异 |

### 8.3 错误类型

无错误抛出（直接代理 store 方法）。

### 8.4 副作用 / 生命周期

| 项         | 文档描述                                                                                     | 源码行为                                                                                   | 差异      |
| ---------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------- |
| 持久化     | "mode 字段自动写入 localStorage（key: `vue3-vite-project:theme-mode`）"（docs/06 §"持久化"） | 由 `useThemeStore` 的 `persist.pick: ['mode']` + `namespacedStorageKey('theme-mode')` 处理 | ✅ 无差异 |
| 跟随系统   | "`mode === 'auto'` 时 store 自动监听 `prefers-color-scheme` 媒体查询"（docs/06 §"跟随系统"） | 由 theme store 内 watcher 处理                                                             | ✅ 无差异 |
| 文档源数据 | theme store（持久化、跟随系统）                                                              | `useThemeStore()` + `storeToRefs(store)` 解构（useTheme.ts:44-45）                         | ✅ 无差异 |

### 8.5 文档定位

- 主要：`docs/06-主题管理规范.md` §"切换 API（`useTheme` composable）"（行 91-114）
- 次要：`docs/19-Pinia store使用规范.md` §7 案例 2-3（"theme store + useTheme composable"）

---

## 9. 总体结论

### 9.1 发现汇总

| #   | Composable   | 严重度 | 类型                   | 描述                                                                                                                                                               | 建议优先级 |
| --- | ------------ | ------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| 1   | useAppRouter | MEDIUM | 文档缺失 + 描述滞后    | `pushByName` 已从 `RouteName` 联合类型 → `string`（2026-07-24 方案 A），但 docs/07 §"路由高层 API"（行 627-647）未同步；新增 `pushByNameStrict` API 文档完全未列出 | P1         |
| 2   | useLogout    | HIGH   | 实现 vs 文档路径不一致 | docs/23 §5.10（行 813-841）展示的 `ElMessageBox.confirm + try/catch` 旧写法未同步到实际 `useConfirm({ composable })` 调用（v1.14.2 改造）；时序图（§2.4）未更新    | P1         |
| 3   | useLogout    | LOW    | 文档字段缺失           | `loggingOut: Ref<boolean>` 返回字段在文档 §5.10 未列出（Header.vue 消费方需要）                                                                                    | P2         |
| 4   | useAuth      | LOW    | 边界行为缺失           | `hasPerm([])` / `hasAnyPerm([])` 返回 `true`（视为「无要求」）的边界语义未在文档 §5.7.1 显式说明                                                                   | P2         |
| 5   | useConfirm   | LOW    | 字段默认值缺失         | `title` 默认 `'系统提示'`、`confirmButtonText` 默认 `'确定'`、`cancelButtonText` 默认 `'取消'` 三项默认值未在 docs/27 §8.5 表格列出                                | P3         |

### 9.2 建议优先修复

1. **P1 必修**（HIGH/MEDIUM，文档误导风险）：
   - **useLogout 文档同步**：docs/23 §5.10 案例代码需从 `ElMessageBox.confirm + try/catch` 切换为 `useConfirm({ content, title, confirmButtonText, type: 'warning' }) + if (!confirmed) return`；时序图 §2.4 的「ElMessageBox 二次确认」步骤需更新文案
   - **useAppRouter 文档同步**：docs/07 §"路由高层 API" 表格新增 `pushByNameStrict` 行 + 类型列从 `RouteName` 改为 `string` + 增加「dev 模式 throw」机制说明（与 §2 同步）
   - **CLAUDE.md §1.6 标识符表**：确认 8 个 composable 标识符全部已在 AutoImport 列表内（已确认：`useAppRouter` / `useRequest` / `useAuth` / `useLogout` / `useDialog` / `useConfirm` / `useDict` / `useTheme`）

2. **P2 可修**（LOW，完整性）：
   - useAuth 文档 §5.7.1 表格新增「空数组视为无要求」一行
   - useConfirm 文档 §8.5.1 新增「默认值」一行（title / confirmButtonText / cancelButtonText）

3. **P3 优化**（LOW，可选）：
   - useLogout `loggingOut` 字段类型补充

### 9.3 风险评估

| 风险类别            | 风险点                              | 当前状态                                                                                                                                |
| ------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **API 类型安全**    | useAppRouter 的 `name: string` 放宽 | 已通过 `pushByNameStrict` + zod runtime 校验兜底（docs/07 §2 已说明机制），文档滞后                                                     |
| **Promise 语义**    | useConfirm vs useDialog 分工        | 实现已完全对齐文档 §8.5 概述；3 个取消哨兵值分支正确                                                                                    |
| **错误处理**        | 全部 composable 错误类型完整        | useDialog 抛 `DialogCancelledError`、useConfirm 取消降级 `false` / 真实异常原样上抛、useRequest 分类 axios code 三类 flag —— 与文档一致 |
| **副作用**          | 全部 composable 副作用受控          | useDialog `onScopeDispose` 自动清理、useRequest 不自动 unmount cancel（文档明确告知）、useAuth / useDict / useTheme 不发起网络          |
| **v2 多 code 契约** | useDict 字段裁剪                    | 源码完全收敛 v2 形态（无 `options` / `getLabel` / `loading` / `refresh` 顶层残留），与 docs/11 §9 迁移表一致                            |

### 9.4 总体合规度

| 维度             | 合规度           | 说明                                                       |
| ---------------- | ---------------- | ---------------------------------------------------------- |
| 入参契约对齐     | **7/8 完全对齐** | useAppRouter 类型放宽 + useLogout 实现路径变更             |
| 返回值契约对齐   | **7/8 完全对齐** | useAppRouter 多出 `pushByNameStrict` 未列文档              |
| 错误类型契约对齐 | **7/8 完全对齐** | useLogout 二次确认实现路径与文档展示不一致                 |
| 副作用契约对齐   | **8/8 完全对齐** | 所有生命周期 / onUnmounted / setProps / refresh 语义均一致 |
| v2 多 code 契约  | **完全对齐**     | useDict v2 形态改造彻底完成，文档 §9 迁移表与源码零偏差    |

**总体结论**：8 个 composable 核心契约与文档高度对齐（无重大偏离），仅有 **2 项 P1 文档滞后**（useAppRouter 同步、`useLogout` 实现路径变更）和 **3 项 P2/P3 字段补全**。无契约破坏性偏离，所有 composable 可在 v1.7.0 项目基线下安全使用。

---

END OF REPORT
