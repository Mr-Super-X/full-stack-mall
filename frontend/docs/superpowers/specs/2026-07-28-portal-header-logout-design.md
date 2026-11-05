# PortalHeader 退出登录入口 — 设计文档

| 属性 | 值 |
|------|-----|
| 日期 | 2026-07-28 |
| 任务类型 | UI 入口补全 |
| 涉及文件 | `src/layouts/portal/components/PortalHeader.vue`（修改）<br>`src/layouts/portal/components/PortalHeader.spec.ts`（新增） |
| 新增文件 | 1（测试） |
| 新增依赖 | 0 |
| 技术选型 | Element Plus `el-dropdown` + 复用 `useLogout` composable |

---

## 1. 目标与背景

### 1.1 现状

`src/layouts/portal/components/PortalHeader.vue` 用户区（`__user`）当前是**纯静态展示**：

```vue
<div :class="bem.e('user')">
  <span :class="bem.e('avatar')">{{ userStore.profile?.name?.charAt(0) ?? '?' }}</span>
  <span :class="bem.e('name')">{{ userStore.profile?.name ?? '游客' }}</span>
  <span :class="bem.e('caret')" aria-hidden="true">▾</span>
</div>
```

- ▾ 箭头是装饰，**点击无任何反应**
- `cursor: pointer` 暗示可点击，但实际无下拉
- `useLogout` composable **已存在**（含 ElMessageBox confirm 弹窗 + loading + 4 个单测）
- `userStore.logout()` **已存在**（悲观退出 + 跳 /login）
- i18n 文案 `auth.logout*` **已就位**

### 1.2 目标

把"装饰性的 ▾ 箭头"变成**真实可点击的下拉菜单**，菜单内含"退出登录"选项，调用现有 `useLogout().confirmLogout()`。

---

## 2. 范围与约束

| 维度 | 决策 |
|------|------|
| 修改文件 | `src/layouts/portal/components/PortalHeader.vue`（1 个） |
| 新增文件 | `src/layouts/portal/components/PortalHeader.spec.ts`（测试，1 个） |
| 不改 | `useLogout.ts` / `useLogout.spec.ts` / `user.ts` / `auth` API / i18n / 其他 PortalHeader 兄弟组件 |
| 不引入新依赖 | 全部用 Element Plus + 现有 composable |
| 满足 §2.3 例外 | 用户明确指定文件路径 |

---

## 3. 视觉设计

### 3.1 改造前后对比

| 元素 | 改造前 | 改造后 |
|------|--------|--------|
| 触发器 | `<div>` 静态 | `<el-dropdown>` 包裹 + `<div>` 作为 trigger |
| 箭头 | 文字 `▾` | `<el-icon><ArrowDown /></el-icon>` |
| 点击行为 | 无反应 | 弹出下拉菜单 |
| hover 反馈 | 无 | 触发区背景色 + 箭头旋转 180° |
| 菜单项 | 无 | 1 项「退出登录」+ SwitchButton 图标 |

### 3.2 视觉规范

- **触发区（`__user`）**：
  - 保持现有布局：头像 + 姓名 + 箭头
  - 移除原 `cursor: pointer`（`el-dropdown` 自带）
  - hover 背景：`rgba(255, 255, 255, 0.08)`（半透明白，0.2s 过渡）
  - padding：`0 12px`，圆角 4px
  - 添加 `tabindex="0"` + `role="button"` + `aria-haspopup="menu"`（无障碍）

- **箭头 `__caret`**：
  - `<el-icon><ArrowDown /></el-icon>`（替换 `▾` 文字）
  - 大小：12px
  - hover 时 `transform: rotate(180deg)` + 0.2s 过渡

- **下拉菜单（el-dropdown-menu）**：
  - 沿用 Element Plus 默认暗色风格（与 portal 头部白色文字协调）
  - 菜单项 padding：`8px 16px`
  - 菜单项 hover 背景：`--el-color-primary-light-9`（半透明蓝）
  - 菜单项图标 `<SwitchButton />`：16px，颜色继承文字

- **退出中态**：
  - 菜单项 `disabled`
  - 文字变"退出中..."（沿用 i18n `auth.logout` 加 loading 文案）

---

## 4. 交互行为

### 4.1 完整流程

```
用户点击用户区
  ↓
el-dropdown 打开菜单
  ↓
用户点击「退出登录」
  ↓
el-dropdown @command 触发 onCommand('logout')
  ↓
confirmLogout() → ElMessageBox.confirm("确定退出登录吗？", "提示", ...)
  ├── 用户点取消 → 关闭弹窗，无操作
  └── 用户点确认 → userStore.logout()
                      ├── await authApi.logout()（后端 /auth/logout）
                      ├── 清 token / cookies / profile
                      ├── globalAbort.abort() 取消在途请求
                      ├── resetAuthGuardState() 重置路由守卫
                      ├── router.push('/login')
                      └── globalAbort.reset() 准备下一个 session
```

### 4.2 状态机

| 状态 | 表现 |
|------|------|
| 初始 | 触发区显示头像/姓名/箭头 |
| hover 触发区 | 背景半透明白 + 箭头旋转 |
| 菜单打开 | 下拉菜单显示"退出登录"项 |
| 菜单项 hover | 背景变蓝色 |
| confirm 弹窗 | ElMessageBox 警告框 |
| 退出中 | 菜单项 disabled + 文字"退出中..." + 后端请求中 |
| 退出完成 | 跳 /login |

### 4.3 防御性 UI 三态

| 状态 | 处理 |
|------|------|
| Loading | `loggingOut=true` → 菜单项 disabled + 文字变"退出中..." |
| Error | `userStore.logout()` 失败由 http.ts 拦截器统一 toast（无需 PortalHeader 额外处理） |
| Empty | 不适用 |

### 4.4 可访问性

- `tabindex="0"`：键盘可达
- `role="button"` + `aria-haspopup="menu"`：屏幕阅读器识别为按钮 + 弹出菜单
- `aria-label` 暂不加（用户区已有可见文字"用户名"）
- Esc 关闭菜单（el-dropdown 默认）
- 焦点管理：el-dropdown 自动处理

---

## 5. 代码结构

### 5.1 文件清单

| 操作 | 路径 | 行数 | 说明 |
|------|------|------|------|
| 修改 | `src/layouts/portal/components/PortalHeader.vue` | 127 → ~150 | 加 el-dropdown 包裹 + 箭头图标 + 菜单项 |
| 新建 | `src/layouts/portal/components/PortalHeader.spec.ts` | ~90 | 4 个单测用例 |

### 5.2 script 改动

新增 import：

```ts
import { ArrowDown, SwitchButton } from '@element-plus/icons-vue'
import { ElDropdown, ElDropdownMenu, ElDropdownItem } from 'element-plus'  // unplugin-auto-import 可省略
import { useLogout } from '@composables/useLogout'  // unplugin-auto-import 可省略
```

新增逻辑：

```ts
const { loggingOut, confirmLogout } = useLogout()

async function onCommand(cmd: string) {
  if (cmd === 'logout') {
    await confirmLogout()
  }
}
```

> 注：项目使用 `unplugin-auto-import`，Element Plus 组件和 composable 可能已自动注入，**优先省略显式 import**（按现有 PortalHeader.vue 风格 —— 当前显式 import 了 `useUserStore`，说明 import 策略是显式）。

### 5.3 template 改动

将原 `<div :class="bem.e('user')">...</div>` 包裹到 el-dropdown：

```vue
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
```

### 5.4 style 改动

```scss
&__user {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border-radius: 4px;
  font-size: 14px;
  transition: background 0.2s ease;

  // 移除 cursor: pointer（el-dropdown 自带）

  &:hover,
  &:focus-visible {
    background: rgba(255, 255, 255, 0.08);
    outline: none;
  }
}

&__caret {
  display: inline-flex;
  align-items: center;
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  transition: transform 0.2s ease;

  .el-dropdown:hover & {
    transform: rotate(180deg);
  }
}

// 菜单项 hover 色：暗色风格
:deep(.el-dropdown-menu__item:not(.is-disabled)) {
  &:hover {
    background: rgba(56, 189, 248, 0.15);
    color: #fff;
  }
}
```

### 5.5 测试文件

```ts
// src/layouts/portal/components/PortalHeader.spec.ts
import { mount, flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockLogout = vi.fn()
const mockConfirmLogout = vi.fn()
vi.mock('@/composables/useLogout', () => ({
  useLogout: () => ({
    loggingOut: ref(false),  // 见下方引用
    confirmLogout: mockConfirmLogout,
  }),
}))
// ... mock userStore、auto-import 等

describe('PortalHeader 退出登录入口', () => {
  it('1. 渲染 el-dropdown 包裹用户区 + 菜单项', () => { /* ... */ })
  it('2. 点击用户区弹出菜单（el-dropdown 默认行为）', () => { /* ... */ })
  it('3. 点击"退出登录"菜单项触发 confirmLogout', async () => { /* ... */ })
  it('4. loggingOut=true 时菜单项 disabled', async () => { /* ... */ })
})
```

---

## 6. 测试用例

| 编号 | 场景 | 断言 |
|------|------|------|
| 1 | 渲染 | el-dropdown 存在，菜单项包含"退出登录"文字 |
| 2 | 触发菜单 | 点击用户区后菜单显示（el-dropdown 内部状态，断言 menu 存在或调用） |
| 3 | 点击退出 | el-dropdown-item command="logout" 触发后 mockConfirmLogout 被调 |
| 4 | loading 态 | loggingOut.value=true 时菜单项 :disabled="true" |

覆盖率目标：≥ 80%

---

## 7. 实施步骤

1. 创建任务清单
2. 备份原 `PortalHeader.vue` 到 `.claude/backups/portal-header-logout/`
3. 写 `PortalHeader.spec.ts`（RED 阶段）
4. 跑测试确认失败
5. 改 `PortalHeader.vue`（GREEN 阶段）
6. 跑测试确认通过
7. 跑 `pnpm type-check:full` + 全量测试 + lint
8. 浏览器目视验证（启动 dev:local + 点击用户区截图）
9. git add + commit
10. 输出合规简报

---

## 8. 风险与缓解

| 风险 | 概率 | 缓解 |
|------|------|------|
| el-dropdown 与 portal 头部暗色风格冲突 | 中 | `:deep()` 覆盖菜单项背景色 |
| SwitchButton 图标在某些版本不存在 | 低 | 备选 `Switch` / `CircleClose` |
| 下拉菜单位置被头部 z-index 遮挡 | 低 | 检查 portal-tokens 中 header z-index |
| 键盘用户无法触发菜单 | 低 | 依赖 el-dropdown 默认行为 + tabindex |
| 退出中时用户再次点击 | 中 | el-dropdown-item :disabled 阻止 |

---

## 9. 验收清单

- [ ] 4 个单测用例全过
- [ ] `pnpm type-check:full` 通过
- [ ] 全量测试 354+ 用例全过
- [ ] 浏览器目视：点击用户区弹出菜单，含"退出登录"项
- [ ] 点击"退出登录" → confirm 弹窗 → 确认 → 跳 /login
- [ ] 确认弹窗取消 → 不退出
- [ ] 退出中菜单项 disabled（loading 态）
- [ ] git diff 范围仅 2 个文件
- [ ] commit msg 中文

---

**文档版本**：v1.0.0
**生成日期**：2026-07-28
**前置依赖**：`useLogout` composable（已存在）+ `userStore.logout()`（已存在）+ i18n `auth.logout*`（已存在）
