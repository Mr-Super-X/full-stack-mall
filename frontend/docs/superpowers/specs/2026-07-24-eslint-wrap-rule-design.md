# ESLint 强制使用项目封装工具 — 设计文档

> **状态**：draft · 待用户审阅
> **日期**：2026-07-24
> **作者**：Claude（基于 brainstorming 流程）
> **关联分支**：feature/engine-optimization

## 1. 背景与目标

### 1.1 问题

项目在 `src/composables/` 中封装了 `useAppRouter`、`useRequest` 等高层 API，意图统一错误处理、注入 i18n title、避免重复样板。但当前代码库中仍有 6 个文件直接 `import { useRouter } from 'vue-router'`，绕过封装：

```
src/components/layout/Sidebar.vue
src/components/common/TagsView/index.vue
src/modules/home/views/components/OverviewCard.vue
src/modules/auth/views/Login.vue
src/modules/demo/layouts/DocLayout.vue
src/modules/demo/components/DemoFrame.vue
```

随着业务扩张，这类违规会越来越多。**需要 ESLint 规则在编码阶段拦截**，而不是依赖 code review。

### 1.2 目标

- ✅ 业务代码必须使用 `useAppRouter` 替代 `vue-router` 的 `useRouter`；`useRoute` 是 vue-router 的"读取当前路由状态"标准 API（route.path / route.name / route.query），暂不限制
- ✅ 业务代码禁止直接 `import axios`（正确的途径是 `@composables/useRequest` 或 `@api/_http`）
- ✅ 违规时给 warning（不阻塞构建），提示文案引导到正确封装
- ✅ 白名单：基础设施代码（composables/router/plugins/main.ts/测试）天然不受约束
- ✅ `pnpm lint` 跑通后整个仓库零 waring
- ❌ 不做：自动修复（useRouter → useAppRouter 需要语义重写，无法机械替换）
- ❌ 不做：限制 useAuth/useTheme/useDict 等（这些封装薄、收益小）

### 1.3 范围

| 维度 | 范围 |
|------|------|
| 工具 | ESLint 10.7.0（flat config）+ 内置规则 |
| 新依赖 | 无 |
| 影响文件 | eslint.config.mjs × 1，业务文件 × 6，文档 × 3 |
| 提示级别 | warn（不阻塞 CI） |
| 自动修复 | 不支持 |

## 2. 设计方案

### 2.1 架构总览

在现有 `eslint.config.mjs` 的平铺式 flat config 中**追加一段路径限定的 rules 块**。不引入新插件、不改构建脚本、不影响 IDE 体验。

```
┌────────────────────────────────────┐
│       现有规则（全局）               │
│  vue/typescript/prettier             │
└────────────────────────────────────┘
              +
┌────────────────────────────────────┐
│  新增规则（仅业务目录）              │
│  no-restricted-imports              │
│  no-restricted-syntax               │
└────────────────────────────────────┘
```

### 2.2 ESLint 配置（写入 `eslint.config.mjs`）

```js
// 业务目录强制使用项目封装（绕过：直接 import vue-router/axios 的 useRouter/useRoute/axios）
{
  name: 'app/business-wrap-rule',
  files: ['src/modules/**/*.{ts,vue}', 'src/components/**/*.{ts,vue}', 'src/views/**/*.{ts,vue}'],
  rules: {
    'no-restricted-imports': [
      'warn',
      {
        patterns: [
          {
            group: ['vue-router'],
            importNames: ['useRouter'],
            message: '业务代码禁止直接使用 vue-router 的 useRouter，请改用 @composables/useAppRouter',
          },
          {
            group: ['axios', 'axios/*'],
            message: '业务代码禁止直接使用 axios 包，请通过 @composables/useRequest 或 @api/_http 调用',
          },
        ],
      },
    ],
  },
},
```

### 2.3 白名单边界

flat config 的 `files` 字段只命中 3 个业务目录。**以下位置天然不受约束**：

| 路径 | 不受约束的原因 |
|------|---------------|
| `src/composables/**` | `useAppRouter` 自身实现要 `useRouter` |
| `src/router/**` | 路由守卫、动态路由注册 |
| `src/plugins/**` | 插件初始化 |
| `src/main.ts`、`src/App.vue` | 应用入口 |
| `*.spec.ts` | 测试用例 |

## 3. 6 个违规文件的重构

每个文件统一改 3 步：
1. `import { useRouter } from 'vue-router'` → `import { useAppRouter } from '@composables/useAppRouter'`
2. `const router = useRouter()` → `const { router, pushByName, pushWithTitle, back } = useAppRouter()`（按需解构）
3. `router.push(...)` / `router.replace(...)` / `router.back(...)` → 优先用封装方法（`pushByName`/`pushWithTitle`/`back`），无法替换的保留 `router` 实例直接调用

| 文件 | 改动量 | 备注 |
|------|--------|------|
| `src/components/layout/Sidebar.vue` | ≤10 行 | 菜单跳转 → pushByName |
| `src/components/common/TagsView/index.vue` | ≤10 行 | 标签页跳转 → pushByName |
| `src/modules/home/views/components/OverviewCard.vue` | ≤10 行 | 卡片点击 → pushByName |
| `src/modules/auth/views/Login.vue` | ≤10 行 | 登录后跳转 → pushByName + goLogin |
| `src/modules/demo/layouts/DocLayout.vue` | ≤10 行 | 文档页组织 → pushByName |
| `src/modules/demo/components/DemoFrame.vue` | ≤10 行 | iframe src 同步 → pushByName |

> **总计**：6 个文件 × ≤10 行 = ≤60 行变更

## 4. 文件改动清单

| 类别 | 文件 | 改动 |
|------|------|------|
| 配置 | `eslint.config.mjs` | + 25 行 |
| 重构 | `src/components/layout/Sidebar.vue` | useRouter → useAppRouter |
| 重构 | `src/components/common/TagsView/index.vue` | useRouter → useAppRouter |
| 重构 | `src/modules/home/views/components/OverviewCard.vue` | useRouter → useAppRouter |
| 重构 | `src/modules/auth/views/Login.vue` | useRouter → useAppRouter |
| 重构 | `src/modules/demo/layouts/DocLayout.vue` | useRouter → useAppRouter |
| 重构 | `src/modules/demo/components/DemoFrame.vue` | useRouter → useAppRouter |
| 文档 | `docs/10-新手指引.md` | 新增"封装工具使用规范"小节 |
| 文档 | `docs/18-代码组织决策表.md` | 补"何时强制使用封装"行 |
| 文档 | `CHANGELOG.md` | 记录本次新增 |

## 5. 测试方案

| 验证项 | 命令 | 预期结果 |
|--------|------|----------|
| 6 个文件改完后规则零警告 | `pnpm lint` | 0 error，0 warning |
| 白名单生效（composables 内部调 useRouter 不报警） | `pnpm lint src/composables/` | 0 warning |
| 故意写违规代码 → 规则触发 | 新增 1 个 `import { useRouter } from 'vue-router'` 的临时文件 → pnpm lint | 1 warning，提示文案正确 |
| 既有 `useAppRouter.spec.ts` 全部通过 | `pnpm test run` | 通过 |
| type-check 仍然通过 | `pnpm type-check` | 通过 |

## 6. 风险与回滚

| 风险 | 概率 | 缓解措施 |
|------|------|----------|
| 配置写错误伤 `src/composables/` 内部 | 低 | `files` 字段已限定目录范围 |
| 6 个文件重构引入运行时 bug | 低 | 改动都是命名替换 + 已有封装方法；变更后跑 `pnpm test` |
| 警告淹没真实错误 | 低 | 仅 2 条规则、文本明确，IDE 易于过滤 |
| 误伤路径未覆盖 | 中 | 跑 `pnpm lint` 后人工 review 全部输出 |

**回滚方案**：
- 本次不 commit 任何改动，全部在 worktree 内
- 验证不通过 → 丢弃 worktree
- 部分通过 → 暂存已通过的改动、未通过的继续迭代

## 7. 不在范围内（明确不做）

- ❌ 自动修复（useRouter → useAppRouter 需要语义重写，无法机械替换）
- ❌ 限制 useAuth/useTheme/useDict（封装薄、收益小）
- ❌ 自定义 ESLint 插件（增加维护成本）
- ❌ 限制 `import { ref } from 'vue'` 等基础 API（这是 Vue 3 标配）
- ❌ 拦截未通过 `@api/_http` 的"间接 axios 调用"（AST 检测能力复杂，收益低）

## 8. 参考资料

- ESLint flat config: https://eslint.org/docs/latest/use/configure/configuration-files
- no-restricted-imports: https://eslint.org/docs/latest/rules/no-restricted-imports
- 项目现有 `eslint.config.mjs`：见 `D:\personal\github\vue3工程模板\vue3-vite-project\eslint.config.mjs`
- `useAppRouter` 实现：见 `src/composables/useAppRouter.ts`

---

> **2026-08-19 架构变更**：本文档中提到的 `src/components/layout/Sidebar.vue` 已迁移至 `src/layouts/default/components/`（layout 自包含重构）。详见 `CHANGELOG.md`「♻ Refactor | 重构」分组。
