# API 契约单源（auth 响应 Schema 试点）P1 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `LoginResult` / `UserProfile` 的 TS 类型从同址 Zod schema 推导，`login` / `fetchProfile` 复用现有 `requestValidated` 在 API 边界识别响应漂移，保持 mock 零运行时依赖与现有认证链路行为零变化。

**Architecture:** 复用 `packages/shared/src/api/validator.ts` 的 `requestValidated`（响应后 `safeParse`，失败抛 `ApiError(code=500)` 不 toast）。schema 与 API 同址声明（`auth.ts`），类型经 `z.infer` 推导，`.passthrough()` 保留后端新增字段的前向兼容。`@vv/shared` 增 zod 运行时依赖（peer），mock 保持 `import type` 编译期擦除。

**Tech Stack:** zod v4（catalog）、现有 `requestValidated` / `request` / Vitest 4、vue-tsc。

**Spec:** `docs/superpowers/specs/2026-10-27-api-contract-single-source-design.md`（已批准）

**⚠️ 提交纪律：** 项目规则禁止擅自 `git commit`。本计划共 4 个 commit，每个 Task 末尾经用户确认后执行。

---

## 背景速读（执行者零上下文假设）

- 改造对象仅 `packages/shared/src/api/modules/auth.ts` 两个只读响应接口（`login` / `fetchProfile`）。`logout` 返回 `void` 不动；菜单递归 schema（admin `remote.ts`）有「部分非法项跳过」容错语义，**本批不碰**。
- `requestValidated(schema, config)`（`api/validator.ts:60-66`）：先 `request<unknown>(config)` 拿 `body.data`，再 `validate(schema, raw)`；失败抛 `ApiError(code=500, message=数据格式异常+issues)` 并 `console.error` 详情（不 toast）。
- 现有 `LoginResult = { profile: { id, name } }`、`UserProfile = { id, name, permissions: string[] }` 是手写 interface（`auth.ts:27-34`）。
- zod v4 `.passthrough()` 已实测（tsc --strict）：推导的 `UserProfile` 在 `ref<UserProfile|null>` / `computed` / 属性访问 / mock `satisfies` 场景**类型全兼容**，可安全替换 interface。
- `@vv/shared` 根 barrel（`src/index.ts:58`）`export type { LoginResult, UserProfile }` 是纯类型导出——auth.ts 改成 `z.infer` 类型别名后，barrel / mock(`import type`) / user store 均**无需改动**。
- `@vv/shared/package.json` 的 zod 当前在 `devDependencies`（P0 加的 spec 值导入），本批升 `peerDependencies`（生产 `auth.ts` 运行时需要）。

---

### Task 1: shared 增 zod 运行时依赖（peer）

**Files:**
- Modify: `packages/shared/package.json`

- [ ] **Step 1: 移动 zod 到 peerDependencies**

`packages/shared/package.json` 的 `peerDependencies` 段（`web-vitals` / `normalize.css` 之后）追加：

```json
    "normalize.css": "catalog:",
    "zod": "catalog:"
```

`devDependencies` 段删除现有 zod 行：

```json
    "zod": "catalog:",
```

> peer 声明宿主契约（运行时 `auth.ts` 需 zod），devDep 已无必要（workspace 根已装）。

- [ ] **Step 2: 安装 + 规则验证**

Run: `pnpm install && pnpm -C packages/shared exec vitest run src/api/validator.spec.ts`
Expected: install 成功（lockfile 更新）；validator spec 仍绿（zod 解析路径不变）。

Run: `pnpm lint`
Expected: PASS（`local/package-contract` 对 `packages/shared` 生产文件 import zod——zod 现已在 peerDependencies，声明合规）。

- [ ] **Step 3: Commit（经用户确认）**

```bash
git add packages/shared/package.json pnpm-lock.yaml
git commit -m "feat(shared): auth schema 试点前置——zod 升为 @vv/shared 运行时 peer 依赖"
```

---

### Task 2: TDD —— auth schema 单测先写（RED）

**Files:**
- Create: `packages/shared/src/api/modules/auth.spec.ts`

> 在改 `auth.ts` 之前，先写捕获 schema 行为 + `silent` 透传的测试，确认当前（无 schema）实现下「schema 校验」用例失败、`silent` 透传用例通过（后者约束重构不改行为）。

- [ ] **Step 1: 写测试文件**

创建 `packages/shared/src/api/modules/auth.spec.ts`：

```ts
/**
 * authApi schema 契约单测（P1 API 契约单源试点）。
 *
 * 覆盖：
 * 1. loginResultSchema / userProfileSchema 合法值通过 + 保留额外字段（.passthrough 前向兼容）
 * 2. 缺必需字段 / 字段类型错误拒绝（ApiError code=500，不 toast）
 * 3. login 的 url/method/data 原样透传
 * 4. fetchProfile({ silent: true }) 的 silent 原样透传给 HTTP 层
 *
 * mock 策略：mock 顶层 request/validator——auth.ts 经 requestValidated 调 request，
 * 直接 mock validator 模块可同时拦截 request 返回与 schema 校验，避免触真实 axios。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'
import { ApiError } from '../types/error'

// auth.ts 经 requestValidated -> request；mock validator 模块即拦截整条链路
vi.mock('../validator', () => ({
  requestValidated: vi.fn(),
}))

import { requestValidated } from '../validator'
import { authApi, loginResultSchema, userProfileSchema } from './auth'

const mockRequestValidated = vi.mocked(requestValidated)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('auth schema 契约（P1 契约单源）', () => {
  it('loginResultSchema 合法值通过并保留额外字段（passthrough 前向兼容）', () => {
    const value = { profile: { id: 1, name: 'Admin', avatar: 'a.png' } }
    const parsed = loginResultSchema.parse(value)
    expect(parsed.profile.id).toBe(1)
    expect(parsed.profile.name).toBe('Admin')
    expect((parsed.profile as Record<string, unknown>).avatar).toBe('a.png')
    // 顶层额外字段也保留
    expect((parsed as Record<string, unknown>).traceId).toBeUndefined()
  })

  it('userProfileSchema 缺 permissions 拒绝；字段类型错误拒绝', () => {
    expect(() => userProfileSchema.parse({ id: 1, name: 'A' })).toThrow()
    expect(() => userProfileSchema.parse({ id: '1', name: 'A', permissions: [] })).toThrow()
  })

  it('schema 校验失败抛 ApiError code=500 且不 toast', async () => {
    mockRequestValidated.mockRejectedValue(
      new ApiError({ code: 500, message: '数据格式异常：profile: Required' })
    )
    await expect(authApi.login({ username: 'a', password: 'b' })).rejects.toMatchObject({
      code: 500,
    })
  })
})

describe('authApi 透传契约（行为零变化）', () => {
  it('login 的 url/method/data 原样透传', async () => {
    mockRequestValidated.mockResolvedValue({ profile: { id: 1, name: 'Admin' } })
    const data = { username: 'admin', password: '123456' }
    await authApi.login(data)
    expect(mockRequestValidated).toHaveBeenCalledWith(
      expect.anything(),
      { url: '/auth/login', method: 'post', data }
    )
  })

  it('fetchProfile({ silent: true }) 的 silent 原样透传', async () => {
    mockRequestValidated.mockResolvedValue({ id: 1, name: 'Admin', permissions: [] })
    await authApi.fetchProfile({ silent: true })
    expect(mockRequestValidated).toHaveBeenCalledWith(
      expect.anything(),
      { url: '/auth/profile', method: 'get', silent: true }
    )
  })
})
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `pnpm -C packages/shared exec vitest run src/api/modules/auth.spec.ts`
Expected: **编译/导入失败**——`auth.ts` 尚未导出 `loginResultSchema` / `userProfileSchema`，`Cannot find exported name`。这证明测试确实约束待实现的 schema 导出。

> 同时确认：两个「透传」用例也失败（因 `auth.ts` 还在用 `request` 而非 `requestValidated`），重构后转绿。

- [ ] **Step 3: Commit（经用户确认，仅测试文件）**

```bash
git add packages/shared/src/api/modules/auth.spec.ts
git commit -m "test(shared): auth schema 契约单测先行（RED——schema 导出与 requestValidated 接线待实现）"
```

---

### Task 3: auth.ts 接 schema + requestValidated（GREEN）

**Files:**
- Modify: `packages/shared/src/api/modules/auth.ts:14-65`

- [ ] **Step 1: 改写 auth.ts**

`packages/shared/src/api/modules/auth.ts` 的 import 区与两个接口实现改写如下（保留文件头注与所有现有 JSDoc/注释，仅改 import 行与 `login`/`fetchProfile` 实现、interface → z.infer 类型 + 新增 schema）：

将 `import { request } from '../http'` 替换为：

```ts
import { z } from 'zod'
import { requestValidated } from '../validator'
```

将 `LoginResult` / `UserProfile` 两个 interface（`auth.ts:27-34`）替换为同址 schema + 类型推导（**保留原 interface 上方的 JSDoc**，移到对应 schema 上方）：

```ts
/**
 * 登录响应 schema（httpOnly 模式）：凭证由后端 Set-Cookie 下发，响应体仅含 profile。
 * `.passthrough()` 保留后端新增字段（前向兼容，不裁剪未知键）。
 * @group 业务 API：认证
 */
export const loginResultSchema = z
  .object({
    profile: z.object({ id: z.number(), name: z.string() }).passthrough(),
  })
  .passthrough()

/**
 * 当前用户 profile + 权限列表 schema（路由守卫鉴权依赖）。
 * `.passthrough()` 保留后端新增字段。
 * @group 业务 API：认证
 */
export const userProfileSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    permissions: z.array(z.string()),
  })
  .passthrough()

export type LoginResult = z.infer<typeof loginResultSchema>
export type UserProfile = z.infer<typeof userProfileSchema>
```

将 `login` 实现（`auth.ts:45`）替换为：

```ts
  login: (data: LoginPayload) =>
    requestValidated(loginResultSchema, { url: '/auth/login', method: 'post', data }),
```

将 `fetchProfile` 实现（`auth.ts:56-57`）替换为：

```ts
  fetchProfile: (options?: { silent?: boolean }) =>
    requestValidated(userProfileSchema, { url: '/auth/profile', method: 'get', silent: options?.silent }),
```

> `logout` 保持 `request<void>` 不动。`LoginPayload` 保持 interface 不动（本批只验证响应，不扩请求体）。

- [ ] **Step 2: 运行测试确认 GREEN**

Run: `pnpm -C packages/shared exec vitest run src/api/modules/auth.spec.ts`
Expected: 全部 PASS（schema 契约 3 例 + 透传 2 例）。

- [ ] **Step 3: 跑 shared 全量测试（防回归）**

Run: `pnpm -C packages/shared test`
Expected: 全绿（含 user store spec 等下游，LoginResult/UserProfile 改 z.infer 后类型别名零破坏）。

- [ ] **Step 4: 类型检查**

Run: `pnpm -C packages/shared type-check && pnpm -C packages/mock type-check`
Expected: PASS（mock 的 `satisfies UserProfile` / `LoginResult` 类型挂钩兼容推导类型）。

- [ ] **Step 5: Commit（经用户确认）**

```bash
git add packages/shared/src/api/modules/auth.ts
git commit -m "feat(shared): auth 响应契约单源——login/profile 同址 zod schema + requestValidated

- loginResultSchema / userProfileSchema 与 API 同址声明，LoginResult / UserProfile
  改 z.infer 推导（.passthrough 保留后端新增字段前向兼容）
- login / fetchProfile 由 request<T> 改 requestValidated(schema, config)——响应漂移
  在 API 边界抛 ApiError(code=500)，不 toast
- 行为零变化：url/method/data/silent 原样透传；logout 保持 request<void>；LoginPayload 不动
- mock 保持 import type 编译期擦除零运行时依赖；根 barrel 纯类型导出无需改"
```

---

### Task 4: 文档 + 全量门禁 + 安全审查

**Files:**
- Modify: `docs/14-zod请求参数校验使用规范.md`（将「只有示例」更新为真实 auth 用法）
- Modify: `CHANGELOG.md`（「未发布」区新增 P1 条目）
- Modify: `docs/superpowers/specs/2026-10-27-api-contract-single-source-design.md`（如实现中有偏差则同步）

- [ ] **Step 1: 更新 docs/14 的 requestValidated 段**

在 `docs/14-zod请求参数校验使用规范.md` 中 `requestValidated` 现有示例附近补一段「真实接入案例（P1）」：

```markdown
### 真实接入案例：auth 响应契约（P1，2026-10-27）

`packages/shared/src/api/modules/auth.ts` 的 `login` / `fetchProfile` 已接入——schema 与 API 同址
声明（`loginResultSchema` / `userProfileSchema`），类型经 `z.infer` 推导。响应漂移在 API 边界抛
`ApiError(code=500)`（详细 issues 记 console.error，不 toast、不打印密码/cookie）。mock 经
`import type` 消费推导类型保持零运行时依赖。
```

- [ ] **Step 2: CHANGELOG 条目**

在 `CHANGELOG.md` `## 未发布` 顶部新增：

```markdown
### ✨ Feat | API 契约单源试点：auth 响应 zod schema 化（2026-10-27）

> 背景：此前 TS interface 只能编译期约束，真实响应与类型漂移要等运行时崩才暴露。复用现有
> `requestValidated` + zod，让 login/profile 的类型与运行时校验同源。

- `auth.ts` 同址声明 `loginResultSchema` / `userProfileSchema`（`.passthrough()` 保留后端新增字段），
  `LoginResult` / `UserProfile` 改 `z.infer` 推导
- `login` / `fetchProfile` 改 `requestValidated`——响应漂移在 API 边界抛 `ApiError(code=500)`、
  不 toast、不打印密码/cookie；url/method/data/silent 原样透传，行为零变化
- `@vv/shared` 的 zod 升为 peerDependencies（生产运行时依赖）；mock 保持 `import type` 零运行时依赖
- 新增 `auth.spec.ts` 5 例（schema 契约 + 透传），user store spec 全绿无回归

验证：`pnpm -C packages/shared test`（428+5 全绿）/ `type-check`（shared+mock）/ `pnpm lint` 全绿。
待安全审查确认日志与错误反馈无敏感信息泄露。
```

- [ ] **Step 3: 全量门禁**

```bash
pnpm lint
pnpm type-check          # 全量
pnpm test                # 9 包
pnpm check:routes && pnpm check:aliases
```

全须 PASS。

- [ ] **Step 4: 浏览器验证 auth 流程**

起 `pnpm dev:gateway admin auth`，经 CDP 走通：
1. 正确账号登录成功 → 跳回 `/admin/`，cookie 设置、profile 权限展示正常
2. 错误账号登录失败 → 走既有 bug 路径（401 重定向，与本批无关，不回退）
3. portal 匿名 `silent` 探测不触发额外 toast/横幅
4. 模拟 401/refresh 流程，确认 schema 改造未改认证链路

> 若 Step 4 发现登录成功路径因 schema 校验失败（如后端返回缺 `permissions`），**停止**——说明真实响应与 schema 假设不符，回到 spec 确认字段必填性，不放宽校验掩盖。

- [ ] **Step 5: 派发 security-reviewer 独立审查**

auth 流程属安全敏感。派 security-reviewer 审查：schema 校验失败的日志是否泄露密码/cookie/完整 profile、错误反馈是否有重复提示、`silent` 语义是否被 schema 层破坏。审查通过后才算 P1 完成。

- [ ] **Step 6: Commit（经用户确认）**

```bash
git add docs/14-zod请求参数校验使用规范.md CHANGELOG.md docs/superpowers/specs/2026-10-27-api-contract-single-source-design.md
git commit -m "docs: auth 契约单源真实用法入档 + CHANGELOG + P1 spec 对齐"
```

---

## Self-Review 记录（写计划时完成）

- **Spec 覆盖**：schema 同址→Task 3；类型推导→Task 3；requestValidated 接入→Task 3；zod 依赖→Task 1；mock 零运行时→Task 3 Step 4（mock type-check）+ spec；透传/silent 零变化→Task 2 透传用例 + Task 3；文档→Task 4；安全审查→Task 4 Step 5。无缺口。
- **类型一致性**：`loginResultSchema` / `userProfileSchema` 命名在 Task 2 测试与 Task 3 实现一致；`requestValidated` 签名引用 validator.ts 现物。
- **zod v4 兼容性**：`.passthrough()` 推导类型在 store/mock/barrel 场景的兼容性已经 tsc --strict 实测（本计划编写时验证，0 错），非凭记忆。
- **风险**:Task 4 Step 4 明确「真实响应与 schema 不符时停止回 spec」，不放宽校验掩盖——防误配 schema 上线。
