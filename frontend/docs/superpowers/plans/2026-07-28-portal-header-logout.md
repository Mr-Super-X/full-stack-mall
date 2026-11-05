# PortalHeader 退出登录入口 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `src/layouts/portal/components/PortalHeader.vue` 用户区的装饰性 ▾ 箭头变成真实的 el-dropdown 菜单，菜单内含"退出登录"选项，点击调用现有 `useLogout().confirmLogout()`。

**Architecture:** 单文件改造（PortalHeader.vue）+ 单测试文件（PortalHeader.spec.ts）。不改 `useLogout` / `userStore` / i18n / API。复用现有 composable + Element Plus 组件。

**Tech Stack:** Vue 3.5 + TypeScript 6 + Element Plus 2.14 + Vitest + @vue/test-utils。沿用项目 `createNamespace` 工具（auto-import）+ BEM 命名规范。

---

## 文件清单

| 操作 | 路径                                                        | 行数       | 说明                                    |
| ---- | ----------------------------------------------------------- | ---------- | --------------------------------------- |
| 备份 | `.claude/backups/portal-header-logout/PortalHeader.vue.bak` | 127        | 实施前备份（CLAUDE.md §七 方案隔离）    |
| 修改 | `src/layouts/portal/components/PortalHeader.vue`            | 127 → ~160 | 加 el-dropdown 包裹 + 箭头图标 + 菜单项 |
| 新建 | `src/layouts/portal/components/PortalHeader.spec.ts`        | ~100       | 4 个单测用例                            |

**src/ 写操作清单**（CLAUDE.md §2.5 必须列出）：
- `src/layouts/portal/components/PortalHeader.vue`（修改 — §2.3 例外已生效）
- `src/layouts/portal/components/PortalHeader.spec.ts`（新增 — 同上）

---

## Task 1: 备份原文件 + 编写测试（RED）

**Files:**
- Backup: `.claude/backups/portal-header-logout/PortalHeader.vue.bak`
- Create: `src/layouts/portal/components/PortalHeader.spec.ts`

- [ ] **Step 1: 创建备份目录 + 备份原 PortalHeader.vue**

```bash
mkdir -p ".claude/backups/portal-header-logout"
cp "src/layouts/portal/components/PortalHeader.vue" ".claude/backups/portal-header-logout/PortalHeader.vue.bak"
ls -la ".claude/backups/portal-header-logout/"
```

预期：`PortalHeader.vue.bak` 存在，约 127 行。

- [ ] **Step 2: 创建测试文件（先写测试，RED 阶段）**

文件 `src/layouts/portal/components/PortalHeader.spec.ts`：

```typescript
import { mount, flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi, beforeEach, ref } from 'vitest'
import { nextTick } from 'vue'

// mock 路由 + i18n
const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push: mockPush }),
}))

const mockProfile = ref<{ name: string } | null>({ name: '张三' })
const mockUserStore = {
  profile: mockProfile,
  token: ref('mock-token'),
  permissions: ref([]),
  isLoggedIn: ref(true),
  login: vi.fn(),
  logout: vi.fn(),
  fetchProfile: vi.fn(),
}
vi.mock('@/store/modules/user', () => ({
  useUserStore: () => mockUserStore,
}))

// mock useLogout（关键：返回响应式 loggingOut + mock confirmLogout）
const mockLoggingOut = ref(false)
const mockConfirmLogout = vi.fn().mockImplementation(async () => {
  mockLoggingOut.value = true
  try {
    // 模拟 userStore.logout()
  } finally {
    mockLoggingOut.value = false
  }
})
vi.mock('@/composables/useLogout', () => ({
  useLogout: () => ({
    loggingOut: mockLoggingOut,
    confirmLogout: mockConfirmLogout,
  }),
}))

// mock useRouterStore（避免实际导航副作用）
vi.mock('@/store/modules/router', () => ({
  useRouterStore: () => ({ $reset: vi.fn() }),
}))

// i18n
const mockT = (key: string) => {
  const map: Record<string, string> = {
    'auth.logout': '退出',
  }
  return map[key] ?? key
}

// 引入被测组件（必须在所有 mock 之后）
import PortalHeader from './PortalHeader.vue'

describe('PortalHeader 退出登录入口', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockProfile.value = { name: '张三' }
    mockLoggingOut.value = false
  })

  it('1. 渲染 el-dropdown + 菜单项包含"退出登录"文案', () => {
    const w = mount(PortalHeader, {
      global: {
        mocks: { $t: mockT },
        components: {
          // Element Plus 组件会被 inline 处理（vitest.config.ts 已配）
        },
      },
    })
    // el-dropdown 渲染后会暴露菜单项（即使未打开）
    expect(w.text()).toContain('张三')
    // 菜单默认未打开时，dropdown item 不一定在 DOM 中
    // 用 trigger 区验证 dropdown 已挂载
    const dropdown = w.find('.el-dropdown')
    expect(dropdown.exists()).toBe(true)
  })

  it('2. 点击 trigger 区打开下拉菜单，显示"退出登录"项', async () => {
    const w = mount(PortalHeader, {
      global: { mocks: { $t: mockT } },
    })
    // 点击 trigger 区（__user 内部任意子元素）
    const trigger = w.find('.vv-portal-header__user')
    expect(trigger.exists()).toBe(true)
    await trigger.trigger('click')
    await nextTick()
    // Element Plus 渲染下拉菜单到 body，需要查询 document
    const dropdownItem = document.querySelector('.el-dropdown-menu__item')
    expect(dropdownItem).toBeTruthy()
    expect(dropdownItem?.textContent).toContain('退出')
  })

  it('3. 点击"退出登录"菜单项触发 confirmLogout', async () => {
    const w = mount(PortalHeader, {
      global: { mocks: { $t: mockT } },
      attachTo: document.body, // 让 el-dropdown 渲染到 document
    })
    const trigger = w.find('.vv-portal-header__user')
    await trigger.trigger('click')
    await nextTick()
    const dropdownItem = document.querySelector('.el-dropdown-menu__item') as HTMLElement
    expect(dropdownItem).toBeTruthy()
    dropdownItem.click()
    await flushPromises()
    expect(mockConfirmLogout).toHaveBeenCalledTimes(1)
  })

  it('4. loggingOut=true 时菜单项 :disabled', async () => {
    mockLoggingOut.value = true
    const w = mount(PortalHeader, {
      global: { mocks: { $t: mockT } },
      attachTo: document.body,
    })
    const trigger = w.find('.vv-portal-header__user')
    await trigger.trigger('click')
    await nextTick()
    const dropdownItem = document.querySelector('.el-dropdown-menu__item')
    expect(dropdownItem?.classList.contains('is-disabled')).toBe(true)
    mockLoggingOut.value = false
  })
})
```

- [ ] **Step 3: 跑测试确认 RED（应当失败）**

```bash
pnpm test src/layouts/portal/components/PortalHeader.spec.ts --run
```

预期：测试**失败**，因为 PortalHeader.vue 还没改（`__user` 还是 div，`__dropdown` 不存在）。

---

## Task 2: 改造 PortalHeader.vue（GREEN）

**Files:**
- Modify: `src/layouts/portal/components/PortalHeader.vue`

- [ ] **Step 1: 修改 script setup（加 useLogout + 图标 import）**

在 `<script setup>` 顶部加入：

```typescript
import { ArrowDown, SwitchButton } from '@element-plus/icons-vue'
import { useLogout } from '@composables/useLogout'
```

> 注：Element Plus 组件 `ElDropdown` / `ElDropdownMenu` / `ElDropdownItem` 已通过 `unplugin-auto-import` 全局注册，**无须显式 import**。

在 `useUserStore()` 之后加入：

```typescript
const { loggingOut, confirmLogout } = useLogout()

async function onCommand(cmd: string) {
  if (cmd === 'logout') {
    await confirmLogout()
  }
}
```

- [ ] **Step 2: 修改 template（用 el-dropdown 包裹 __user）**

把原：

```vue
<nav :class="bem.e('nav')" aria-label="主导航">
  <PortalNav :items="PORTAL_NAV" />
  <div :class="bem.e('user')">
    <span :class="bem.e('avatar')">{{ userStore.profile?.name?.charAt(0) ?? '?' }}</span>
    <span :class="bem.e('name')">{{ userStore.profile?.name ?? '游客' }}</span>
    <span :class="bem.e('caret')" aria-hidden="true">▾</span>
  </div>
</nav>
```

改为：

```vue
<nav :class="bem.e('nav')" aria-label="主导航">
  <PortalNav :items="PORTAL_NAV" />
  <el-dropdown :class="bem.e('dropdown')" trigger="click" @command="onCommand">
    <div
      :class="bem.e('user')"
      tabindex="0"
      role="button"
      aria-haspopup="menu"
    >
      <span :class="bem.e('avatar')">{{ userStore.profile?.name?.charAt(0) ?? '?' }}</span>
      <span :class="bem.e('name')">{{ userStore.profile?.name ?? '游客' }}</span>
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
</nav>
```

- [ ] **Step 3: 修改 style（__user 移除 cursor + 加 hover 背景 + 箭头旋转）**

在 `<style lang="scss">` 中：

把：

```scss
&__user {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
}
```

改为：

```scss
&__dropdown {
  display: inline-flex;
}

&__user {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border-radius: 4px;
  font-size: 14px;
  transition: background 0.2s ease;
  outline: none;

  &:hover,
  &:focus-visible {
    background: rgba(255, 255, 255, 0.08);
  }
}
```

把：

```scss
&__caret {
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
}
```

改为：

```scss
&__caret {
  display: inline-flex;
  align-items: center;
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  transition: transform 0.2s ease;
}

&__dropdown:hover &__caret,
&__dropdown:focus-within &__caret {
  transform: rotate(180deg);
}

:deep(.el-dropdown-menu__item:not(.is-disabled)) {
  &:hover {
    background: rgba(56, 189, 248, 0.15);
    color: #fff;
  }
}
```

- [ ] **Step 4: 跑测试确认 GREEN**

```bash
pnpm test src/layouts/portal/components/PortalHeader.spec.ts --run
```

预期：4 个测试**全部通过**。

如有失败，按 [失败排查]：
- dropdown 找不到 → 检查 el-dropdown 包装位置（必须在 PortalNav 同一行）
- menu item 找不到 → 用 `attachTo: document.body` 让 Element Plus 把 menu 渲染到 body
- $t not defined → 全局 mock `$t`
- is-disabled 类名错 → Element Plus 2.x 实际是 `.is-disabled`

---

## Task 3: 静态质量校验

**Files:** 无

- [ ] **Step 1: 跑 TypeScript 全量校验**

```bash
pnpm type-check:full
```

预期：通过，0 错误。

- [ ] **Step 2: 跑 ESLint（精准指定 2 个文件）**

```bash
npx eslint "src/layouts/portal/components/PortalHeader.vue" "src/layouts/portal/components/PortalHeader.spec.ts"
```

预期：通过，0 错误 / 0 警告（除 npm 全局 warn 与本任务无关）。

- [ ] **Step 3: 跑全量测试**

```bash
pnpm test --run
```

预期：所有测试**通过**（354 + 4 = 358 用例）。

---

## Task 4: 浏览器目视验证

**Files:** 无

- [ ] **Step 1: 启动 dev server**

```bash
cd "D:/personal/github/vue3工程模板/vue3-vite-project" && pnpm dev:local
```

预期：Vite 启动，端口 5173 或 5174 可访问。

- [ ] **Step 2: 访问 /home（已登录态），截图用户区**

```javascript
mcp__chrome-devtools__new_page({ url: "http://localhost:5173/vue3-vite-project/home" })
mcp__chrome-devtools__resize_page({ width: 1440, height: 900 })
mcp__chrome-devtools__take_screenshot()
```

预期：截图显示 portal 头部，右侧用户区有"张三 + 头像 + 箭头"。

- [ ] **Step 3: 点击用户区，截图下拉菜单**

```javascript
mcp__chrome-devtools__take_snapshot()  // 获取 trigger uid
mcp__chrome-devtools__click({ uid: "<user-trigger-uid>" })
mcp__chrome-devtools__take_screenshot()
```

预期：截图显示下拉菜单弹出，含 1 项"退出"。

- [ ] **Step 4: 点击"退出登录"项，验证 confirm 弹窗**

```javascript
mcp__chrome-devtools__take_snapshot()  // 获取 menu item uid
mcp__chrome-devtools__click({ uid: "<menu-item-uid>" })
mcp__chrome-devtools__take_screenshot()
```

预期：ElMessageBox confirm 弹窗"确定退出登录吗？"出现。

- [ ] **Step 5: 点击取消，验证菜单关闭且不退出**

```javascript
mcp__chrome-devtools__click({ uid: "<cancel-button-uid>" })
```

预期：弹窗关闭，页面无变化（用户态保持）。

---

## Task 5: 收尾

**Files:**
- Stage: `PortalHeader.vue` + `PortalHeader.spec.ts`

- [ ] **Step 1: git status 确认变更范围**

```bash
git status --short
```

预期：仅 2 个文件变动（PortalHeader.vue 修改 + PortalHeader.spec.ts 新增）。

- [ ] **Step 2: 询问用户是否 commit（参考之前模式：用户决策 commit 节奏）**

> 不擅自 commit。展示 staged 状态 + 简报，等用户决定。

- [ ] **Step 3: 输出合规简报**

```
本次涉及的规则条款：§一/§二/§三.3.3/§四/§五
自检清单通过情况：[通过数 / 总数]
src/ 写操作清单：
  - src/layouts/portal/components/PortalHeader.vue（修改）
  - src/layouts/portal/components/PortalHeader.spec.ts（新增）
```

---

## 验收清单

- [ ] 4 个单测全过
- [ ] type-check:full 通过
- [ ] 全量测试 358 用例全过
- [ ] 浏览器：点击用户区弹出菜单
- [ ] 浏览器：点击"退出" → confirm 弹窗
- [ ] 浏览器：confirm 取消 → 不退出
- [ ] 浏览器：confirm 确认 → 跳 /login
- [ ] 加载态菜单项 disabled
- [ ] git diff 范围仅 2 个文件
- [ ] commit msg 中文（待用户决定 commit 时机）

---

**Plan 版本**：v1.0.0
**生成日期**：2026-07-28
**前置 spec**：`docs/superpowers/specs/2026-07-28-portal-header-logout-design.md`
