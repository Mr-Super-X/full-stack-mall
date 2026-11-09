# 阶段 3 admin 后台（统一登录接线 + 寄卖审核 + 结算审批）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **v2 方向变更（2026-11-09，用户指令）**：「登录功能应该打通现有的auth/login而不是再写一套，管理后台和h5也同步接线」。v1 的方案 A（admin 应用级自建登录页）作废，改为**统一登录方案**：适配 `@vv/shared` 认证契约指向商城 `/mall/auth/*`，apps/auth 既有登录页即商城登录页，admin 回退 P4 跨应用统一登录协议，h5 删除自有 auth 端点改走 shared authApi。v1 产物（mall-admin 内 Login.vue / apis/auth.ts / useMallAuth / mall-login 守卫，均未提交）在 Task 1 中撤销。

**Goal:** 全 monorepo 一套商城账号体系——apps/auth 统一登录（ADMIN 进后台、USER 被权限点拦在 403）；apps/admin 成为可真实操作的商城管理后台（寄卖审核队列 + Payout 三步审批）；h5 登录/注册同步切换到 shared 契约。

**Architecture:** 单一事实源是 `packages/shared/src/api/modules/auth.ts`：三个端点改指 `/mall/auth/login|me|logout`（logout 已存在于后端 `AuthController.java:57`，**本计划零后端改动**），zod schema 经 transform 把商城 UserInfoDTO（`{id,username,nickname,avatar,role}`）映射为 shared `UserProfile`（`{id,name,permissions[]}`），role→permissions 映射收敛在此一处；新增 `register` 端点（h5 需要）。admin 守卫链恢复原样（`checkLoginState` 探测 + 未登录整页跳 apps/auth），商城业务路由以 `meta.permissions=['mall:admin']` 鉴权；mock 层补齐 `/mall/auth/*` 处理器保 showroom 应用可演示。

**Tech Stack:** Vue 3.6(beta) + TS 6 + Vite 8 + Pinia 3 + Element Plus + vitest；共享 http.ts 已原生拆 `{code,message,data}` 信封（`BusinessCode.SUCCESS` 校验 + `res.data.data` 提取，http.ts:301/410），商城后端契约天然兼容。

**Spec:** `docs/superpowers/specs/2026-11-06-resale-mall-design.md`（§6 接口表：寄卖管理/结算管理行，plan-06 已调整归属）

## Global Constraints

- **后端零改动**（logout 端点已存在，契约冻结）；`packages/*` 只许动两个文件面：`packages/shared/src/api/modules/auth.ts`（契约适配）与 `packages/mock` 的认证处理器（数据对齐），其余 packages 文件一行不动
- 新模块已用 `pnpm new-module mall-admin` 生成骨架（v1 已完成）；模块边界：对外只经 `modules/mall-admin/index.ts` 暴露（§1.2）
- 业务封装（ESLint error 级拦截 + 规范兜底）：请求一律 `request`（`@api/http`），禁止裸 axios；路由跳转一律 `useAppRouter`；二次确认一律 `useConfirm`
- 新增 composable / store / 类型必须带 `.spec.ts`（约束 #6，覆盖率 ≥80%）
- BEM 强约束（§3）：`createNamespace` 自动注入、组件名 kebab-case 与 sass 根选择器对齐、`lang="scss"`、禁 `scoped`、禁 `:deep()`、禁 `!important`
- commit message 中文约定式，禁任何 AI 痕迹（约束 #11）
- 验证环境：`pnpm dev:gateway`（:8080 同域网关，P4 跨应用整页跳协议的运行前提）+ MySQL（Docker 13306）+ `mvn spring-boot:run`（18080，context-path `/api`，CORS 已放行 8080）
- 任务完成后输出合规简报：表格列出全部 workspace 写操作（路径 / 操作 / 原状 / 变更）

## Review Focus

（spec 隐含但各任务测试未直接覆盖、最可能咬人的输入类别，按最可能先排序）

1. **role=USER 的商城账号经 apps/auth 登录后访问 admin 业务路由**：`checkLoginState` 只认会话有效（放行），`checkPermission` 以 `meta.permissions=['mall:admin']` 拦截 → `/403`。USER 映射权限必须**不含** `mall:admin`，且映射逻辑不得因未知 role 静默放行（未知 role → 空权限数组）。（→ Task 1 schema transform spec 覆盖 + Task 4 浏览器验证）
2. **shared 契约换向后连累面**：`userStore.login()` 内部链（login → Session 标记 → fetchProfile → dict 预加载）在商城后端下，fetchProfile 必须命中 `/mall/auth/me` 而非残留 `/auth/profile`；`/dict/*` 在商城后端 404 属既有 catch 兜底（仅 warn），不得升级为阻塞。（→ Task 1 shared auth.spec + user store 既有 spec 全绿）
3. **mock 漂移**：shared 端点改 `/mall/auth/*` 后，showroom 应用（portal/big/docs 无 `VITE_API_BASE_URL`）在 mock 模式下登录 404——mock 必须同步补 `/mall/auth/*` 处理器且返回商城形状数据，`pnpm check:mock-wiring` 保持绿。（→ Task 1 mock 对齐 + 校验命令）
4. **h5 登录态断档**：h5-mall 删除自有 auth 端点后，`useAuthForm` 改走 `userStore.login`——`result` 语义从接口返回 UserInfo 变为 store profile，login.vue/register.vue 的消费点必须同步改，否则登录成功无跳转。（→ Task 1 h5 spec 更新 + Task 4 浏览器验证）
5. **凭证过期后操作业务按钮**：审核/审批时 cookie 已过期 → 401 → http 层 refresh 失败兜底回登录（shared 既有行为），页面不得卡死或静默吞错。（→ Task 2/3 spec 断言错误向上抛 + Task 4 手动验证）
6. **审批按钮连点 / 状态已变迁**：`confirm`/`pay` 遇后端条件迁移 400（`PAYOUT_STATE_ILLEGAL`）→ 前端错误可见（toast）+ 强制刷新对齐真态，不留"幻觉成功"。（→ Task 3 spec 覆盖）

---

### Task 1: 统一登录接线（shared 契约适配 + 撤销 v1 产物 + h5 切换）

**Files:**
- Modify: `frontend/packages/shared/src/api/modules/auth.ts`（端点 + schema transform + role 映射 + register）
- Modify: `frontend/packages/shared/src/api/modules/auth.spec.ts`（断言换商城契约）
- Modify: `frontend/packages/mock/src/auth.ts`（`/mall/auth/*` 处理器，商城形状数据）
- Modify: `frontend/packages/mock/src/mockProdServer.ts`（prod 内联 mock 同步）
- Delete（v1 未提交产物）: `frontend/apps/admin/src/modules/mall-admin/apis/auth.ts`、`composables/useMallAuth.ts`、`composables/useMallAuth.spec.ts`、`views/Login.vue`、`router/guards/mall-login.ts`、`router/guards/mall-login.spec.ts`
- Revert（v1 未提交改动，git checkout 还原）: `frontend/apps/admin/src/router/guards/auth.ts`、`frontend/apps/admin/src/router/whitelist.ts`
- Modify（还原为空导出，Task 2/3 再填）: `frontend/apps/admin/src/modules/mall-admin/index.ts`、`apis/index.ts`、`routes/index.ts`
- Modify: `frontend/apps/admin/.env.development`（追加 `VITE_API_BASE_URL`，v1 已验证文件存在）
- Modify: `frontend/apps/h5/src/modules/h5-mall/apis/index.ts`（删除 login/register/me/logout 四端点与 UserInfo 类型，保留商品端点）
- Modify: `frontend/apps/h5/src/modules/h5-mall/composables/useAuthForm.ts`（改走 shared）
- Modify: `frontend/apps/h5/src/modules/h5-mall/views/login.vue`、`register.vue`（result 消费点适配）
- Modify: h5 相关 spec（`apis/index.spec.ts` 删 auth 断言、`useAuthForm.spec.ts` 改 shared 断言）

**Interfaces:**
- Consumes（既有，全部已验证存在）:
  - shared http.ts：`request` / `requestValidated`（zod schema 校验响应）；信封 `{code,message,data}` 拆包为既有行为
  - `useUserStore().login(credentials)`：内部链 `authApi.login → Session.set('auth') → authenticated=true → fetchProfile() → dict 预加载（catch 仅 warn）`——本计划不动 store 源码
  - `checkLoginState`（@vv/shared/router-guards）：未登录整页跳 apps/auth 并带 redirect（P4 协议），探测走 `userStore.fetchProfile()`
  - 后端：`POST /mall/auth/login|register` → `Result<UserInfoDTO>`（login 同时 Set-Cookie）；`GET /mall/auth/me` → `Result<UserInfoDTO>`；`POST /mall/auth/logout` → `Result<Void>`。`UserInfoDTO = {id:number, username:string, nickname:string|null, avatar:string|null, role:'ADMIN'|'USER'}`
- Produces:
  ```ts
  // packages/shared/src/api/modules/auth.ts（适配后）
  export const LOGIN_URL = '/mall/auth/login'
  export const MALL_REGISTER_URL = '/mall/auth/register'
  const PROFILE_URL = '/mall/auth/me'
  const LOGOUT_URL = '/mall/auth/logout'

  /** 角色→权限码唯一映射点：ADMIN 得商城后台权限，USER 得买家权限，未知 role 为空数组（不静默放行） */
  export const ROLE_PERMISSIONS: Record<string, string[]> = {
    ADMIN: ['mall:admin'],
    USER: ['mall:user'],
  }

  // loginResultSchema：商城 UserInfoDTO 形状（passthrough）
  // userProfileSchema：mallUserSchema.transform(dto => ({
  //   ...dto, id: dto.id, name: dto.nickname ?? dto.username,
  //   permissions: ROLE_PERMISSIONS[dto.role] ?? [],
  // }))——输出对齐既有 UserProfile {id,name,permissions[]}
  export const authApi = {
    login: (data: LoginPayload) => /* requestValidated(loginResultSchema, {url: LOGIN_URL, method:'post', data}) */,
    register: (data: LoginPayload & { nickname?: string }) => /* 同 schema，MALL_REGISTER_URL */,
    fetchProfile: (options?: { silent?: boolean }) => /* requestValidated(userProfileSchema, {url: PROFILE_URL, method:'get', silent}) */,
    logout: () => /* request<void>({url: LOGOUT_URL, method:'post'}) */,
  }
  ```
  - mock：`/mall/auth/login|me|logout` 处理器返回商城信封 + 商城形状用户（role='ADMIN' 演示账号）；`mockProdServer.ts` 内联三端点同步
  - h5 `useAuthForm`：`login` 模式改 `userStore.login(form)`（`result` 改为读 `userStore.profile`）；`register` 模式改 `authApi.register(form)`；`Session.set` 手动写入删除（store 内建）

- [ ] **Step 1: 撤销 v1 未提交产物 + 基线确认**

```bash
cd frontend
git checkout -- apps/admin/src/router/guards/auth.ts apps/admin/src/router/whitelist.ts
rm apps/admin/src/modules/mall-admin/apis/auth.ts \
   apps/admin/src/modules/mall-admin/composables/useMallAuth.ts \
   apps/admin/src/modules/mall-admin/composables/useMallAuth.spec.ts \
   apps/admin/src/modules/mall-admin/views/Login.vue \
   apps/admin/src/router/guards/mall-login.ts \
   apps/admin/src/router/guards/mall-login.spec.ts
# mall-admin/index.ts、apis/index.ts、routes/index.ts 还原为空导出/空数组（Edit 手动清）
pnpm -C packages/shared test 2>&1 | tail -3 && pnpm -C apps/admin test 2>&1 | tail -3 && pnpm -C apps/h5 test 2>&1 | tail -3
```

Expected: 删除与还原完成；三个测试基线全绿并记录通过数（后续变红必须归因本计划改动）

- [ ] **Step 2: 写失败测试——shared auth.spec.ts 换商城契约断言**

断言清单（沿用既有 spec 结构，替换契约）：
- `login` 请求 `{url:'/mall/auth/login', method:'post'}`，响应按商城 UserInfoDTO 校验（含未知键 passthrough）
- `register` 请求 `{url:'/mall/auth/register', method:'post'}`
- `fetchProfile` 请求 `{url:'/mall/auth/me', method:'get'}`；输入 `{id:1,username:'admin',nickname:'管理员',avatar:null,role:'ADMIN'}` 输出 `{id:1,name:'管理员',permissions:['mall:admin']}`（transform 生效）
- `fetchProfile` 输入 role `'USER'` → `permissions:['mall:user']`；输入未知 role `'GUEST'` → `permissions:[]`（Review Focus #1）
- `fetchProfile` 输入 nickname=null → `name===username`
- `logout` 请求 `{url:'/mall/auth/logout', method:'post'}`

Run: `cd frontend && pnpm -C packages/shared test src/api/modules/auth.spec.ts`
Expected: FAIL（端点/映射未实现）

- [ ] **Step 3: 实现 shared auth.ts 适配**

按 Produces 改四个端点常量 + schema transform + `ROLE_PERMISSIONS` + `register`。**不改** `userStore` 源码（其 `login` 链自动生效）。

Run: `cd frontend && pnpm -C packages/shared test`
Expected: shared 全绿（含既有 user store / guards / http 套件无回归；若有断言旧 `/auth/*` 端点的关联 spec，同步换契约，禁改被测源码行为）

- [ ] **Step 4: mock 对齐（/mall/auth/* 处理器）**

- `packages/mock/src/auth.ts`：既有 `/mock/auth/login|profile|logout` 三处理器改为 `/mock/mall/auth/login|me|logout`（路径随 mock 既有前缀约定），返回商城信封 `{code:200,message:'success',data:{id,username,nickname,avatar,role:'ADMIN'}}`
- `packages/mock/src/mockProdServer.ts` 内联三端点同步
- 旧 `/mock/auth/*` 处理器删除（无消费方——shared 已改指商城端点）

Run: `cd frontend && pnpm check:mock-wiring && pnpm -C packages/mock test 2>&1 | tail -3`
Expected: 校验绿；mock 测试绿

- [ ] **Step 5: h5 切换（apis 裁剪 + useAuthForm 改走 shared + 视图适配 + spec 更新）**

- `apis/index.ts`：删除 `login/register/me/logout` 四端点与 `UserInfo/LoginPayload/RegisterPayload` 类型（商品端点全保留）
- `useAuthForm.ts`：login → `useUserStore().login(form)`，`result` 改为 `computed(() => userStore.profile)`；register → `authApi.register(form)`（从 `@vv/shared` 导入）；删除手动 `Session.set`
- `login.vue`/`register.vue`：`result` 消费点（成功提示/跳转）按新形状适配（`profile.name`）
- spec：`apis/index.spec.ts` 删 auth 四条断言；`useAuthForm.spec.ts` 改为 mock `@vv/shared`（importOriginal 展开）断言 `userStore.login` 被调 / register 走 `/mall/auth/register`

Run: `cd frontend && pnpm -C apps/h5 test`
Expected: h5 全绿

- [ ] **Step 6: admin env 追加 + 类型门禁**

`.env.development` 追加：
```
# admin dev（5174）→ 后端（18080）跨域直连；withCredentials 由 http.ts 统一携带
VITE_API_BASE_URL=http://localhost:18080/api
```

Run: `cd frontend && pnpm -C apps/admin type-check:full 2>&1 | tail -3 && pnpm -C packages/shared type-check 2>&1 | tail -3`
Expected: 零新增错误

- [ ] **Step 7: Commit**

```bash
git add frontend/packages/shared/src/api/modules/auth.ts frontend/packages/shared/src/api/modules/auth.spec.ts \
        frontend/packages/mock frontend/apps/admin frontend/apps/h5
git commit -m "feat(auth): 统一登录接线商城后端（shared 契约适配 /mall/auth/* + role 权限映射 + h5 切换 + mock 对齐）"
```

---

### Task 2: 寄卖审核队列页

**Files:**
- Create: `frontend/apps/admin/src/modules/mall-admin/apis/consignments.ts`
- Create: `frontend/apps/admin/src/modules/mall-admin/apis/index.ts`（barrel 具名导出）
- Create: `frontend/apps/admin/src/modules/mall-admin/composables/useConsignmentReview.ts`
- Create: `frontend/apps/admin/src/modules/mall-admin/composables/useConsignmentReview.spec.ts`
- Create: `frontend/apps/admin/src/modules/mall-admin/views/Consignments.vue`
- Modify: `frontend/apps/admin/src/modules/mall-admin/routes/index.ts`（default 布局父记录 + 寄卖审核子路由）

**Interfaces:**
- Consumes: Task 1 统一登录链（守卫探测 + 权限点）；`useConfirm`（驳回二次确认）；后端 `GET /mall/admin/consignments?status=` → `Result<List<ConsignmentDTO>>`（**非分页，纯列表**）；`POST /mall/admin/consignments/{id}/review`（body `ReviewRequest`）→ `Result<ConsignmentDTO>`
- Produces:
  ```ts
  // apis/consignments.ts（字段与后端 ConsignmentDTO 一一对齐）
  export interface AdminConsignmentItem {
    id: number; brand: string | null; title: string; categoryId: number | null
    conditionGrade: string; size: string | null; images: string[]
    description: string | null; expectedPrice: number | null
    platformPrice: number | null; commissionRate: number | null
    status: string; rejectReason: string | null; listedProductId: number | null
    createTime: string
  }
  export interface ReviewPayload { approve: boolean; platformPrice?: number; commissionRate?: number; rejectReason?: string }
  export const adminConsignmentApi = {
    list: (status: string) => Promise<AdminConsignmentItem[]>,
    review: (id: number, data: ReviewPayload) => Promise<AdminConsignmentItem>,
  }

  // composables/useConsignmentReview.ts
  export function useConsignmentReview(): {
    list: Ref<AdminConsignmentItem[]>; loading: Ref<boolean>; status: Ref<string>  // 默认 'SUBMITTED'
    load(s?: string): Promise<void>                // 切状态即重取
    approve(id: number, platformPrice: number, commissionRate: number): Promise<void>  // 成功自动 reload；错误向上抛（视图 toast）
    reject(id: number, reason: string): Promise<void>  // 同上
  }
  // 表单校验规则（视图层，element-plus form rules）：
  //   approve=true → platformPrice 必填 >0、commissionRate 必填 0<rate≤100、最多两位小数
  //   approve=false → rejectReason 必填（非空去空格）
  // 路由 meta（两条业务路由通用）：{ title, requiresAuth: true, permissions: ['mall:admin'] }
  ```

- [ ] **Step 1: 写失败测试 `useConsignmentReview.spec.ts`**

- `load_defaultStatus_SUBMITTED_andMapsList`：默认参数 status='SUBMITTED' 请求，返回数组原样落 list
- `load_statusSwitch_refetches`：`load('PRICED')` 后参数为 PRICED
- `approve_sendsPayloadAndReloads`：`approve(7, 12800, 15)` → review 调用参数 `{approve:true, platformPrice:12800, commissionRate:15}`，随后触发一次 reload
- `reject_sendsReasonAndReloads`：`reject(7,'图片不清晰')` → `{approve:false, rejectReason:'图片不清晰'}` + reload
- `review_error_propagatesAndNoReload`：review reject → 错误上抛，不触发 reload

Run: `cd frontend && pnpm -C apps/admin test src/modules/mall-admin/composables/useConsignmentReview.spec.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 2: 实现 apis/consignments.ts + useConsignmentReview.ts + barrel**

Run: `cd frontend && pnpm -C apps/admin test src/modules/mall-admin/composables/useConsignmentReview.spec.ts`
Expected: PASS（5/5）

- [ ] **Step 3: Consignments.vue + 路由**

- 页面结构（BEM：`createNamespace('mall-admin-consignments')`）：状态 Tab（SUBMITTED/PRICED/LISTED/REJECTED 等）+ el-table（图片缩略/标题品牌/成色/期望价/平台价/佣金率/提交时间/状态/操作列）+ Loading/Error/Empty 三态
- 操作列（仅 SUBMITTED 行显示）：「通过」开 dialog（platformPrice/commissionRate 输入 + 校验规则见 Produces）提交 approve；「驳回」`useConfirm` + 原因输入（dialog 表单）提交 reject
- 金额展示统一 `toFixed(2)`；空 images 行给占位块
- 路由：父记录 `/mall-admin`（default 布局，meta `title:'商城后台' icon:'shop'`）children 首个业务路由 `{path:'consignments', name:'MallAdminConsignments', component, meta:{title:'寄卖审核', requiresAuth:true, permissions:['mall:admin']}}`

Run: `cd frontend && pnpm -C apps/admin type-check:full 2>&1 | tail -3 && pnpm -C apps/admin test src/modules/mall-admin`
Expected: 类型零新增错误；测试全绿

- [ ] **Step 4: Commit**

```bash
git add frontend/apps/admin/src/modules/mall-admin
git commit -m "feat(admin): 寄卖审核队列页（状态筛选 + 通过定价/驳回原因）"
```

---

### Task 3: 结算审批页

**Files:**
- Create: `frontend/apps/admin/src/modules/mall-admin/apis/payouts.ts`
- Create: `frontend/apps/admin/src/modules/mall-admin/composables/usePayoutApproval.ts`
- Create: `frontend/apps/admin/src/modules/mall-admin/composables/usePayoutApproval.spec.ts`
- Create: `frontend/apps/admin/src/modules/mall-admin/views/Payouts.vue`
- Modify: `frontend/apps/admin/src/modules/mall-admin/apis/index.ts`（barrel 追加）
- Modify: `frontend/apps/admin/src/modules/mall-admin/routes/index.ts`（+ 结算审批子路由）

**Interfaces:**
- Consumes: 后端 `GET /mall/admin/payouts?status=` → `Result<List<PayoutDTO>>`（纯列表）；`POST /mall/admin/payouts/{id}/confirm|pay` → `Result<PayoutDTO>`
- Produces:
  ```ts
  // apis/payouts.ts（字段与后端 PayoutDTO 一一对齐）
  export interface AdminPayoutItem {
    id: number; sellerId: number; orderItemId: number
    sellerAmount: number; commission: number; status: string; createTime: string
  }
  export const adminPayoutApi = {
    list: (status: string) => Promise<AdminPayoutItem[]>,
    confirm: (id: number) => Promise<AdminPayoutItem>,  // POST .../confirm（PENDING→CONFIRMED）
    pay: (id: number) => Promise<AdminPayoutItem>,      // POST .../pay（CONFIRMED→PAID）
  }

  // composables/usePayoutApproval.ts
  export function usePayoutApproval(): {
    list: Ref<AdminPayoutItem[]>; loading: Ref<boolean>; status: Ref<string>  // 默认 'PENDING'
    load(s?: string): Promise<void>
    confirm(id: number): Promise<void>  // 成功 reload；400（PAYOUT_STATE_ILLEGAL 等）向上抛（视图 toast + 已 reload 对齐真态）
    pay(id: number): Promise<void>      // 同上
  }
  ```

- [ ] **Step 1: 写失败测试 `usePayoutApproval.spec.ts`**

- `load_defaultStatus_PENDING`：默认参数 PENDING
- `load_tabSwitch_refetches`：切 CONFIRMED/PAID 参数正确
- `confirm_success_reloads`：confirm 成功 → reload
- `pay_success_reloads`：pay 成功 → reload
- `confirm_stateIllegal400_propagatesAndRefreshes`：confirm 以 400 reject → 错误上抛 **且仍触发一次 reload**（对齐真态，Review Focus #6）

Run: `cd frontend && pnpm -C apps/admin test src/modules/mall-admin/composables/usePayoutApproval.spec.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 2: 实现 apis/payouts.ts + usePayoutApproval.ts + barrel**

Run: `cd frontend && pnpm -C apps/admin test src/modules/mall-admin/composables/usePayoutApproval.spec.ts`
Expected: PASS（5/5）

- [ ] **Step 3: Payouts.vue + 路由**

- 页面（BEM：`createNamespace('mall-admin-payouts')`）：状态 Tab（PENDING/CONFIRMED/PAID）+ el-table（结算单号/卖家 ID/订单行 ID/应结金额/平台佣金/状态/创建时间/操作列）+ 三态
- 操作列：PENDING 行显示「初审通过」（`useConfirm` 二次确认 → confirm）；CONFIRMED 行显示「确认打款」（`useConfirm` → pay）；PAID 行无操作
- 金额列 `toFixed(2)` + 「应结+佣金=订单金额」 hover 提示（拆账恒等可读性）
- 路由追加 `{path:'payouts', name:'MallAdminPayouts', component, meta:{title:'结算审批', requiresAuth:true, permissions:['mall:admin']}}`

Run: `cd frontend && pnpm -C apps/admin type-check:full 2>&1 | tail -3 && pnpm -C apps/admin test src/modules/mall-admin`
Expected: 类型零新增错误；测试全绿

- [ ] **Step 4: Commit**

```bash
git add frontend/apps/admin/src/modules/mall-admin
git commit -m "feat(admin): 结算审批页（PENDING/CONFIRMED/PAID 三步流转）"
```

---

### Task 4: 浏览器真实验证（网关 + 统一登录）+ 文档收尾

**Files:**
- Modify: `CHANGELOG.md`（根目录，Unreleased 节）
- Modify: `README.md`（阶段 3 行状态更新）

**Interfaces:**
- Consumes: Task 1-3 全部产物；阶段 3 e2e curl 命令链（`.superpowers/sdd/06-阶段3-订单流转与结算/progress.md` Task 6 记录的同套流程）
- Produces: 无新代码接口

- [ ] **Step 1: 全量测试基线**

Run: `cd frontend && pnpm test 2>&1 | tail -8`
Expected: 全 workspace 全绿（shared + mock + 各 app），与 Task 1 基线对比无回归

- [ ] **Step 2: 起服务 + 造数（一条 curl 链）**

```bash
# 终端A：MySQL（Docker 13306）+ cd backend && mvn spring-boot:run（18080）
# 终端B：cd frontend && pnpm dev:gateway（:8080 同域网关，含 admin/auth/h5）
# 造数（Git Bash）：seller 登录提交寄卖申请（产生 SUBMITTED 一条）；
# 另起 buyer/seller/admin 三角链复现阶段3 e2e（直购→支付→发货→确认收货）产生 PENDING payout 一条
```

Expected: `GET /mall/admin/consignments?status=SUBMITTED` 有 ≥1 条；`GET /mall/admin/payouts?status=PENDING` 有 ≥1 条

- [ ] **Step 3: 浏览器验证清单（1440 主验 + 375 一瞥）**

```
□ 未登录访问 http://localhost:8080/admin/mall-admin/consignments → 整页跳
  http://localhost:8080/auth/login?redirect=/admin/mall-admin/consignments（P4 协议）
□ admin/admin123 在 apps/auth 登录 → 自动回跳 admin 目标页；刷新页面会话仍在（cookie 探测恢复）
□ 退出登录（布局退出按钮）→ 跳回 auth 登录页；再访问受保护页仍跳登录（cookie 已清，无自动重登）
□ seller/seller123 在 apps/auth 登录后访问 admin 业务路由 → /403 无权限页（Review Focus #1）
□ 寄卖审核：通过（输入平台价 3999 + 佣金率 15）→ 列表刷新该行消失；PRICED Tab 可见
□ 驳回（填原因）→ REJECTED Tab 可见且原因列正确
□ 结算审批：PENDING 行「初审通过」→ CONFIRMED Tab 可见；「确认打款」→ PAID Tab 可见；
  卖家寄卖单 API 查得 SETTLED（联动未破坏）
□ h5 接线：http://localhost:8080/h5/ 登录页 buyer/buyer123 登录成功并回跳；
  登录后访问 admin 业务路由 → /403（权限模型一致）
□ 模板残留页（工作台等）菜单可见但数据区为错误态——已知取舍，不阻塞
□ 375 宽度：auth 登录页与 admin 两业务页不横向滚动、操作列可用
```

- [ ] **Step 4: 文档同步**

- `CHANGELOG.md` 顶部 `## [Unreleased]` Added 节记录：统一登录接线商城后端（shared 契约 `/mall/auth/*` + role→permissions + mock 对齐 + h5 切换）、admin 寄卖审核队列页、结算审批页
- `README.md` 阶段 3 行：`✅ 2026-11-09（后端 + admin 后台；h5 订单/卖家工作台见计划 08）`

- [ ] **Step 5: Commit**

```bash
git add CHANGELOG.md README.md
git commit -m "docs: admin 后台验收记录（CHANGELOG Unreleased + README 阶段3状态）"
```

---

## 非目标（本计划明确不做）

- 不动模板残留模块（workbench/user/reports）的删除或菜单隐藏——其数据接口指向真实后端后呈错误态，属已知取舍；清理由后续独立批次经用户批准后做
- 不动 `packages/shared` 的 userStore / router-guards / http.ts 源码（只动 `api/modules/auth.ts` 契约文件）
- 不做 `.env.production` 与部署适配（阶段 5）
- 不做商品管理、秒杀活动管理页（阶段 4）
- 不做 i18n 菜单键（菜单用 meta.title 中文直写）
- 不做 h5 tabbar 常驻（独立任务，见任务列表 #5，本计划落地后处理）
- 不改后端任何文件（logout 端点已存在；契约冻结）
