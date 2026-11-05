# Home + Portal 企业官网重构 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 丢弃现有门户首页与 portal 头部，重构为「星澜科技」黑白极简企业官网（精简三屏、锚点滚动、全 SVG、公开访问）。

**Architecture:** 官网区块全部归入 `home` 模块（`config/site.ts` 文案单源 + 5 个展示组件）；`portal` 布局只留壳 + 64px 白底 Header（锚点导航 + 登录/用户双态）；公开访问经 `ROUTE_WHITE_LIST` 按 name 豁免登录检查（守卫不读 `meta.requiresAuth`，这是唯一公开机制）。

**Tech Stack:** Vue 3.5 `<script setup>` + SCSS（BEM §3 规范）+ unplugin-icons（tabler 线性集合）+ Vitest/VTU。

**Spec:** [`../specs/2026-10-20-home-portal-enterprise-site-design.md`](../specs/2026-10-20-home-portal-enterprise-site-design.md)

**关键约束（执行前必读）:**
1. **BEM 硬规则**：`createNamespace('kebab-case')` auto-imported（禁 import）；`<style lang="scss">` **禁 scoped**；根选择器 `.#{$BEM_PREFIX}-<kebab>`；非 scoped 下禁用 `:deep()`，直接写后代选择器。
2. **图标只许** `i-tabler-*`（enabledCollections: ep/tabler/app）；特性卡用 tabler 线性图标。
3. **路由跳转只用 `useAppRouter`**（auto-imported）；单测里 `vi.mock('@/composables/useAppRouter', ...)`（既有模式）。
4. **commit 步骤**：按用户全局规则，每次 commit 前须征得用户确认（可一次性授权整批）；commit msg 用中文 conventional 格式（`feat(home): ...`）。
5. 所有文案进 `config/site.ts`，组件内**禁止硬编码中文字符串**（BEM class 除外）。

---

### Task 1: PortalNav 锚点导航（TDD）

**Files:**
- Modify: `src/layouts/portal/config/types.ts`（收窄为锚点模型）
- Modify: `src/layouts/portal/config/nav.ts`（重写为 PORTAL_NAV 锚点配置）
- Test: `src/layouts/portal/components/PortalNav.spec.ts`（新建）
- Modify: `src/layouts/portal/components/PortalNav.vue`（重写为纯链接列表 + scroll-spy）

- [ ] **Step 1: 写失败测试 `src/layouts/portal/components/PortalNav.spec.ts`**

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import PortalNav from './PortalNav.vue'
import { PORTAL_NAV } from '@/layouts/portal/config/nav'

describe('PortalNav 锚点导航', () => {
  let scrollIntoViewMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // jsdom 未实现 scrollIntoView，手动 stub（组件点击锚点会调用）
    scrollIntoViewMock = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoViewMock
  })

  it('1. 渲染全部导航项链接，href 指向锚点', () => {
    const w = mount(PortalNav, { props: { items: PORTAL_NAV } })
    const links = w.findAll('a')
    expect(links).toHaveLength(PORTAL_NAV.length)
    for (let i = 0; i < links.length; i++) {
      expect(links[i].attributes('href')).toBe(PORTAL_NAV[i].anchor)
    }
    expect(w.text()).toContain('产品')
  })

  it('2. 点击导航项平滑滚动到对应锚点并高亮当前项', async () => {
    const target = document.createElement('section')
    target.id = 'features'
    document.body.appendChild(target)

    const w = mount(PortalNav, { props: { items: PORTAL_NAV }, attachTo: document.body })
    const link = w.findAll('a')[1] // 产品
    await link.trigger('click')

    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1)
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
    expect(link.classes()).toContain('is-active')
    expect(w.findAll('a')[0].classes()).not.toContain('is-active')

    target.remove()
    w.unmount()
  })

  it('3. 初始高亮第一项（jsdom 无 IntersectionObserver，scroll-spy 静默跳过）', () => {
    const w = mount(PortalNav, { props: { items: PORTAL_NAV } })
    expect(w.findAll('a')[0].classes()).toContain('is-active')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/layouts/portal/components/PortalNav.spec.ts`
Expected: FAIL（`PORTAL_NAV[i].anchor` undefined / 旧 nav.ts 无 anchor 字段）

- [ ] **Step 3: 重写 `src/layouts/portal/config/types.ts`（全文件替换）**

```ts
/**
 * 顶部导航配置类型（PortalNav 使用）。
 *
 * 2026-10-20 企业官网改造：导航项从「路由/外链/子菜单」模型收窄为「页面锚点」模型，
 * 点击行为统一为平滑滚动（见 PortalNav.vue）。
 *
 * @see [`../components/PortalNav.vue`](../components/PortalNav.vue) 渲染消费方
 * @see [`./nav.ts`](./nav.ts) PORTAL_NAV 配置
 * @group 布局：Portal
 */

/**
 * 顶部导航项（锚点模型）。
 *
 * - anchor 为页面内区块选择器（如 '#features'），点击平滑滚动过去
 * - key 同时是区块元素 id（不含 #），scroll-spy 用它回写高亮
 */
export interface PortalNavItem {
  key: string
  label: string
  /** 页面内锚点选择器（如 '#features'），对应区块元素 id = key */
  anchor: string
}
```

- [ ] **Step 4: 重写 `src/layouts/portal/config/nav.ts`（全文件替换）**

```ts
import type { PortalNavItem } from './types'

/**
 * 顶部锚点导航配置（企业官网）。
 *
 * key 与各区块元素 id 一一对应（SiteHero/SiteFeatures/SiteStats/SiteAbout 根元素）。
 * 增删区块时需同步三处：home 视图对应组件的根元素 id、本配置、页脚锚点链接（config/site.ts）。
 *
 * @see [`./types.ts`](./types.ts) PortalNavItem 类型定义
 * @see [`../components/PortalNav.vue`](../components/PortalNav.vue) 渲染消费方
 * @group 布局：Portal
 */
export const PORTAL_NAV: PortalNavItem[] = [
  { key: 'hero', label: '首页', anchor: '#hero' },
  { key: 'features', label: '产品', anchor: '#features' },
  { key: 'stats', label: '数据', anchor: '#stats' },
  { key: 'about', label: '关于', anchor: '#about' },
]
```

- [ ] **Step 5: 重写 `src/layouts/portal/components/PortalNav.vue`（全文件替换）**

```vue
<script setup lang="ts">
/**
 * PortalNav：企业官网顶部锚点导航（纯链接列表）。
 *
 * 2026-10-20 企业官网改造：弃用 el-menu（hover 子菜单/激活态是后台管理范式），
 * 改为真实 <a href="#anchor"> 链接：
 * - 点击 → click.prevent 后 scrollIntoView 平滑滚动（保留 href 供无 JS / SEO 降级）
 * - 当前区块高亮 → IntersectionObserver scroll-spy（rootMargin 顶部偏移 header 高度 64px）
 * - jsdom / 旧浏览器无 IntersectionObserver 时静默跳过（守卫判断，点击高亮仍可用）
 *
 * @see [`../config/nav.ts`](../config/nav.ts) 锚点配置
 * @see [`../config/types.ts`](../config/types.ts) PortalNavItem 类型
 * @group 布局：Portal
 */
import type { PortalNavItem } from '@/layouts/portal/config/types'

const bem = createNamespace('portal-nav')

const props = defineProps<{
  items: PortalNavItem[]
}>()

/** 当前高亮导航 key（初始首项；点击 / scroll-spy 回写） */
const activeKey = ref(props.items[0]?.key ?? '')

let observer: IntersectionObserver | undefined

function scrollTo(item: PortalNavItem): void {
  activeKey.value = item.key
  document.querySelector(item.anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

onMounted(() => {
  // jsdom 与部分旧浏览器无 IntersectionObserver，跳过 scroll-spy
  if (typeof IntersectionObserver === 'undefined') return
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) activeKey.value = entry.target.id
      }
    },
    // 顶部 -64px（header 高度）：区块顶边越过 header 下沿才算进入视口
    { rootMargin: '-64px 0px -70% 0px' }
  )
  for (const item of props.items) {
    const el = document.querySelector(item.anchor)
    if (el) observer.observe(el)
  }
})

onUnmounted(() => {
  observer?.disconnect()
})
</script>

<template>
  <nav :class="bem.b()" aria-label="主导航">
    <a
      v-for="item in items"
      :key="item.key"
      :href="item.anchor"
      :class="[bem.e('link'), { 'is-active': activeKey === item.key }]"
      @click.prevent="scrollTo(item)"
      >{{ item.label }}</a
    >
  </nav>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-portal-nav {
  display: flex;
  align-items: center;
  gap: 32px;

  &__link {
    position: relative;
    font-size: 15px;
    color: var(--portal-ink-2);
    text-decoration: none;
    line-height: var(--portal-header-h);
    transition: color 0.2s ease;

    &:hover {
      color: var(--portal-ink);
    }

    // 激活态：黑色短下划线
    &.is-active {
      color: var(--portal-ink);
      font-weight: 600;

      &::after {
        content: '';
        position: absolute;
        left: 50%;
        bottom: 14px;
        transform: translateX(-50%);
        width: 16px;
        height: 2px;
        background: var(--portal-ink);
      }
    }
  }

  // 窄屏隐藏锚点导航，保留品牌 + 登录入口（移动端无汉堡菜单，KISS）
  @media (max-width: 768px) {
    display: none;
  }
}
</style>
```

- [ ] **Step 6: 跑测试确认通过**

Run: `pnpm test src/layouts/portal/components/PortalNav.spec.ts`
Expected: PASS（3 例）

- [ ] **Step 7: Commit（需用户确认）**

```bash
git add src/layouts/portal/config/types.ts src/layouts/portal/config/nav.ts src/layouts/portal/components/PortalNav.vue src/layouts/portal/components/PortalNav.spec.ts
git commit -m "refactor(portal): 顶部导航改为企业官网锚点滚动模型"
```

---

### Task 2: Portal 视觉 token + PortalHeader 双态（TDD）

**Files:**
- Modify: `src/layouts/portal/styles/portal-tokens.scss`（重写为黑白极简 token）
- Test: `src/layouts/portal/components/PortalHeader.spec.ts`（重写）
- Modify: `src/layouts/portal/components/PortalHeader.vue`（重写为 64px 白底 + 登录/用户双态）
- Modify: `src/layouts/portal/index.vue`（仅文件头注释更新）

- [ ] **Step 1: 重写 `src/layouts/portal/styles/portal-tokens.scss`（全文件替换）**

```scss
// Portal 视觉 token（2026-10-20 企业官网改造）
// 黑白极简：无彩色，层级靠字重 + 留白 + 1px 细线

:root {
  // 布局常量
  --portal-header-h: 64px; // sticky 顶栏高度
  --portal-max-width: 1200px; // 内容区宽度
  --portal-bg: #ffffff; // 页面底
  --portal-bg-alt: #fafafa; // 分区底（特性区）
  --portal-ink: #111111; // 主文字
  --portal-ink-2: #555555; // 次要文字
  --portal-line: #eeeeee; // 1px 细线
  --portal-z-index-header: 1000; // 顶栏 z-index
}
```

- [ ] **Step 2: 写失败测试 `src/layouts/portal/components/PortalHeader.spec.ts`（全文件替换）**

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { nextTick, ref, reactive } from 'vue'

// mock useAppRouter（auto-import 在 vitest 走同一 vite 管线，解析到 '@/composables/useAppRouter'）
const mockGoLogin = vi.fn()
vi.mock('@/composables/useAppRouter', () => ({
  useAppRouter: () => ({ goLogin: mockGoLogin }),
}))

// mock useUserStore（组件仅消费 profile）
const mockProfile = ref<{ name: string } | null>({ name: '张三' })
const mockUserStore = reactive({
  profile: mockProfile,
  permissions: [] as string[],
  isLoggedIn: true,
})
vi.mock('@/store/modules/user', () => ({
  useUserStore: () => mockUserStore,
}))

// mock useLogout
const mockLoggingOut = ref(false)
const mockConfirmLogout = vi.fn()
vi.mock('@/composables/useLogout', () => ({
  useLogout: () => ({ loggingOut: mockLoggingOut, confirmLogout: mockConfirmLogout }),
}))

const map: Record<string, string> = { 'auth.logout': '退出' }
const mockT = (key: string): string => map[key] ?? key

import PortalHeader from './PortalHeader.vue'

describe('PortalHeader 企业官网顶栏', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockProfile.value = { name: '张三' }
    mockLoggingOut.value = false
  })

  it('1. 渲染品牌名与全部锚点导航', () => {
    const w = mount(PortalHeader, { global: { mocks: { $t: mockT } } })
    expect(w.text()).toContain('星澜科技')
    // 品牌 logo 锚点(1) + 导航锚点(4)
    expect(w.findAll('a')).toHaveLength(5)
    expect(w.text()).toContain('产品')
  })

  it('2. 未登录显示「登录」按钮，点击调 goLogin', async () => {
    mockProfile.value = null
    const w = mount(PortalHeader, { global: { mocks: { $t: mockT } } })
    const btn = w.find('.vv-portal-header__login')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')
    expect(mockGoLogin).toHaveBeenCalledTimes(1)
  })

  it('3. 已登录显示用户菜单，下拉「退出」触发 confirmLogout', async () => {
    const w = mount(PortalHeader, {
      global: { mocks: { $t: mockT } },
      attachTo: document.body,
    })
    expect(w.find('.vv-portal-header__login').exists()).toBe(false)
    const trigger = w.find('.vv-portal-header__user')
    expect(trigger.text()).toContain('张三')
    await trigger.trigger('click')
    await nextTick()
    const item = document.querySelector('.el-dropdown-menu__item') as HTMLElement | null
    expect(item?.textContent).toContain('退出')
    item?.click()
    await nextTick()
    expect(mockConfirmLogout).toHaveBeenCalledTimes(1)
  })

  it('4. loggingOut=true 时退出项禁用', async () => {
    mockLoggingOut.value = true
    const w = mount(PortalHeader, {
      global: { mocks: { $t: mockT } },
      attachTo: document.body,
    })
    await w.find('.vv-portal-header__user').trigger('click')
    await nextTick()
    expect(
      document.querySelector('.el-dropdown-menu__item')?.classList.contains('is-disabled')
    ).toBe(true)
    mockLoggingOut.value = false
  })
})
```

- [ ] **Step 3: 跑测试确认失败**

Run: `pnpm test src/layouts/portal/components/PortalHeader.spec.ts`
Expected: FAIL（`__login` 不存在 / `goLogin` 未调用——旧 header 无此结构）

- [ ] **Step 4: 重写 `src/layouts/portal/components/PortalHeader.vue`（全文件替换）**

```vue
<script setup lang="ts">
/**
 * 门户头部（2026-10-20 企业官网改造）：sticky 白底细线 + 品牌区 + 锚点导航 + 登录/用户双态。
 *
 * 对比旧版 180px 位图头部：
 * - 高度 64px；背景位图（layout-head-bg/logo/biaoyu 三张 png）→ 纯色 + 内联 SVG 字标
 * - 右侧双态：未登录 → 「登录」按钮（goLogin）；已登录 → 用户下拉（useLogout 退出流程保留）
 *
 * A11y：<header role="banner">；品牌区是真实锚点（href="#hero"）；导航 aria-label 由 PortalNav 承担。
 *
 * @see [`./PortalNav.vue`](./PortalNav.vue) 锚点导航
 * @see [`@composables/useLogout`](../../../composables/useLogout.ts) 退出流程
 * @group 布局：Portal
 */
import { useUserStore } from '@/store/modules/user'
import { useLogout } from '@composables/useLogout'
import { ArrowDown, SwitchButton } from '@element-plus/icons-vue'
import { PORTAL_NAV } from '@/layouts/portal/config/nav'
import PortalNav from './PortalNav.vue'

const bem = createNamespace('portal-header')

const userStore = useUserStore()
const { goLogin } = useAppRouter() // 项目 composable @composables/useAppRouter（vite 自动注入）
const { loggingOut, confirmLogout } = useLogout()

async function onCommand(cmd: string) {
  if (cmd === 'logout') {
    await confirmLogout()
  }
}
</script>

<template>
  <header :class="bem.b()" role="banner">
    <div :class="bem.e('inner')">
      <a :class="bem.e('brand')" href="#hero" aria-label="星澜科技 回到首页">
        <svg :class="bem.e('mark')" viewBox="0 0 32 32" aria-hidden="true">
          <rect width="32" height="32" rx="7" fill="#111" />
          <path
            d="M7 12c3-3 6 3 9 0s6 3 9 0"
            stroke="#fff"
            stroke-width="2"
            fill="none"
            stroke-linecap="round"
          />
          <path
            d="M7 19c3-3 6 3 9 0s6 3 9 0"
            stroke="#fff"
            stroke-width="2"
            fill="none"
            stroke-linecap="round"
            opacity=".6"
          />
        </svg>
        <span :class="bem.e('name')">星澜科技</span>
      </a>

      <PortalNav :items="PORTAL_NAV" />

      <div :class="bem.e('actions')">
        <button v-if="!userStore.profile" type="button" :class="bem.e('login')" @click="goLogin()">
          登录
        </button>
        <el-dropdown v-else trigger="click" :class="bem.e('dropdown')" @command="onCommand">
          <div :class="bem.e('user')" tabindex="0" role="button" aria-haspopup="menu">
            <span :class="bem.e('avatar')">{{ userStore.profile.name?.charAt(0) ?? '?' }}</span>
            <span :class="bem.e('username')">{{ userStore.profile.name }}</span>
            <el-icon :class="bem.e('caret')"><ArrowDown /></el-icon>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="logout" :disabled="loggingOut">
                <el-icon class="el-icon--left"><SwitchButton /></el-icon>
                <span>{{ loggingOut ? '退出中...' : $t('auth.logout') }}</span>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
  </header>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-portal-header {
  position: sticky;
  top: 0;
  z-index: var(--portal-z-index-header);
  width: 100%;
  height: var(--portal-header-h);
  background: var(--portal-bg);
  border-bottom: 1px solid var(--portal-line);

  &__inner {
    max-width: var(--portal-max-width);
    margin: 0 auto;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 32px;
    padding: 0 24px;
    box-sizing: border-box;
  }

  &__brand {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    flex-shrink: 0;
  }

  &__mark {
    width: 28px;
    height: 28px;
    display: block;
  }

  &__name {
    font-size: 17px;
    font-weight: 700;
    color: var(--portal-ink);
    letter-spacing: 0.5px;
  }

  &__actions {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  // 未登录态：黑底白字按钮，hover 反白互换
  &__login {
    height: 34px;
    padding: 0 18px;
    font-size: 14px;
    color: #fff;
    background: var(--portal-ink);
    border: 1px solid var(--portal-ink);
    border-radius: 4px;
    cursor: pointer;
    transition:
      background 0.2s ease,
      color 0.2s ease;

    &:hover {
      background: transparent;
      color: var(--portal-ink);
    }
  }

  &__dropdown {
    display: inline-flex;
  }

  &__user {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 10px;
    border-radius: 4px;
    cursor: pointer;
    outline: none;

    &:hover,
    &:focus-visible {
      background: var(--portal-bg-alt);
    }
  }

  &__avatar {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: var(--portal-ink);
    color: #fff;
    display: grid;
    place-items: center;
    font-size: 12px;
    font-weight: 600;
  }

  &__username {
    font-size: 14px;
    color: var(--portal-ink);
  }

  &__caret {
    display: inline-flex;
    color: var(--portal-ink-2);
    font-size: 12px;
    transition: transform 0.2s ease;
  }

  &__dropdown:hover &__caret,
  &__dropdown:focus-within &__caret {
    transform: rotate(180deg);
  }

  @media (max-width: 768px) {
    &__inner {
      gap: 16px;
      padding: 0 16px;
    }
  }
}
</style>
```

- [ ] **Step 5: 更新 `src/layouts/portal/index.vue` 文件头注释**

将 `<script setup>` 上方的文档注释整体替换为：

```ts
/**
 * Portal 布局：企业官网专用头部 + 路由出口。
 *
 * 职责：只负责头部（PortalHeader：品牌区 + 锚点导航 + 登录/用户双态）与一行内容出口。
 *      导航以下的所有官网区块（Hero/特性/数据/关于/页脚）由 home 模块自管。
 *
 * 2026-10-20 改造：头部从 180px 位图政务风改为 64px 白底极简风（见 PortalHeader 头注释）。
 *
 * @see [`./components/PortalHeader.vue`](./components/PortalHeader.vue) 门户头部
 * @see [`./components/PortalNav.vue`](./components/PortalNav.vue) 顶部锚点导航
 * @see [`@/modules/home`](../../modules/home) 官网业务内容
 * @group 布局
 */
```

- [ ] **Step 6: 跑测试确认通过**

Run: `pnpm test src/layouts/portal/components/PortalHeader.spec.ts`
Expected: PASS（4 例）

- [ ] **Step 7: Commit（需用户确认）**

```bash
git add src/layouts/portal/styles/portal-tokens.scss src/layouts/portal/components/PortalHeader.vue src/layouts/portal/components/PortalHeader.spec.ts src/layouts/portal/index.vue
git commit -m "refactor(portal): 头部重构为 64px 白底极简顶栏，登录/用户双态"
```

---

### Task 3: 路由公开访问 + 站点配置单源 + barrel 清理

**Files:**
- Modify: `src/router/whitelist.ts`（追加 `'Home'`）
- Modify: `src/modules/home/routes/index.ts`（删 requiresAuth + 注释更新）
- Modify: `src/modules/home/index.ts`（清掉 useHomeStore re-export）
- Create: `src/modules/home/config/site.ts`（站点文案/数据单源）

- [ ] **Step 1: 修改 `src/router/whitelist.ts`**

在 `ROUTE_WHITE_LIST` 字面量数组中，`'Login', // 登录页` 行之后插入一行：

```ts
  'Login', // 登录页
  'Home', // 企业官网首页（公开访问：门户落地页免登录，登录入口在页内顶栏）
```

- [ ] **Step 2: 重写 `src/modules/home/routes/index.ts`（全文件替换）**

```ts
/**
 * home 模块路由。
 *
 * 自动注册：被 `src/router/auto-register.ts` 扫描到，无需手动 import。
 *
 * 设计（2026-10-20 企业官网改造）：
 * - `/home` 使用 `portal` 布局（简约顶栏 + 锚点导航的企业官网）
 * - 公开访问：经 `src/router/whitelist.ts` 的 ROUTE_WHITE_LIST 按 name 豁免登录/权限检查
 *   （守卫 checkLoginState 不读 meta.requiresAuth，白名单是唯一公开机制）
 * - 首页刻意不进多页签（meta.noTags: true），portal 落地页通过顶部锚点导航返回即可
 * - 远程菜单模式下，后端返回的菜单项会覆盖本地静态路由
 *
 * @see [`@/router/auto-register.ts`](../../../router/auto-register.ts) 自动注册入口
 * @see [`@/router/whitelist.ts`](../../../router/whitelist.ts) 公开访问白名单
 * @see [`../views/index.vue`](../views/index.vue) 官网首页视图
 * @group 业务模块：Home
 */

import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/home',
    component: () => import('@/layouts/portal/index.vue'),
    children: [
      {
        path: '',
        name: 'Home',
        component: () => import('../views/index.vue'),
        meta: {
          title: '首页',
          titleKey: 'menu.home',
          icon: 'odometer',
          noTags: true,
        },
      },
    ],
  },
]

export default routes
```

- [ ] **Step 3: 重写 `src/modules/home/index.ts`（全文件替换）**

```ts
/**
 * home 模块公开出口（barrel）。
 *
 * 2026-10-20 企业官网改造：官网为纯静态展示页（文案集中在 `./config/site.ts`），
 * 不再有对外暴露的 store / composable；本文件仅保留模块说明。
 *
 * @see [`./routes`](./routes/index.ts) 路由定义（被 router/auto-register 扫描）
 * @see [`./config/site.ts`](./config/site.ts) 站点文案/数据单源
 * @see [`./views/index.vue`](./views/index.vue) 官网首页入口
 * @group 业务模块：Home
 */
export {}
```

- [ ] **Step 4: 创建 `src/modules/home/config/site.ts`**

```ts
/**
 * 星澜科技企业官网 —— 站点文案与数据单源。
 *
 * 设计：
 * - 所有区块（Hero/特性/数据/关于/页脚）的文案集中于此，组件只读渲染，不硬编码字符串
 * - 全静态：无请求、无 i18n（官网单语言，YAGNI；路由 meta.titleKey 走既有 i18n 不受影响）
 * - `as const` 保证消费方不能意外改写
 *
 * @see [`../views/index.vue`](../views/index.vue) 官网页面组合
 * @group 业务模块：Home
 */

/** 品牌标识（顶栏 + 页脚共用） */
export const SITE_BRAND = {
  name: '星澜科技',
  /** 页脚品牌行英文小字 */
  nameEn: 'XINGLAN TECH',
  slogan: '让数据成为企业增长的引擎',
} as const

/** Hero 首屏（id=hero） */
export const SITE_HERO = {
  /** 眉题：全大写小字 */
  kicker: 'CLOUD DATA PLATFORM',
  /** 主标题两行（模板用 <br> 连接） */
  titleLines: ['让数据成为', '企业增长的引擎'] as const,
  subtitle: '一站式云端数据平台，助力企业快速构建智能应用，释放数据的全部价值。',
  /** 主按钮：跳登录（项目无注册页，免费试用 = 登录后开通） */
  primaryCta: { label: '免费试用', to: '/login' },
  /** 次按钮：同为登录（预约演示由登录后流程承接） */
  secondaryCta: { label: '预约演示', to: '/login' },
} as const

/** 产品特性（id=features，3 卡；icon 为组件内静态 tabler 标签，见 SiteFeatures.vue） */
export const SITE_FEATURES = [
  {
    title: '实时分析引擎',
    desc: '毫秒级查询响应，支撑百万级 QPS 的实时看板与即席分析。',
  },
  {
    title: '企业级安全',
    desc: '端到端加密与细粒度权限管控，满足合规审计要求。',
  },
  {
    title: '云原生架构',
    desc: '弹性伸缩、开箱即用，分钟级完成集群部署与扩缩容。',
  },
] as const

/** 数据指标（id=stats；静态数字——刻意不做滚动计数，KISS） */
export const SITE_STATS = [
  { value: '99.99%', label: '服务可用性' },
  { value: '10ms', label: '平均查询延迟' },
  { value: '5000+', label: '服务企业客户' },
  { value: '100万+', label: '日均处理请求' },
] as const

/** 关于与联系（id=about） */
export const SITE_ABOUT = {
  heading: '关于星澜',
  /** 公司简介段落 */
  paragraphs: [
    '星澜科技成立于 2016 年，专注于云端数据平台的研发与服务，帮助企业把复杂的数据基础设施化繁为简。',
    '我们相信数据是企业的核心资产，而优秀的平台能让每一位工程师都轻松驾驭它。',
  ] as const,
  contacts: [
    { label: '商务合作', value: 'hello@xinglan.tech' },
    { label: '公司地址', value: '北京市海淀区中关村创业大街 1 号' },
    { label: '服务热线', value: '400-888-0000' },
  ] as const,
} as const

/** 页脚 */
export const SITE_FOOTER = {
  /** 链接组：全部指向页内锚点，无死链 */
  links: [
    { label: '产品特性', anchor: '#features' },
    { label: '数据指标', anchor: '#stats' },
    { label: '关于我们', anchor: '#about' },
  ] as const,
  /** ICP 备案占位（虚构） */
  icp: '京ICP备2026000000号-1',
} as const
```

- [ ] **Step 5: 校验**

Run: `pnpm check:routes && pnpm type-check:full`
Expected: 均退出码 0

- [ ] **Step 6: Commit（需用户确认）**

```bash
git add src/router/whitelist.ts src/modules/home/routes/index.ts src/modules/home/index.ts src/modules/home/config/site.ts
git commit -m "feat(home): /home 经白名单公开访问，新增企业官网站点配置单源"
```

---

### Task 4: SiteHero 首屏（TDD）

**Files:**
- Test: `src/modules/home/components/SiteHero.spec.ts`（新建）
- Create: `src/modules/home/components/SiteHero.vue`

- [ ] **Step 1: 写失败测试 `src/modules/home/components/SiteHero.spec.ts`**

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockGoLogin = vi.fn()
vi.mock('@/composables/useAppRouter', () => ({
  useAppRouter: () => ({ goLogin: mockGoLogin }),
}))

import SiteHero from './SiteHero.vue'
import { SITE_HERO } from '../config/site'

describe('SiteHero 官网首屏', () => {
  beforeEach(() => vi.clearAllMocks())

  it('1. 渲染 kicker / 主标题 / 副文案', () => {
    const w = mount(SiteHero)
    expect(w.text()).toContain(SITE_HERO.kicker)
    expect(w.text()).toContain(SITE_HERO.titleLines[0])
    expect(w.text()).toContain(SITE_HERO.subtitle)
  })

  it('2. 两个 CTA 按钮点击均跳登录', async () => {
    const w = mount(SiteHero)
    const btns = w.findAll('button')
    expect(btns).toHaveLength(2)
    await btns[0].trigger('click')
    await btns[1].trigger('click')
    expect(mockGoLogin).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/modules/home/components/SiteHero.spec.ts`
Expected: FAIL（组件不存在）

- [ ] **Step 3: 创建 `src/modules/home/components/SiteHero.vue`**

```vue
<script setup lang="ts">
/**
 * 官网 Hero 首屏（id=hero）：左文案 + 右线条 SVG 产品示意图。
 *
 * 设计：
 * - 文案来自 `config/site.ts`（SITE_HERO）；两个 CTA 均 goLogin（项目无注册页，见 site.ts 注释）
 * - 右侧示意图为内联 SVG（折线 + 柱状 + 网格，单色 stroke），仅此处使用故不独立成文件
 * - 入场动画 fade-up（≤0.6s 递增 delay）；prefers-reduced-motion 时关闭（a11y）
 *
 * @see [`../../config/site.ts`](../../config/site.ts) SITE_HERO 文案单源
 * @group 业务模块：Home
 */
import { SITE_HERO } from '../../config/site'

const bem = createNamespace('site-hero')

const { goLogin } = useAppRouter() // 项目 composable @composables/useAppRouter（vite 自动注入）
</script>

<template>
  <section id="hero" :class="bem.b()">
    <div :class="bem.e('inner')">
      <div :class="bem.e('copy')">
        <p :class="bem.e('kicker')">{{ SITE_HERO.kicker }}</p>
        <h1 :class="bem.e('title')">
          {{ SITE_HERO.titleLines[0] }}<br />{{ SITE_HERO.titleLines[1] }}
        </h1>
        <p :class="bem.e('subtitle')">{{ SITE_HERO.subtitle }}</p>
        <div :class="bem.e('actions')">
          <button type="button" :class="[bem.e('btn'), bem.m('primary')]" @click="goLogin()">
            {{ SITE_HERO.primaryCta.label }}
          </button>
          <button type="button" :class="[bem.e('btn'), bem.m('ghost')]" @click="goLogin()">
            {{ SITE_HERO.secondaryCta.label }}
          </button>
        </div>
      </div>

      <svg
        :class="bem.e('art')"
        viewBox="0 0 480 360"
        role="img"
        aria-label="数据面板示意图"
      >
        <rect
          x="8"
          y="8"
          width="464"
          height="344"
          rx="10"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        />
        <line x1="8" y1="52" x2="472" y2="52" stroke="currentColor" stroke-width="1" />
        <circle cx="32" cy="30" r="5" fill="currentColor" />
        <rect x="48" y="24" width="96" height="12" rx="6" fill="currentColor" opacity=".25" />
        <g stroke="currentColor" stroke-width="0.5" opacity=".15">
          <line v-for="y in [100, 150, 200, 250, 300]" :key="y" x1="32" :y1="y" x2="448" :y2="y" />
        </g>
        <g fill="currentColor" opacity=".2">
          <rect x="60" y="220" width="28" height="80" />
          <rect x="104" y="180" width="28" height="120" />
          <rect x="148" y="240" width="28" height="60" />
          <rect x="192" y="150" width="28" height="150" />
          <rect x="236" y="200" width="28" height="100" />
        </g>
        <polyline
          points="60,200 130,150 200,180 270,110 340,140 410,80"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <g fill="currentColor">
          <circle cx="270" cy="110" r="4.5" />
          <circle cx="410" cy="80" r="4.5" />
        </g>
      </svg>
    </div>
  </section>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-site-hero {
  background: var(--portal-bg);

  &__inner {
    max-width: var(--portal-max-width);
    margin: 0 auto;
    padding: 96px 24px;
    min-height: calc(100vh - var(--portal-header-h));
    display: grid;
    grid-template-columns: 1fr 1fr;
    align-items: center;
    gap: 64px;
    box-sizing: border-box;
  }

  &__kicker {
    font-size: 13px;
    letter-spacing: 2px;
    color: var(--portal-ink-2);
    margin: 0 0 20px;
  }

  &__title {
    font-size: clamp(36px, 5vw, 56px);
    line-height: 1.2;
    font-weight: 700;
    color: var(--portal-ink);
    margin: 0 0 24px;
  }

  &__subtitle {
    font-size: 17px;
    line-height: 1.8;
    color: var(--portal-ink-2);
    margin: 0 0 40px;
    max-width: 30em;
  }

  &__actions {
    display: flex;
    gap: 16px;
  }

  &__btn {
    height: 46px;
    padding: 0 28px;
    font-size: 15px;
    border-radius: 4px;
    cursor: pointer;
    transition:
      background 0.2s ease,
      color 0.2s ease;

    &--primary {
      background: var(--portal-ink);
      color: #fff;
      border: 1px solid var(--portal-ink);

      &:hover {
        background: transparent;
        color: var(--portal-ink);
      }
    }

    &--ghost {
      background: transparent;
      color: var(--portal-ink);
      border: 1px solid var(--portal-ink);

      &:hover {
        background: var(--portal-ink);
        color: #fff;
      }
    }
  }

  &__art {
    width: 100%;
    height: auto;
    color: var(--portal-ink);
  }

  // 入场动画（全站唯一动效，克制）：文案子元素递增 delay
  &__copy > * {
    animation: #{$BEM_PREFIX}-hero-fade-up 0.6s ease both;
  }

  &__copy > *:nth-child(2) {
    animation-delay: 0.08s;
  }

  &__copy > *:nth-child(3) {
    animation-delay: 0.16s;
  }

  &__copy > *:nth-child(4) {
    animation-delay: 0.24s;
  }

  &__art {
    animation: #{$BEM_PREFIX}-hero-fade-up 0.6s 0.2s ease both;
  }

  @media (prefers-reduced-motion: reduce) {
    &__copy > *,
    &__art {
      animation: none;
    }
  }

  @media (max-width: 900px) {
    &__inner {
      grid-template-columns: 1fr;
      gap: 48px;
      padding: 64px 24px;
    }
  }
}

@keyframes #{$BEM_PREFIX}-hero-fade-up {
  from {
    opacity: 0;
    transform: translateY(16px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test src/modules/home/components/SiteHero.spec.ts`
Expected: PASS（2 例）

- [ ] **Step 5: Commit（需用户确认）**

```bash
git add src/modules/home/components/SiteHero.vue src/modules/home/components/SiteHero.spec.ts
git commit -m "feat(home): 新增企业官网 Hero 首屏（黑白极简 + 线条 SVG 示意图）"
```

---

### Task 5: SiteFeatures 特性区（TDD）

**Files:**
- Test: `src/modules/home/components/SiteFeatures.spec.ts`（新建）
- Create: `src/modules/home/components/SiteFeatures.vue`

- [ ] **Step 1: 写失败测试 `src/modules/home/components/SiteFeatures.spec.ts`**

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import SiteFeatures from './SiteFeatures.vue'
import { SITE_FEATURES } from '../config/site'

describe('SiteFeatures 产品特性区', () => {
  it('渲染 3 张特性卡（标题 + 描述来自 config）', () => {
    const w = mount(SiteFeatures)
    expect(w.findAll('article')).toHaveLength(3)
    expect(w.text()).toContain(SITE_FEATURES[0].title)
    expect(w.text()).toContain(SITE_FEATURES[0].desc)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/modules/home/components/SiteFeatures.spec.ts`
Expected: FAIL（组件不存在）

- [ ] **Step 3: 创建 `src/modules/home/components/SiteFeatures.vue`**

```vue
<script setup lang="ts">
/**
 * 产品特性区（id=features）：3 卡线性图标布局。
 *
 * 设计：卡片标题/描述来自 `config/site.ts`（SITE_FEATURES）；
 * 图标是呈现细节，用编译期解析的静态 `<i-tabler-* />` 标签写在模板里（3 卡逐张展开），
 * 不进 config、不做运行时 name→组件映射（virtual:icons 在 vitest 不可解析，静态标签测试安全）。
 *
 * @see [`../../config/site.ts`](../../config/site.ts) SITE_FEATURES 数据单源
 * @group 业务模块：Home
 */
import { SITE_FEATURES } from '../../config/site'

const bem = createNamespace('site-features')
</script>

<template>
  <section id="features" :class="bem.b()">
    <div :class="bem.e('inner')">
      <h2 :class="bem.e('heading')">产品能力</h2>
      <div :class="bem.e('grid')">
        <article :class="bem.e('card')">
          <i-tabler-chart-line :class="bem.e('icon')" aria-hidden="true" />
          <h3 :class="bem.e('title')">{{ SITE_FEATURES[0].title }}</h3>
          <p :class="bem.e('desc')">{{ SITE_FEATURES[0].desc }}</p>
        </article>
        <article :class="bem.e('card')">
          <i-tabler-shield-lock :class="bem.e('icon')" aria-hidden="true" />
          <h3 :class="bem.e('title')">{{ SITE_FEATURES[1].title }}</h3>
          <p :class="bem.e('desc')">{{ SITE_FEATURES[1].desc }}</p>
        </article>
        <article :class="bem.e('card')">
          <i-tabler-cloud-computing :class="bem.e('icon')" aria-hidden="true" />
          <h3 :class="bem.e('title')">{{ SITE_FEATURES[2].title }}</h3>
          <p :class="bem.e('desc')">{{ SITE_FEATURES[2].desc }}</p>
        </article>
      </div>
    </div>
  </section>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-site-features {
  background: var(--portal-bg-alt);

  &__inner {
    max-width: var(--portal-max-width);
    margin: 0 auto;
    padding: 96px 24px;
  }

  &__heading {
    font-size: 32px;
    font-weight: 700;
    color: var(--portal-ink);
    margin: 0 0 48px;
    text-align: center;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
  }

  &__card {
    background: var(--portal-bg);
    border: 1px solid var(--portal-line);
    border-radius: 8px;
    padding: 40px 32px;
    transition: border-color 0.2s ease;

    &:hover {
      border-color: var(--portal-ink);
    }
  }

  &__icon {
    font-size: 36px;
    color: var(--portal-ink);
    display: inline-block;
    margin-bottom: 24px;
  }

  &__title {
    font-size: 18px;
    font-weight: 600;
    color: var(--portal-ink);
    margin: 0 0 12px;
  }

  &__desc {
    font-size: 14px;
    line-height: 1.8;
    color: var(--portal-ink-2);
    margin: 0;
  }

  @media (max-width: 900px) {
    &__grid {
      grid-template-columns: 1fr;
    }
  }
}
</style>
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test src/modules/home/components/SiteFeatures.spec.ts`
Expected: PASS（1 例）

- [ ] **Step 5: Commit（需用户确认）**

```bash
git add src/modules/home/components/SiteFeatures.vue src/modules/home/components/SiteFeatures.spec.ts
git commit -m "feat(home): 新增企业官网产品特性区（3 卡 tabler 线性图标）"
```

---

### Task 6: SiteStats 数据指标条（TDD）

**Files:**
- Test: `src/modules/home/components/SiteStats.spec.ts`（新建）
- Create: `src/modules/home/components/SiteStats.vue`

- [ ] **Step 1: 写失败测试 `src/modules/home/components/SiteStats.spec.ts`**

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import SiteStats from './SiteStats.vue'
import { SITE_STATS } from '../config/site'

describe('SiteStats 数据指标条', () => {
  it('渲染 4 项指标（数值 + 标签）', () => {
    const w = mount(SiteStats)
    expect(w.findAll('.vv-site-stats__item')).toHaveLength(4)
    expect(w.text()).toContain(SITE_STATS[0].value)
    expect(w.text()).toContain(SITE_STATS[0].label)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/modules/home/components/SiteStats.spec.ts`
Expected: FAIL（组件不存在）

- [ ] **Step 3: 创建 `src/modules/home/components/SiteStats.vue`**

```vue
<script setup lang="ts">
/**
 * 数据指标条（id=stats）：静态数字，刻意不做滚动计数（KISS / YAGNI）。
 *
 * @see [`../../config/site.ts`](../../config/site.ts) SITE_STATS 数据单源
 * @group 业务模块：Home
 */
import { SITE_STATS } from '../../config/site'

const bem = createNamespace('site-stats')
</script>

<template>
  <section id="stats" :class="bem.b()">
    <div :class="bem.e('inner')">
      <div v-for="s in SITE_STATS" :key="s.label" :class="bem.e('item')">
        <div :class="bem.e('value')">{{ s.value }}</div>
        <div :class="bem.e('label')">{{ s.label }}</div>
      </div>
    </div>
  </section>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-site-stats {
  background: var(--portal-bg);
  border-top: 1px solid var(--portal-line);
  border-bottom: 1px solid var(--portal-line);

  &__inner {
    max-width: var(--portal-max-width);
    margin: 0 auto;
    padding: 72px 24px;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 24px;
    text-align: center;
  }

  &__value {
    font-size: 40px;
    font-weight: 700;
    color: var(--portal-ink);
    line-height: 1.2;
    margin-bottom: 8px;
    font-variant-numeric: tabular-nums;
  }

  &__label {
    font-size: 14px;
    color: var(--portal-ink-2);
  }

  @media (max-width: 900px) {
    &__inner {
      grid-template-columns: repeat(2, 1fr);
    }
  }
}
</style>
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test src/modules/home/components/SiteStats.spec.ts`
Expected: PASS（1 例）

- [ ] **Step 5: Commit（需用户确认）**

```bash
git add src/modules/home/components/SiteStats.vue src/modules/home/components/SiteStats.spec.ts
git commit -m "feat(home): 新增企业官网数据指标条（静态数字）"
```

---

### Task 7: SiteAbout + SiteFooter + 首页组装（TDD）

**Files:**
- Create: `src/modules/home/components/SiteAbout.vue`
- Create: `src/modules/home/components/SiteFooter.vue`
- Test: `src/modules/home/views/index.spec.ts`（新建，smoke）
- Modify: `src/modules/home/views/index.vue`（重写为 5 区块组合）

- [ ] **Step 1: 创建 `src/modules/home/components/SiteAbout.vue`**

```vue
<script setup lang="ts">
/**
 * 关于与联系（id=about）：公司简介 + 三栏联系信息。
 *
 * @see [`../../config/site.ts`](../../config/site.ts) SITE_ABOUT 数据单源
 * @group 业务模块：Home
 */
import { SITE_ABOUT } from '../../config/site'

const bem = createNamespace('site-about')
</script>

<template>
  <section id="about" :class="bem.b()">
    <div :class="bem.e('inner')">
      <div :class="bem.e('intro')">
        <h2 :class="bem.e('heading')">{{ SITE_ABOUT.heading }}</h2>
        <p v-for="(p, i) in SITE_ABOUT.paragraphs" :key="i" :class="bem.e('para')">{{ p }}</p>
      </div>
      <div :class="bem.e('contact')">
        <div v-for="c in SITE_ABOUT.contacts" :key="c.label" :class="bem.e('contact-item')">
          <div :class="bem.e('contact-label')">{{ c.label }}</div>
          <div :class="bem.e('contact-value')">{{ c.value }}</div>
        </div>
      </div>
    </div>
  </section>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-site-about {
  background: var(--portal-bg);

  &__inner {
    max-width: var(--portal-max-width);
    margin: 0 auto;
    padding: 96px 24px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 64px;
  }

  &__heading {
    font-size: 32px;
    font-weight: 700;
    color: var(--portal-ink);
    margin: 0 0 24px;
  }

  &__para {
    font-size: 15px;
    line-height: 1.9;
    color: var(--portal-ink-2);
    margin: 0 0 16px;
  }

  &__contact-item {
    border-top: 1px solid var(--portal-line);
    padding: 20px 0;

    &:last-child {
      border-bottom: 1px solid var(--portal-line);
    }
  }

  &__contact-label {
    font-size: 13px;
    color: var(--portal-ink-2);
    margin-bottom: 6px;
  }

  &__contact-value {
    font-size: 16px;
    color: var(--portal-ink);
    font-weight: 600;
  }

  @media (max-width: 900px) {
    &__inner {
      grid-template-columns: 1fr;
      gap: 40px;
    }
  }
}
</style>
```

- [ ] **Step 2: 创建 `src/modules/home/components/SiteFooter.vue`**

```vue
<script setup lang="ts">
/**
 * 官网页脚：黑底收束 + 品牌行 + 锚点链接组 + ICP 占位（站点唯一深色区）。
 *
 * @see [`../../config/site.ts`](../../config/site.ts) SITE_FOOTER / SITE_BRAND 数据单源
 * @group 业务模块：Home
 */
import { SITE_BRAND, SITE_FOOTER } from '../../config/site'

const bem = createNamespace('site-footer')
</script>

<template>
  <footer :class="bem.b()">
    <div :class="bem.e('inner')">
      <div :class="bem.e('brand')">
        <span :class="bem.e('name')">{{ SITE_BRAND.name }}</span>
        <span :class="bem.e('slogan')">{{ SITE_BRAND.slogan }}</span>
      </div>
      <nav :class="bem.e('links')" aria-label="页脚导航">
        <a
          v-for="l in SITE_FOOTER.links"
          :key="l.label"
          :href="l.anchor"
          :class="bem.e('link')"
          >{{ l.label }}</a
        >
      </nav>
      <div :class="bem.e('meta')">
        <span :class="bem.e('icp')">{{ SITE_FOOTER.icp }}</span>
        <span :class="bem.e('copy')">© 2026 {{ SITE_BRAND.nameEn }}</span>
      </div>
    </div>
  </footer>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-site-footer {
  background: var(--portal-ink);
  color: #fff;

  &__inner {
    max-width: var(--portal-max-width);
    margin: 0 auto;
    padding: 64px 24px 32px;
  }

  &__brand {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 32px;
  }

  &__name {
    font-size: 20px;
    font-weight: 700;
  }

  &__slogan {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.55);
  }

  &__links {
    display: flex;
    gap: 24px;
    padding: 24px 0;
    border-top: 1px solid rgba(255, 255, 255, 0.15);
  }

  &__link {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.75);
    text-decoration: none;

    &:hover {
      color: #fff;
    }
  }

  &__meta {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.45);
  }
}
</style>
```

- [ ] **Step 3: 写失败测试 `src/modules/home/views/index.spec.ts`**

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

// Hero 内部按钮依赖 useAppRouter（auto-import），mock 掉避免路由副作用
vi.mock('@/composables/useAppRouter', () => ({
  useAppRouter: () => ({ goLogin: vi.fn() }),
}))

import HomeIndex from './index.vue'

describe('home 官网首页（smoke）', () => {
  it('渲染 4 个锚点区块 + 页脚，且品牌名可见', () => {
    const w = mount(HomeIndex)
    for (const id of ['hero', 'features', 'stats', 'about']) {
      expect(w.find(`#${id}`).exists()).toBe(true)
    }
    expect(w.find('footer').exists()).toBe(true)
    expect(w.text()).toContain('星澜科技')
  })
})
```

- [ ] **Step 4: 跑测试确认失败**

Run: `pnpm test src/modules/home/views/index.spec.ts`
Expected: FAIL（旧 views/index.vue 渲染旧区块，无 #features 等锚点）

- [ ] **Step 5: 重写 `src/modules/home/views/index.vue`（全文件替换）**

```vue
<script setup lang="ts">
/**
 * 企业官网首页视图：Hero + 特性 + 数据 + 关于 + 页脚。
 *
 * PortalHeader 在父级 `layouts/portal` 内；本页全部为纯静态展示区块（文案在 `config/site.ts`），
 * 无请求因此无需 Loading/Error/Empty 三态。
 *
 * @see [`../config/site.ts`](../config/site.ts) 全站文案数据单源
 * @group 业务模块：Home
 */
import SiteHero from '../components/SiteHero.vue'
import SiteFeatures from '../components/SiteFeatures.vue'
import SiteStats from '../components/SiteStats.vue'
import SiteAbout from '../components/SiteAbout.vue'
import SiteFooter from '../components/SiteFooter.vue'

const bem = createNamespace('home-index')
</script>

<template>
  <div :class="bem.b()">
    <SiteHero />
    <SiteFeatures />
    <SiteStats />
    <SiteAbout />
    <SiteFooter />
  </div>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-home-index {
  min-height: 100vh;

  // 锚点滚动时抵消 sticky header 高度（64px）；各区块 id 挂在 section 根上
  section[id] {
    scroll-margin-top: var(--portal-header-h);
  }
}
</style>
```

- [ ] **Step 6: 跑测试确认通过**

Run: `pnpm test src/modules/home/views/index.spec.ts`
Expected: PASS（1 例）

- [ ] **Step 7: Commit（需用户确认）**

```bash
git add src/modules/home/components/SiteAbout.vue src/modules/home/components/SiteFooter.vue src/modules/home/views/index.vue src/modules/home/views/index.spec.ts
git commit -m "feat(home): 新增关于/页脚区块并完成官网首页组装"
```

---

### Task 8: 删除旧 home 数据链路与位图（38 项）

**Files:**
- Delete: home 模块 33 项（13 组件 + 2 spec + 3 config + 3 store + 1 types + 11 png）
- Delete: `src/api/modules/portal-overview.ts`、`mock/portal-overview.ts`
- Delete: portal 位图 3 张

- [ ] **Step 1: 删除文件**

```bash
rm src/modules/home/components/DateGreeting.vue \
  src/modules/home/components/HeroSection.vue \
  src/modules/home/components/HomeAiWidget.vue \
  src/modules/home/components/HomeFooter.vue \
  src/modules/home/components/HotSearchTags.vue \
  src/modules/home/components/NoticePanel.vue \
  src/modules/home/components/OverviewCard.vue \
  src/modules/home/components/OverviewCardSkeleton.vue \
  src/modules/home/components/OverviewEmptyState.vue \
  src/modules/home/components/OverviewErrorState.vue \
  src/modules/home/components/OverviewMetricRow.vue \
  src/modules/home/components/OverviewSection.vue \
  src/modules/home/components/OverviewSection.spec.ts \
  src/modules/home/components/SearchBar.vue \
  src/modules/home/components/SearchBar.spec.ts \
  src/modules/home/config/footer.ts \
  src/modules/home/config/hero.ts \
  src/modules/home/config/types.ts \
  src/modules/home/store/portal-overview.ts \
  src/modules/home/store/portal-overview.spec.ts \
  src/modules/home/store/index.ts \
  src/modules/home/types/portal-overview.ts \
  src/modules/home/images/*.png \
  src/api/modules/portal-overview.ts \
  mock/portal-overview.ts \
  src/layouts/portal/images/logo.png \
  src/layouts/portal/images/biaoyu.png \
  src/layouts/portal/images/layout-head-bg.png
```

- [ ] **Step 2: 清理空目录（git 不跟踪空目录，本地也一并清掉）**

```bash
rmdir src/modules/home/images src/modules/home/store src/modules/home/types 2>/dev/null || true
```

- [ ] **Step 3: 零残留校验**

Run: `pnpm test && pnpm type-check:full`
Expected: 全绿。随后 grep 确认 src/ 与 mock/ 无残留：

```bash
grep -r "portal-overview\|OverviewSection\|HomeAiWidget\|useHomeStore" src/ mock/ || echo "CLEAN"
```

Expected: 输出 `CLEAN`

- [ ] **Step 4: Commit（需用户确认）**

```bash
git add -A
git commit -m "refactor(home)!: 移除旧门户首页数据链路与位图（38 文件）"
```

> `!` 标记 BREAKING：OverviewSection/HomeFooter 等公开组件被删除（对本模板下游而言）。

---

### Task 9: 文档同步（7 份）

**Files:**
- Modify: `docs/04-构建与测试工具.md`（§测试清单）
- Modify: `docs/05-BEM样式规范.md`（BEM 命名空间表）
- Modify: `docs/18-代码组织决策表.md`（api 目录树）
- Modify: `docs/22-mock使用规范.md`（mock 目录树）
- Modify: `docs/33-pnpm-dev与dev-local模式对比.md`（mock 表）
- Modify: `README.md`（mock 列表 + mock 表，2 处）
- Modify: `CHANGELOG.md`（新增条目）

- [ ] **Step 1: `docs/04-构建与测试工具.md` line 613**

将整行（`| src/modules/home/{store/portal-overview,components/OverviewSection,components/SearchBar}.spec.ts` … | 工作台首页概览组件 |）替换为：

```markdown
| `src/modules/home/views/index.spec.ts`                                                                                                                                                                                | 企业官网首页区块 smoke                                                                                                                  |
```

（对齐表内既有空格宽度；line 614 的 PortalHeader.spec.ts 行保留。）

- [ ] **Step 2: `docs/05-BEM样式规范.md` BEM 命名空间表**

删除两行：

```markdown
| `HomeFooter`           | `home-footer`            |
| `OverviewCardSkeleton` | `overview-card-skeleton` |
```

在表中追加五行（空格对齐表内既有格式）：

```markdown
| `SiteHero`             | `site-hero`              |
| `SiteFeatures`         | `site-features`          |
| `SiteStats`            | `site-stats`             |
| `SiteAbout`            | `site-about`             |
| `SiteFooter`           | `site-footer`            |
```

- [ ] **Step 3: `docs/18-代码组织决策表.md`**

删除 api/modules 目录树中的 `    ├── portal-overview.ts` 行（位于 line ~180，以内容匹配为准，上下文是 `src/api/modules/` 树）。

- [ ] **Step 4: `docs/22-mock使用规范.md`**

删除 mock 目录树中的 `├── portal-overview.ts   # /api/portal/overview 首页数据` 行（line ~32）。

- [ ] **Step 5: `docs/33-pnpm-dev与dev-local模式对比.md` line 337**

将行内 `auth/menu/dict/user/portal-overview/pro-table 等` 改为 `auth/menu/dict/user/pro-table 等`（整行其余内容不动）。

- [ ] **Step 6: `README.md` 两处**

1. line ~297：`│   ├── auth.ts / user.ts / menu.ts / portal-overview.ts  # 接口 mock` → `│   ├── auth.ts / user.ts / menu.ts  # 接口 mock`
2. 删除 mock 表（§环境变量/ Mock 数据附近）中整行：`| portal-overview | \`/api/portal/overview\`（首页数据总览） | - |`（行内分隔线宽度以原文为准）

- [ ] **Step 7: `CHANGELOG.md` 顶部新增条目（格式对齐仓库既有版本节）**

```markdown
## [Unreleased]

### ⚠ BREAKING CHANGE

- **home 模块整体重构为企业官网**：旧门户首页组件（OverviewSection / HomeFooter / SearchBar 等 13 个）、`usePortalOverviewStore` 数据链路（mock/api/store/单测）与 portal 三张位图全部移除

### ✨ Features

- home: 门户首页重构为「星澜科技」黑白极简企业官网（Hero/特性/数据/关于/页脚，文案单源 `config/site.ts`）
- home: `/home` 经 `ROUTE_WHITE_LIST` 公开访问（守卫不读 `meta.requiresAuth`，白名单是唯一公开机制）
- portal: 头部从 180px 位图政务风改为 64px 白底极简顶栏（内联 SVG 字标 + 锚点导航 + 登录/用户双态）
- portal: 顶部导航从 el-menu 改为锚点滚动模型（IntersectionObserver scroll-spy）

### 📚 Docs

- 同步 docs/04、docs/05、docs/18、docs/22、docs/33、README 中 portal-overview / 旧组件引用
```

- [ ] **Step 8: 文档一致性校验**

Run: `pnpm check:doc-currency`
Expected: 退出码 0

- [ ] **Step 9: Commit（需用户确认）**

```bash
git add docs/04-构建与测试工具.md docs/05-BEM样式规范.md docs/18-代码组织决策表.md docs/22-mock使用规范.md docs/33-pnpm-dev与dev-local模式对比.md README.md CHANGELOG.md
git commit -m "docs: 同步 home/portal 企业官网重构的全部引用"
```

---

### Task 10: 全量校验 + 浏览器验收

**Files:** 无新增改动（校验 + 人工/CDP 验收）

- [ ] **Step 1: 全量校验链**

```bash
pnpm check:routes && pnpm check:aliases && pnpm type-check:full && pnpm lint && pnpm test && pnpm check:doc-currency
```

Expected: 全部退出码 0

- [ ] **Step 2: dev 启动 + CDP 浏览器验收**

```bash
pnpm dev
```

用 chrome-devtools MCP 打开 `http://localhost:5174/home` 逐项验收：

1. 未登录（无痕）直接访问 `/home` **不被踢到 /login**，首屏为黑白极简 Hero（无彩色、无位图、控制台无 404）
2. 点击顶栏「产品/数据/关于」平滑滚动到对应区块，滚动停止后当前项下划线高亮正确
3. 点击「免费试用」「预约演示」「登录」均跳转 `/login`
4. 登录后回 `/home`：顶栏右侧变用户菜单，退出流程可用
5. 视口 1440 / 768 两档：无横向滚动条，窄屏下锚点导航隐藏
6. 页脚黑底、链接（产品特性/数据指标/关于我们）点击可回跳锚点

- [ ] **Step 3: 收尾（需用户确认）**

```bash
git add -A
git commit -m "chore(home): 企业官网重构验收通过（校验链 + 浏览器实测）"
```

> 若此前用户选择「整批授权 commit」，本任务内的 3 次 commit 已分别完成，Step 3 仅在有未提交改动时执行。
