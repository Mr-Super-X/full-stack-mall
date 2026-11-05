# Portal 首页 Layout 重构 — 设计说明

> 日期：2026-07-23
> 范围：新增 `src/layouts/portal/` 整个壳与 `src/modules/dashboard/views/home/` 整组首页视图；修改 1 处路由指向

## 一、目标与背景

### 现状问题

| #   | 问题                                                                                                | 位置                                          |
| --- | --------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 1   | 现有 default layout 是 admin 风格（深色侧边栏 + 顶部 + 多页签），与"政府门户首页"的视觉风格严重不符 | `src/layouts/default/index.vue:14-32`         |
| 2   | Header 仅显示用户名 + 退出按钮，无法承载"我的消息/待办/头像"信息卡                                  | `src/components/layout/Header.vue:14-22`      |
| 3   | Sidebar 仅显示标题 + 折叠按钮，无法承载横向顶部导航                                                 | `src/components/layout/Sidebar.vue:8-10`      |
| 4   | Dashboard 首页只有 3 张简单 el-card，没有"数据总览"等门户必备元素                                   | `src/modules/dashboard/views/Index.vue:15-31` |
| 5   | 缺少 AI 浮窗、热门搜索、问候语等门户组件                                                            | —                                             |
| 6   | 系统链接与版权没有结构化承载                                                                        | —                                             |

### 设计目标

1. **首页专属 portal layout**：新增 `PortalLayout` 给 `/dashboard` 用，与现有 admin layout 并存，互不干扰
2. **可复用**：未来 `/law-screen` / `/knowledge` 等门户页面可直接复用 PortalLayout，内容区由 `<RouterView/>` 决定
3. **数据 Mock + API 双通道**：5 张数据卡走 `usePortalOverviewStore`，通过 `VITE_USE_MOCK` 环境变量切换 mock/真接口
4. **配置驱动**：顶部导航、热门搜索、系统链接统一走 `src/portal/config/` 常量文件
5. **防御性 UI**：OverviewSection 显式处理 Loading / Error / Empty 三态
6. **类型契约前置**：所有 DTO 集中在 `types/portal-overview.ts`，禁止散落
7. **测试 ≥80%**：覆盖 store 状态机、API 双通道、组件三态渲染

### 非目标（明确不做）

- 不引入新的 UI 库（继续用 Element Plus）
- 不改造现有 default layout / Header / Sidebar / TagsView
- 不接入真实 AI 对话（仅占位 UI）
- 不改路由守卫、错误边界、全局状态

---

## 二、目标态架构

### 2.1 路由结构

```
/                  → redirect /dashboard          (rootRedirect)
/dashboard         → PortalLayout (新)
  ''               → home/Index.vue                (重命名后的首页)
/orders            → DefaultLayout (旧)
  ''               → orders/views/List.vue
/reports           → DefaultLayout (旧)
  ''               → reports/views/Index.vue
/login             → 不带 layout（独立页面）
*                  → 404 / 500 错误页
```

**双 layout 并存**：通过路由的 `component` 字段切换，业务子页零影响。

### 2.2 组件树

```
PortalLayout (src/layouts/portal/index.vue)
├─ PortalTopBar          顶部蓝 banner + 国徽 + 标题 + 标语
├─ PortalHeaderNav       横向导航（配置驱动）+ 用户信息卡
├─ <RouterView/>         内容区（由路由决定，本期为 home/Index）
├─ PortalFooter          系统链接 + 版权
└─ PortalAiWidget        fixed 浮窗（脱离文档流，bottom:24 right:24）

home/Index.vue
├─ HeroSection
│  ├─ HotSearchTags
│  └─ SearchBar
├─ DateGreeting
└─ OverviewSection
   └─ OverviewCard × 5
      └─ OverviewMetricRow × 3
```

### 2.3 数据流

```
home/Index.vue onMounted
  ↓
usePortalOverviewStore().fetch()
  ↓
portalOverviewApi.getOverview()
  ├─ VITE_USE_MOCK=true  → 200ms delay → 返回 api/mock/portal-overview.ts 静态数据
  └─ VITE_USE_MOCK=false → axios GET /api/portal/overview → 返回 DTO
  ↓
store.cards / store.loading / store.error
  ↓
OverviewSection 订阅 store → 渲染三态之一（Loading/Error/Empty/Normal）
```

---

## 三、模块设计

### 3.1 文件清单

#### 新增（26 个）

```
src/layouts/portal/
  index.vue                                 # 壳（flex column, ~50 行）
  components/
    PortalTopBar.vue                        # 顶部蓝 banner，~80 行
    PortalHeaderNav.vue                     # 横向导航 + 用户信息卡，~150 行
    PortalFooter.vue                        # 系统链接 + 版权，~120 行
    PortalAiWidget.vue                      # AI 浮窗，~60 行

src/modules/dashboard/views/home/
  Index.vue                                 # 页面容器（组合子组件），~80 行
  components/
    HeroSection.vue                         # 大标题 + 标语 + 搜索，~180 行
    HotSearchTags.vue                       # 热门搜索标签，~50 行
    SearchBar.vue                           # 搜索输入 + 选择器 + 按钮，~120 行
    DateGreeting.vue                        # 问候语 + 日期，~40 行
    OverviewSection.vue                     # 数据总览容器（三态分发），~120 行
    OverviewCard.vue                        # 单张数据卡片，~150 行
    OverviewCardSkeleton.vue                # 加载骨架，~30 行
    OverviewErrorState.vue                  # 错误态，~50 行
    OverviewEmptyState.vue                  # 空态，~40 行
    OverviewMetricRow.vue                   # 卡片内一行指标，~50 行

src/modules/dashboard/store/
  portal-overview.ts                        # Pinia store，~60 行（与现有 store/index.ts 同目录）
  portal-overview.spec.ts                   # store 测试，~80 行

src/modules/dashboard/types/
  portal-overview.ts                        # DTO 类型，~30 行（新建目录）

src/api/modules/
  portal-overview.ts                        # API 抽象层（双通道），~30 行

mock/
  portal-overview.ts                        # vite-plugin-mock 拦截（项目根 mock/ 目录）

src/portal/
  config/
    nav.ts                                  # 顶部横向导航配置，~30 行
    hero.ts                                 # 大标题 + 热门搜索 + 搜索类型配置，~30 行
    footer.ts                               # 系统链接 + 版权配置，~40 行
    types.ts                                # PortalNavItem / SearchTypeOption / FooterLinkGroup
  styles/
    portal-tokens.scss                      # portal 专属 CSS 变量，~30 行
```

**路径说明**：

- `src/modules/dashboard/store/` 而非 `stores/`：与现有 `src/modules/dashboard/store/index.ts` 单数约定一致
- `mock/` 在项目根而非 `src/api/mock/`：与现有 `mock/dashboard.ts` 等同级（vite-plugin-mock 默认扫描路径）
- `src/modules/dashboard/types/` 是本次新建目录，未来其他模块的 DTO 也可复用此模式

#### 修改 / 删除（2 个）

```
src/modules/dashboard/routes/index.ts       # 改一行：component 指向 PortalLayout
src/modules/dashboard/views/Index.vue       # 删除（原 dashboard 首页改为 views/home/Index.vue）
```

**重命名策略**：原 `views/Index.vue` 删除，新建 `views/home/Index.vue`。路由 name `Dashboard` 不变，仅文件路径迁移。

### 3.2 关键 Props 接口

```ts
// === HeroSection.vue ===
interface HeroSectionProps {
  titleArt?: string // 左侧装饰图（本次用占位）
  slogan?: string // 默认走 config/hero.ts
  hotSearches: string[]
  searchTypes: SearchTypeOption[]
  modelValueSearchType: string
  modelValueKeyword: string
}

// === HotSearchTags.vue ===
interface HotSearchTagsProps {
  tags: string[]
  active?: string
}

// === SearchBar.vue ===
interface SearchTypeOption {
  label: string
  value: string
}
interface SearchBarProps {
  types: SearchTypeOption[]
  modelValueType: string
  modelValueKeyword: string
  placeholder?: string
  loading?: boolean
}

// === OverviewCard.vue ===
type TrendDirection = 'up' | 'down' | 'flat'
interface OverviewMetric {
  label: string
  unit?: string
  value: number | string
  trend: TrendDirection
  trendText: string
}
interface OverviewCardProps {
  title: string
  iconName: string
  iconBg: string
  metrics: OverviewMetric[]
  viewDetailPath?: string
}

// === PortalFooter.vue ===
interface FooterLinkGroup {
  title: string
  links: { label: string; href: string }[]
}
interface PortalFooterProps {
  groups: FooterLinkGroup[]
  copyright: string
}

// === DateGreeting.vue ===
interface DateGreetingProps {
  greeting?: string
  date?: Date
}
```

### 3.3 Store 设计

```ts
// src/modules/dashboard/stores/portal-overview.ts
export const usePortalOverviewStore = defineStore('portal-overview', () => {
  const cards = ref<OverviewCardDto[]>([])
  const loading = ref(false)
  const error = ref<Error | null>(null)

  async function fetch() {
    loading.value = true
    error.value = null
    try {
      const data = await portalOverviewApi.getOverview()
      cards.value = data
    } catch (err: unknown) {
      error.value = err instanceof Error ? err : new Error(String(err))
      cards.value = []
    } finally {
      loading.value = false
    }
  }

  return { cards, loading, error, fetch }
})
```

### 3.4 API 抽象层

```ts
// src/api/modules/portal-overview.ts
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'

export const portalOverviewApi = {
  async getOverview(): Promise<OverviewCardDto[]> {
    if (USE_MOCK) {
      await new Promise((r) => setTimeout(r, 200)) // 模拟网络延迟
      return getMockOverview()
    }
    const { data } = await request.get<OverviewCardDto[]>('/api/portal/overview')
    return data
  },
}
```

### 3.5 类型契约

```ts
// src/modules/dashboard/types/portal-overview.ts
export type TrendDirection = 'up' | 'down' | 'flat'

export interface OverviewMetricDto {
  label: string
  unit?: string
  value: number | string
  trend: TrendDirection
  trendText: string
}

export interface OverviewCardDto {
  code: string
  title: string
  iconName: string
  iconBg: string
  metrics: OverviewMetricDto[]
  viewDetailPath?: string
}
```

```ts
// src/portal/config/types.ts
export interface PortalNavItem {
  key: string
  label: string
  routeName?: RouteRecordName
  path?: string
  active?: boolean
}

export interface SearchTypeOption {
  label: string
  value: string
}

export interface FooterLinkGroup {
  title: string
  links: { label: string; href: string }[]
}
```

---

## 四、错误处理（防御性 UI 三态）

### 4.1 OverviewSection 三态

| 状态    | 触发条件                        | UI                                                                |
| ------- | ------------------------------- | ----------------------------------------------------------------- |
| Loading | `store.loading === true`        | 5 个 `OverviewCardSkeleton`（静态骨架，不闪烁）                   |
| Error   | `store.error !== null`          | `OverviewErrorState`：图标 + "数据加载失败" + 错误提示 + 重试按钮 |
| Empty   | `cards.length === 0` 且无 error | `OverviewEmptyState`：图标 + "暂无数据" + 提示文字                |
| Normal  | 上述皆否                        | 5 张 `OverviewCard`                                               |

**关键约束**：

- Loading 与 Empty **视觉明确区分**（骨架 vs 插画），不能都用 v-if 一刀切
- Error 必须有可操作的**重试按钮**（emit retry → store.fetch）
- `error.message` 只展示后端业务文案，不暴露堆栈
- 整个首页不抛任何异步错误到上层，store 内 `try/catch` 全量兜底

### 4.2 其他组件

| 组件                   | Loading                               | Error             | Empty                             |
| ---------------------- | ------------------------------------- | ----------------- | --------------------------------- |
| HeroSection            | 不适用（hotSearches 来自 config）     | —                 | 热门搜索数组为空 → "暂无热门搜索" |
| PortalHeaderNav 用户卡 | `userStore.profile` 未就绪 → 骨架头像 | 异常 → 全局错误页 | 用户名为空 → 降级显示"游客"       |
| DateGreeting           | 不适用（用 new Date()）               | —                 | —                                 |
| PortalAiWidget         | 不适用（仅 ElMessage 反馈）           | —                 | —                                 |
| SearchBar              | 点击搜索 → 按钮 loading               | —                 | 关键词为空 → 按钮 disabled        |

---

## 五、测试策略

### 5.1 覆盖目标

- **Store** (`portal-overview.ts`)：100% 行覆盖
- **API 抽象层** (`portal-overview.ts`)：mock / 真接口两条分支
- **组件** (`OverviewSection`)：四分支（Loading/Error/Empty/Normal）
- **组件** (`OverviewCard`)：trend up/down/flat 三种图标
- **组件** (`SearchBar`)：v-model 双向绑定 + disabled 边界
- **配置**：`nav.ts` / `hero.ts` 数据合法性
- **不测**：纯展示组件（PortalTopBar / PortalFooter 静态布局）

### 5.2 Store 测试重点

```ts
describe('usePortalOverviewStore', () => {
  it('初始状态：loading=false, error=null, cards=[]', ...)
  it('fetch 成功：写入 cards, loading 收尾', ...)
  it('fetch 失败：写入 error, cards 清空', ...)
  it('fetch 期间 loading=true', ...)
  it('非 Error 类型抛出被规范化为 Error 实例', ...)
})
```

### 5.3 组件渲染测试重点

```ts
describe('OverviewSection', () => {
  it('Loading 态：渲染 5 个骨架')
  it('Error 态：渲染错误组件 + 重试按钮（触发 retry）')
  it('Empty 态：渲染空状态')
  it('Normal 态：渲染 N 张卡片')
})
```

### 5.4 命令

```bash
pnpm test                      # 单跑
pnpm test:watch                # 开发监听
pnpm test -- portal-overview   # 仅本次新增
pnpm test:coverage             # 覆盖率（门槛 80%）
```

---

## 六、变更影响与风险

### 6.1 影响面

| 范围                                    | 影响                       |
| --------------------------------------- | -------------------------- |
| `src/modules/dashboard/routes/index.ts` | 1 行修改（component 路径） |
| `src/layouts/default/`                  | 零影响                     |
| `src/components/layout/`                | 零影响                     |
| `src/router/index.ts`                   | 零影响                     |
| 路由守卫 / 全局状态 / 错误边界          | 零影响                     |
| 其他业务页（orders / reports）          | 零影响                     |

### 6.2 风险与缓解

| 风险                                                 | 缓解                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------- |
| 默认 layout 残留导致用户视觉困惑                     | 路由明确指向新 layout，文档化                                 |
| 5 张卡 mock 数据与后端真实返回结构不一致             | 后端文档就绪前，DTO 与 mock 共用 type，零漂移                 |
| PortalLayout 与 DefaultLayout 视觉冲突（如未来误用） | 通过路由文件物理隔离                                          |
| Store 单例污染（重复进入首页）                       | 仅暴露 `fetch()`，不缓存命中判断；如需缓存，引入 `hasFetched` |
| 测试覆盖率不达标                                     | 关键 store + 三态组件已列入测试清单                           |

---

## 七、视觉约定（Portal 专属 Token）

```scss
// src/portal/styles/portal-tokens.scss
:root {
  --card-law-bg: #e8f1ff; // 执法监管
  --card-monitor-bg: #ffebe6; // 监测预警
  --card-safety-bg: #e8f8ee; // 安评监管
  --card-training-bg: #fff4e0; // 培训监管
  --card-hazard-bg: #ffe8e8; // 隐患排查

  --banner-grad-from: #1b5bc9; // banner 渐变起点
  --banner-grad-to: #5b9bf0; // banner 渐变终点

  --trend-up: #f56c6c; // 上升（红色，警示）
  --trend-down: #67c23a; // 下降（绿色，向好）
  --trend-flat: #909399;
}
```

**图标选择（Element Plus 已装）**：

- 执法监管 → `odometer`
- 监测预警 → `warning-filled`
- 安评监管 → `document-checked`
- 培训监管 → `user-filled`
- 隐患排查 → `search`

**趋势箭头与颜色映射（按截图严格一致）**：

| `trend` 值 | 箭头 | 颜色         |
| ---------- | ---- | ------------ |
| `up`       | ▲    | 红 `#F56C6C` |
| `down`     | ▼    | 绿 `#67C23A` |
| `flat`     | —    | 灰 `#909399` |

注意：颜色仅反映**方向**，不反映**好坏**。例如「执法计划完成率 ▲ 3.9%」是好事，但箭头仍为红色。判断好坏由业务方决定，本设计只负责视觉一致。

---

## 八、CHANGELOG 预告

```
feat(portal): 新增政府门户首页 Layout（首页专属 PortalLayout + 数据总览 + 顶部蓝 banner）
```

涉及文件：本次新增 18 个 + 修改 1 个。

---

## 九、版本

文档版本 v1.0.0 | 起草日期 2026-07-23
