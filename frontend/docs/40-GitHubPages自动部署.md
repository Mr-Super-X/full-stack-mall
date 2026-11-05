# GitHub Pages 自动部署

> **文档版本**：v1.0.0 | **创建日期**：2026-10-20
> **覆盖范围**：gh-pages 线上 demo 的部署链路（workflow、构建开关、生产 mock 接线、演示模式、故障排查）
> **适用读者**：fork 本项目后想一键获得线上 demo 的维护者
> **配套文档**：`docs/22-mock使用规范.md` §15（生产 mock 接线细节）、`docs/superpowers/specs/2026-10-20-gh-pages-deploy-design.md`（设计稿）

---

## 1. 能力概述

push 到 `master` 分支即自动构建并部署到 `https://<org>.github.io/<repo>/`（本项目：`https://Mr-Super-X.github.io/vue3-vite-project/`），**无需 gh-pages 分支**——官方 `actions/upload-pages-artifact` + `actions/deploy-pages` 直连 Pages 服务。

| 维度   | 说明                                                                                                                                              |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 触发   | push 至 `master`（正式发布）+ push 至 `gh-pages`（2026-10-27 预览通道，未合入 master 前先在线验收）；job 级 `if` 双分支守卫 + `workflow_dispatch` |
| 产物   | `dist/` 静态文件（`pnpm build:pages` 六应用聚合，产物 `dist/<app>/` + 落地导航页）                                                                |
| 权限   | `contents:read` + `pages:write` + `id-token:write`（收敛最小集）                                                                                  |
| 工具链 | Node 24.12.0 + pnpm 12（与 `ci.yml` 对齐）                                                                                                        |

**首次启用（唯一一次手动）**：仓库 Settings → Pages → Source 选 "GitHub Actions"。选错 Source（如 Deploy from a branch）会导致部署 404，见 §6 排查。

---

## 2. 构建五开关 + 演示模式

gh-pages 是纯静态托管（无 node 中间件、无 SPA fallback），`deploy.yml` 通过环境变量把产物切成「可演示形态」：

| 环境变量            | 值                                            | 作用                                                                                                                       |
| ------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `VITE_HISTORY_MODE` | `hash`                                        | gh-pages 无 SPA fallback——history 模式下刷新/深层链接会 404；hash 模式由前端路由自己承载                                   |
| `VITE_MENU_SOURCE`  | `local`                                       | 纯静态托管无后端，菜单走本地静态路由（remote 模式的 `/api/menu` 无人应答）                                                 |
| `VITE_USE_MOCK`     | `true`                                        | 生产客户端 mock 开关——`packages/mock/src/mockProdServer.ts` 经 `createProdMockServer` 在浏览器端接线（细节见 docs/22 §15） |
| `VITE_DEMO_NO_AUTH` | `true`                                        | 演示模式：守卫跳过登录/权限校验，演示账号 Admin（admin/123456）全链路可点；按钮级 `v-auth` 仍按真实 permissions 渲染       |
| `VITE_BUILD_ID`     | `${{ github.sha }}-${{ github.run_attempt }}` | 版本检测 buildId 注入——git sha 使产物可追溯，拼 run_attempt 消「同 commit 重跑产生相同 buildId」                           |

> **base 与登录协议基址不在 env 声明**：两者均由 `scripts/build-pages.ts` 按 app 注入——
> `VITE_BASE` 由 `REPO_PREFIX`（默认 `/vue3-vite-project`）拼 `/vue3-vite-project/<app>/`；
> `VITE_AUTH_ORIGIN` 注入 `${REPO_PREFIX}/auth/#`（`#` 尾巴承载 auth 的 hash 路由形态，
> 退出登录/未登录跳才能拼出 Pages 可接住的 `/<repo>/auth/#/login`，否则三条协议线全 404）。
> 自定义域部署改脚本内 `REPO_PREFIX` 为 `/` 即可。

> 常规生产构建（自有服务器 + 真后端）**不要**照搬这五值——history 模式 + remote 菜单 + 真后端接口才是常规形态，见 README §部署。

---

## 3. Workflow 结构（`.github/workflows/deploy.yml`）

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [master, gh-pages] # gh-pages = 预览通道（2026-10-27）
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  deploy: # ← 单 job：build + pages + deploy 全步骤，无 needs
    name: Build + Deploy
    if: github.ref == 'refs/heads/master' || github.ref == 'refs/heads/gh-pages' # ← ref 守卫
    environment: github-pages # ← Environment 白名单，首次部署需在仓库 Settings → Environments 放行 master + gh-pages 分支
    steps:
      # actions/checkout@v4 + pnpm/action-setup@v4 + actions/setup-node@v4（Node 24.12.0 + pnpm 缓存）
      - run: pnpm install --frozen-lockfile
      - run: pnpm build:pages # 六应用聚合构建（scripts/build-pages.ts 自动发现 apps/*，base 按 REPO_PREFIX/<app>/ 注入）
      - uses: actions/upload-pages-artifact@v3 # path: dist/（6 app 子目录 + 落地页）
      - uses: actions/deploy-pages@v4
```

**顺序强约束（2026-10-20 修复，git e70da8e/777acab）**：`pnpm build` 内部是 `build-only` **先于** `type-check:full`——CI 干净环境下 unplugin 只在 build 时生成 `components.d.ts` / `auto-imports.d.ts`，先 type-check 会因类型声明缺失而失败。本地模拟 CI 构建同理（Git Bash 需 `MSYS2_ARG_CONV_EXCL='*'` 防 `--base` 参数被路径污染）。

---

## 4. 与 ci.yml 的职责划分

| Workflow     | 触发                       | 职责                                                                                                                                                                                                                  |
| ------------ | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci.yml`     | push/PR 至 master、develop | 质量门禁：lint + test:eslint-rules + test:check-scripts + test:gateway + turbo build/test（master 全量，PR affected）+ coverage gate + check:routes/aliases/doc-currency/mock-wiring + E2E（详见 docs/46-CI门禁速查） |
| `deploy.yml` | push 至 master / gh-pages  | 只构建 + 部署（不重复跑 lint/test——同次 push 的 ci.yml 已门禁，职责单一）                                                                                                                                             |

lint/test/check:routes 的失败不会阻塞 deploy（两条 workflow 独立），但同次 push 引入的失败会在 ci.yml 里标红——发布前应先看 ci.yml 结果。

---

## 5. 生产 mock 接线（线上 demo 有数据的关键）

gh-pages 静态托管没有 node 中间件，`vite-plugin-mock@3.0.2` 的 dev-server 形态在 prod 完全失效。方案：client 侧 `createProdMockServer` 手动接线。

```mermaid
flowchart TD
    A[push master] --> B[deploy.yml build job]
    B --> C[pnpm build:pages<br/>VITE_USE_MOCK=true 进产物]
    C --> D[upload-pages-artifact]
    D --> E[deploy-pages]
    E --> F[浏览器访问线上 demo]
    F --> G[apps/<a>/src/main.ts 检测 PROD + VITE_USE_MOCK]
    G --> H[use(router) 前 await<br/>setupProdMockServer]
    H --> I[mockjs 劫持 XHR<br/>login/profile/menu/user/dict 全通]
```

两个最容易踩的坑（均已根治，勿回退）：

1. **挂接时序**：`await setupProdMockServer()` 必须在 `createApp` 后、`app.use(router)` **前**。router install 即触发初始导航，晚于 use 则守卫请求穿透拦截窗口（打到 Pages 服务器返回 HTML）。「mount 前 await」不够——守卫链与 main.ts 后续语句并行。
2. **PROD 守卫**：挂接条件必须含 `import.meta.env.PROD`。`.env.development` 里 `VITE_USE_MOCK=true` 时若无此守卫，dev 的 node 中间件与 client 侧 mockjs 会双重劫持（auth 的 rawResponse 被 client 静默忽略 → dev 登录必挂）。

完整接线细节、新增 mock 模块的同步登记约定（@trigger）、auth/dict prod 内联原因：**docs/22 §15**。

---

## 6. 故障排查（按命中率排序）

| 症状                           | 根因                                                               | 解法                                                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 部署后全站 404                 | Pages Source 未绑定 GitHub Actions                                 | Settings → Pages → Source 选 "GitHub Actions"（见 §1）                                                                                          |
| 首次部署卡住等待批准           | `github-pages` Environment 白名单未初始化                          | 仓库 Settings → Environments → 批准首次部署（随默认分支初始化）                                                                                 |
| 部署成功但页面空白/资源 404    | 仓库名与 `REPO_PREFIX` 不一致，或本地构建时 Git Bash 污染 `--base` | 确认 `scripts/build-pages.ts` 的 `REPO_PREFIX`（默认 `/vue3-vite-project`，按 app 注入 `/<repo>/<app>/`）；本地模拟须 `MSYS2_ARG_CONV_EXCL='*'` |
| 刷新/深层链接 404              | 误用 history 模式                                                  | `VITE_HISTORY_MODE=hash`（gh-pages 无 SPA fallback）                                                                                            |
| 登录后立刻被弹回 / profile 401 | mock 挂接晚于 router install（拦截窗口穿透）                       | 确认 `apps/<a>/src/main.ts` 挂接块在 `use(router)` 前且顶层 await（§5.1）                                                                       |
| dev 模式登录必挂               | PROD 守卫缺失导致 dev 双重劫持                                     | 挂接条件必须是 `PROD && VITE_USE_MOCK==='true'`（§5.2）                                                                                         |
| 字典双 toast / 字典 400        | client wrapper 不支持路径参数，动态 `/api/dict/:code` 恒 undefined | 已由 `prodDictMocks` 静态展开根治（docs/22 §10）；回退检查 `mockProdServer.ts` 是否漏登记                                                       |

---

## 7. 本地预演（部署前验证）

演示正道是 `pnpm build:pages` 整包预演——与 deploy.yml 同链路（六应用聚合 + REPO_PREFIX base 注入），起任意静态服务器 serve `dist/` 即可（落地页 `dist/index.html` 可跳转各 app）：

```bash
pnpm build:pages   # 聚合构建，产物 dist/<app>/ + 落地页（Git Bash 无需 MSYS2_ARG_CONV_EXCL——env 经 spawn 注入不依赖 shell 展开）
```

单 app 快速预演（base 须带 app 子前缀 `/vue3-vite-project/<app>/`，与聚合口径一致）：

```bash
# Git Bash 用户必须带 MSYS2_ARG_CONV_EXCL，否则 --base 被转成 /Program Files/Git/...
MSYS2_ARG_CONV_EXCL='*' pnpm -C apps/admin build-only --base=/vue3-vite-project/admin/
pnpm -C apps/admin preview
```

`pnpm -C apps/admin preview` 起的是静态服务（无 dev 中间件），最接近 gh-pages 真实形态——登录、菜单、字典、ProTable 直连数据源都应工作。注意：preview 下 `VITE_USE_MOCK` 取自 `.env.production`，本地预演演示模式需在 `.env.production` 设 `VITE_USE_MOCK=true` + `VITE_DEMO_NO_AUTH=true`（勿提交该改动）。

---

## 🔗 相关文档

| 文档                                                          | 范围                                                                          |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `docs/22-mock使用规范.md` §15                                 | 生产 mock 接线完整规范（@trigger 登记约定 / auth·dict 内联原因 / 时序硬约束） |
| `docs/superpowers/specs/2026-10-20-gh-pages-deploy-design.md` | 设计稿（含被否决方案的记录）                                                  |
| `docs/superpowers/plans/2026-10-20-gh-pages-deploy.md`        | 实施计划（含连环修复时间线）                                                  |
| `README.md` §CI/CD                                            | workflow 速览表                                                               |
| `.github/workflows/deploy.yml` / `ci.yml`                     | 真实 workflow 源文件                                                          |

---

_文档版本：v1.0.0 | 创建日期：2026-10-20 | 配套项目版本：vue3-vite-project 1.0.0_
