# Home + Portal 重构为简约企业官网 — 设计文档

> **日期**：2026-10-20 | **状态**：已获用户批准（brainstorming 口头确认） | **分支**：feature/engine-optimization
>
> **一句话**：丢弃现有门户首页与 portal 布局全部内容，重构为「虚构科技公司 · 星澜科技」的黑白极简企业官网（纯静态、锚点滚动、全 SVG 素材）。

---

## 1. 背景与目标

### 1.1 现状问题

- `/home` 门户首页（hero 搜索 + 时间问候 + 5 卡数据总览 + AI 助手 + 页脚）视觉陈旧、信息架构是「政务工作台」形态，作为模板门面展示效果差
- portal 布局依赖 3 张位图（`layout-head-bg.png` 1920×180 / `logo.png` 671×80 / `biaoyu.png` 252×80），头部高达 180px，风格与「现代简约」背道而驰
- home 模块拖着一条完整数据链路（mock → api → store → 三态组件 + 3 份单测），为演示而生、无真实业务价值

### 1.2 目标

| 维度 | 目标 |
|------|------|
| 视觉 | 黑白极简（无彩色、纯排版驱动），简约高级感 |
| 结构 | 3-4 屏精简官网：Hero + 特性/数据 + 关于联系 + 页脚 |
| 工程 | 彻底删除旧数据链路（不留死代码），文档同步 |
| 交互 | 锚点平滑滚动；未登录显示「登录」入口，已登录显示用户菜单 |

### 1.3 非目标（YAGNI）

- 不做 i18n（文案集中在 config，路由 meta.titleKey 行为保留）
- 不做数字滚动/GSAP 等动效依赖（仅 Hero 纯 CSS 入场动画）
- 不做多路由子页面（产品/解决方案不是独立路由）
- 不做注册页（「免费试用」复用 `/login`）

---

## 2. 需求决策记录（brainstorming 产出）

| # | 决策点 | 结论 |
|---|--------|------|
| 1 | 企业主题 | 虚构科技公司「星澜科技」（云端数据平台） |
| 2 | 页面结构 | C · 精简三屏：Hero / 特性+数据 / 关于联系 / 页脚 |
| 3 | 视觉风格 | C · 黑白极简（事件流显示用户在 A 浅色蓝 与 C 之间对比后定 C） |
| 4 | 导航交互 | 锚点滚动 + 「登录」按钮（已登录 → 用户菜单，保留 useLogout） |
| 5 | 素材方案 | 全 SVG 手绘（unplugin-icons 线性图标 + 自绘线条插画），零外链图片 |
| 6 | 丢弃力度 | 彻底物理删除旧组件/store/单测/API/mock + 同步活跃文档 |

## 3. 实现结构方案

**选定方案 A**：官网区块全部归入 `home` 模块；`portal` 布局只留「壳 + 简约 Header」。

| 备选 | 否决理由 |
|------|----------|
| B · 新建 marketing 模块 | 过度设计；home 模块被掏空成空壳 |
| C · 区块写进 layouts/portal | 违反 §2.1 #6「layouts 不放置业务内容」 |

---

## 4. 信息架构

```text
/home（portal layout · 公开可访问）
├── PortalHeader（sticky 白底细线）
│   ├── 左：SVG logo + 字标「星澜科技」 → 锚 #hero
│   ├── 中：锚点导航 首页/产品/数据/关于
│   └── 右：未登录「登录」按钮 | 已登录用户菜单（退出）
├── <main> home 模块视图
│   ├── SiteHero      #hero   kicker + 大标题 + 副文案 + 双按钮 + 右侧产品示意图 SVG
│   ├── SiteFeatures  #features  3 特性卡（线性图标 + 标题 + 一句描述）
│   ├── SiteStats     #stats     4 项数据指标条（静态数字）
│   ├── SiteAbout     #about     公司简介 + 邮箱/地址/电话
│   └── SiteFooter            品牌行 + 链接组 + 备案占位
└── 屏高：Hero min-height 100vh-header；其余区块 padding 96px 0
```

锚点导航 `scrollIntoView({ behavior: 'smooth' })`；各区块 `scroll-margin-top` = header 高度，抵消 sticky 遮挡。

## 5. 视觉规范（黑白极简 token）

`src/layouts/portal/styles/portal-tokens.scss` 重写为：

```scss
:root {
  --portal-header-h: 64px;      // sticky 顶栏
  --portal-max-width: 1200px;   // 内容宽
  --portal-ink: #111111;        // 主文字
  --portal-ink-2: #555555;      // 次要文字
  --portal-line: #eeeeee;       // 1px 细线
  --portal-bg: #ffffff;         // 页面底
  --portal-bg-alt: #fafafa;     // 分区底（特性/数据区）
  --portal-z-index-header: 1000;
}
```

- 层级手段：字重（400/600/700）+ 留白 + 1px 细线；**禁止**彩色、阴影堆叠、大圆角
- 字体：系统栈；Hero 标题 clamp(36px, 5vw, 56px)
- 动效：仅 Hero 元素入场（fade-up，CSS animation，≤0.6s）

## 6. 组件设计

### 6.1 home 模块（全部只读 config，无请求无三态）

`src/modules/home/config/site.ts` 单源文案/数据：

```ts
export const SITE_BRAND = { name: '星澜科技', nameEn: 'Xinglan Tech' } as const
export const SITE_HERO = {
  kicker: 'CLOUD DATA PLATFORM',
  title: ['让数据成为', '企业增长的引擎'],
  subtitle: '一站式云端数据平台，助力企业快速构建智能应用',
  primaryCta: { label: '免费试用', to: '/login' },
  secondaryCta: { label: '预约演示', to: '/login' }, // 无注册页，均跳登录
} as const
export const SITE_FEATURES = [
  // icon 为呈现细节：组件内静态 <i-tabler-*> 标签（编译期解析，vitest 安全），不进 config
  { title: '实时分析引擎', desc: '毫秒级查询响应，支撑百万级 QPS 实时看板' },
  { title: '企业级安全', desc: '端到端加密与细粒度权限，满足合规审计要求' },
  { title: '云原生架构', desc: '弹性伸缩，开箱即用，分钟级完成集群部署' },
] as const
export const SITE_STATS = [
  { value: '99.99%', label: '服务可用性' },
  { value: '10ms', label: '平均查询延迟' },
  { value: '5000+', label: '服务企业客户' },
  { value: '100万+', label: '日均处理请求' },
] as const
export const SITE_ABOUT = { intro: '...', email: '...', address: '...', phone: '...' } as const
export const SITE_FOOTER = { links: [...], icp: '京ICP备XXXXXXXX号' } as const
```

> 具体文案实施时定稿；结构以本表为准。

| 组件 | 职责 | 行数预算 |
|------|------|---------|
| `views/index.vue` | 组合 5 区块 + SEO 注释 | ≤60 |
| `components/SiteHero.vue` | Hero（含内联 SVG 产品示意图） | ≤200 |
| `components/SiteFeatures.vue` | 3 特性卡 | ≤120 |
| `components/SiteStats.vue` | 4 数字指标条 | ≤100 |
| `components/SiteAbout.vue` | 简介 + 联系 | ≤120 |
| `components/SiteFooter.vue` | 页脚 | ≤100 |

SVG 示意图：Hero 右侧一张线条风格「数据面板」SVG（折线 + 柱状 + 网格，stroke 单色 #111/#555），自绘内联于 SiteHero，不做独立文件（仅一处使用）。

### 6.2 Portal Header 改造

`PortalHeader.vue` 重写（保留 `useUserStore` + `useLogout`）：

- 未登录：`登录` 按钮（border 1px #111，hover 反白）→ `router.push('/login')`
- 已登录：用户菜单（el-dropdown 复用，`confirmLogout` 退出流程不变）
- A11y 语义保留：`<header role="banner">`、导航 `aria-label="主导航"`、锚点链接为真实 `<a href="#features">`

`PortalNav.vue` 重写：弃用 el-menu（其激活态/弹出层均为后台管理范式），改为渲染 `nav.ts` 锚点数组的普通链接列表；当前区块高亮用 `IntersectionObserver` scroll-spy（rootMargin 顶部偏移 header 高度）。

`config/nav.ts` 重写：

```ts
export const PORTAL_NAV: PortalNavItem[] = [
  { key: 'hero', label: '首页', anchor: '#hero' },
  { key: 'features', label: '产品', anchor: '#features' },
  { key: 'stats', label: '数据', anchor: '#stats' },
  { key: 'about', label: '关于', anchor: '#about' },
]
```

`config/types.ts` 同步收窄为 `{ key, label, anchor }`。

`layouts/portal/index.vue`：注释随内容更新（不再提「数据总览/AI 助手」），结构不变。

## 7. 路由变更

**公开访问机制 = 白名单（`src/router/whitelist.ts` 追加 `'Home'`）**。

> 重要事实核查（2026-10-20）：`router/guards/login.ts` 的 `checkLoginState` **不读 `meta.requiresAuth`**——非白名单路由一律要求登录。`meta.requiresAuth` 仅是 meta 类型上的声明（无守卫消费）。因此官网公开的正确做法是按 name 加入 `ROUTE_WHITE_LIST`（白名单同时跳过远程菜单加载与权限检查，公开页正需要）。

`src/modules/home/routes/index.ts`：

- 删除 `meta.requiresAuth: true`（该字段无守卫消费，留着是误导；公开性由白名单承担）
- `noTags: true` 保留；`title/titleKey/icon` 保留
- 文件头注释更新（不再是工作台首页；注明公开访问由 ROUTE_WHITE_LIST 承担）

## 8. 文件变更清单

### 8.1 删除（38 项）

**home 模块（33）**：
`components/` 下 DateGreeting / HeroSection / HomeAiWidget / HomeFooter / HotSearchTags / NoticePanel / OverviewCard / OverviewCardSkeleton / OverviewEmptyState / OverviewErrorState / OverviewMetricRow / OverviewSection / SearchBar 共 13 个 .vue + OverviewSection.spec.ts + SearchBar.spec.ts 2 份单测；`config/` footer.ts + hero.ts + types.ts；`store/` portal-overview.ts + portal-overview.spec.ts + index.ts；`types/portal-overview.ts`；`images/` 全部 11 张 png（avatar-male / data-overview-01~05 / hero-banner / home-head-bg / rest-time / robot / user-avatar）

**数据链路（2）**：`src/api/modules/portal-overview.ts`、`mock/portal-overview.ts`

**portal 位图（3）**：`images/logo.png`、`biaoyu.png`、`layout-head-bg.png`

### 8.2 修改（9 项）

| 文件 | 变更 |
|------|------|
| `src/modules/home/views/index.vue` | 重写为 5 区块组合 |
| `src/modules/home/routes/index.ts` | 删 requiresAuth（无守卫消费）+ 注释 |
| `src/router/whitelist.ts` | `ROUTE_WHITE_LIST` 追加 `'Home'`（官网公开访问） |
| `src/modules/home/index.ts` | 删除 useHomeStore re-export（无外部消费方，barrel 清空为纯注释说明） |
| `src/layouts/portal/components/PortalHeader.vue` | 重写（简约白底 + 登录/用户双态） |
| `src/layouts/portal/components/PortalNav.vue` | 重写（锚点链接列表 + scroll-spy） |
| `src/layouts/portal/config/nav.ts` / `types.ts` | 重写为锚点模型 |
| `src/layouts/portal/styles/portal-tokens.scss` | 重写为黑白极简 token |
| `src/layouts/portal/index.vue` | 注释更新 |

### 8.3 新增（7）

`views/index.spec.ts`、`components/Site{Hero,Features,Stats,About,Footer}.vue`、`config/site.ts`

### 8.4 文档同步（6）

| 文档 | 位置 | 动作 |
|------|------|------|
| `docs/04-构建与测试工具.md` | §测试清单 line 613 | 删 3 条旧 spec，视情况补 index.spec.ts 条目 |
| `docs/05-BEM样式规范.md` | BEM 表 line 159-160 | 删 HomeFooter / OverviewCardSkeleton 2 行，补新组件行 |
| `docs/18-代码组织决策表.md` | 目录树 line 180 | 删 portal-overview.ts |
| `docs/22-mock使用规范.md` | mock 列表 line 32 | 删 portal-overview 行 |
| `docs/33-pnpm-dev与dev-local模式对比.md` | mock 表 line 337 | 删 portal-overview 行 |
| `README.md` | line 297 mock 列表 + line 388 mock 表 | 删 portal-overview 两处 |
| `CHANGELOG.md` | 顶部 | 新增本次重构条目 |

> `docs/audit/`、`docs/archive/` 为历史记录，**刻意不改动**。

## 9. 测试策略

| 测试 | 范围 |
|------|------|
| `home/views/index.spec.ts`（新增） | smoke：5 区块标题渲染、锚点 id 存在 |
| `PortalHeader.spec.ts`（重写） | 未登录→登录按钮跳 /login；已登录→用户菜单渲染；锚点导航点击触发 scroll（jsdom 中断言 scrollIntoView 调用） |
| 回归 | `pnpm test` 全量（删 3 份 spec 后总量下降，覆盖率不因此泛红——被删代码同步移除） |
| 校验链 | `pnpm check:routes` → `type-check:full` → `lint` → `pnpm test` |

浏览器 CDP 实测（验收时）：首屏视觉、锚点平滑滚动、登录跳转、已登录用户菜单、1440/768 两档断点无横向滚动。

## 10. 验收标准

1. `/home` 未登录可直接访问（不再被守卫踢到 /login）
2. 首屏为黑白极简 Hero，无彩色、无位图、无 404 资源
3. 4 个锚点点击均平滑滚动且滚动后当前导航项高亮正确
4. 旧 portal-overview 数据链路在 src/ 与 mock/ 中零残留（grep 验证）
5. §8.4 六处文档同步完成，`pnpm check:doc-currency` 通过
6. 全量校验链绿灯

## 11. 风险与对策

| 风险 | 对策 |
|------|------|
| 远程菜单模式（`pnpm dev`）后端菜单覆盖本地路由 | 官网场景与远程菜单无关；`requiresAuth:false` 不影响菜单加载逻辑，已确认 `router/guards/remote-menu.ts` 不消费 home 组件 |
| 删除 `mock/portal-overview.ts` 影响 `vite-plugin-mock` 启动 | mock 为按文件扫描，删文件即下线，无需配置变更（docs/22 机制） |
| `check:doc-currency` 硬数据校验 | §8.4 同步后跑 `pnpm check:doc-currency` 兜底 |
| 用户中途想要彩色版本 | token 集中于 portal-tokens.scss + site.ts，改主色成本极低（本次仍为黑白） |
