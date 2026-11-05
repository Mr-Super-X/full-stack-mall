# 路由 component-registry 合并到 auto-register 设计

> **变更摘要**：删除独立的 `src/router/component-registry.ts`，改为在 `auto-register.ts` 中从 `autoRegisteredRoutes` 派生 `COMPONENT_REGISTRY`。消除"路由配置 + 组件映射"双重维护，让 `routes/index.ts` 成为唯一 source of truth。新增路由从 3 处改动（routes/index.ts + types.ts + component-registry.ts）简化为 1 处（routes/index.ts）。

| 属性     | 值                           |
| -------- | ---------------------------- |
| 项目代号 | vue3-vite-project            |
| 创建日期 | 2026-07-21                   |
| 版本     | v1.0.0                       |
| 状态     | 设计已批准，待 writing-plans |
| 目标读者 | 前端开发、Code Review        |

---

## TL;DR

`component-registry.ts` 与 `auto-register.ts` 都基于同一份路由配置，但**写了两次相同的 component loader**。本次重构让 `auto-register.ts` 在扫描 `routes/index.ts` 后**顺带派生** `COMPONENT_REGISTRY`，删除独立文件。同时简化 `scripts/check-routes.ts`（移除 component-registry 校验项）。后端 JSON → 视图组件的桥接逻辑保留，仅换实现位置。

---

## 1. 背景与目标

### 1.1 当前问题

**`src/router/component-registry.ts`** 维护一份手写映射：

```ts
export const COMPONENT_REGISTRY: Record<RouteName, () => Promise<unknown>> = {
  Login: () => import('@/modules/auth/views/Login.vue'),
  Dashboard: () => import('@/modules/dashboard/views/Index.vue'),
  UserList: () => import('@/modules/user/views/List.vue'),
  // ...
}
```

**`src/router/auto-register.ts`** 扫描 `routes/index.ts`：

```ts
// auth/routes/index.ts
{
  path: '/login',
  name: 'Login',
  component: () => import('../views/Login.vue'),
}
```

**两者指向同一份 .vue 文件**：

- `auth/views/Login.vue`（实际代码）
- 但在 `auth/routes/index.ts` 和 `component-registry.ts` 各写一次 loader

### 1.2 目标

| #   | 目标                                                                |
| --- | ------------------------------------------------------------------- |
| G1  | 消除 component-registry 与 routes/index.ts 的双重维护               |
| G2  | 让 routes/index.ts 成为 name → component 映射的唯一 source of truth |
| G3  | 新增业务路由从"3 处改动"降为"1 处改动"（仅 routes/index.ts）        |
| G4  | 后端 JSON → 视图组件的桥接逻辑保持（remote.ts 行为不变）            |
| G5  | types.ts 的 RouteName 联合类型约束保留（type safety 不退化）        |

### 1.3 非目标

| #   | 不做什么                                                                              |
| --- | ------------------------------------------------------------------------------------- |
| N1  | 不改 auto-register.ts 的扫描逻辑（仍扫 routes/index.ts）                              |
| N2  | 不改 remote.ts 的业务流程（仍按 name 找 component）                                   |
| N3  | 不重命名 RouteName / autoRegisteredRoutes 等已有 export                               |
| N4  | 不做"运行时校验 routes/index.ts 必须有 name + component"的硬约束（lint 层面后续议题） |

---

## 2. 核心设计

### 2.1 架构变化

```text
重构前：
  routes/index.ts ──┬──→ auto-register.ts ──→ autoRegisteredRoutes
                    │
                    └──→ component-registry.ts ──→ COMPONENT_REGISTRY ──→ remote.ts
                              ↑
                              └── 手写第二遍 loader

重构后：
  routes/index.ts ──→ auto-register.ts ──→ autoRegisteredRoutes
                                 │
                                 └──→ COMPONENT_REGISTRY（派生）──→ remote.ts
```

### 2.2 派生逻辑

在 `auto-register.ts` 已有 `autoRegisteredRoutes` 后，遍历 routes 提取 `(name, component)`：

```ts
// 伪代码
export const COMPONENT_REGISTRY: Record<string, () => Promise<unknown>> = (() => {
  const map: Record<string, () => Promise<unknown>> = {}
  const visit = (routes: RouteRecordRaw[]) => {
    for (const route of routes) {
      if (route.name && route.component) {
        const name = String(route.name)
        if (map[name]) console.warn(`[router/auto-register] 重复的路由 name: ${name}`)
        map[name] = route.component as () => Promise<unknown>
      }
      if (route.children?.length) visit(route.children)
    }
  }
  visit(autoRegisteredRoutes)
  return map
})()
```

### 2.3 类型策略

`COMPONENT_REGISTRY: Record<string, () => Promise<unknown>>`

- 弱类型（不再用 `Record<RouteName, ...>`）
- 理由：避免 `auto-register.ts` 反向依赖 `types.ts` 的 RouteName 联合类型（可能导致循环依赖或脆弱的推导链）
- 运行期保证 key 有效性：所有 key 来自 `routes/index.ts` 的 `name` 字段，编译期已由 `RouteName` 联合类型约束

`remote.ts` 仍做 `as RouteName` 断言（保持原状）。

---

## 3. 改动清单

| 文件                               | 操作     | 说明                                                            |
| ---------------------------------- | -------- | --------------------------------------------------------------- |
| `src/router/component-registry.ts` | **删除** | 整体删除（29 行）                                               |
| `src/router/auto-register.ts`      | 修改     | 在 `autoRegisteredRoutes` 后追加 `COMPONENT_REGISTRY` 派生      |
| `src/router/remote.ts`             | 修改     | import 路径改 `./auto-register`；warn 文案简化                  |
| `src/router/types.ts`              | 修改     | 注释更新（移除 component-registry 引用）                        |
| `src/api/modules/menu.ts`          | 修改     | 注释更新                                                        |
| `scripts/check-routes.ts`          | 修改     | 删除 component-registry 校验项；保留 RouteName + whitelist 校验 |
| `CHANGELOG.md`                     | 修改     | 追加 refactor 条目                                              |
| `docs/07-路由模块设计.md`          | 修改     | "新增路由流程" 从 3 步改为 1 步                                 |

### 3.1 `src/router/auto-register.ts` 新增内容

```ts
/**
 * 路由 name → 视图组件 loader 的映射（从 autoRegisteredRoutes 派生）。
 *
 * 设计要点：
 *   - 替代了原本的 src/router/component-registry.ts
 *   - 单一 source of truth：路由配置 routes/index.ts
 *   - 新增业务路由**只需在 routes/index.ts 写一次**（无需同步 component-registry）
 *   - 类型：Record<string, ...>，避免 auto-register 反向依赖 RouteName 联合类型
 *   - 远程菜单（router/remote.ts）通过此映射按 name 查找 component loader
 */
export const COMPONENT_REGISTRY: Record<string, () => Promise<unknown>> = (() => {
  const map: Record<string, () => Promise<unknown>> = {}
  const visit = (routes: RouteRecordRaw[]): void => {
    for (const route of routes) {
      if (route.name && route.component) {
        const name = String(route.name)
        if (map[name]) {
          console.warn(`[router/auto-register] 重复的路由 name: ${name}（后注册会覆盖）`)
        }
        map[name] = route.component as () => Promise<unknown>
      }
      if (route.children?.length) visit(route.children)
    }
  }
  visit(autoRegisteredRoutes)
  return map
})()
```

### 3.2 `src/router/remote.ts` 改动

```diff
- import { COMPONENT_REGISTRY } from './component-registry'
+ import { COMPONENT_REGISTRY } from './auto-register'

  // warn 文案
- `[router/remote] 未注册的路由 name: ${item.name}（需在 component-registry.ts 中添加）`
+ `[router/remote] 未注册的路由 name: ${item.name}（routes/index.ts 中未声明）`
```

### 3.3 `scripts/check-routes.ts` 改动

删除以下校验项：

- `registryContent = readRouterFile('component-registry.ts')`（行 64）
- "RouteName 中每个 name 都必须在 component-registry 中"（行 73-77）
- "component-registry 中每个 key 都必须在 RouteName 中"（行 78-82）
- `console.log('component-registry 映射：...')`（行 104）

**保留**：

- RouteName 联合类型解析
- 与 whitelist 一致性校验
- scripts/check-routes.ts 顶部的"组件注册表必要性"说明改为"routes/index.ts 一致性"

### 3.4 `src/router/types.ts` 注释更新

```diff
  // whitelist.ts 用 RouteName 校验白名单拼写
- // component-registry.ts 用 RouteName 校验 key 拼写
- // 新增路由时必须在此追加，否则 TS 报错
+ // 新增路由时必须在此追加，否则 TS 报错
+ //
+ // 注：原 component-registry.ts 已合并到 auto-register.ts 派生，
+ // 无需再单独维护 name → component 映射。

  // RemoteMenuItem 注释同步更新
- // - name 是业务路由名，对应 component-registry 的 key（前端可校验）
+ // - name 是业务路由名（前端通过 auto-register.ts 派生的 COMPONENT_REGISTRY 校验）
```

### 3.5 `docs/07-路由模块设计.md` 同步

"新增业务模块的标准流程" 从 3 步改为 1 步：

```diff
- 新增业务模块的标准流程（无需改 router 目录）：
-   1. 创建 src/modules/<feature>/routes/index.ts
-   2. 在 types.ts 追加 RouteName
-   3. 在 component-registry.ts 追加同名映射
-   4. 完成 —— 路由自动可用
-   （scripts/check-routes.ts 可一键校验 3 处一致性）
+ 新增业务模块的标准流程（无需改 router 目录）：
+   1. 在 src/modules/<feature>/routes/index.ts 写路由（含 name + component）
+   2. 在 src/router/types.ts 追加 RouteName 联合类型条目
+   3. 完成 —— 路由自动可用，remote 模式自动可用
+   （scripts/check-routes.ts 校验 RouteName + whitelist 一致性）
```

---

## 4. 测试策略

### 4.1 单元测试

新增 `src/router/auto-register.spec.ts`：

```ts
// 验证 COMPONENT_REGISTRY 从 routes 派生
import { COMPONENT_REGISTRY } from './auto-register'

describe('COMPONENT_REGISTRY（派生自 autoRegisteredRoutes）', () => {
  it('含 routes/index.ts 中声明的所有 name', () => {
    expect(COMPONENT_REGISTRY.Login).toBeDefined()
    expect(COMPONENT_REGISTRY.Dashboard).toBeDefined()
    expect(COMPONENT_REGISTRY.UserList).toBeDefined()
  })

  it('含 error 模块的 name', () => {
    expect(COMPONENT_REGISTRY.Forbidden).toBeDefined()
    expect(COMPONENT_REGISTRY.NotFound).toBeDefined()
    expect(COMPONENT_REGISTRY.ServerError).toBeDefined()
  })

  it('component 是 lazy loader（函数）', () => {
    expect(typeof COMPONENT_REGISTRY.Login).toBe('function')
  })

  it('不包含未在 routes 中声明的 name', () => {
    expect(COMPONENT_REGISTRY.NonExistent).toBeUndefined()
  })
})
```

### 4.2 端到端验证

1. `pnpm type-check` —— 通过（无新错误）
2. `pnpm test` —— 通过（新单测 + 现有 56 测试）
3. `pnpm check:routes` —— 通过（无 component-registry 校验项报错）
4. `pnpm build` —— 通过
5. 启动 dev，访问 `/login` 路径 —— 远程模式 + 本地模式均能正常加载视图

---

## 5. 边界与错误处理

| 场景                            | 行为                                        |
| ------------------------------- | ------------------------------------------- |
| routes 中 name 重复             | 派生时 `console.warn` + 后注册覆盖前者      |
| routes 中无 name 字段           | 跳过（不加入 COMPONENT_REGISTRY）           |
| routes 中无 component 字段      | 跳过（不加入 COMPONENT_REGISTRY）           |
| 后端返回 routes 中未声明的 name | remote.ts warn + 跳过该菜单项（保持原行为） |
| `Record<string, ...>` 弱类型    | 接受；运行期保证 key 来自 routes/index.ts   |

---

## 6. 风险评估

| 风险                                                              | 等级 | 缓解                                                        |
| ----------------------------------------------------------------- | ---- | ----------------------------------------------------------- |
| 删除 component-registry.ts 后有遗漏 import                        | 低   | Grep 验证：`remote.ts:17` 是唯一 import 点，spec 阶段已确认 |
| `Record<string, ...>` 弱类型降低 TS 保护                          | 中   | 用户已确认接受；运行期 routes/index.ts 保证 key 有效        |
| 派生逻辑在 routes 含 children 时漏掉                              | 中   | 实现已递归处理 children；单测覆盖                           |
| 现有 `scripts/check-routes.ts` 调用方依赖 component-registry 校验 | 低   | 该脚本仅 pnpm check:routes 内部使用，无外部依赖             |
| `auto-imports.d.ts` / `components.d.ts` 等自动生成文件被影响      | 低   | 与本次改动无关，auto-register.ts 不涉及                     |

---

## 7. 实施产物清单

| 序号 | 文件                               | 改动                                   |
| ---- | ---------------------------------- | -------------------------------------- |
| 1    | `src/router/component-registry.ts` | **删除**                               |
| 2    | `src/router/auto-register.ts`      | 修改（追加 COMPONENT_REGISTRY 派生）   |
| 3    | `src/router/remote.ts`             | 修改（改 1 行 import + warn 文案）     |
| 4    | `src/router/types.ts`              | 修改（注释更新）                       |
| 5    | `src/api/modules/menu.ts`          | 修改（注释更新）                       |
| 6    | `scripts/check-routes.ts`          | 修改（删除 component-registry 校验项） |
| 7    | `src/router/auto-register.spec.ts` | 新建（4 个测试）                       |
| 8    | `CHANGELOG.md`                     | 追加 refactor 条目                     |
| 9    | `docs/07-路由模块设计.md`          | 更新"新增路由流程"                     |

预计代码变更：+约 35 行 / -约 30 行

---

_文档版本：v1.0.0 | 生成日期：2026-07-21_
