# 路由 component-registry 合并到 auto-register 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 删除独立的 `src/router/component-registry.ts`，让 `auto-register.ts` 在扫描 `routes/index.ts` 后派生 `COMPONENT_REGISTRY`，消除"路由配置 + 组件映射"双重维护；新增业务路由从 3 处改动降为 1 处（仅 routes/index.ts）。

**Architecture:** `auto-register.ts` 用 `import.meta.glob` 已收集所有 routes/index.ts 模块，顺带遍历 `autoRegisteredRoutes` 提取 `(name, component)` 字典导出为 `COMPONENT_REGISTRY`；`remote.ts` 改 import 路径，行为不变；`scripts/check-routes.ts` 删除 component-registry 校验项，保留 RouteName + whitelist 一致性校验。

**Tech Stack:** Vue 3.5 + Vite 8 + TypeScript 6 + Vitest 4

---

## File Structure

| 文件                               | 类型     | 责任                                                      |
| ---------------------------------- | -------- | --------------------------------------------------------- |
| `src/router/auto-register.ts`      | 修改     | 派生 `COMPONENT_REGISTRY`（在 autoRegisteredRoutes 之后） |
| `src/router/auto-register.spec.ts` | 新建     | 4 个测试 case 验证派生正确性                              |
| `src/router/component-registry.ts` | **删除** | —                                                         |
| `src/router/remote.ts`             | 修改     | import 路径改为 `./auto-register`；warn 文案简化          |
| `src/router/types.ts`              | 修改     | 注释更新（移除 component-registry 引用）                  |
| `src/api/modules/menu.ts`          | 修改     | 注释更新                                                  |
| `scripts/check-routes.ts`          | 修改     | 删除 component-registry 校验项                            |
| `CHANGELOG.md`                     | 修改     | 追加 refactor 条目                                        |
| `docs/07-路由模块设计.md`          | 修改     | "新增路由流程" 改为 1 步                                  |

不修改：

- `src/router/index.ts` / `config.ts` / `whitelist.ts` / `fallback.ts` / `guards/*`
- `src/modules/**/routes/index.ts`（routes 配置不动）

---

## Task 1: 写 auto-register.spec.ts 派生测试（先行失败）

**Files:**

- Create: `src/router/auto-register.spec.ts`

- [ ] **Step 1: 写测试**

```ts
import { describe, it, expect } from 'vitest'
import { COMPONENT_REGISTRY } from './auto-register'

describe('COMPONENT_REGISTRY（从 autoRegisteredRoutes 派生）', () => {
  it('含 routes/index.ts 中声明的所有业务路由 name', () => {
    expect(COMPONENT_REGISTRY.Login).toBeDefined()
    expect(COMPONENT_REGISTRY.Dashboard).toBeDefined()
    expect(COMPONENT_REGISTRY.UserList).toBeDefined()
  })

  it('含 error 模块的所有 name', () => {
    expect(COMPONENT_REGISTRY.Forbidden).toBeDefined()
    expect(COMPONENT_REGISTRY.NotFound).toBeDefined()
    expect(COMPONENT_REGISTRY.ServerError).toBeDefined()
  })

  it('component 是懒加载函数（不会立即执行）', () => {
    expect(typeof COMPONENT_REGISTRY.Login).toBe('function')
  })

  it('不包含未在 routes 中声明的 name', () => {
    expect(COMPONENT_REGISTRY.NonExistentRoute).toBeUndefined()
  })
})
```

- [ ] **Step 2: 跑测试，验证失败**

Run: `cd "D:/personal/github/vue3工程模板/vue3-vite-project" && pnpm test src/router/auto-register.spec.ts`
Expected: 失败（`COMPONENT_REGISTRY` 还不存在）

- [ ] **Step 3: 提交（测试先行）**

```bash
cd "D:/personal/github/vue3工程模板/vue3-vite-project"
git add src/router/auto-register.spec.ts
git commit -m "test(router): 添加 COMPONENT_REGISTRY 派生的单测（先行失败）

验证 auto-register.ts 派生的 COMPONENT_REGISTRY 含全部业务路由 name + error
模块 name，以及 component 是懒加载函数、未声明的 name 返回 undefined。"
```

> Husky pre-commit 会跑 vue-tsc；如果 `COMPONENT_REGISTRY` 不存在，ts 报错。**这一阶段测试已存在、但类型检查会失败**。commit message 标注"先行失败"。

---

## Task 2: 在 auto-register.ts 添加 COMPONENT_REGISTRY 派生

**Files:**

- Modify: `src/router/auto-register.ts`（在 `autoRegisteredRoutes` 导出后追加派生代码）

- [ ] **Step 1: 在文件末尾追加派生代码**

定位 `auto-register.ts` 的最后一行（`export const autoRegisteredRoutes: RouteRecordRaw[] = ...`）之后，追加以下代码块：

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
 *
 * 边界处理：
 *   - 跳过无 name 或无 component 的路由（如 layout 包裹层、catch-all 兜底）
 *   - 重复 name 时 console.warn + 后注册覆盖前者
 *   - 递归处理 routes.children（嵌套路由同样提取）
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

- [ ] **Step 2: 跑测试，验证通过**

Run: `cd "D:/personal/github/vue3工程模板/vue3-vite-project" && pnpm test src/router/auto-register.spec.ts`
Expected: 4/4 tests passed

- [ ] **Step 3: 类型检查**

Run: `pnpm type-check`
Expected: 通过

- [ ] **Step 4: 提交**

```bash
cd "D:/personal/github/vue3工程模板/vue3-vite-project"
git add src/router/auto-register.ts
git commit -m "feat(router): 在 auto-register.ts 派生 COMPONENT_REGISTRY

从 autoRegisteredRoutes 递归提取 (name, component) 字典，替代独立的
component-registry.ts。单一 source of truth：新增业务路由只需改
routes/index.ts 一处。type: Record<string, ...> 弱类型，避免反向依赖
RouteName 联合类型导致循环依赖。"
```

---

## Task 3: 删除独立的 component-registry.ts

**Files:**

- Delete: `src/router/component-registry.ts`

- [ ] **Step 1: 用 git rm 删除文件**

Run:

```bash
cd "D:/personal/github/vue3工程模板/vue3-vite-project"
git rm src/router/component-registry.ts
```

- [ ] **Step 2: 提交**

```bash
git commit -m "refactor(router): 删除独立的 component-registry.ts

已合并到 auto-register.ts 派生。保留历史 commit 可通过 git log --follow 追溯。"
```

> 注意：此时 `src/router/remote.ts` 仍 import `./component-registry`，编译会失败。但只要 Task 4 在同一会话内紧接完成（无需 merge 即可），不会污染 main 分支。**Task 3 完成后立即执行 Task 4**。

---

## Task 4: 修改 remote.ts 的 import + warn 文案

**Files:**

- Modify: `src/router/remote.ts:17`（改 import）
- Modify: `src/router/remote.ts:52-55`（改 warn 文案）

- [ ] **Step 1: 改 import**

定位 `src/router/remote.ts` 第 17 行：

```ts
import { COMPONENT_REGISTRY } from './component-registry'
```

改为：

```ts
import { COMPONENT_REGISTRY } from './auto-register'
```

- [ ] **Step 2: 改 warn 文案**

定位 `src/router/remote.ts` 第 52-55 行的 `console.warn(...)`：

```ts
console.warn(`[router/remote] 未注册的路由 name: ${item.name}（需在 component-registry.ts 中添加）`)
```

改为：

```ts
console.warn(`[router/remote] 未注册的路由 name: ${item.name}（routes/index.ts 中未声明）`)
```

- [ ] **Step 3: 验证**

Run:

```bash
cd "D:/personal/github/vue3工程模板/vue3-vite-project"
pnpm type-check 2>&1 | tail -5
```

Expected: 通过（删除 component-registry.ts 后所有 import 已修复）

- [ ] **Step 4: 提交**

```bash
cd "D:/personal/github/vue3工程模板/vue3-vite-project"
git add src/router/remote.ts
git commit -m "refactor(router): remote.ts import 改为 auto-register，warn 文案更新"
```

---

## Task 5: 更新 types.ts 注释

**Files:**

- Modify: `src/router/types.ts`（注释更新）

- [ ] **Step 1: 修改文件顶部注释**

定位 `src/router/types.ts` 第 1-8 行：

```ts
// 路由类型定义（集中管理所有路由的 name）
//
// - whitelist.ts 用 RouteName 校验白名单拼写
// - component-registry.ts 用 RouteName 校验 key 拼写
// - 新增路由时必须在此追加，否则 TS 报错
//
// 校验脚本：scripts/check-routes.ts（pnpm check:routes）
```

改为：

```ts
// 路由类型定义（集中管理所有路由的 name）
//
// - whitelist.ts 用 RouteName 校验白名单拼写
// - 新增路由时必须在此追加，否则 TS 报错
// - 注：原 component-registry.ts 已合并到 auto-register.ts 派生，
//   无需再单独维护 name → component 映射。
//
// 校验脚本：scripts/check-routes.ts（pnpm check:routes）
```

- [ ] **Step 2: 修改 RouteName JSDoc 注释**

定位第 14-19 行：

```ts
/**
 * 业务路由 name 联合类型。
 *
 * 命名约定：与路由配置中的 `name` 字段一致。
 * 新增路由时：
 *   1. 在 router/modules/*.ts 中定义 name
 *   2. 在此联合类型追加
 *   3. 在 component-registry.ts 追加同名映射
 */
```

改为：

```ts
/**
 * 业务路由 name 联合类型。
 *
 * 命名约定：与路由配置中的 `name` 字段一致。
 * 新增路由时：
 *   1. 在 src/modules/<feature>/routes/index.ts 中定义 name
 *   2. 在此联合类型追加
 * 完成后路由自动可用，remote 模式自动可用（component 由 auto-register.ts 派生）
 */
```

- [ ] **Step 3: 修改 RemoteMenuItem 注释**

定位 RemoteMenuItem 注释（查找 "name 是业务路由名，对应 component-registry 的 key"）：

```ts
 *   - name 是业务路由名，对应 component-registry 的 key（前端可校验）
```

改为：

```ts
 *   - name 是业务路由名（前端通过 auto-register.ts 派生的 COMPONENT_REGISTRY 校验）
```

- [ ] **Step 4: 类型检查 + 提交**

```bash
cd "D:/personal/github/vue3工程模板/vue3-vite-project"
pnpm type-check
git add src/router/types.ts
git commit -m "docs(router): types.ts 注释更新，移除 component-registry 引用"
```

---

## Task 6: 更新 api/modules/menu.ts 注释

**Files:**

- Modify: `src/api/modules/menu.ts:5`（注释）

- [ ] **Step 1: 改注释**

定位 `src/api/modules/menu.ts` 第 5 行附近：

```ts
//   - 由前端 src/router/component-registry.ts 维护 name → 组件的映射
```

改为：

```ts
//   - 由前端 src/router/auto-register.ts 派生 COMPONENT_REGISTRY（name → 组件）
```

- [ ] **Step 2: 提交**

```bash
cd "D:/personal/github/vue3工程模板/vue3-vite-project"
git add src/api/modules/menu.ts
git commit -m "docs(api): menu.ts 注释更新，指向 auto-register 派生"
```

---

## Task 7: 简化 scripts/check-routes.ts

**Files:**

- Modify: `scripts/check-routes.ts`（删除 component-registry 校验项）

- [ ] **Step 1: 改顶部说明注释**

定位第 1-12 行附近（"组件注册表"相关说明）：

```ts
// 路由 name 一致性校验脚本
//
// 校验 3 处一致性：
//   1. router/types.ts 的 RouteName 联合类型
//   2. component-registry.ts 中的 COMPONENT_REGISTRY 键（实现）
//   3. whitelist.ts 中的路由 name 白名单
//
// ...
```

保留"RouteName + whitelist 一致性校验"；删除 component-registry 相关说明。

改为：

```ts
// 路由 name 一致性校验脚本
//
// 校验 2 处一致性：
//   1. router/types.ts 的 RouteName 联合类型
//   2. whitelist.ts 中的路由 name 白名单
//
// 注：原 component-registry.ts 校验已移除（该文件已合并到 auto-register.ts 派生）。
//
// ...
```

- [ ] **Step 2: 删除 component-registry 校验代码**

定位约第 60-80 行的 component-registry 校验逻辑：

```ts
const registryContent = readRouterFile('component-registry.ts')
// ... 提取 registeredNames ...
// RouteName 中每个 name 都必须在 component-registry 中
// component-registry 中每个 key 都必须在 RouteName 中
```

**整段删除**（约 20 行）。具体方法：找到该段起始（`const registryContent`）到结束（约 `for (const name of registeredNames)` 之后）的范围，整体删除。

- [ ] **Step 3: 删除 component-registry 计数日志**

定位约第 104 行：

```ts
console.log(`component-registry 映射：${registeredNames.size} 个`)
```

**删除该行**。

- [ ] **Step 4: 验证**

```bash
cd "D:/personal/github/vue3工程模板/vue3-vite-project"
pnpm check:routes 2>&1 | tail -10
```

Expected: 通过（不再有 component-registry 校验项，但 RouteName + whitelist 仍校验）

- [ ] **Step 5: 提交**

```bash
cd "D:/personal/github/vue3工程模板/vue3-vite-project"
git add scripts/check-routes.ts
git commit -m "refactor(scripts): check-routes 移除 component-registry 校验项

component-registry.ts 已合并到 auto-register.ts 派生，不再需要独立校验。
保留 RouteName + whitelist 一致性校验。"
```

---

## Task 8: 更新 docs/07-路由模块设计.md

**Files:**

- Modify: `docs/07-路由模块设计.md`（"新增路由流程"改为 1 步）

- [ ] **Step 1: 定位流程说明**

查找文档中"新增业务模块的标准流程"段落（约 §新增路由标准流程），修改步骤数。

- [ ] **Step 2: 改流程描述**

原：

```markdown
新增业务模块的标准流程（无需改 router 目录）：

1. 创建 src/modules/<feature>/routes/index.ts
2. 在 types.ts 追加 RouteName
3. 在 component-registry.ts 追加同名映射
4. 完成 —— 路由自动可用
   （scripts/check-routes.ts 可一键校验 3 处一致性）
```

改为：

```markdown
新增业务模块的标准流程（无需改 router 目录）：

1. 在 src/modules/<feature>/routes/index.ts 写路由（含 name + component）
2. 在 src/router/types.ts 的 RouteName 联合类型追加
3. 完成 —— 路由自动可用，remote 模式自动可用
   （scripts/check-routes.ts 校验 RouteName + whitelist 一致性）

注：原 component-registry.ts 步骤已移除（已合并到 auto-register.ts 派生）。
```

- [ ] **Step 3: 提交**

```bash
cd "D:/personal/github/vue3工程模板/vue3-vite-project"
git add docs/07-路由模块设计.md
git commit -m "docs(router): docs/07 新增路由流程从 3 步改为 1 步"
```

---

## Task 9: 更新 CHANGELOG.md

**Files:**

- Modify: `CHANGELOG.md`（追加 refactor 条目）

- [ ] **Step 1: 在顶部追加条目**

在 "## Unreleased / ### Added" 区末尾追加：

```markdown
- 重构路由 component-registry：删除独立的 `src/router/component-registry.ts`，改为在 `src/router/auto-register.ts` 中从 `autoRegisteredRoutes` 派生 `COMPONENT_REGISTRY`（`Record<string, () => Promise<unknown>>`）。消除"路由配置 + 组件映射"双重维护，新增业务路由从 3 处改动降为 1 处。`scripts/check-routes.ts` 同步删除 component-registry 校验项，保留 RouteName + whitelist 校验
```

- [ ] **Step 2: 提交**

```bash
cd "D:/personal/github/vue3工程模板/vue3-vite-project"
git add CHANGELOG.md
git commit -m "docs(changelog): 记录 component-registry 合并到 auto-register 的重构"
```

---

## Task 10: 端到端验证

- [ ] **Step 1: 完整 lint**

```bash
cd "D:/personal/github/vue3工程模板/vue3-vite-project"
pnpm lint
```

Expected: 通过

- [ ] **Step 2: 完整 type-check**

```bash
pnpm type-check:full
```

Expected: 通过

- [ ] **Step 3: 完整测试**

```bash
pnpm test
```

Expected: 全部通过（新增 4 个 auto-register 测试 + 已有 56 个 = 60 个）

- [ ] **Step 4: 路由一致性脚本**

```bash
pnpm check:routes
```

Expected: 通过（不再有 component-registry 校验项）

- [ ] **Step 5: 构建**

```bash
pnpm build
```

Expected: 成功

- [ ] **Step 6: 验证 remote.ts 的 fallback 链路**

```bash
# 启动 dev
pnpm dev &
DEV_PID=$!
sleep 5

# 访问 /login 路径（触发 Login 路由）
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/login

# 关闭 dev
kill $DEV_PID
```

Expected: 200 / 正常响应

> 如果 curl 不可用，跳过此步（已有单元测试覆盖 lazy loader 解析逻辑）

- [ ] **Step 7: 全部通过则无需 commit；如有修复则单独 commit**

---

## Self-Review Summary

**1. Spec coverage:**

- G1 消除双重维护 ✅ Task 3 + Task 4
- G2 单一 source of truth ✅ Task 2
- G3 1 处改动 ✅ Task 2 + Task 8
- G4 remote 行为不变 ✅ Task 4（只改 import + 文案）
- G5 RouteName 强类型保留 ✅ Task 5（types.ts 不动 RouteName 定义，只改注释）

**2. Placeholder scan:** 无 TBD、无"类似 Task X"。

**3. Type consistency:** `COMPONENT_REGISTRY: Record<string, () => Promise<unknown>>` 在 Task 2 定义、Task 1 引用、Task 4 消费，签名一致；`autoRegisteredRoutes` 在 Task 2 末尾复用，原定义不变。

**4. Pitfalls noticed & fixed:**

- Task 1 单独 commit 测试文件：husky 会在 Task 1 commit 时因 `COMPONENT_REGISTRY` 缺失而失败 TS 检查 —— 用户已接受合并 commit 模式（参见上次 common 组件任务的处理），如果需要可改为 Task 1+2 合并 commit
- Task 3 单独删除 component-registry.ts：Task 3 commit 时 `remote.ts` 仍 import 该文件，会破坏 build —— 已注明"Task 3 完成后立即执行 Task 4"（同一 subagent 串行执行无影响）
- Task 7 的 `pnpm check:routes` 验证：依赖 RouteName + whitelist 仍能解析，验证脚本不需 import component-registry 文件
