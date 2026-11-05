# Portal 首页 Layout 重构 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `/dashboard` 路由新增政府门户风格的 PortalLayout（含顶部蓝 banner、横向导航、数据总览 5 卡、AI 浮窗），与现有 admin layout 双 layout 并存。

**Architecture:**

- 新建 `src/layouts/portal/` 提供头尾固定的壳；内容区走 `<RouterView/>` slot 化，便于未来其他门户页复用。
- 数据通过 `src/modules/dashboard/store/portal-overview.ts`（Pinia setup store）+ `src/api/modules/portal-overview.ts`（mock/真接口双通道）+ `mock/portal-overview.ts` 三层解耦。
- 类型契约集中在 `src/modules/dashboard/types/portal-overview.ts`，配置常量在 `src/portal/config/`。
- 改 1 个文件（路由指向），删 1 个文件（`views/Index.vue` 改为 `views/home/Index.vue`）。

**Tech Stack:** Vue 3 `<script setup>` · Pinia · Element Plus · axios · vite-plugin-mock · vitest + @vue/test-utils · SCSS · UnoCSS

---

## Phase 0：备份与前置

### Task 0.1：建立备份

**Files:**

- Create: `.claude/backups/portal-home-2026-07-23/manifest.txt`

- [ ] **Step 1：创建备份目录**

```bash
mkdir -p ".claude/backups/portal-home-2026-07-23"
```

- [ ] **Step 2：写清单**

文件 `.claude/backups/portal-home-2026-07-23/manifest.txt`：

```text
[MODIFY]
D:\personal\github\vue3工程模板\vue3-vite-project\src\modules\dashboard\routes\index.ts

[DELETE]
D:\personal\github\vue3工程模板\vue3-vite-project\src\modules\dashboard\views\Index.vue

[NEW]
D:\personal\github\vue3工程模板\vue3-vite-project\src\layouts\portal\index.vue
D:\personal\github\vue3工程模板\vue3-vite-project\src\layouts\portal\components\PortalTopBar.vue
D:\personal\github\vue3工程模板\vue3-vite-project\src\layouts\portal\components\PortalHeaderNav.vue
D:\personal\github\vue3工程模板\vue3-vite-project\src\layouts\portal\components\PortalFooter.vue
D:\personal\github\vue3工程模板\vue3-vite-project\src\layouts\portal\components\PortalAiWidget.vue
D:\personal\github\vue3工程模板\vue3-vite-project\src\modules\dashboard\views\home\Index.vue
D:\personal\github\vue3工程模板\vue3-vite-project\src\modules\dashboard\views\home\components\HeroSection.vue
D:\personal\github\vue3工程模板\vue3-vite-project\src\modules\dashboard\views\home\components\HotSearchTags.vue
D:\personal\github\vue3工程模板\vue3-vite-project\src\modules\dashboard\views\home\components\SearchBar.vue
D:\personal\github\vue3工程模板\vue3-vite-project\src\modules\dashboard\views\home\components\DateGreeting.vue
D:\personal\github\vue3工程模板\vue3-vite-project\src\modules\dashboard\views\home\components\OverviewSection.vue
D:\personal\github\vue3工程模板\vue3-vite-project\src\modules\dashboard\views\home\components\OverviewCard.vue
D:\personal\github\vue3工程模板\vue3-vite-project\src\modules\dashboard\views\home\components\OverviewCardSkeleton.vue
D:\personal\github\vue3工程模板\vue3-vite-project\src\modules\dashboard\views\home\components\OverviewErrorState.vue
D:\personal\github\vue3工程模板\vue3-vite-project\src\modules\dashboard\views\home\components\OverviewEmptyState.vue
D:\personal\github\vue3工程模板\vue3-vite-project\src\modules\dashboard\views\home\components\OverviewMetricRow.vue
D:\personal\github\vue3工程模板\vue3-vite-project\src\modules\dashboard\store\portal-overview.ts
D:\personal\github\vue3工程模板\vue3-vite-project\src\modules\dashboard\store\portal-overview.spec.ts
D:\personal\github\vue3工程模板\vue3-vite-project\src\modules\dashboard\types\portal-overview.ts
D:\personal\github\vue3工程模板\vue3-vite-project\src\api\modules\portal-overview.ts
D:\personal\github\vue3工程模板\vue3-vite-project\mock\portal-overview.ts
D:\personal\github\vue3工程模板\vue3-vite-project\src\portal\config\types.ts
D:\personal\github\vue3工程模板\vue3-vite-project\src\portal\config\nav.ts
D:\personal\github\vue3工程模板\vue3-vite-project\src\portal\config\hero.ts
D:\personal\github\vue3工程模板\vue3-vite-project\src\portal\config\footer.ts
D:\personal\github\vue3工程模板\vue3-vite-project\src\portal\styles\portal-tokens.scss
D:\personal\github\vue3工程模板\vue3-vite-project\src\modules\dashboard\views\home\components\OverviewSection.spec.ts
D:\personal\github\vue3工程模板\vue3-vite-project\src\modules\dashboard\views\home\components\SearchBar.spec.ts
D:\personal\github\vue3工程模板\vue3-vite-project\docs\superpowers\plans\2026-07-23-portal-home-layout.md
D:\personal\github\vue3工程模板\vue3-vite-project\docs\superpowers\specs\2026-07-23-portal-home-layout-design.md
```

---

## Phase 1：基础常量与类型（无逻辑）

### Task 1.1：定义 DTO 类型

**Files:**

- Create: `src/modules/dashboard/types/portal-overview.ts`

- [ ] **Step 1：写文件**

```ts
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

- [ ] **Step 2：跑类型检查**

Run: `pnpm type-check`
Expected: PASS（无错误）

- [ ] **Step 3：提交**

```bash
git add src/modules/dashboard/types/portal-overview.ts
git commit -m "feat(portal-types): 定义数据总览 DTO 类型"
```

---

### Task 1.2：定义 Portal 配置类型

**Files:**

- Create: `src/portal/config/types.ts`

- [ ] **Step 1：写文件**

```ts
import type { RouteRecordName } from 'vue-router'

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

export interface HeroConfig {
  slogan: string
  hotSearches: string[]
  searchTypes: SearchTypeOption[]
  searchPlaceholder: string
}
```

- [ ] **Step 2：跑类型检查**

Run: `pnpm type-check`
Expected: PASS

- [ ] **Step 3：提交**

```bash
git add src/portal/config/types.ts
git commit -m "feat(portal-config): 定义 portal 配置项类型"
```

---

### Task 1.3：定义 nav 配置

**Files:**

- Create: `src/portal/config/nav.ts`

- [ ] **Step 1：写文件**

```ts
import type { PortalNavItem } from './types'

export const PORTAL_NAV: PortalNavItem[] = [
  { key: 'home', label: '首页', path: '/dashboard' },
  { key: 'law', label: '执法大屏', path: '/law-screen' },
  { key: 'knowledge', label: '知识学习', path: '/knowledge' },
  { key: 'monthly', label: '月度填报', path: '/monthly-fill' },
  { key: 'admin', label: '系统管理', path: '/admin' },
]
```

- [ ] **Step 2：提交**

```bash
git add src/portal/config/nav.ts
git commit -m "feat(portal-config): 配置顶部横向导航"
```

---

### Task 1.4：定义 hero 配置

**Files:**

- Create: `src/portal/config/hero.ts`

- [ ] **Step 1：写文件**

```ts
import type { HeroConfig } from './types'

export const HERO_CONFIG: HeroConfig = {
  slogan: '智慧监管·精准预警·数据真实·责任在肩',
  hotSearches: ['矿山', '危险化学品', '国寿', '烟爆花竹', '交通运输', '民用爆炸物'],
  searchTypes: [
    { label: '企业', value: 'company' },
    { label: '机构', value: 'org' },
    { label: '自然人', value: 'person' },
  ],
  searchPlaceholder: '请输入您想查询的关键字（查企业、查机构、查自然人）',
}
```

- [ ] **Step 2：提交**

```bash
git add src/portal/config/hero.ts
git commit -m "feat(portal-config): 配置 hero 区数据"
```

---

### Task 1.5：定义 footer 配置

**Files:**

- Create: `src/portal/config/footer.ts`

- [ ] **Step 1：写文件**

```ts
import type { FooterLinkGroup } from './types'

export const FOOTER_GROUPS: FooterLinkGroup[] = [
  {
    title: '系统链接',
    links: [
      { label: '广东省应急管理厅大数据中心', href: 'https://example.com/bigdata' },
      { label: `${appTitle}系统`, href: 'https://example.com/command' }, // appTitle = import.meta.env.VITE_APP_TITLE（2026-09-10 起品牌文案统一走环境变量）
      { label: '信息报送与共享系统', href: 'https://example.com/share' },
      { label: '广东省应急管理厅', href: 'https://example.com/gov' },
    ],
  },
  {
    title: '',
    links: [
      { label: '民用爆炸物', href: '#' },
      { label: '交通运输', href: '#' },
      { label: '矿山', href: '#' },
      { label: '渔业', href: '#' },
    ],
  },
]

export const FOOTER_COPYRIGHT = `版权所有：广东省应急管理厅
粤ICP备05070829号 粤公网安备44010402001160号
技术支持单位：数字广东网络建设有限公司
网站标识码：4400000078 地址：广州市建设大马路19号 电话：020-83137111 邮政编码：510060`
```

- [ ] **Step 2：提交**

```bash
git add src/portal/config/footer.ts
git commit -m "feat(portal-config): 配置 footer 数据"
```

---

### Task 1.6：定义 portal 样式 token

**Files:**

- Create: `src/portal/styles/portal-tokens.scss`

- [ ] **Step 1：写文件**

```scss
:root {
  --card-law-bg: #e8f1ff;
  --card-monitor-bg: #ffebe6;
  --card-safety-bg: #e8f8ee;
  --card-training-bg: #fff4e0;
  --card-hazard-bg: #ffe8e8;

  --banner-grad-from: #1b5bc9;
  --banner-grad-to: #5b9bf0;

  --trend-up: #f56c6c;
  --trend-down: #67c23a;
  --trend-flat: #909399;

  --portal-bg: #f5f7fa;
  --portal-max-width: 1280px;
  --portal-header-h: 64px;
  --portal-banner-h: 144px;
}
```

- [ ] **Step 2：在主入口引入 token**

修改 `src/assets/styles/index.scss`（或项目现有的全局样式入口），追加一行：

```scss
@use '@/portal/styles/portal-tokens.scss';
```

如果项目没有全局样式 index 文件，跳过本步骤，直接进入 1.7。

- [ ] **Step 3：提交**

```bash
git add src/portal/styles/portal-tokens.scss
git commit -m "feat(portal-styles): 定义 portal 视觉 token"
```

---

## Phase 2：Mock 数据 + API 抽象

### Task 2.1：写 mock 数据

**Files:**

- Create: `mock/portal-overview.ts`

- [ ] **Step 1：写文件**

```ts
import type { MockMethod } from 'vite-plugin-mock'
import type { OverviewCardDto } from '@/modules/dashboard/types/portal-overview'

const MOCK_CARDS: OverviewCardDto[] = [
  {
    code: 'law',
    title: '执法监管',
    iconName: 'odometer',
    iconBg: 'var(--card-law-bg)',
    metrics: [
      { label: '检查总数', unit: '(项)', value: 1959, trend: 'down', trendText: '同比 ▼ 8.5%' },
      { label: '执法计划完成率', unit: '(%)', value: 89, trend: 'up', trendText: '同比 ▲ 3.9%' },
      {
        label: '行政处罚总金额',
        unit: '(万元)',
        value: 6592,
        trend: 'up',
        trendText: '同比 ▲ 8.8%',
      },
    ],
    viewDetailPath: '/law-enforcement',
  },
  {
    code: 'monitor',
    title: '监测预警',
    iconName: 'warning-filled',
    iconBg: 'var(--card-monitor-bg)',
    metrics: [
      { label: '企业接入总数', unit: '(家)', value: 7709, trend: 'up', trendText: '同比 ▲ 7.3%' },
      { label: '风险预警总数', unit: '(项)', value: 3052, trend: 'down', trendText: '同比 ▼ 1.3%' },
      { label: '监测报警总数', unit: '(项)', value: 4159, trend: 'up', trendText: '同比 ▲ 4.7%' },
    ],
    viewDetailPath: '/monitor',
  },
  {
    code: 'safety',
    title: '安评监管',
    iconName: 'document-checked',
    iconBg: 'var(--card-safety-bg)',
    metrics: [
      { label: '机构总数', unit: '(家)', value: 336, trend: 'down', trendText: '同比 ▼ 30%' },
      { label: '项目总数', unit: '(项)', value: 739, trend: 'up', trendText: '同比 ▲ 39%' },
      { label: '风险预警数', unit: '(项)', value: 199, trend: 'up', trendText: '同比 ▲ 66%' },
    ],
    viewDetailPath: '/safety',
  },
  {
    code: 'training',
    title: '培训监管',
    iconName: 'user-filled',
    iconBg: 'var(--card-training-bg)',
    metrics: [
      { label: '已备案总数', unit: '(项)', value: 522, trend: 'up', trendText: '同比 ▲ 48%' },
      { label: '课程监管数', unit: '(项)', value: 620, trend: 'down', trendText: '同比 ▼ 30%' },
      { label: '持证总数', unit: '(本)', value: 870, trend: 'up', trendText: '同比 ▲ 85%' },
    ],
    viewDetailPath: '/training',
  },
  {
    code: 'hazard',
    title: '隐患排查',
    iconName: 'search',
    iconBg: 'var(--card-hazard-bg)',
    metrics: [
      { label: '企业接入数', unit: '(项)', value: 569, trend: 'down', trendText: '同比 ▼ 8.5%' },
      { label: '隐患整改率', unit: '(%)', value: 99, trend: 'down', trendText: '同比 ▼ 8.5%' },
      { label: '重大隐患', unit: '(项)', value: 932, trend: 'up', trendText: '同比 ▲ 64%' },
    ],
    viewDetailPath: '/hazard',
  },
]

export default [
  {
    url: '/api/portal/overview',
    method: 'get',
    timeout: 200,
    response: () => ({ code: 200, message: 'ok', data: MOCK_CARDS }),
  },
] as MockMethod[]
```

- [ ] **Step 2：mock 自动挂载验证**

mock 目录由 vite-plugin-mock 自动扫描，无需手动注册。启动 `pnpm dev`，浏览器访问 dev tools network 应能看到 `/api/portal/overview` 路由。

- [ ] **Step 3：提交**

```bash
git add mock/portal-overview.ts
git commit -m "feat(mock): 数据总览 mock 接口"
```

---

### Task 2.2：API 抽象层

**Files:**

- Create: `src/api/modules/portal-overview.ts`

- [ ] **Step 1：写文件**

```ts
import request from '@/utils/request'
import type { OverviewCardDto } from '@/modules/dashboard/types/portal-overview'

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'

// 注意：真接口路径临时占位 `/api/portal/overview`，与 mock 拦截一致；
// 联调时由后端真实接口替换，本文件无需改动。
export const portalOverviewApi = {
  async getOverview(): Promise<OverviewCardDto[]> {
    if (USE_MOCK) {
      await new Promise((r) => setTimeout(r, 200))
    }
    const { data } = await request.get<{ data: OverviewCardDto[] }>('/api/portal/overview')
    return data.data
  },
}
```

> 注：`request.get` 返回结构是 `{ code, message, data }`，真实 data 在 `data.data`。如果项目 `request` 直接返回 data，请改为 `const data = await request.get<OverviewCardDto[]>(...)`。

- [ ] **Step 2：跑类型检查**

Run: `pnpm type-check`
Expected: PASS

- [ ] **Step 3：提交**

```bash
git add src/api/modules/portal-overview.ts
git commit -m "feat(api): portal-overview API 抽象层（mock/真接口双通道）"
```

---

## Phase 3：Store（TDD）

### Task 3.1：写 store 失败测试

**Files:**

- Create: `src/modules/dashboard/store/portal-overview.spec.ts`

- [ ] **Step 1：写测试**

```ts
import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePortalOverviewStore } from './portal-overview'
import * as apiModule from '@/api/modules/portal-overview'

describe('usePortalOverviewStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  it('初始状态：loading=false, error=null, cards=[]', () => {
    const store = usePortalOverviewStore()
    expect(store.loading).toBe(false)
    expect(store.error).toBe(null)
    expect(store.cards).toEqual([])
  })

  it('fetch 成功：写入 cards, loading 收尾为 false', async () => {
    vi.spyOn(apiModule.portalOverviewApi, 'getOverview').mockResolvedValue([
      { code: 'law', title: '执法监管', iconName: 'odometer', iconBg: 'var(--x)', metrics: [] },
    ])
    const store = usePortalOverviewStore()
    await store.fetch()
    expect(store.cards).toHaveLength(1)
    expect(store.loading).toBe(false)
    expect(store.error).toBe(null)
  })

  it('fetch 失败：写入 error, cards 清空, loading 收尾', async () => {
    vi.spyOn(apiModule.portalOverviewApi, 'getOverview').mockRejectedValue(new Error('网络异常'))
    const store = usePortalOverviewStore()
    await store.fetch()
    expect(store.error?.message).toBe('网络异常')
    expect(store.cards).toEqual([])
    expect(store.loading).toBe(false)
  })

  it('fetch 期间 loading=true', async () => {
    let resolve!: (v: OverviewCardDto[]) => void
    vi.spyOn(apiModule.portalOverviewApi, 'getOverview').mockReturnValue(
      new Promise((r) => {
        resolve = r
      })
    )
    const store = usePortalOverviewStore()
    const p = store.fetch()
    expect(store.loading).toBe(true)
    resolve([])
    await p
    expect(store.loading).toBe(false)
  })

  it('非 Error 类型抛出被规范化为 Error 实例', async () => {
    vi.spyOn(apiModule.portalOverviewApi, 'getOverview').mockRejectedValue('字符串异常')
    const store = usePortalOverviewStore()
    await store.fetch()
    expect(store.error).toBeInstanceOf(Error)
    expect(store.error?.message).toBe('字符串异常')
  })
})
```

- [ ] **Step 2：跑测试，确认失败**

Run: `pnpm test -- portal-overview`
Expected: FAIL（`./portal-overview` 模块不存在）

---

### Task 3.2：写 store 实现

**Files:**

- Create: `src/modules/dashboard/store/portal-overview.ts`

- [ ] **Step 1：写文件**

```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { portalOverviewApi } from '@/api/modules/portal-overview'
import type { OverviewCardDto } from '@/modules/dashboard/types/portal-overview'

export const usePortalOverviewStore = defineStore('module-portal-overview', () => {
  const cards = ref<OverviewCardDto[]>([])
  const loading = ref(false)
  const error = ref<Error | null>(null)

  async function fetch(): Promise<void> {
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

- [ ] **Step 2：跑测试，确认通过**

Run: `pnpm test -- portal-overview`
Expected: PASS（5/5 通过）

- [ ] **Step 3：提交**

```bash
git add src/modules/dashboard/store/portal-overview.ts src/modules/dashboard/store/portal-overview.spec.ts
git commit -m "feat(portal-store): 数据总览 Pinia store（含 5 项状态机测试）"
```

---

## Phase 4：Portal Layout 壳

### Task 4.1：PortalTopBar（顶部蓝 banner）

**Files:**

- Create: `src/layouts/portal/components/PortalTopBar.vue`

- [ ] **Step 1：写文件**

```vue
<script setup lang="ts">
// 顶部蓝 banner：full-bleed 背景，内容居中。
// 国徽、标题、标语来自硬编码常量（静态展示，无外部数据）。
</script>

<template>
  <div class="portal-top-bar">
    <div class="portal-top-bar__inner">
      <div class="portal-top-bar__brand">
        <div class="portal-top-bar__emblem" aria-hidden="true">徽</div>
        <div class="portal-top-bar__title-wrap">
          <h1 class="portal-top-bar__title">省工贸安全监管和监测预警系统</h1>
          <p class="portal-top-bar__subtitle">
            Provincial industrial and trade safety supervision and monitoring and early warning
            system
          </p>
        </div>
      </div>
      <div class="portal-top-bar__slogans" aria-hidden="true">
        <div class="portal-top-bar__slogan">对党忠诚 纪律严明</div>
        <div class="portal-top-bar__slogan">赴汤蹈火 竭诚为民</div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.portal-top-bar {
  background: linear-gradient(135deg, var(--banner-grad-from) 0%, var(--banner-grad-to) 100%);
  color: #fff;
  height: var(--portal-banner-h);

  &__inner {
    max-width: var(--portal-max-width);
    margin: 0 auto;
    height: 100%;
    padding: 0 var(--spacing-lg);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__brand {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  &__emblem {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: #d23a3a;
    display: grid;
    place-items: center;
    font-weight: bold;
  }

  &__title {
    font-size: 26px;
    margin: 0;
  }

  &__subtitle {
    font-size: 12px;
    opacity: 0.8;
    margin: 4px 0 0;
  }

  &__slogans {
    text-align: right;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.6;
  }
}
</style>
```

- [ ] **Step 2：提交**

```bash
git add src/layouts/portal/components/PortalTopBar.vue
git commit -m "feat(portal-layout): PortalTopBar 顶部蓝 banner"
```

---

### Task 4.2：PortalHeaderNav（横向导航 + 用户信息卡）

**Files:**

- Create: `src/layouts/portal/components/PortalHeaderNav.vue`

- [ ] **Step 1：写文件**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '@/store/modules/user'
import { PORTAL_NAV } from '@/portal/config/nav'
import type { PortalNavItem } from '@/portal/config/types'

const userStore = useUserStore()
const route = useRoute()

const navItems = computed(() =>
  PORTAL_NAV.map((item: PortalNavItem) => ({
    ...item,
    active: item.path === route.path,
  }))
)
</script>

<template>
  <nav class="portal-header-nav">
    <div class="portal-header-nav__inner">
      <ul class="portal-header-nav__menu">
        <li
          v-for="item in navItems"
          :key="item.key"
          :class="['portal-header-nav__item', { active: item.active }]"
        >
          <a :href="item.path">{{ item.label }}</a>
        </li>
      </ul>
      <div class="portal-header-nav__user">
        <span class="portal-header-nav__avatar">
          {{ userStore.profile?.name?.charAt(0) ?? '?' }}
        </span>
        <span class="portal-header-nav__name">
          {{ userStore.profile?.name ?? '游客' }}
        </span>
        <span class="portal-header-nav__caret">▾</span>
      </div>
    </div>
  </nav>
</template>

<style lang="scss" scoped>
.portal-header-nav {
  position: sticky;
  top: 0;
  z-index: 10;
  background: #fff;
  border-bottom: 1px solid #ebeef5;
  height: var(--portal-header-h);

  &__inner {
    max-width: var(--portal-max-width);
    margin: 0 auto;
    height: 100%;
    padding: 0 var(--spacing-lg);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__menu {
    display: flex;
    gap: 32px;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  &__item {
    font-size: 16px;

    a {
      color: #303133;
      text-decoration: none;
    }

    &.active a {
      color: var(--el-color-primary);
      font-weight: 600;
    }
  }

  &__user {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }

  &__avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: #409eff;
    color: #fff;
    display: grid;
    place-items: center;
    font-weight: 600;
  }
}
</style>
```

- [ ] **Step 2：跑类型检查**

Run: `pnpm type-check`
Expected: PASS

- [ ] **Step 3：提交**

```bash
git add src/layouts/portal/components/PortalHeaderNav.vue
git commit -m "feat(portal-layout): PortalHeaderNav 横向导航 + 用户信息卡"
```

---

### Task 4.3：PortalAiWidget（AI 浮窗）

**Files:**

- Create: `src/layouts/portal/components/PortalAiWidget.vue`

- [ ] **Step 1：写文件**

```vue
<script setup lang="ts">
import { ElMessage } from 'element-plus'

function onClick(): void {
  // 占位逻辑：本次不接入真实 AI，点击提示即将上线
  ElMessage.info('AI 助手即将上线')
}
</script>

<template>
  <button type="button" class="portal-ai-widget" aria-label="打开 AI 助手" @click="onClick">
    <span class="portal-ai-widget__icon" aria-hidden="true">🤖</span>
    <span class="portal-ai-widget__label">
      <span class="portal-ai-widget__name">小安智能</span>
      <span class="portal-ai-widget__hint">你可以对我说本月全省检查合计是多少？</span>
    </span>
  </button>
</template>

<style lang="scss" scoped>
.portal-ai-widget {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 999px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  cursor: pointer;

  &__icon {
    font-size: 20px;
  }

  &__label {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    line-height: 1.2;
  }

  &__name {
    font-size: 12px;
    color: #303133;
    font-weight: 600;
  }

  &__hint {
    font-size: 10px;
    color: #909399;
  }
}
</style>
```

- [ ] **Step 2：提交**

```bash
git add src/layouts/portal/components/PortalAiWidget.vue
git commit -m "feat(portal-layout): PortalAiWidget 占位浮窗"
```

---

### Task 4.4：PortalFooter（系统链接 + 版权）

**Files:**

- Create: `src/layouts/portal/components/PortalFooter.vue`

- [ ] **Step 1：写文件**

```vue
<script setup lang="ts">
import { FOOTER_GROUPS, FOOTER_COPYRIGHT } from '@/portal/config/footer'
</script>

<template>
  <footer class="portal-footer">
    <div class="portal-footer__inner">
      <div class="portal-footer__groups">
        <div v-for="(group, idx) in FOOTER_GROUPS" :key="idx" class="portal-footer__group">
          <h4 v-if="group.title" class="portal-footer__group-title">
            {{ group.title }}
          </h4>
          <ul class="portal-footer__links">
            <li v-for="link in group.links" :key="link.label">
              <a :href="link.href" target="_blank" rel="noopener">{{ link.label }}</a>
            </li>
          </ul>
        </div>
      </div>
      <pre class="portal-footer__copyright">{{ FOOTER_COPYRIGHT }}</pre>
    </div>
  </footer>
</template>

<style lang="scss" scoped>
.portal-footer {
  background: #f5f7fa;
  border-top: 1px solid #ebeef5;
  padding: 24px 0;
  margin-top: 32px;

  &__inner {
    max-width: var(--portal-max-width);
    margin: 0 auto;
    padding: 0 var(--spacing-lg);
  }

  &__groups {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px 48px;
  }

  &__group-title {
    font-size: 14px;
    color: #606266;
    margin: 0 0 8px;
  }

  &__links {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 4px 24px;

    a {
      color: #606266;
      font-size: 12px;
      text-decoration: none;

      &:hover {
        color: var(--el-color-primary);
      }
    }
  }

  &__copyright {
    margin: 16px 0 0;
    padding-top: 16px;
    border-top: 1px solid #ebeef5;
    font-size: 12px;
    color: #909399;
    line-height: 1.8;
    white-space: pre-wrap;
    font-family: inherit;
  }
}
</style>
```

- [ ] **Step 2：提交**

```bash
git add src/layouts/portal/components/PortalFooter.vue
git commit -m "feat(portal-layout): PortalFooter 系统链接 + 版权"
```

---

### Task 4.5：PortalLayout 壳（组合所有 layout 子组件）

**Files:**

- Create: `src/layouts/portal/index.vue`

- [ ] **Step 1：写文件**

```vue
<script setup lang="ts">
import PortalTopBar from './components/PortalTopBar.vue'
import PortalHeaderNav from './components/PortalHeaderNav.vue'
import PortalFooter from './components/PortalFooter.vue'
import PortalAiWidget from './components/PortalAiWidget.vue'
</script>

<template>
  <div class="portal-layout">
    <PortalTopBar />
    <PortalHeaderNav />
    <main class="portal-layout__main">
      <!-- 内容区由路由决定（RouterView 即为默认 slot） -->
      <RouterView />
    </main>
    <PortalFooter />
    <PortalAiWidget />
  </div>
</template>

<style lang="scss" scoped>
.portal-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--portal-bg);

  &__main {
    max-width: var(--portal-max-width);
    width: 100%;
    margin: 0 auto;
    padding: 24px var(--spacing-lg);
    flex: 1;
  }
}
</style>
```

- [ ] **Step 2：跑类型检查**

Run: `pnpm type-check`
Expected: PASS

- [ ] **Step 3：提交**

```bash
git add src/layouts/portal/index.vue
git commit -m "feat(portal-layout): PortalLayout 壳（顶部+nav+slot+footer+AI 浮窗）"
```

---

## Phase 5：Home 页 HeroSection 组

### Task 5.1：HotSearchTags

**Files:**

- Create: `src/modules/dashboard/views/home/components/HotSearchTags.vue`

- [ ] **Step 1：写文件**

```vue
<script setup lang="ts">
defineProps<{
  tags: string[]
  active?: string
}>()

defineEmits<{
  (e: 'select', tag: string): void
}>()
</script>

<template>
  <div class="hot-search">
    <span class="hot-search__label">热门搜索：</span>
    <button
      v-for="tag in tags"
      :key="tag"
      type="button"
      :class="['hot-search__tag', { active: tag === active }]"
      @click="$emit('select', tag)"
    >
      {{ tag }}
    </button>
  </div>
</template>

<style lang="scss" scoped>
.hot-search {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 13px;

  &__label {
    color: #909399;
  }

  &__tag {
    padding: 4px 12px;
    background: #f0f6ff;
    border: 1px solid #d6e8ff;
    border-radius: 4px;
    color: #409eff;
    cursor: pointer;
    font-size: 13px;

    &.active {
      background: #409eff;
      color: #fff;
    }
  }
}
</style>
```

- [ ] **Step 2：提交**

```bash
git add src/modules/dashboard/views/home/components/HotSearchTags.vue
git commit -m "feat(portal-home): HotSearchTags 热门搜索标签"
```

---

### Task 5.2：SearchBar（TDD）

**Files:**

- Create: `src/modules/dashboard/views/home/components/SearchBar.vue`
- Create: `src/modules/dashboard/views/home/components/SearchBar.spec.ts`

- [ ] **Step 1：写失败测试**

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SearchBar from './SearchBar.vue'

describe('SearchBar', () => {
  const types = [
    { label: '企业', value: 'company' },
    { label: '机构', value: 'org' },
  ]

  it('渲染选择器与输入框', () => {
    const w = mount(SearchBar, {
      props: { types, modelValueType: 'company', modelValueKeyword: '' },
    })
    expect(w.find('input').exists()).toBe(true)
  })

  it('空关键词时按钮 disabled', () => {
    const w = mount(SearchBar, {
      props: { types, modelValueType: 'company', modelValueKeyword: '' },
    })
    expect(w.find('button').attributes('disabled')).toBeDefined()
  })

  it('有关键词时按钮可点击', () => {
    const w = mount(SearchBar, {
      props: { types, modelValueType: 'company', modelValueKeyword: '矿山' },
    })
    expect(w.find('button').attributes('disabled')).toBeUndefined()
  })

  it('点击按钮 emit submit', async () => {
    const w = mount(SearchBar, {
      props: { types, modelValueType: 'company', modelValueKeyword: '矿山' },
    })
    await w.find('button').trigger('click')
    expect(w.emitted('submit')).toHaveLength(1)
  })
})
```

- [ ] **Step 2：跑测试，确认失败**

Run: `pnpm test -- SearchBar`
Expected: FAIL（模块不存在）

- [ ] **Step 3：写实现**

```vue
<script setup lang="ts">
import type { SearchTypeOption } from '@/portal/config/types'

const props = defineProps<{
  types: SearchTypeOption[]
  modelValueType: string
  modelValueKeyword: string
  placeholder?: string
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValueType', v: string): void
  (e: 'update:modelValueKeyword', v: string): void
  (e: 'submit'): void
}>()

const canSubmit = (): boolean => !props.loading && props.modelValueKeyword.trim().length > 0

function onSubmit(): void {
  if (canSubmit()) emit('submit')
}
</script>

<template>
  <div class="search-bar">
    <select
      class="search-bar__select"
      :value="modelValueType"
      @change="emit('update:modelValueType', ($event.target as HTMLSelectElement).value)"
    >
      <option v-for="t in types" :key="t.value" :value="t.value">
        {{ t.label }}
      </option>
    </select>
    <input
      class="search-bar__input"
      :value="modelValueKeyword"
      :placeholder="placeholder"
      @input="emit('update:modelValueKeyword', ($event.target as HTMLInputElement).value)"
    />
    <button type="button" class="search-bar__btn" :disabled="!canSubmit()" @click="onSubmit">
      搜索
    </button>
  </div>
</template>

<style lang="scss" scoped>
.search-bar {
  display: flex;
  gap: 8px;
  align-items: center;

  &__select {
    height: 40px;
    padding: 0 12px;
    border: 1px solid #dcdfe6;
    border-radius: 4px;
    background: #fff;
  }

  &__input {
    flex: 1;
    height: 40px;
    padding: 0 12px;
    border: 1px solid #dcdfe6;
    border-radius: 4px;
    background: #fff;
  }

  &__btn {
    height: 40px;
    padding: 0 24px;
    background: #409eff;
    color: #fff;
    border: none;
    border-radius: 4px;
    cursor: pointer;

    &:disabled {
      background: #a0cfff;
      cursor: not-allowed;
    }
  }
}
</style>
```

- [ ] **Step 4：跑测试，确认通过**

Run: `pnpm test -- SearchBar`
Expected: PASS（4/4）

- [ ] **Step 5：提交**

```bash
git add src/modules/dashboard/views/home/components/SearchBar.vue src/modules/dashboard/views/home/components/SearchBar.spec.ts
git commit -m "feat(portal-home): SearchBar 搜索栏（含 4 项测试）"
```

---

### Task 5.3：HeroSection（组合 HotSearchTags + SearchBar）

**Files:**

- Create: `src/modules/dashboard/views/home/components/HeroSection.vue`

- [ ] **Step 1：写文件**

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import HotSearchTags from './HotSearchTags.vue'
import SearchBar from './SearchBar.vue'
import { HERO_CONFIG } from '@/portal/config/hero'

const searchType = ref(HERO_CONFIG.searchTypes[0].value)
const keyword = ref('')
const activeTag = ref<string | undefined>(undefined)

function selectTag(tag: string): void {
  activeTag.value = tag
  keyword.value = tag
}

function onSubmit(): void {
  // 本次未对接搜索接口，预留事件出口
  console.info('[portal-search]', { type: searchType.value, keyword: keyword.value })
}

const heroSlogan = computed(() => HERO_CONFIG.slogan)
</script>

<template>
  <section class="hero" aria-labelledby="hero-title">
    <div class="hero__art">
      <span class="hero__art-text">安全发展 国泰民安</span>
    </div>
    <div class="hero__content">
      <h2 id="hero-title" class="hero__title">省工贸安全监管平台</h2>
      <p class="hero__slogan">{{ heroSlogan }}</p>
      <HotSearchTags
        class="hero__hot"
        :tags="HERO_CONFIG.hotSearches"
        :active="activeTag"
        @select="selectTag"
      />
      <SearchBar
        class="hero__search"
        :types="HERO_CONFIG.searchTypes"
        :placeholder="HERO_CONFIG.searchPlaceholder"
        v-model:model-value-type="searchType"
        v-model:model-value-keyword="keyword"
        @submit="onSubmit"
      />
    </div>
  </section>
</template>

<style lang="scss" scoped>
.hero {
  background: linear-gradient(120deg, #e8f1ff 0%, #f5f7fa 100%);
  border-radius: 8px;
  padding: 32px;
  display: flex;
  gap: 32px;
  margin-bottom: 24px;

  &__art {
    flex: 0 0 240px;
    display: grid;
    place-items: center;
    font-size: 36px;
    font-weight: 700;
    color: #1b5bc9;
    background: rgba(255, 255, 255, 0.5);
    border-radius: 8px;
  }

  &__content {
    flex: 1;
  }

  &__title {
    font-size: 24px;
    margin: 0 0 8px;
    color: #303133;
  }

  &__slogan {
    font-size: 18px;
    color: #f56c6c;
    font-weight: 600;
    margin: 0 0 16px;
  }

  &__hot {
    margin-bottom: 12px;
  }
}
</style>
```

- [ ] **Step 2：跑类型检查**

Run: `pnpm type-check`
Expected: PASS

- [ ] **Step 3：提交**

```bash
git add src/modules/dashboard/views/home/components/HeroSection.vue
git commit -m "feat(portal-home): HeroSection 大标题+标语+搜索"
```

---

### Task 5.4：DateGreeting（问候语 + 日期）

**Files:**

- Create: `src/modules/dashboard/views/home/components/DateGreeting.vue`

- [ ] **Step 1：写文件**

```vue
<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    greeting?: string
    date?: Date
  }>(),
  {
    greeting: '下午时间，只有奋斗的人生才称得上幸福的人生！',
    date: () => new Date(),
  }
)

const formattedDate = computed(() => {
  const d = props.date
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  return `${y}年${m}月${day}日 星期${weekdays[d.getDay()]}`
})
</script>

<template>
  <div class="date-greeting">
    <span class="date-greeting__icon" aria-hidden="true">☕</span>
    <p class="date-greeting__text">{{ greeting }}</p>
    <p class="date-greeting__date">{{ formattedDate }}</p>
  </div>
</template>

<style lang="scss" scoped>
.date-greeting {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 16px 0;
  font-size: 13px;
  color: #606266;

  &__icon {
    font-size: 16px;
  }
}
</style>
```

- [ ] **Step 2：提交**

```bash
git add src/modules/dashboard/views/home/components/DateGreeting.vue
git commit -m "feat(portal-home): DateGreeting 问候语 + 日期"
```

---

## Phase 6：Home 页 OverviewSection 组（含 TDD）

### Task 6.1：OverviewCardSkeleton

**Files:**

- Create: `src/modules/dashboard/views/home/components/OverviewCardSkeleton.vue`

- [ ] **Step 1：写文件**

```vue
<template>
  <div class="ov-skeleton" data-test="skeleton" aria-hidden="true">
    <div class="ov-skeleton__head shimmer" />
    <div class="ov-skeleton__title shimmer" />
    <div v-for="i in 3" :key="i" class="ov-skeleton__row shimmer" />
  </div>
</template>

<style lang="scss" scoped>
.ov-skeleton {
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  border: 1px solid #ebeef5;

  &__head {
    width: 48px;
    height: 48px;
    border-radius: 8px;
  }

  &__title {
    height: 16px;
    margin: 12px 0;
    border-radius: 4px;
  }

  &__row {
    height: 32px;
    margin-top: 12px;
    border-radius: 4px;
  }
}

.shimmer {
  background: linear-gradient(90deg, #f2f3f5 25%, #e6e8eb 50%, #f2f3f5 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
```

- [ ] **Step 2：提交**

```bash
git add src/modules/dashboard/views/home/components/OverviewCardSkeleton.vue
git commit -m "feat(portal-home): OverviewCardSkeleton 加载骨架"
```

---

### Task 6.2：OverviewErrorState

**Files:**

- Create: `src/modules/dashboard/views/home/components/OverviewErrorState.vue`

- [ ] **Step 1：写文件**

```vue
<script setup lang="ts">
import { CircleCloseFilled } from '@element-plus/icons-vue'

defineProps<{ message: string }>()
defineEmits<{ (e: 'retry'): void }>()
</script>

<template>
  <div class="ov-error" role="alert">
    <el-icon :size="48" color="#F56C6C"><CircleCloseFilled /></el-icon>
    <p class="ov-error__title">数据加载失败</p>
    <p class="ov-error__detail">{{ message }}</p>
    <el-button type="primary" @click="$emit('retry')">重新加载</el-button>
  </div>
</template>

<style lang="scss" scoped>
.ov-error {
  background: #fff;
  border-radius: 8px;
  padding: 48px;
  text-align: center;
  border: 1px solid #ebeef5;

  &__title {
    font-size: 16px;
    color: #303133;
    margin: 16px 0 4px;
  }

  &__detail {
    font-size: 13px;
    color: #909399;
    margin: 0 0 16px;
  }
}
</style>
```

- [ ] **Step 2：提交**

```bash
git add src/modules/dashboard/views/home/components/OverviewErrorState.vue
git commit -m "feat(portal-home): OverviewErrorState 错误态"
```

---

### Task 6.3：OverviewEmptyState

**Files:**

- Create: `src/modules/dashboard/views/home/components/OverviewEmptyState.vue`

- [ ] **Step 1：写文件**

```vue
<script setup lang="ts">
import { DocumentRemove } from '@element-plus/icons-vue'
</script>

<template>
  <div class="ov-empty">
    <el-icon :size="48" color="#909399"><DocumentRemove /></el-icon>
    <p class="ov-empty__title">暂无数据</p>
    <p class="ov-empty__hint">当前时间段未查询到统计指标</p>
  </div>
</template>

<style lang="scss" scoped>
.ov-empty {
  background: #fff;
  border-radius: 8px;
  padding: 48px;
  text-align: center;
  border: 1px solid #ebeef5;

  &__title {
    font-size: 16px;
    color: #303133;
    margin: 16px 0 4px;
  }

  &__hint {
    font-size: 13px;
    color: #909399;
    margin: 0;
  }
}
</style>
```

- [ ] **Step 2：提交**

```bash
git add src/modules/dashboard/views/home/components/OverviewEmptyState.vue
git commit -m "feat(portal-home): OverviewEmptyState 空态"
```

---

### Task 6.4：OverviewMetricRow

**Files:**

- Create: `src/modules/dashboard/views/home/components/OverviewMetricRow.vue`

- [ ] **Step 1：写文件**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { OverviewMetricDto } from '@/modules/dashboard/types/portal-overview'

const props = defineProps<{
  metric: OverviewMetricDto
}>()

const trendClass = computed(() => `is-${props.metric.trend}`)
</script>

<template>
  <div class="ov-row">
    <div class="ov-row__label">
      {{ metric.label }}
      <span v-if="metric.unit" class="ov-row__unit">{{ metric.unit }}</span>
    </div>
    <div class="ov-row__value-wrap">
      <span class="ov-row__value">{{ metric.value }}</span>
      <span :class="['ov-row__trend', trendClass]">
        {{ metric.trendText }}
      </span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.ov-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;

  &__label {
    color: #606266;
    font-size: 13px;
  }

  &__unit {
    color: #909399;
    font-size: 12px;
    margin-left: 2px;
  }

  &__value-wrap {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  &__value {
    font-size: 18px;
    font-weight: 600;
    color: #303133;
  }

  &__trend {
    font-size: 12px;

    &.is-up {
      color: var(--trend-up);
    }

    &.is-down {
      color: var(--trend-down);
    }

    &.is-flat {
      color: var(--trend-flat);
    }
  }
}
</style>
```

- [ ] **Step 2：提交**

```bash
git add src/modules/dashboard/views/home/components/OverviewMetricRow.vue
git commit -m "feat(portal-home): OverviewMetricRow 单行指标"
```

---

### Task 6.5：OverviewCard

**Files:**

- Create: `src/modules/dashboard/views/home/components/OverviewCard.vue`

- [ ] **Step 1：写文件**

```vue
<script setup lang="ts">
import { useRouter } from 'vue-router'
import * as ElIcons from '@element-plus/icons-vue'
import OverviewMetricRow from './OverviewMetricRow.vue'
import type { OverviewCardDto } from '@/modules/dashboard/types/portal-overview'

const props = defineProps<{
  title: string
  iconName: string
  iconBg: string
  metrics: OverviewCardDto['metrics']
  viewDetailPath?: string
}>()

const router = useRouter()

const IconComponent = (): unknown => (ElIcons as Record<string, unknown>)[props.iconName] ?? null

function onView(): void {
  if (props.viewDetailPath) router.push(props.viewDetailPath)
}
</script>

<template>
  <article class="ov-card" data-test="card">
    <header class="ov-card__head">
      <div class="ov-card__icon" :style="{ background: iconBg }">
        <el-icon :size="24" color="#fff">
          <component :is="IconComponent()" />
        </el-icon>
      </div>
      <h3 class="ov-card__title">{{ title }}</h3>
    </header>
    <div class="ov-card__body">
      <OverviewMetricRow v-for="(m, idx) in metrics" :key="idx" :metric="m" />
    </div>
    <footer class="ov-card__foot">
      <button v-if="viewDetailPath" type="button" class="ov-card__view" @click="onView">
        {{ title }} ▶
      </button>
    </footer>
  </article>
</template>

<style lang="scss" scoped>
.ov-card {
  background: #fff;
  border-radius: 8px;
  border: 1px solid #ebeef5;
  padding: 16px;
  display: flex;
  flex-direction: column;

  &__head {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }

  &__icon {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    display: grid;
    place-items: center;
  }

  &__title {
    margin: 0;
    font-size: 16px;
    color: #303133;
  }

  &__body {
    flex: 1;
  }

  &__foot {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px dashed #ebeef5;
  }

  &__view {
    background: none;
    border: none;
    color: #409eff;
    cursor: pointer;
    font-size: 13px;
  }
}
</style>
```

- [ ] **Step 2：提交**

```bash
git add src/modules/dashboard/views/home/components/OverviewCard.vue
git commit -m "feat(portal-home): OverviewCard 单张数据卡片"
```

---

### Task 6.6：OverviewSection（含 TDD，三态分发）

**Files:**

- Create: `src/modules/dashboard/views/home/components/OverviewSection.vue`
- Create: `src/modules/dashboard/views/home/components/OverviewSection.spec.ts`

- [ ] **Step 1：写失败测试**

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createTestingPinia } from '@pinia/testing'
import OverviewSection from './OverviewSection.vue'
import OverviewCardSkeleton from './OverviewCardSkeleton.vue'
import OverviewErrorState from './OverviewErrorState.vue'
import OverviewEmptyState from './OverviewEmptyState.vue'
import OverviewCard from './OverviewCard.vue'
import { usePortalOverviewStore } from '@/modules/dashboard/store/portal-overview'
import type { OverviewCardDto } from '@/modules/dashboard/types/portal-overview'

function mountSection(opts: {
  loading?: boolean
  error?: Error | null
  cards?: OverviewCardDto[]
}) {
  const pinia = createTestingPinia()
  const store = usePortalOverviewStore(pinia)
  store.loading = opts.loading ?? false
  store.error = opts.error ?? null
  store.cards = opts.cards ?? []

  return mount(OverviewSection, {
    global: {
      plugins: [pinia],
      stubs: {
        OverviewCardSkeleton,
        OverviewErrorState,
        OverviewEmptyState,
        OverviewCard,
      },
    },
  })
}

describe('OverviewSection 三态分发', () => {
  it('Loading：渲染 5 个骨架', () => {
    const w = mountSection({ loading: true })
    expect(w.findAllComponents(OverviewCardSkeleton)).toHaveLength(5)
  })

  it('Error：渲染错误组件', () => {
    const w = mountSection({ error: new Error('网络异常') })
    expect(w.find('[role="alert"]').exists()).toBe(true)
  })

  it('Empty：渲染空状态', () => {
    const w = mountSection({ cards: [] })
    expect(w.text()).toContain('暂无数据')
  })

  it('Normal：渲染 N 张卡片', () => {
    const cards: OverviewCardDto[] = [
      { code: 'law', title: '执法监管', iconName: 'odometer', iconBg: 'var(--x)', metrics: [] },
    ]
    const w = mountSection({ cards })
    expect(w.findAllComponents(OverviewCard)).toHaveLength(1)
  })
})
```

- [ ] **Step 2：跑测试，确认失败**

Run: `pnpm test -- OverviewSection`
Expected: FAIL

- [ ] **Step 3：写实现**

```vue
<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { usePortalOverviewStore } from '@/modules/dashboard/store/portal-overview'
import OverviewCard from './OverviewCard.vue'
import OverviewCardSkeleton from './OverviewCardSkeleton.vue'
import OverviewErrorState from './OverviewErrorState.vue'
import OverviewEmptyState from './OverviewEmptyState.vue'

const store = usePortalOverviewStore()
const { cards, loading, error } = storeToRefs(store)
</script>

<template>
  <section class="overview" aria-labelledby="overview-title">
    <header class="overview__header">
      <h2 id="overview-title" class="overview__heading">
        <span class="overview__dot" aria-hidden="true" />
        数据总览
      </h2>
      <div class="overview__period">
        <button type="button" class="overview__chip">自定义</button>
        <button type="button" class="overview__chip active">本月</button>
        <button type="button" class="overview__chip">本季</button>
        <button type="button" class="overview__chip">本年</button>
      </div>
    </header>

    <div v-if="loading" class="overview__grid">
      <OverviewCardSkeleton v-for="i in 5" :key="i" />
    </div>

    <OverviewErrorState v-else-if="error" :message="error.message" @retry="store.fetch()" />

    <OverviewEmptyState v-else-if="cards.length === 0" />

    <div v-else class="overview__grid">
      <OverviewCard
        v-for="card in cards"
        :key="card.code"
        :title="card.title"
        :icon-name="card.iconName"
        :icon-bg="card.iconBg"
        :metrics="card.metrics"
        :view-detail-path="card.viewDetailPath"
      />
    </div>
  </section>
</template>

<style lang="scss" scoped>
.overview {
  margin: 24px 0;

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  &__heading {
    margin: 0;
    font-size: 20px;
    color: #303133;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--el-color-primary);
  }

  &__period {
    display: flex;
    gap: 8px;
  }

  &__chip {
    padding: 4px 12px;
    background: #fff;
    border: 1px solid #dcdfe6;
    border-radius: 4px;
    font-size: 13px;
    color: #606266;
    cursor: pointer;

    &.active {
      background: #ecf5ff;
      border-color: #409eff;
      color: #409eff;
    }
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }
}
</style>
```

- [ ] **Step 4：跑测试，确认通过**

Run: `pnpm test -- OverviewSection`
Expected: PASS（4/4）

- [ ] **Step 5：提交**

```bash
git add src/modules/dashboard/views/home/components/OverviewSection.vue src/modules/dashboard/views/home/components/OverviewSection.spec.ts
git commit -m "feat(portal-home): OverviewSection 数据总览容器（含 4 项三态测试）"
```

---

## Phase 7：Home Index 组合 + 路由切换

### Task 7.1：Home Index 页面

**Files:**

- Create: `src/modules/dashboard/views/home/Index.vue`

- [ ] **Step 1：写文件**

```vue
<script setup lang="ts">
import { onMounted } from 'vue'
import { usePortalOverviewStore } from '@/modules/dashboard/store/portal-overview'
import HeroSection from './components/HeroSection.vue'
import DateGreeting from './components/DateGreeting.vue'
import OverviewSection from './components/OverviewSection.vue'

const store = usePortalOverviewStore()

onMounted(() => {
  store.fetch()
})
</script>

<template>
  <div class="home">
    <HeroSection />
    <DateGreeting />
    <OverviewSection />
  </div>
</template>

<style lang="scss" scoped>
.home {
  display: flex;
  flex-direction: column;
}
</style>
```

- [ ] **Step 2：跑类型检查**

Run: `pnpm type-check`
Expected: PASS

- [ ] **Step 3：提交**

```bash
git add src/modules/dashboard/views/home/Index.vue
git commit -m "feat(portal-home): home/Index.vue 组合页面"
```

---

### Task 7.2：删除旧 Index.vue + 切换路由

**Files:**

- Delete: `src/modules/dashboard/views/Index.vue`
- Modify: `src/modules/dashboard/routes/index.ts`

- [ ] **Step 1：删除旧文件**

```bash
rm "src/modules/dashboard/views/Index.vue"
```

- [ ] **Step 2：改路由 component 路径**

修改 `src/modules/dashboard/routes/index.ts`：

```ts
// 改前：
// component: () => import('@/layouts/default/index.vue'),

// 改后：
component: () => import('@/layouts/portal/index.vue'),
```

- [ ] **Step 3：跑类型检查**

Run: `pnpm type-check`
Expected: PASS

- [ ] **Step 4：启动 dev 验证**

```bash
pnpm dev
```

浏览器访问 `http://localhost:5173/dashboard`，应看到门户首页 5 张数据卡 + 顶部 banner + 横向 nav + AI 浮窗 + footer。

- [ ] **Step 5：跑全部测试**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 6：跑覆盖率**

Run: `pnpm test:coverage`
Expected: ≥80%

- [ ] **Step 7：提交**

```bash
git add src/modules/dashboard/routes/index.ts
git commit -m "refactor(routes): /dashboard 切换至 PortalLayout"
```

---

### Task 7.3：CHANGELOG

**Files:**

- Modify: `CHANGELOG.md`

- [ ] **Step 1：在最新章节追加一条**

```markdown
### feat(portal) — 2026-07-23

新增政府门户首页 Layout：`/dashboard` 切换至 PortalLayout（顶部蓝 banner + 横向导航 + Hero 搜索 + 数据总览 5 卡 + 系统链接 footer + AI 占位浮窗）。与现有 admin layout 双 layout 并存，业务子页零影响。

新增 26 个文件，修改 2 个文件，删除 1 个文件。
```

- [ ] **Step 2：提交**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): 记录 portal 首页 layout 重构"
```

---

### Task 7.4：清理备份

- [ ] **Step 1：移除备份目录**

```bash
rm -rf ".claude/backups/portal-home-2026-07-23"
```

- [ ] **Step 2：最终验证**

```bash
pnpm type-check
pnpm test
pnpm dev
```

手动验证清单：

- [ ] 首页 5 张数据卡渲染正确
- [ ] Loading 骨架出现（断网时）
- [ ] Error 态 + 重试按钮（mock 报错时）
- [ ] Empty 态（mock 返回空数组时）
- [ ] 顶部蓝 banner 渐变
- [ ] 横向导航 5 项高亮当前路由
- [ ] 用户信息卡显示当前用户名
- [ ] AI 浮窗点击 → toast
- [ ] Footer 系统链接 + 版权
- [ ] 切到 /orders → 仍是旧 admin layout
- [ ] 切到 /reports → 仍是旧 admin layout

---

## 总结

| Phase         | 任务数 | 文件数                  |
| ------------- | ------ | ----------------------- |
| 0 备份        | 1      | 1                       |
| 1 基础        | 6      | 6                       |
| 2 Mock/API    | 2      | 2                       |
| 3 Store       | 2      | 2                       |
| 4 Layout 壳   | 5      | 5                       |
| 5 Hero        | 4      | 4                       |
| 6 Overview    | 6      | 6（含 2 测试文件）      |
| 7 路由 + 验证 | 4      | 1（CHANGELOG）          |
| **总计**      | **30** | **27（含 3 测试文件）** |

预计总任务量 ≈ 30 步，每步 2-5 分钟，预计总耗时 2-4 小时（不含 dev 启动验证等待）。
