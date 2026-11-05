# 登录页 UI 优化 — 设计文档

| 属性 | 值 |
|------|-----|
| 日期 | 2026-07-28 |
| 任务类型 | 视觉 + 交互优化 |
| 涉及文件 | `src/modules/auth/views/Login.vue`（仅此 1 个） |
| 新增文件 | 0 |
| 新增依赖 | 0 |
| 设计风格 | 深色科技感（应急/水利行业向） |

---

## 1. 目标与背景

当前 `src/modules/auth/views/Login.vue` 仅 50 行，使用 Element Plus 默认 `el-card` 居中渲染表单，无任何品牌差异化设计：

- 无品牌标识、无背景、无装饰元素
- 无过渡动画、视觉层次
- 缺少表单校验、错误反馈（`try/finally` 吞错）
- 单列 400px 卡片，无响应式适配

参考优秀登录页改造后，期望达到：
1. 契合"应急/水利"行业调性（专业、克制、可信赖）
2. 提升品牌识别度（与 portal 头部已用的暗色科技调性一致）
3. 补齐交互（校验、错误提示、loading 反馈、密码显隐）
4. 加载性能零损失（无图片资源，纯 CSS）

---

## 2. 视觉系统

### 2.1 色板（CSS Variables，作用域在组件 style 内）

| Token | 值 | 用途 |
|-------|-----|------|
| `--login-bg-base` | `#0a1428` | 页面底色（深海蓝） |
| `--login-bg-deep` | `#050b1a` | 渐变终止色 |
| `--login-bg-tint` | `#1e3a8a` | 径向渐变起始色 |
| `--login-bg-grid` | `rgba(56, 189, 248, 0.06)` | 网格线 |
| `--login-accent` | `#38bdf8` | 强调色（科技蓝） |
| `--login-accent-glow` | `rgba(56, 189, 248, 0.4)` | 强调光晕 |
| `--login-accent-hover` | `#7dd3fc` | 强调色 hover |
| `--login-card-bg` | `rgba(15, 23, 42, 0.75)` | 卡片玻璃底 |
| `--login-card-border` | `rgba(56, 189, 248, 0.18)` | 卡片边线 |
| `--login-card-shadow` | `0 20px 60px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05)` | 卡片阴影 |
| `--login-text-primary` | `#e2e8f0` | 主文字 |
| `--login-text-secondary` | `#94a3b8` | 次文字 |
| `--login-text-muted` | `#64748b` | 辅助文字 |
| `--login-input-bg` | `rgba(15, 23, 42, 0.6)` | 输入框底 |
| `--login-input-border` | `rgba(56, 189, 248, 0.2)` | 输入框边线 |
| `--login-input-focus` | `rgba(56, 189, 248, 0.4)` | 输入框聚焦边线 |
| `--login-error` | `#f87171` | 错误红 |
| `--login-success` | `#34d399` | 成功绿 |

### 2.2 背景层（纯 CSS，无图片资源）

三层叠加：

1. **底层渐变**：`background: radial-gradient(ellipse at top, var(--login-bg-tint) 0%, var(--login-bg-base) 60%, var(--login-bg-deep) 100%)`
2. **中间网格**：内联 SVG `<pattern>` 32x32 像素，stroke 使用 `var(--login-bg-grid)`，`pointer-events: none`
3. **顶层光斑**：3 个 absolute 定位的圆形（直径 300-500px），`filter: blur(120px)`，分别使用 `@keyframes` 浮动（位移 60-100px，周期 12-20s，ease-in-out infinite alternate）

**光斑配色**（基于 accent 色，降低饱和度）：
- 光斑 1：`rgba(56, 189, 248, 0.15)` — 左上
- 光斑 2：`rgba(99, 102, 241, 0.12)` — 右下
- 光斑 3：`rgba(14, 165, 233, 0.1)` — 居中靠下

### 2.3 卡片

- 宽度：440px（桌面）/ `calc(100% - 32px)`（移动端，< 480px 断点）
- 距顶部：12vh
- 背景：`var(--login-card-bg)` + `backdrop-filter: blur(20px)` + `-webkit-backdrop-filter: blur(20px)`
- 边线：`1px solid var(--login-card-border)`
- 圆角：`16px`
- 内边距：`40px 36px`
- 阴影：`var(--login-card-shadow)`
- 过渡：`transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.6s`
- 入场动画：`@keyframes fadeInUp` 从 `translateY(20px) + opacity: 0` 到默认状态

**降级方案**：浏览器不支持 `backdrop-filter` 时，自动降级为不透明背景（`background: rgba(15, 23, 42, 0.95)`），通过 `@supports not (backdrop-filter: blur(1px))` 判断。

### 2.4 表单元素

**输入框（`el-input`）**：
- 背景：`var(--login-input-bg)`
- 边线：`1px solid var(--login-input-border)`，hover 时 `var(--login-accent-glow)`
- 聚焦时：外发光 `box-shadow: 0 0 0 3px var(--login-input-focus)`
- 圆角：`8px`
- 文字：`var(--login-text-primary)`，placeholder 用 `var(--login-text-muted)`
- 高度：44px
- 左侧 prefix 图标：使用 Element Plus 内置 `User` / `Lock` 图标，颜色 `var(--login-text-secondary)`

**按钮（`el-button type="primary"`）**：
- 高度：48px
- 圆角：8px
- 背景渐变：`linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%)`
- 文字：`#0a1428`（深色），font-weight 600
- hover：`background-position: right center` + `box-shadow: 0 8px 24px var(--login-accent-glow)` + `transform: translateY(-1px)`
- active：`transform: translateY(0)` + 阴影缩小
- loading：Element Plus 默认 spinner，文字保持"登录中..."
- 过渡：all 0.3s cubic-bezier(0.16, 1, 0.3, 1)

**密码显隐按钮**：
- 位置：密码输入框右侧 suffix
- 图标：`View` / `Hide`（Element Plus）
- 颜色：`var(--login-text-secondary)`，hover `var(--login-accent)`
- 点击切换 input type：password ↔ text

**记住我 checkbox** + **忘记密码链接**：
- 记住我：Element Plus `el-checkbox`，颜色用 `var(--login-accent)`
- 忘记密码：纯文字链接，hover 下划线 + 颜色变 `var(--login-accent-hover)`
- 布局：`display: flex; justify-content: space-between`

### 2.5 文字层级

| 元素 | 字号 | 字重 | 颜色 |
|------|------|------|------|
| 主标题"企业中后台管理" | 24px | 600 | `var(--login-text-primary)` |
| 副标题"{{ appTitle }} · 数据中台"（VITE_APP_TITLE 驱动） | 13px | 400 | `var(--login-text-secondary)` |
| 表单 label | 13px | 500 | `var(--login-text-secondary)` |
| 输入文字 | 14px | 400 | `var(--login-text-primary)` |
| 按钮文字 | 15px | 600 | `#0a1428` |
| 底部版权"© 2026 {{ appTitle }}中心"（VITE_APP_TITLE 驱动） | 12px | 400 | `var(--login-text-muted)` |

字体策略：系统字体栈（避免外部字体加载）：
```
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
```

### 2.6 LOGO 区

- 占位：用 CSS 渲染的菱形 LOGO（4 个旋转 45° 的方块组成，accent 色渐变）
- 尺寸：48x48
- 与标题垂直堆叠居中
- 不引用图片资源

---

## 3. 布局与响应式

### 3.1 桌面（≥ 768px）

```
┌─────────────────────────────────────────┐
│  背景层（z-index: 0）                   │
│   ├── 径向渐变底色                       │
│   ├── SVG 网格                          │
│   └── 3 个缓动光斑                       │
│                                          │
│        ┌──────────────────┐             │
│        │   🔷 LOGO         │             │
│        │   企业中后台管理 │             │
│        │   企业中后台管理·数据中台│             │
│        │   ──────────      │             │
│        │   账号            │             │
│        │   [admin____]     │             │
│        │   密码            │             │
│        │   [••••••••] 👁  │             │
│        │   ☐记住  忘记密码? │             │
│        │   [   登 录   ]   │             │
│        │   © 2026 应急...  │             │
│        └──────────────────┘             │
└─────────────────────────────────────────┘
```

- 卡片水平居中，距顶部 12vh
- 卡片宽度 440px

### 3.2 移动端（< 768px）

- 卡片宽度：`calc(100% - 32px)`，最大 440px
- 内边距缩小到 28px 24px
- 主标题字号 20px
- 距顶部：6vh
- 光斑数量减为 2 个（性能考虑）

### 3.3 暗色模式

- 本身就是深色设计，无需 `prefers-color-scheme` 切换
- 不支持亮色模式（行业属性决定）

---

## 4. 交互行为

### 4.1 表单校验（必填）

使用 Element Plus `el-form` ref + `rules`：

| 字段 | 规则 | 错误提示 |
|------|------|----------|
| username | required, min 3 | "请输入账号（至少 3 位）" |
| password | required, min 6 | "请输入密码（至少 6 位）" |

提交时调用 `formRef.value.validate()`，通过后才执行登录。

### 4.2 登录流程

```
用户点击"登录"
  ↓
formRef.validate() ──失败→ 显示表单错误（Element Plus 自动）
  ↓ 通过
loading.value = true
  ↓
try {
  await userStore.login(form)
  ElMessage.success('登录成功')
  const redirect = (route.query.redirect as string) ?? '/home'
  router.push(redirect)
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : '登录失败，请重试'
  ElMessage.error(msg)
  console.error('[Login] 登录失败', err)
} finally {
  loading.value = false
}
```

### 4.3 错误展示

- 表单字段错误：Element Plus `el-form-item` 红字
- 业务错误（API 失败）：右上 `ElMessage.error` toast
- 网络错误：toast 显示"网络异常，请检查后重试"

### 4.4 微交互

| 元素 | 交互 | 实现 |
|------|------|------|
| 卡片 | 入场 | `@keyframes fadeInUp` 600ms cubic-bezier(0.16, 1, 0.3, 1) |
| 输入框 | focus | 外发光 `box-shadow: 0 0 0 3px var(--login-input-focus)` |
| 输入框 | hover 边线 | 颜色过渡 200ms |
| 按钮 | hover | 上移 1px + 阴影增强 + 渐变位移 |
| 按钮 | active | 下沉 0px + 阴影缩小 |
| 密码显隐 | click | 图标切换 + input type 切换 |
| 光斑 | 持续 | `@keyframes float` 12-20s 周期，无限循环 |

### 4.5 防御性 UI 三态

| 状态 | 处理 |
|------|------|
| Loading | 按钮内置 loading spinner + disabled + 文字"登录中" |
| Error | `ElMessage.error` + console.error（不静默吞错） |
| Empty | 不适用（登录页无空数据） |

### 4.6 可访问性（A11y）

- 所有输入框有 `aria-label` 或可见 label
- 按钮有 `aria-label`（特别是纯图标按钮"密码显隐"）
- 颜色对比度 ≥ 4.5:1（主文字 vs 背景）
- 焦点状态明显（`outline` + `box-shadow` 双指示）
- 支持键盘 Tab 切换 + Enter 提交
- 尊重 `prefers-reduced-motion`：媒体查询下禁用光斑动画 + 卡片入场动画

---

## 5. 代码结构

### 5.1 文件修改清单

| 文件 | 操作 | 行数变化 |
|------|------|----------|
| `src/modules/auth/views/Login.vue` | 完全重写 | 50 → ~220 行 |

**仅 1 个文件改动**，符合 CLAUDE.md §2.3 用户明确指定文件路径的例外条款。

### 5.2 BEM 命名（符合项目记忆 `component-bem-namespace-pattern`）

```vue
<script setup lang="ts">
import { createNamespace } from '@utils/bem'
const { bem, BEM_PREFIX } = createNamespace('auth-login')
</script>

<template>
  <div :class="bem.b()">
    <!-- 背景层 -->
    <div :class="bem.e('bg')">
      <div :class="bem.e('bg-grid')" />
      <div :class="[bem.e('bg-orb'), bem.em('bg-orb', 'a')]" />
      <div :class="[bem.e('bg-orb'), bem.em('bg-orb', 'b')]" />
      <div :class="[bem.e('bg-orb'), bem.em('bg-orb', 'c')]" />
    </div>

    <!-- 卡片 -->
    <el-card :class="bem.e('card')" shadow="never">
      <div :class="bem.e('brand')">
        <div :class="bem.e('logo')" />
        <h1 :class="bem.e('title')">企业中后台管理</h1>
        <p :class="bem.e('subtitle')">{{ appTitle }} · 数据中台</p>
      </div>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        :class="bem.e('form')"
        @submit.prevent="handleSubmit"
      >
        <el-form-item :label="$t('auth.username')" prop="username">
          <el-input v-model="form.username" :prefix-icon="User" clearable />
        </el-form-item>

        <el-form-item :label="$t('auth.password')" prop="password">
          <el-input
            v-model="form.password"
            :prefix-icon="Lock"
            :type="showPassword ? 'text' : 'password'"
          >
            <template #suffix>
              <el-button
                link
                :class="bem.e('toggle-pwd')"
                @click="showPassword = !showPassword"
              >
                <el-icon><component :is="showPassword ? 'Hide' : 'View'" /></el-icon>
              </el-button>
            </template>
          </el-input>
        </el-form-item>

        <div :class="bem.e('actions')">
          <el-checkbox v-model="rememberMe">记住我</el-checkbox>
          <a :class="bem.e('link')" @click.prevent>忘记密码？</a>
        </div>

        <el-button
          type="primary"
          :loading="loading.value"
          :class="bem.e('submit')"
          @click="handleSubmit"
        >
          {{ loading.value ? '登录中...' : '登录' }}
        </el-button>
      </el-form>

      <p :class="bem.e('footer')">© 2026 {{ appTitle }}中心</p>
    </el-card>
  </div>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-auth-login {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 12vh;
  overflow: hidden;
  // ... CSS Variables + 所有样式
}
</style>
```

### 5.3 不做的事（避免范围蔓延）

- ❌ 不新建子组件（避免 §2 架构锁定）
- ❌ 不新建 scss 变量文件（CSS Variables 内联在组件 style 内）
- ❌ 不引入新依赖
- ❌ 不修改其他文件（路由、store、布局、locales）
- ❌ 不实现"扫码登录""短信登录"等扩展功能
- ❌ 不实现"忘记密码"实际逻辑（仅占位 UI）

---

## 6. 测试

### 6.1 单元测试（`src/modules/auth/views/Login.spec.ts`，新增）

覆盖以下场景：

| 用例 | 断言 |
|------|------|
| 渲染默认 | 卡片、输入框、按钮存在 |
| 表单校验 | 空用户名/密码提交，触发错误提示 |
| 登录成功 | mock userStore.login resolve → ElMessage.success + router.push('/home') |
| 登录失败 | mock userStore.login reject → ElMessage.error + 不跳转 |
| redirect 参数 | `?redirect=/foo` 时跳转 `/foo` |
| 密码显隐切换 | 点击 👁 后 input type 切换 |
| 记住我 | v-model 双向绑定 |

**覆盖率目标**：≥ 80%（与项目 §4 一致）

### 6.2 不做的事

- ❌ 不写 E2E（登录流程简单，E2E 由项目其他模块负责）
- ❌ 不做视觉回归（单页面 + 一次性优化，手工 + 截图验证即可）

---

## 7. 实施步骤

1. 创建任务清单（用 TaskCreate）
2. 在 `.claude/backups/login-ui-refresh/` 备份原 `Login.vue`
3. 用 `Write` 完全重写 `src/modules/auth/views/Login.vue`
4. 新建 `src/modules/auth/views/Login.spec.ts`
5. 跑 `pnpm test src/modules/auth/views/Login.spec.ts` 验证通过
6. 跑 `pnpm type-check:full` 验证 TS 通过
7. 跑 `pnpm lint` 验证 ESLint 通过
8. 启动 `pnpm dev:local` 浏览器目视验证
9. 输出合规简报
10. git add + commit（中文 msg，等用户授权）

---

## 8. 风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| `backdrop-filter` Firefox 不支持 | 中 | 低 | `@supports not` 降级到不透明背景 |
| Element Plus 默认主题色与深色卡片冲突 | 中 | 中 | `<style lang="scss">` 内不写 scoped 但用高优先级选择器 + `:deep()` 穿透 |
| 移动端性能（光斑 blur 120px） | 低 | 低 | < 768px 减为 2 个光斑 |
| 加载慢 | 极低 | 极低 | 纯 CSS，无图片资源 |
| 第三方依赖 API 变更 | 0 | — | 不引入新依赖 |
| 暗色与现有 portal 头部调性冲突 | 低 | 中 | 复用 portal-tokens.scss 已有的暗色科技色系 |

---

## 9. 验收清单

- [ ] 视觉与设计稿一致（手工 + 浏览器截图）
- [ ] 表单校验正常（空提交报错）
- [ ] 登录成功跳转 `/home`
- [ ] 登录失败显示错误提示（不静默吞错）
- [ ] redirect 参数生效
- [ ] 密码显隐切换正常
- [ ] 移动端布局不溢出
- [ ] 键盘 Tab 流程合理
- [ ] 单元测试覆盖率 ≥ 80%
- [ ] `pnpm type-check:full` 通过
- [ ] `pnpm lint` 通过
- [ ] 无 TypeScript 报错
- [ ] 无 ESLint 报错
- [ ] 浏览器控制台无错误
- [ ] 不修改 src/ 其他文件
- [ ] git diff 范围仅限 `Login.vue` + `Login.spec.ts`

---

**文档版本**：v1.0.0
**生成日期**：2026-07-28
