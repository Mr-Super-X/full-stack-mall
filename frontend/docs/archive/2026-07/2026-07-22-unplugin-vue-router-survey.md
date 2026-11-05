# unplugin-vue-router 调研报告

> **调研日期**：2026-07-22
> **调研人**：vue3-vite-project 项目组
> **目的**：评估是否值得把当前 glob-based 自动注册（`src/router/auto-register.ts`）迁移到 `unplugin-vue-router`（file-based 路由生成）
> **结论（TL;DR）**：❌ 当前阶段**不建议迁移**。理由见 §6。

---

## 1. unplugin-vue-router 是什么

官方仓库：`https://github.com/posva/unplugin-vue-router`

核心能力：

- **文件路径即路由**：放在 `src/pages/users/[id].vue` 自动成为 `/users/:id` 路由
- **typesafe**：基于文件结构生成 `typed-router.d.ts`，`router.push({ name: 'users-id', params: { id: 1 } })` 全部自动补全
- **零配置**：安装插件即可，与 Nuxt 的 pages 路由相似但适用于 Vite 通用项目
- **支持 layouts**：用 `definePage()` 在 SFC 中定义 meta / keepAlive / middleware

**与 Nuxt 文件路由的区别**：unplugin-vue-router 不强制要求整个项目按 Nuxt 约定组织，可以让已有的 legacy 路由共存（混合模式）。

---

## 2. 当前项目路由设计回顾

```
src/router/
├── index.ts                  # createRouter + setupAuthGuard
├── auto-register.ts          # import.meta.glob('/src/modules/**/routes/index.ts')
├── config.ts                 # menuSource + historyMode + base
├── fallback.ts               # catch-all 404
├── whitelist.ts              # 白名单 Set<RouteName>
├── types.ts                  # RouteName 联合类型 + AppRouteMeta
├── remote.ts                 # fetchRemoteRoutes()
├── error-boundary.ts         # router.onError 封装
├── helpers.ts                # resolveRouteTitle / extractRoutePermissions
└── guards/
    ├── auth.ts               # 编排入口
    ├── visibility.ts         # 可见性检查
    ├── login.ts              # 登录态检查
    ├── permission.ts         # 权限码检查
    ├── remote-menu.ts        # 远程菜单加载 + dynamicLoaded 状态
    └── composable.ts         # composeGuards 工具

src/modules/{auth,user,home,error,orders,reports}/routes/index.ts
```

> 业务模块**显式声明**路由数组（routes/index.ts），通过 glob 聚合。当前 6 个业务模块约 7 个路由。

---

## 3. 与当前方案的对比矩阵

| 维度               | **当前（glob + RouteName 联合类型）**                       | **unplugin-vue-router（file-based）**                              |
| ------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------ |
| **新增路由成本**   | 1 文件（`routes/index.ts`）                                 | 1 文件（`pages/<feature>.vue`）+ 文件命名有约定                    |
| **路由元数据**     | `meta: { title, icon, permissions, ... }` 显式对象字面量    | `definePage({ meta: { ... } })` 在 SFC 内部定义                    |
| **类型安全**       | `RouteName` 联合类型 + `ReadonlySet<RouteName>` 白名单      | `typed-router.d.ts` 自动生成 `RoutesNamedMap`                      |
| **router.push**    | `router.push({ name: 'UserList', params: {...} })` 需手写   | `router.push({ name: 'users-id', params: { id: 1 } })` 自动补全    |
| **route() helper** | 无（必须写完整 RouteLocationRaw）                           | 官方提供 typed version：`route.locations.users(params)`            |
| **嵌套布局**       | 业务模块自管（`/orders` + children / `/orders/detail/:id`） | 文件夹嵌套（`pages/orders/[id].vue`）自动生成嵌套                  |
| **远程菜单加载**   | `addRoute()` 后置注入（守卫 + COMPONENT_REGISTRY 派生）     | **不直接支持**——unplugin-vue-router 把路由视为 build-time 静态集合 |
| **catch-all 404**  | `router/fallback.ts` 单独注册（避免字典序问题）             | 可以用 `pages/[...all].vue` 自动 catch-all                         |
| **Meta 加载时机**  | 路由懒加载时（runtime）                                     | build-time 生成（更快但失去远程动态注入能力）                      |
| **滚动行为**       | 手写 `router.afterEach` 设置 scrollBehavior                 | 支持全局 scrollBehavior 配置                                       |
| **路由守卫**       | 手写 `setupAuthGuard` + 多个独立 guard 文件                 | 一致（不受影响）                                                   |
| **测试友好**       | `auto-register.spec.ts` 已存在                              | 添加 Vitest plugin 时需把测试也移到文件路由约定下                  |

---

## 4. 迁移成本评估

### 4.1 必须重做的部分

| 步骤                                                                                                                                                                                          | 工作量 | 风险                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| 4.1.1 安装 `unplugin-vue-router` 0.x + 配置 `vite.config.ts`                                                                                                                                  | 0.5h   | 低                                                       |
| 4.1.2 把 `src/modules/<feature>/views/*.vue` 移到 `src/pages/<feature>/*.vue`（或保留 views/，但需配置 `routeStyle`）                                                                         | 1d     | 中（路径含义改变）                                       |
| 4.1.3 把路由元数据从 `meta: {...}` 改写到各 SFC 的 `<route>` 块或 `definePage()`                                                                                                              | 1d     | 高（meta 散落到 SFC，可读性下降）                        |
| 4.1.4 远程菜单加载重构（关键变化点）：unplugin-vue-router 不允许 build-time 之外的 addRoute，后端菜单必须改为「meta 配置驱动」（后端返回 component 路径，前端用 dynamic import 或 vite glob） | 2d     | **🔴 高（违反当前"后端不返回 component 路径"安全原则）** |
| 4.1.5 现有 13 个改进项（v-auth / 守卫拆分 / AppRouteMeta 等）需要 review 是否在文件路由下仍然适用                                                                                             | 0.5d   | 中                                                       |
| 4.1.6 文档（docs/07-路由模块设计.md）大改                                                                                                                                                     | 0.5d   | 低                                                       |

**总成本估算：5 天（1 人）** —— 远超新增一个 v-auth 指令。

### 4.2 迁移收益对照

- 路径即路由：少写 1 个 `routes/index.ts` 文件（**节省 ~10 行/路由**）
- 类型安全 router.push：减少 `router.push({ name: 'UserList' })` 拼写错误（**当前已有 RouteName 联合类型约束**）
- 文件夹嵌套 vs 显式 children：少写嵌套数组（**当前业务尚未出现 3 级嵌套**）

---

## 5. 决策矩阵

| 场景                                             | 选 unplugin-vue-router？ | 备注                          |
| ------------------------------------------------ | ------------------------ | ----------------------------- |
| 新项目 / 演示用脚手架                            | ✅ 推荐                  | 配置最简，路由少时收益高      |
| **中等规模业务（10-50 路由）**                   | ⚠️ 视情况                | 已有 glob 方案也很成熟        |
| **远程菜单动态注入是关键能力**                   | ❌ 不要                  | unplugin-vue-router 不支持    |
| 部署环境受限（如静态托管）                       | ✅ 优势大                | file-based 路由天然 hash 模式 |
| 团队已有 Vue Router 文件路由约定（如 Nuxt 迁移） | ✅ 优势大                | 复用肌肉记忆                  |

---

## 6. 结论：当前阶段不建议迁移

**核心反对理由（按重要性降序）：**

1. **🔴 远程菜单动态注入丢失**
   当前架构最大的优势是"后端返回 name，前端维护 component map"——前端代码结构不外泄。unplugin-vue-router 在 build-time 锁定路由集合，无法支持后端返回新路由时的运行时 `addRoute`（除非放弃安全原则让后端返回 component 路径）。

2. **🟡 迁移 ROI 低**
   13 个 P0/P1/P2 改进项都基于当前的显式 routes/index.ts 设计。如果迁移，要全部 review 兼容性——成本 5 天 vs 收益 ~10 行/路由。

3. **🟢 RouteName 联合类型已基本等价于"typed router"**
   `pushByName<RouteName>(...)` 已经提供了类型安全的 name 跳转。`useAppRouter.pushByName('UserList')` 在 IDE 自动补全与 unplugin-vue-router 行为差距不大。

---

## 7. 何时需要重新评估

- 路由数量超过 30+（手动维护 routes/index.ts 变得繁琐）
- 出现 3 级以上嵌套菜单（file-based 自动嵌套优势凸显）
- 项目大规模转型 Nuxt（如被纳入统一脚手架）
- 出现"路由配置重复"成为热点问题（如 meta 字段散落到所有 routes/index.ts 难维护）

---

## 8. 参考资源

- 官方仓库：<https://github.com/posva/unplugin-vue-router>
- 官方文档：<https://uvr.posva.net/>
- 类型化 router.push 演示：<https://uvr.posva.net/guide/typed-router.html>
- 与 Vue Router 内置对比：<https://uvr.posva.net/guide/migration-from-vue-router.html>

---

**调研人备注**：本次调研未实际集成到项目，纯文献 + 评估。如后续确需迁移，本报告可作为迁移方案的起点。
