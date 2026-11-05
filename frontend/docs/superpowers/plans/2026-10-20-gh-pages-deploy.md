# gh-pages 自动化部署 Implementation Plan

> **⚠️ 终态指针（2026-10-20 实施终态）**：本 plan 为过程快照，部分 Task 描述已被实施取代——终态方案 = client 侧 `createProdMockServer`（非 viteMockServe prodEnabled）+ `build-only` → `type-check:full` 顺序 + `use(router)` 前顶层 await 挂接。**准确描述以 [docs/40-GitHubPages自动部署.md](../../40-GitHubPages自动部署.md) 为准**，本 plan 保留作执行时间线追溯。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** push 到 `master` 时通过 GitHub Actions 自动构建（hash 路由 + local 菜单 + mock 生产注入 + 子路径 base）并部署到 GitHub Pages。

**Architecture:** 新增 `.github/workflows/deploy.yml`（官方 `upload-pages-artifact` + `deploy-pages`）；`vite.config.ts` 的 `viteMockServe` 增加 `prodEnabled`（CI 构建时 `VITE_USE_MOCK=true` 让 mock 拦截注入生产产物）；同步 CHANGELOG。设计文档：`docs/superpowers/specs/2026-10-20-gh-pages-deploy-design.md`。

**Tech Stack:** GitHub Actions（pages: write + id-token: write）、viteMockServe prodEnabled、pnpm 12 + Node 24.12.0（与 ci.yml 对齐）

---

### Task 1（修订版）: mock 生产接线（createProdMockServer 手动接线）+ 双场景构建验证

**Files:**
- Create: `mock/mockProdServer.ts`
- Modify: `src/main.ts`（入口挂接，mount 前 +4 行）

**修订背景**：初版 prodEnabled 方案作废——`vite-plugin-mock@3.0.2` 无此选项（2.9.x 旧版特性，3.0.0 起重写为纯 dev-server 插件）。改为 3.0.2 官方 client 侧接线，详见 spec §4.2 作废记录。`vite.config.ts` **无需改动**。mock 特征字符串 `/api/user/list` 来自 `mock/user.ts:9`，作为产物验证探针。

- [ ] **Step 1: 新增 `mock/mockProdServer.ts`**

```ts
/**
 * 生产环境 mock 接线（gh-pages 纯静态托管用）。
 *
 * vite-plugin-mock@3.0.2 为纯 dev-server 插件（2.9.x 的 prodEnabled 已移除），
 * 生产构建需经 client 侧 createProdMockServer 手动注册——浏览器端 mockjs 劫持 XHR，
 * 使无后端的静态产物具备完整 demo 数据。
 *
 * 挂接点：src/main.ts 条件分支（仅 VITE_USE_MOCK==='true' 的动态 import），
 * 常规生产构建（'false'）整分支被 tree-shake，产物不含 mock。
 *
 * 模块清单说明：仅含 5 个真实 mock 路由模块（mock/ 目录全部 url: '/api/*' 定义处）。
 * mock/index.ts 只聚合 auth/user/menu；pro-table/ 下 11 个文件是具名导出
 * xxxRequestApi（ProTableRequestApi 组件直连数据源，无 XHR 依赖），无需接线。
 * @see src/main.ts 入口挂接
 */
import type { MockMethod } from 'vite-plugin-mock'
import { createProdMockServer } from 'vite-plugin-mock/client'

import auth from './auth'
import dict from './dict'
import menu from './menu'
import portalOverview from './portal-overview'
import user from './user'

/** 全量 mock 路由清单（与 mock/ 目录全部 url: '/api/*' 定义一一对应） */
const mockModules: MockMethod[] = [...auth, ...dict, ...menu, ...portalOverview, ...user]

/**
 * 注册生产 mock（浏览器端 mockjs XHR 劫持）。
 * 仅在 VITE_USE_MOCK==='true' 的产物中由 main.ts 调用；
 * createProdMockServer 为 async（内部动态 import mockjs），此处 fire-and-forget，
 * 劫持在 mockjs 加载完成后生效，应用 mount 后的业务请求即可被拦截。
 */
export function setupProdMockServer(): void {
  void createProdMockServer(mockModules)
}
```

- [ ] **Step 2: 修改 `src/main.ts` 挂接（先 Read 确认现有结构）**

先 `Read src/main.ts`，找到 `createApp(...).mount(...)` 调用点。在 `mount` **之前**插入（顶部 import 区域之后的任意语句级位置，保持 import 置顶）：

```ts
// VITE_USE_MOCK==='true' 时（CI 构建 gh-pages 产物）动态挂接浏览器端 mock；
// 常规生产构建静态比较为 false，整分支 tree-shake，产物不含 mock
if (import.meta.env.VITE_USE_MOCK === 'true') {
  const { setupProdMockServer } = await import('../mock/mockProdServer')
  setupProdMockServer()
}
```

注意：
- 使用**顶层 await**（main.ts 为 ESM 入口，Vite 构建 target es2022 支持）；若 main.ts 已有顶层 await 先例则保持一致写法
- 动态 import 路径用相对路径 `../mock/mockProdServer`（mock/ 不在 src/ 内，无 alias 可用）
- 除该挂接块外**不得改动 main.ts 其他任何内容**

- [ ] **Step 3: 场景 A 验证——常规生产构建不含 mock（兼容性回归）**

Run: `pnpm build-only && grep -r "/api/user/list" dist/ ; echo "exit=$?"`
Expected: `exit=1`（grep 无匹配，dist 产物不含 mock 字符串——与现状一致）

- [ ] **Step 4: 场景 B 验证——VITE_USE_MOCK=true 构建含 mock（新行为）**

Run: `cross-env VITE_USE_MOCK=true pnpm build-only && grep -rl "/api/user/list" dist/ | head -5`
Expected: 命中至少 1 个 js 文件（mock 已注入生产产物）

- [ ] **Step 5: 类型校验**

Run: `pnpm type-check:full`
Expected: PASS（`vite-plugin-mock/client` 的导出映射与 `MockMethod` 类型均在包内验证过）

- [ ] **Step 6: Commit**

```bash
git add mock/mockProdServer.ts src/main.ts docs/superpowers/specs/2026-10-20-gh-pages-deploy-design.md
git commit -m "feat(build): mock 生产接线 createProdMockServer，CI 可注入 mock 到静态产物

vite-plugin-mock@3.0.2 无 prodEnabled（2.9.x 旧版特性），
改 client 侧手动接线：全量 16 个 mock 模块 + main.ts 条件动态 import。
常规生产构建（VITE_USE_MOCK=false）tree-shake 掉整个分支，产物体积不变。
spec §4.2 同步修订（prodEnabled 方案作废记录）。"
```

（spec 修订文件随本 commit 一并提交，保持文档与实现同 commit）

---

### Task 2: 新增 GitHub Pages 部署 workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: 写入 deploy.yml**

```yaml
name: Deploy to GitHub Pages

# 触发条件：push 到 master 自动部署（与 ci.yml 触发分支对齐）+ 手动兜底
on:
  push:
    branches: [master]
  workflow_dispatch:

permissions:
  pages: write
  id-token: write

# 取消同 branch 上的旧 workflow（与 ci.yml 同策略）
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

env:
  VITE_BASE: /vue3-vite-project/ # vue-router basename（src/router/config.ts 消费）
  VITE_HISTORY_MODE: hash # gh-pages 无 SPA fallback，hash 模式刷新/深层链接不 404
  VITE_MENU_SOURCE: local # 纯静态托管无后端，菜单走本地静态路由
  VITE_USE_MOCK: 'true' # node 侧：viteMockServe enable + prodEnabled 均消费

jobs:
  deploy:
    name: Build + Deploy
    runs-on: ubuntu-latest
    timeout-minutes: 15
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 12

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '24.12.0'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Type check (full)
        # --force 强制重建 .tsbuildinfo 防缓存陈旧（与 ci.yml 一致）
        run: pnpm type-check:full

      - name: Build
        # vite 静态资源 base 走 CLI；vue-router basename 由 env.VITE_BASE 供客户端消费
        run: pnpm build-only --base=/vue3-vite-project/

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist/

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: YAML 语法校验（prettier，lint-staged 同款）**

Run: `pnpm prettier --check .github/workflows/deploy.yml`
Expected: 无报错（prettier 能解析即 YAML 语法合法，且格式符合项目 lint-staged 钩子要求）

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: 新增 GitHub Pages 自动部署 workflow（push master 触发）"
```

---

### Task 3: 同步 CHANGELOG.md

**Files:**
- Modify: `CHANGELOG.md:5-6`（`## 未发布` 段首插入新条目）

- [ ] **Step 1: 在 `## 未发布` 下新增条目**

在 `## 未发布` 行之后、`### ✨ Feat | 团队级图标体系落地...` 之前插入：

```markdown
### 🚀 CI | gh-pages 自动化部署：push master 即发布线上 demo（2026-10-20）

> 设计文档：[docs/superpowers/specs/2026-10-20-gh-pages-deploy-design.md](docs/superpowers/specs/2026-10-20-gh-pages-deploy-design.md)。push 到 `master` 自动构建并部署到 `https://Mr-Super-X.github.io/vue3-vite-project/`（首次需在仓库 Settings → Pages 把 Source 设为 "GitHub Actions"）。

- **workflow**（`.github/workflows/deploy.yml`）：官方 `actions/upload-pages-artifact` + `actions/deploy-pages`（permissions 收敛 `pages: write` + `id-token: write`，无需 gh-pages 分支）；Node 24.12.0 + pnpm 12 与 ci.yml 对齐；跑 type-check:full + build（lint/test 由同次 push 的 ci.yml 门禁，职责单一不重复）
- **构建四开关**：`--base=/vue3-vite-project/`（vite 静态资源前缀）+ `VITE_BASE`（vue-router basename）+ `VITE_HISTORY_MODE=hash`（gh-pages 无 SPA fallback，刷新不 404）+ `VITE_MENU_SOURCE=local`（无后端走本地静态菜单）
- **mock 生产注入**：`viteMockServe.prodEnabled` 按 `VITE_USE_MOCK==='true'` 开启——CI 构建把 mock 拦截打进产物，gh-pages 上 ProTable/表单/图表等 demo 全功能可演示；常规生产构建不受影响（本地默认与 `.env.production` 均为 false，产物体积与现状一致）
```

- [ ] **Step 2: 格式校验**

Run: `pnpm prettier --check CHANGELOG.md`
Expected: 无报错

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: CHANGELOG 记录 gh-pages 自动化部署"
```

---

### Task 4: CI 构建本地端到端预演 + 手动验证清单

**Files:** 无改动（纯验证任务）

- [ ] **Step 1: 完整模拟 CI 构建**

Run: `cross-env VITE_USE_MOCK=true VITE_BASE=/vue3-vite-project/ VITE_HISTORY_MODE=hash VITE_MENU_SOURCE=local pnpm build-only --base=/vue3-vite-project/`
Expected: 构建成功

- [ ] **Step 2: 验证资源前缀与 mock 注入**

Run: `grep -o 'src="[^"]*"' dist/index.html | head -3 && grep -rl "/api/user/list" dist/ | head -3`
Expected: index.html 的 script 引用带 `/vue3-vite-project/` 前缀；dist 内有文件命中 mock 特征串

- [ ] **Step 3: preview 本地目检（手动，需用户参与）**

Run: `pnpm exec vite preview --base=/vue3-vite-project/`（preview 的 base 必须与构建时一致，否则产物资源引用 404）
浏览器访问 `http://localhost:4173/vue3-vite-project/`，逐项确认：
- 页面加载正常，静态资源无 404（DevTools Network）
- 侧边栏菜单完整（local 菜单生效）
- 打开 ProTable/UserList 等 demo 页面有 mock 数据
- URL 为 hash 形态（`/#/...`），刷新任意页面不 404

确认后 Ctrl+C 停掉 preview。

- [ ] **Step 4: 无需 commit**（本任务不产生文件变更）

---

## 上线后手动步骤（非本计划范围，交付时告知用户）

1. 仓库 **Settings → Pages → Source** 选 **"GitHub Actions"**（一次性前置条件）
2. 本分支合入 `master`（push 触发 deploy.yml；同次 push 的 ci.yml 并行跑门禁）
3. Actions 中确认 `Deploy to GitHub Pages` run 绿 → 访问 `https://Mr-Super-X.github.io/vue3-vite-project/`
