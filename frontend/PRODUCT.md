# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **主要用户**：仓库所有者本人（单人维护）。本仓库是他各项目的工程起点与能力沉淀池，功能默认服务自己的真实项目。
- **次要受众**：fork / 借鉴代码的同行，以及 GitHub Pages 在线 demo 的访客。代码公开供参考、demo 在线可玩，但**不承诺模板级支持**（无 npm 包发布、无社区运营，issue 可提响应不保证）——见 docs/45-仓库定位声明。

## Product Purpose

一个 Feature-Sliced 风格的企业中后台门户前端 Monorepo 工程底座：一套代码仓拆为 6 个独立应用 + 4 个共享包，覆盖**中后台管理、门户企业官网、H5 移动端、数据大屏**四种面板（"四栖"），内置统一登录、完整 mock 联调、CI 门禁与文档体系。

成功意味着：所有者开新项目时开箱即用；6 应用一键起、门禁全绿；demo 在线可玩且门面诚实。

## Positioning

邻近产品无法真实复制的组合（据 docs/43、docs/45、docs/48 推导）：

- **四栖一体**：单个 Monorepo 同时交付中后台 / 门户 / H5 / 大屏 / 组件文档 / 统一登录 6 个应用，共享包源码直链消费，而非"一个模板打天下"。
- **无后端即可联调**：vite-plugin-mock 双接线 + zod 契约单源，clone 下来即可完整跑通业务流程。
- **统一登录整页跳转协议**：cookie 同域漫游 + 白名单公开路由，多应用会话一致性是底座级能力。
- **治理即代码**：路由 / 别名 / mock 接线 / 文档硬数据一致性全部 CI 机械拦截，不靠人自觉。

## Operating Context

- **运行环境**：pnpm workspace + turbo@2 拓扑编排；本地经 node 网关 :8080 同域复现（`pnpm dev:gateway`）；生产 Docker + nginx 分离部署（`API_UPSTREAM` 反代真实后端）；gh-pages 六应用聚合发布。
- **版本策略**：vue 3.6.0-beta.17 精确钉版（2027-01-31 前回稳定线）；对外 semver 以根 package.json + git tag 为唯一事实源；fork 升级见 docs/36。
- **文档体系**：docs/01–49 专题文档 + 16 个层级化 AGENTS.md 目录导航；`check:doc-currency` 冻结 docs/ 根级文档数。
- **评审仪式**：/autoplan 多视角计划审查、XForm/ProTable 等组件深度审查；门禁退役走 §2.6 治理准则。

## Capabilities and Constraints

- **6 应用 × 4 包拓扑**：apps/admin（中后台，Operate）、apps/portal（门户官网，showroom）、apps/h5（移动端，rem 适配）、apps/big（数据大屏，scale 适配）、apps/docs（组件示例文档，Read）、apps/auth（统一登录）+ packages/config|mock|shared|ui。
- **依赖方向铁律**：apps → packages 单向；packages 内部 config ∥ shared → mock → ui；运行时依赖一律 peerDependencies + catalog；ESLint error 级机械拦截越界。
- **工作区架构锁定**：未经任务内明确批准，禁止增删 / 移动 / 重命名 app、包、根一级目录或各 app `src/` 一级目录；vite.config / turbo.json / pnpm-workspace.yaml 等解析相关配置锁定。
- **视觉事实分工**：运行时主题（明暗 / 主色换肤）走 Element Plus 变量体系（docs/06）；不经 EP 的自有视觉 token（四栖固定色板 / 字号阶梯 / 间距）锚定根目录 DESIGN.md，新增先登记再使用。
- **样式分层五层架构**：tokens / 公共 / 端级 / 布局 / 组件，z-index 分层强约束，EP 覆盖三级形态，见 docs/49。
- **组件规范**：.vue 强制 BEM（createNamespace + `vv` 前缀 + 无 scoped + scss）；全局组件经 unplugin-vue-components 自动注册，禁止显式 import；packages/* 生产源码一律显式 import。
- **业务封装**：路由跳转 useAppRouter、请求 useRequest、权限 useAuth、弹窗 useDialog、确认 useConfirm——前两条 ESLint 机械拦截。
- **认证模式**：httpOnly cookie，前端不可读凭证，`Session.get('auth')` 仅为守卫同步标记；公开访问唯一机制是按 name 加 ROUTE_WHITE_LIST。
- **未决定**：产品级无障碍标准未确认（仓库有 vitest-axe 依赖但未建立验收基线）。

## Brand Commitments

- **无品牌约束，视觉自由**（用户 2026-11-02 确认）：无 logo 资产、无对外主色 / 名称承诺，未来视觉工作可自由定方向。
- **门面即承诺**：README 定位声明、badges、issue 模板、GitHub Pages 在线 demo 是对外既有事实（docs/45），视觉迭代不得破坏门面诚实性。
- **开源 MIT**；commit message 中文、约定式前缀、零 AI 协作痕迹（husky + commitlint 三层防线）。

## Evidence on Hand

- **真实资产**：代码库本身（6 app 全链路可跑）；docs/01–49 专题文档；CHANGELOG.md；DESIGN.md 四栖视觉 token 锚点；gh-pages 在线 demo；CI 全绿历史。
- **不存在、未来工作不得虚构**：真实客户案例与证言、企业真实文案与联系方式、logo / 品牌指南、性能基准实测数字、npm 下载量等市场数据。

## Product Principles

1. **结构即契约**：架构与目录锁定，任何结构变更须任务内明确批准——稳定压倒灵活。
2. **治理零人工税**：门禁只拦代码事实漂移，需人类自觉维护的台账一律拒绝。
3. **功能默认服务自己**：底座优先满足所有者真实项目；公开门面保持诚实，不假装模板生意。
4. **可 Mock 优先**：不启动后端即可完整联调是底线能力，新功能必须可在 mock 下跑通。
5. **文档与代码同源**：硬数据一致性 CI 拦截，语义级一致性以 DESIGN.md / AGENTS.md 为判定基准。

## Accessibility & Inclusion

产品级无障碍标准未确认（未决事实，非结论）。仓库已具备 vitest-axe 工具链，但无验收基线；后续如确认目标标准（如 WCAG 2.1 AA）需在此登记。
