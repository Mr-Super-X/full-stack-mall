# Mock 数据使用规范

> **文档版本**：v1.1.0 | **最后更新**：2026-10-20
> **覆盖范围**：mock 文件组织、`MockMethod[]` + `response`/`rawResponse` 用法、与 Zod schema 集成、prod 防御层（mock-guard）、**生产 mock 接线（mockProdServer.ts，gh-pages 静态部署用）**、CI 验证
> **适用读者**：第一次给页面加 mock 数据的新人 + 联调真实后端前期的开发者 + 配置 gh-pages 演示部署的维护者
> **配套文档**：`docs/15-请求层缓存-合并-分页适配使用规范.md`（cache + merge + pageAdapter 三件套）、`docs/14-zod请求参数校验使用规范.md`（Zod schema）、`docs/40-GitHubPages自动部署.md`（生产 mock 的部署侧上下文）
> **Monorepo 口径（v3.0.0 起）**：`mock/` 根目录已整体迁为 `@vv/mock` 包——文中所有 mock 文件路径一律指 `packages/mock/src/`；vite 插件配置指 `@vv/config` 工厂（`packages/config/src/create-vite-config.ts`）。

---

## 1. 决策表：什么时候需要 mock

| 场景                         | 用 mock        | 直接调真接口 | 备注                                                               |
| ---------------------------- | -------------- | ------------ | ------------------------------------------------------------------ |
| 后端接口尚未就绪             | ✅             | ❌           | 必须 mock，否则无法开发                                            |
| 后端接口已就绪但本地无法访问 | ✅             | ❌           | 演示、离线、出差场景                                               |
| 单元测试                     | ❌             | ❌           | 用 vi.mock，**不要**用 mock-server                                 |
| 关键用户流程 E2E             | ⚠️             | ✅           | 真实环境跑                                                         |
| 生产构建（常规）             | ❌ 自动剔除    | ✅           | vite-plugin-mock 3.x 为纯 dev-server 插件，prod 构建不附带         |
| 生产构建（gh-pages 演示）    | ✅ 客户端 mock | ❌           | `VITE_USE_MOCK=true` 时经 `mockProdServer.ts` client 侧接线（§15） |

**项目约定**：开发期所有未对接的接口都走 `packages/mock/src/<feature>.ts`，**禁止**在组件里写死假数据。

---

## 2. 文件组织

```
packages/mock/src/
├── auth.ts              # /api/auth/* 登录相关（dev rawResponse 形态）
├── user.ts              # /api/user/* 用户管理
├── menu.ts              # /api/menu 远程菜单
├── dict.ts              # /api/dict/:code 字典（动态路由，dev 形态）
├── dict-data.ts         # DICT_DATA 字典数据单源（dev/prod 双形态共用）
├── _utils.ts            # mock 公共工具（分页/延迟等）
├── pro-table/           # ProTable 具名数据源（11 个 xxxRequestApi 导出，组件直连无 XHR）
├── mockProdServer.ts    # 生产 mock 接线（client 侧 createProdMockServer，§15）
├── index.ts             # 聚合导出（dev viteMockServe 按目录扫描实际不受此限）
└── <feature>.ts         # 新业务模块的 mock
```

**约定**：

- 每个业务模块一个 mock 文件，文件名与 `packages/shared/src/api/modules/<feature>.ts` 对应
- `vite-plugin-mock` dev 模式自动扫描 `packages/mock/src/**/*.ts`，无需手动注册；**prod 接线不受扫描机制保护，须手动在 `mockProdServer.ts` 登记（§15 的 @trigger 约定）**
- 跨业务共享的 mock 抽到独立文件（如 `dict.ts` / `dict-data.ts`）
- **响应体与 api 层类型挂钩（2026-10-26 测试审计 #2 立规）**：mock 数据 `import type` `@vv/shared` 的对应契约类型并 `satisfies` 标注（先例：`_utils.ts` 的 `generateUsers(): UserItem[]`、`auth.ts` 的 `satisfies LoginResult / UserProfile`、`dict-data.ts` 的 `DictItem`、`pro-table/` 的 `ProTableRequestApi`）——杜绝「api 层契约演化、mock 静默偏离」；`import type` 编译期擦除，不产生运行时依赖

---

## 3. MockMethod[] 基础用法（vite-plugin-mock v3）

```ts
// packages/mock/src/user.ts
import type { MockMethod } from 'vite-plugin-mock'

export default [
  {
    url: '/api/user/list',
    method: 'get',
    timeout: 200, // 模拟网络延迟 200ms
    response: ({ query }) => ({
      // ← response 是函数，接收 query/params
      code: 200,
      message: 'ok',
      data: {
        list: Array.from({ length: 10 }, (_, i) => ({
          id: i + 1,
          name: `用户 ${i + 1}`,
          email: `user${i + 1}@example.com`,
        })),
        total: 100,
      },
    }),
  },

  // 多个接口一起定义
  {
    url: '/api/user/:id',
    method: 'get',
    response: ({ params }) => ({
      code: 200,
      data: { id: Number(params.id), name: '用户 ' + params.id },
    }),
  },
] as MockMethod[]
```

### 3.1 response 函数签名

`response` 字段接收一个**同步**函数，签名如下（参考 `packages/mock/src/user.ts`）：

```ts
response: ({ query, params }) => {
  // query: URL 查询参数
  // params: URL 动态参数
  return { code: 200, data: ... }
}
```

| 参数     | 来源           | 示例                                                    |
| -------- | -------------- | ------------------------------------------------------- |
| `query`  | URL 查询字符串 | `?page=1&pageSize=20` → `{ page: '1', pageSize: '20' }` |
| `params` | URL 动态参数   | `/user/:id` → `{ id: '123' }`                           |

> 注意：query/params 值都是**字符串**，需要手动转 number：`Number(params.id)`。
> 简化的 `response` 不暴露 `headers` / 请求 `body`；如需读请求头或 body，用 `rawResponse: (req, res) => {...}`（参考 `packages/mock/src/auth.ts` 的登录契约）。

### 3.2 同步 / 异步

**简化的 `response` 必须同步**（vite-plugin-mock v3 设计）；如需异步（延迟、读 body、写 Set-Cookie 等），切到 `rawResponse: (req, res) => {...}`。

```ts
// ✅ 同步（推荐，性能好；timeout 字段生效）
{
  url: '/api/user/list',
  method: 'get',
  timeout: 200,
  response: ({ query }) => ({ code: 200, data: [] }),
}

// ✅ 异步（仅 rawResponse 支持；timeout 字段不生效，需手写 setTimeout）
{
  url: '/api/auth/login',
  method: 'post',
  rawResponse: async (req, res) => {
    const body = await readBody(req) // 手动解析 body
    setTimeout(() => {
      res.setHeader('Set-Cookie', 'token=xxx; HttpOnly')
      res.end(JSON.stringify({ code: 200 }))
    }, 200)
  },
}
```

> **关键区分**：
>
> - `response`：**必须同步**；延迟用 `timeout: ms` 字段
> - `rawResponse`：**支持 async**；不受 `timeout` 控制（用 setTimeout 模拟延迟）；手动管 Set-Cookie / statusCode / body 解析

### 3.3 timeout 字段

```ts
{
  url: '/api/user/list',
  method: 'get',
  timeout: 200,         // 单位 ms；模拟网络延迟
  response: () => ({ ... }),
}
```

---

## 4. 与 Zod schema 集成（推荐）

把 mock 数据走 Zod schema，**让 mock 与生产 schema 共享一份类型契约**。

```ts
// apps/<a>/src/modules/user/types.ts（教学示例路径——user 模块当前未建 types.ts，
// 实际项目里对应你的业务模块 types 文件，模式相同）
import { z } from 'zod'

export const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
  status: z.enum(['active', 'inactive']),
})

export type User = z.infer<typeof UserSchema>
```

```ts
// packages/mock/src/user.ts
import type { MockMethod } from 'vite-plugin-mock'
import { UserSchema, type User } from '@/modules/user/types'

export default [
  {
    url: '/api/user/list',
    method: 'get',
    timeout: 200,
    response: () => {
      const list: User[] = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        name: `用户 ${i + 1}`,
        email: `user${i + 1}@example.com`,
        status: i % 2 ? 'active' : 'inactive',
      }))

      // 校验：确保 mock 数据也满足 schema（开发期拦截）
      return { code: 200, data: { list, total: 100 } }
    },
  },
] as MockMethod[]
```

**优势**：

- mock 与生产 schema 共享一份类型
- 后端字段变化时，mock 与生产同步更新
- TS 类型推导友好

---

## 5. 错误码模拟

```ts
import type { MockMethod } from 'vite-plugin-mock'

export default [
  // 正常返回
  {
    url: '/api/user/list',
    method: 'get',
    response: () => ({ code: 200, data: [] }),
  },

  // 模拟 401（未登录）
  {
    url: '/api/auth/profile',
    method: 'get',
    response: () => ({
      code: 401,
      message: '未登录',
    }),
  },

  // 模拟 500（服务器错误）
  {
    url: '/api/user/list',
    method: 'get',
    status: 500, // ← HTTP 状态码
    response: () => ({ code: 500, message: '服务器异常' }),
  },
] as MockMethod[]
```

> `code` 是业务字段（前端拦截器识别），`status` 是 HTTP 状态码（浏览器识别）。

---

## 6. 动态响应（按 query/params 切换）

```ts
{
  url: '/api/user/detail/:id',
  method: 'get',
  response: ({ params }) => {
    const id = Number(params.id)
    if (id === 999) {
      return { code: 404, message: '用户不存在' }
    }
    return {
      code: 200,
      data: { id, name: `用户 ${id}`, email: `user${id}@example.com` },
    }
  },
}
```

---

## 7. vite-plugin-mock 配置（@vv/config 工厂）

mock 插件不在各 app `vite.config.ts` 手写——由 `packages/config/src/create-vite-config.ts` 工厂统一装配（各 app 只传 `appRoot` / `appName` / `mockPath` 等参数）：

```ts
// packages/config/src/create-vite-config.ts（工厂内 viteMockServe 段，节选）
...(mockPath
  ? [
      viteMockServe({
        mockPath,                                    // 缺省 = <appRoot>/../../packages/mock/src（@vv/mock 包源码）
        enable: process.env.VITE_USE_MOCK !== 'false', // dev 默认开启（2026-07-27 切换）
        watchFiles: true,                             // mock 文件变更热更新
      }),
      cleanMockBundled(mockPath),                     // 清理 _*.bundled_*.mjs 临时文件（根治并行 dev 抢删竞态）
    ]
  : []),
```

**注意**：

- `enable: VITE_USE_MOCK !== 'false'` 保证 prod 打包不包含 mock（vite build 不读 `.env.development`，自然落入"关闭"分支）
- `watchFiles: true` 让 mock 修改实时生效（无需重启 dev server）
- dev 默认开启：clone 后未建 `.env.development` 时 `VITE_USE_MOCK=undefined` → `!== 'false'` 判定为 true，mock 自动启用
- `mockPath` 必须是绝对路径（vite-plugin-mock 以 isAbsPath 判定，cwd 相对解析会静默空转）——工厂缺省已指向 `packages/mock/src`，各 app 无需覆写
- 联调真后端：经 **shell env** 设 `VITE_USE_MOCK=false` + `VITE_API_BASE_URL=<真实后端地址>`（如 `VITE_USE_MOCK=false pnpm -C apps/admin dev`）——dev 中间件开关读 `process.env`（config 装配期），`.env` 文件对该键**无效**（2026-10-28 口径修正）

---

## 8. prod 防御层（packages/shared/src/api/mock-guard.ts）与 prod 双形态总览

**背景**：vite-plugin-mock@3.0.2 起为纯 dev-server 插件（2.9.x 的 `prodEnabled` 已移除），mock 在 prod 的形态分两种：

| 形态              | 条件                                          | 行为                                                                                                                                                         |
| ----------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 常规生产构建      | `VITE_USE_MOCK` 未设或非 `'true'`             | 不启用任何 mock（viteMockServe 不介入 + 各 app `main.ts` 的 PROD 守卫不挂接 client mock——装配单源在 `@vv/shared` 的 `bootstrapApp` 工厂），整分支 tree-shake |
| gh-pages 演示构建 | `VITE_USE_MOCK=true` + `import.meta.env.PROD` | `packages/mock/src/mockProdServer.ts` 经 client 侧 `createProdMockServer` 手动接线（§15），浏览器端 mockjs 劫持 XHR                                          |

**项目方案**：`packages/shared/src/api/mock-guard.ts` 提供 prod 断言钩子（实际兜底由 vite 构建配置 + main.ts 挂接条件保证；mock 模块在常规 prod 构建自然被 tree-shake 剔除）。

```ts
// packages/shared/src/api/mock-guard.ts（实际实现，2026-08 现状）
export function assertNoMockInProd(): void {
  // vite-plugin-mock 仅在 dev 服务生效；prod 构建自然剔除 mock 模块
  // 此函数保留为防御层扩展点——如未来需要运行时校验（如扫描 import.meta.glob），
  // 可在此实现具体逻辑
  void 0
}
```

**使用场景**：

- 当前实现为**空操作 + 扩展点**——常规 prod 包不包含 mock 是由 vite build 配置 + tree-shake 自然保证
- 演示构建（`VITE_USE_MOCK=true`）是显式选择的产物形态，须配合 `VITE_DEMO_NO_AUTH` 演示模式与 gh-pages 部署上下文阅读（docs/40）
- 未来如需运行时校验（如扫描 import.meta.glob 确认无 mock 导入），在 `assertNoMockInProd` 内部加实现即可

---

## 9. 远程菜单 mock

```ts
// packages/mock/src/menu.ts（节选，详见 docs/07-路由模块设计.md）
import type { MockMethod } from 'vite-plugin-mock'

export default [
  {
    url: '/api/menu',
    method: 'get',
    response: () => ({
      code: 200,
      data: [
        {
          name: 'Home',
          path: '/home',
          meta: { title: '首页', icon: 'odometer', requiresAuth: true },
        },
        {
          name: 'UserList',
          path: '/user/list',
          meta: { title: '用户管理', icon: 'user', permissions: ['user:view'] },
        },
        // ⚠️ 路由 name 必须与 modules/<m>/routes/index.ts 声明一致（remote 模式按 name 查 COMPONENT_REGISTRY）
      ],
    }),
  },
] as MockMethod[]
```

**注意**：路由 `name` 必须与业务模块 `routes/index.ts` 的声明一致——remote 模式由 `COMPONENT_REGISTRY`（从 autoRegisteredRoutes 派生）按 name 查组件 loader；写不存在的 name 会在守卫侧报「组件未注册」。`pnpm check:routes` 校验的是 whitelist ↔ 实际 routes 的一致性（§12），不直接校验 packages/mock/src/menu.ts 内的 name。

---

## 10. 字典 mock（与 useDict 集成）

```ts
// packages/mock/src/dict.ts（节选）——dev 形态：动态路由 /api/dict/:code
// ⚠️ vite-plugin-mock 3.0.2 不给 response 传 params——:code 被合并进 query
// （requestMiddleware: query = urlMatch(reqUrl).params），须从 query.code 取并做防御
import type { MockMethod } from 'vite-plugin-mock'
import { DICT_DATA } from './dict-data'

export default [
  {
    url: '/api/dict/:code',
    method: 'get',
    timeout: 100,
    response: ({ query }: { query: { code?: string } }) => {
      const code = query.code
      if (!code) return { code: 400, message: '缺少字典 code 参数', data: [] }
      const list = DICT_DATA[code]
      return list
        ? { code: 200, message: 'ok', data: list }
        : { code: 404, message: `字典 ${code} 不存在`, data: [] }
    },
  },
  // 业务侧用法详见 docs/11-字典使用规范.md
] as MockMethod[]
```

**dev/prod 双形态**（2026-10-20 字典 prod 静态展开，git 659cd6a）：

- **dev**：`/api/dict/:code` 动态路由（如上），数据单源 `packages/mock/src/dict-data.ts` 的 `DICT_DATA`
- **prod**：client wrapper 不从路径提取参数（`:code` 恒 undefined 命中防御分支 400），故 `mockProdServer.ts` 内联 `prodDictMocks` 把 `DICT_DATA` **逐条静态展开**为 `/api/dict/<code>` 独立 url 注册，每条 url 的 code 由闭包固化
- **新增字典**：只需在 `packages/mock/src/dict-data.ts` 的 `DICT_DATA` 加键值，dev 动态路由与 prod 静态展开双形态自动覆盖，**无需**改动 dict.ts / mockProdServer.ts

> **DS-3 关键约定（mock URL vs API URL）**：
>
> | 维度        | API 代码 url 字段（`packages/shared/src/api/modules/*.ts`） | mock 文件 url 字段（`packages/mock/src/*.ts`）    |
> | ----------- | ----------------------------------------------------------- | ------------------------------------------------- |
> | `/api` 前缀 | **不写**（由 `http.ts` 的 `baseURL` 拼装）                  | **必写**（vite-plugin-mock 直连独立 mock 服务器） |
> | 环境变量    | `VITE_API_BASE_URL` 控制 baseURL                            | 与 baseURL 无关，由 mock 服务器自行处理           |
>
> **典型错误**：业务代码写 `request({ url: '/api/user/list' })` → 实际请求变成 `VITE_API_BASE_URL + /api/api/user/list`（`/api` 双拼，请求 404）。
> 正确写法：`request({ url: '/user/list' })`。`baseURL` 已在 `packages/shared/src/api/http.ts` 统一配置。
>
> 关闭 mock 时设 `VITE_USE_MOCK=false` + `VITE_API_BASE_URL=<真实后端地址>`（详见 §"环境变量"段）。

---

## 11. 测试与 mock 的关系

**核心原则**：

- **单元测试**：用 `vi.mock('@api/http')`，**不要**启动 vite-plugin-mock
- **集成测试**：可短暂启用 vite-plugin-mock（用 MSW 等）
- **E2E**：禁用 mock，跑真实接口

```ts
// ✅ 正例：单测里直接 mock 模块
vi.mock('@api/modules/user', () => ({
  userApi: { getList: vi.fn() },
}))
```

---

## 12. CI 验证

`pnpm check:routes`（pre-commit + CI 强制）校验 whitelist ↔ 实际 routes 的 5 项一致性（A 白名单元素必须有 route 实现 / B 系统兜底路由必须在白名单 / C 系统兜底路由必须有真实实现 / D 双向一致性汇总，豁免前缀不参与对比 / E 注册表反向校验——apps/ 下发现的应用必须登记 apps-registry.mjs，防静默失效）。**不再校验 RouteName 联合类型**——`types.ts` 的 `RouteName` 自 2026-07-24 方案 A 起已改为 string alias，组件注册经 `COMPONENT_REGISTRY` 派生，新增路由无须多处同步类型。

mock 相关的路由约束靠约定兜底：远程菜单 mock 返回的 `name` 必须能在 `COMPONENT_REGISTRY` 查到组件（§9）。

---

## 13. 评审 Checklist（PR 必过）

```
□ 1. mock 文件放在 packages/mock/src/<feature>.ts，与 packages/shared/src/api/modules/<feature>.ts 对应？
□ 2. 使用 `[...] as MockMethod[]` 数组形式（而非单个对象）？
□ 3. 同步数据用 `response: ({ query, params }) => ...` + `timeout` 字段；需要异步/Set-Cookie/读 body 时切 `rawResponse: (req, res) => ...`？
□ 4. mock 数据类型与 Zod schema 一致（避免字段漂移）？
□ 5. 错误码用业务字段 code 而非 HTTP status（除非要测 500）？
□ 6. 远程菜单 mock 的 name 能在 COMPONENT_REGISTRY 查到组件（与 modules/<m>/routes/index.ts 声明一致）？
□ 7. prod 形态已确认：常规构建 tree-shake 不含 mock；演示构建（VITE_USE_MOCK=true）已同步登记 mockProdServer.ts（§15 的 @trigger 约定）？
□ 8. 单测用 vi.mock 而非 mock-server？
□ 9. 响应体已 `import type` + `satisfies` 挂钩 @vv/shared api 层契约类型（UserItem / LoginResult / UserProfile / DictItem / ProTableRequestApi 等，§2 约定）？
```

---

## 14. 常见坑

| 症状                                                 | 原因                                                                                                   | 解法                                                                                                                                        |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| mock 修改后没生效                                    | dev server 未重启 + watchFiles 未开                                                                    | `@vv/config` 工厂（`packages/config/src/create-vite-config.ts`）已默认 `watchFiles: true`；未生效时确认 `mockPath` 指向 `packages/mock/src` |
| 常规 prod 包包含 mock 残留                           | vite build 不读 `.env.development`，未设/非 `'true'` 自动关闭；如遇 prod mock 残留，多半是代码静态引用 | 检查工厂的 `enable` 契约（`VITE_USE_MOCK !== 'false'`）                                                                                     |
| 演示构建（VITE_USE_MOCK=true）请求穿透打到静态服务器 | mockjs 挂接晚于 router install——Vue Router install 即触发初始导航，守卫请求在劫持激活前发出            | 挂接块必须位于 `createApp` 后、`app.use(router)` 前并 `await setupProdMockServer()`（§15 时序硬约束）                                       |
| `response` 写 async 不生效                           | `response` 字段必须同步（vite-plugin-mock v3 设计）                                                    | 改用同步 + `timeout: ms`；如需真异步用 `rawResponse: async (req, res) => ...`（参考 packages/mock/src/auth.ts）                             |
| dev 动态路由 `:code` 读 params 得 undefined          | vite-plugin-mock 3.0.2 把路径参数合并进 `query`（requestMiddleware），不单独传 `params`                | 从 `query.code` 取并做缺失防御（参考 packages/mock/src/dict.ts 文件头注释）                                                                 |
| params 是字符串                                      | URL 动态参数永远是 string                                                                              | `Number(params.id)` 手动转                                                                                                                  |
| 后端字段名改了但前端没改                             | mock 与生产 schema 漂移                                                                                | 用 Zod schema 共享类型                                                                                                                      |
| 远程菜单 mock 报"未注册的路由 name"                  | name 不在 COMPONENT_REGISTRY                                                                           | 先在 modules/<m>/routes/index.ts 声明                                                                                                       |

---

## 15. 生产 mock 接线（mockProdServer.ts，gh-pages 静态部署用）

> 2026-10-20 落地（git df9f19c + cb39d00 + 659cd6a + 6d0db79 连环修复终态）。设计文档：[docs/superpowers/specs/2026-10-20-gh-pages-deploy-design.md](./superpowers/specs/2026-10-20-gh-pages-deploy-design.md)；部署侧上下文见 docs/40。

### 15.1 为什么需要

`vite-plugin-mock@3.0.2` 是**纯 dev-server 插件**——2.9.x 的 `prodEnabled` 在 3.0.0 重写为 dev 中间件后已移除。gh-pages 纯静态托管无 node 中间件，要让线上 demo 有数据，必须在浏览器端手动接线：mockjs 劫持 XHR。

### 15.2 接线架构

```
apps/<a>/src/main.ts（6 app 逐字同构，装配单源在 @vv/shared 的 bootstrapApp 工厂）
  └─ bootstrapApp({ loadMockServer: () => import('@mock/mockProdServer'), ... })
       工厂内守卫：if (import.meta.env.PROD && import.meta.env.VITE_USE_MOCK === 'true')
                   await setupProdMockIfNeeded()   ← createApp 后、app.use(router) 前，顶层 await
            │
            ▼
packages/mock/src/mockProdServer.ts（@mock 别名 → 回调注入，仅 app 编译上下文可解析）
  ├─ prodAuthMocks（内联，response 形态）
  ├─ prodDictMocks（内联，DICT_DATA 逐条静态展开）
  ├─ menu.ts（data 直引）
  └─ user.ts（data 直引）
            │
            ▼
createProdMockServer(mockModules)  ← vite-plugin-mock/client，浏览器端 mockjs 劫持
```

**挂接时序硬约束**（两轮 preview 目检 + CDP 实证）：必须在 `createApp` 之后、`app.use(router)` **之前**顶层 `await`。Vue Router install 即触发初始导航——挂接晚于 `use(router)`，守卫的 profile 拉取会抢在 mockjs 劫持激活之前发出（穿透拦截窗口打到静态服务器返回 HTML）。「mount 前 await」也不够：守卫链与 main.ts 后续语句并行执行。（P6 起该时序已固化在 `bootstrapApp` 工厂内，6 app 逐字同构，业务侧无须手写）

### 15.3 prod 内联 auth/dict 的原因

- **auth**：dev 版 `packages/mock/src/auth.ts` 用 `rawResponse` 模拟 Set-Cookie HttpOnly 凭证流，client 侧 `createProdMockServer` 只消费 `response` 函数（client.mjs 解构 4 字段，rawResponse 被静默忽略）——更深层是 mockjs 伪造响应写不进 cookie 也校验不了。故 prod 版内联 `response` 形态的 login/profile/logout/refresh，供 `VITE_DEMO_NO_AUTH` 演示模式消费；权限码字面量与 dev 版 `MOCK_PERMISSIONS` **手工对齐**（两处无运行时共享）。
- **dict**：client wrapper 不从路径提取参数（`:code` 恒 undefined → 命中 400 防御分支）。故把 `DICT_DATA` 逐条静态展开为 `/api/dict/<code>` 独立 url，每条 code 由闭包固化。

### 15.4 新增 mock 模块的同步登记约定

**@trigger**：新增 `packages/mock/src/<feature>.ts` 路由模块时，须同步登记两处——

1. `packages/mock/src/index.ts`（dev 聚合导出）
2. `packages/mock/src/mockProdServer.ts`（prod 接线清单，`data` 直引或按需内联 prod 版）

两处清单**不许分叉**。`pro-table/` 下的具名导出 `xxxRequestApi` 是组件直连数据源（无 XHR 依赖），两形态均无需接线。

### 15.5 演示模式配合

`VITE_DEMO_NO_AUTH=true` 时守卫跳过登录/权限校验（`packages/shared/src/router-guards/login.ts` + `permission.ts`），演示账号 Admin（admin/123456）全链路可点；按钮级 `v-auth` 仍按真实 permissions 渲染，权限控制演示效果不受影响。

---

## 🔗 相关文档

| 文档                                          | 范围                                     |
| --------------------------------------------- | ---------------------------------------- |
| `docs/10-新手指引.md` §3.3                    | mock 写入示例                            |
| `docs/14-zod请求参数校验使用规范.md`          | Zod schema + mock 共享类型               |
| `docs/15-请求层缓存-合并-分页适配使用规范.md` | mock 接口的 cache 配置                   |
| `docs/11-字典使用规范.md`                     | dict mock 用法                           |
| `docs/07-路由模块设计.md` §远程菜单 JSON      | 远程菜单 mock 协议                       |
| `packages/shared/src/api/mock-guard.ts`       | prod 防御层源码                          |
| `packages/mock/src/mockProdServer.ts`         | 生产 mock 接线源码（§15）                |
| `docs/40-GitHubPages自动部署.md`              | 部署侧上下文（四开关）                   |
| `packages/config/src/create-vite-config.ts`   | vite-plugin-mock 配置（@vv/config 工厂） |

---

_文档版本：v1.1.0 | 编写日期：2026-09-04 | 配套项目版本：vue3-vite-project 1.0.0 | 修订记录：v1.0.1 (2026-09-04) §3-7 同步 vite-plugin-mock v3（`body`→`response` + `defineMock`→`MockMethod[]` + `rawResponse` 异步契约）；v1.1.0 (2026-10-20) 新增 §15 生产 mock 接线（createProdMockServer 手动接线 + PROD 守卫防 dev 双重劫持 + use(router) 前 await 时序硬约束 + 字典 prod 静态展开双形态 + @trigger 同步登记约定）；§1 决策表/§8 增补 prod 客户端 mock 双形态（修正「prod 无任何 mock」旧表述）；§2 文件组织补 dict-data.ts/_utils.ts/pro-table//mockProdServer.ts；§9/§12 清除 RouteName 联合类型旧表述（2026-07-24 方案 A 起 types.ts 已改 string alias，check-routes 不校验 mock menu name）；§10 字典改 /api/dict/:code 动态路由（query.code 取值坑）+ prod 静态展开；§13 Checklist 第 6/7 条同步；§14 常见坑补穿透挂接时序坑与 query.code 坑_
