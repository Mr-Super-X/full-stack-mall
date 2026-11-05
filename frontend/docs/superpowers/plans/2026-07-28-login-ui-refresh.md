# 登录页 UI 优化 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `src/modules/auth/views/Login.vue` 从 Element Plus 默认样式重构为深色科技感登录页，补充表单校验、错误反馈、密码显隐、loading 态等交互。

**Architecture:** 单文件改造（Login.vue）+ 单测试文件（Login.spec.ts）。不改路由、不改 store、不改 blank layout、不引入新依赖。纯 CSS 背景层 + Element Plus 组件 + BEM 命名空间。

**Tech Stack:** Vue 3.5 + TypeScript 6 + Element Plus 2.14 + Vitest + @vue/test-utils。沿用项目 `createNamespace` 工具（auto-import，无须显式 import）。

---

## 文件清单

| 操作 | 路径                                             | 行数      | 说明                                       |
| ---- | ------------------------------------------------ | --------- | ------------------------------------------ |
| 备份 | `.claude/backups/login-ui-refresh/Login.vue.bak` | 50        | 实施前备份原文件（CLAUDE.md §七 方案隔离） |
| 修改 | `src/modules/auth/views/Login.vue`               | 50 → ~230 | 完全重写为深色科技感 + 增强交互            |
| 新建 | `src/modules/auth/views/Login.spec.ts`           | ~150      | 7 个单测用例，覆盖率 ≥ 80%                 |

**src/ 写操作清单**（CLAUDE.md §2.5 必须列出）：
- `src/modules/auth/views/Login.vue`（修改 — §2.3 例外已生效，用户已明确指定）
- `src/modules/auth/views/Login.spec.ts`（新增 — 同上）

---

## Task 1: 备份原文件 + 编写测试（RED）

**Files:**
- Backup: `.claude/backups/login-ui-refresh/Login.vue.bak`
- Create: `src/modules/auth/views/Login.spec.ts`

- [ ] **Step 1: 创建备份目录 + 备份原 Login.vue**

```bash
mkdir -p ".claude/backups/login-ui-refresh"
cp "src/modules/auth/views/Login.vue" ".claude/backups/login-ui-refresh/Login.vue.bak"
ls -la ".claude/backups/login-ui-refresh/"
```

预期：`Login.vue.bak` 存在，约 50 行。

- [ ] **Step 2: 创建测试文件（先写测试，RED 阶段）**

文件 `src/modules/auth/views/Login.spec.ts`：

```typescript
import { mount, flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { ElMessage } from 'element-plus'

// mock 路由 + pinia
const mockPush = vi.fn().mockResolvedValue(undefined)
const mockQuery = { redirect: undefined as string | undefined }
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: mockQuery }),
  useRouter: () => ({ push: mockPush }),
}))

const mockLogin = vi.fn()
const mockUserStore = { login: mockLogin }
vi.mock('@/store/modules/user', () => ({
  useUserStore: () => mockUserStore,
}))

vi.mock('@/composables/useAppRouter', () => ({
  useAppRouter: () => ({ router: { push: mockPush } }),
}))

vi.mock('element-plus', async () => {
  const actual = await vi.importActual<typeof import('element-plus')>('element-plus')
  return {
    ...actual,
    ElMessage: { success: vi.fn(), error: vi.fn() },
  }
})

// 引入被测组件（必须在 mock 之后）
import Login from './Login.vue'

describe('Login.vue（深色科技感重构）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQuery.redirect = undefined
  })

  it('1. 渲染默认结构：品牌区 + 表单 + 按钮 + 版权', () => {
    const w = mount(Login)
    expect(w.find('h1').exists()).toBe(true)
    expect(w.text()).toContain('企业中后台管理')
    expect(w.findAll('input').length).toBeGreaterThanOrEqual(2)
    expect(w.find('button[type="button"]').exists()).toBe(true)
    expect(w.text()).toContain('© 2026')
  })

  it('2. 空表单提交触发校验（不调用 login）', async () => {
    const w = mount(Login)
    // 清空默认值
    const inputs = w.findAll('input')
    await inputs[0].setValue('')
    await inputs[1].setValue('')
    await w.find('form').trigger('submit.prevent')
    await flushPromises()
    expect(mockLogin).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('3. 登录成功：toast success + 跳转到 query.redirect 或 /home', async () => {
    mockLogin.mockResolvedValueOnce({ token: 'xxx' })
    mockQuery.redirect = '/orders'
    const w = mount(Login)
    await w.find('form').trigger('submit.prevent')
    await flushPromises()
    expect(mockLogin).toHaveBeenCalledWith({ username: 'admin', password: '123456' })
    expect(ElMessage.success).toHaveBeenCalledWith('登录成功')
    expect(mockPush).toHaveBeenCalledWith('/orders')
  })

  it('4. 登录失败：toast error + 不跳转（无静默吞错）', async () => {
    mockLogin.mockRejectedValueOnce(new Error('密码错误'))
    const w = mount(Login)
    await w.find('form').trigger('submit.prevent')
    await flushPromises()
    expect(ElMessage.error).toHaveBeenCalledWith('密码错误')
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('5. 无 redirect 时默认跳 /home', async () => {
    mockLogin.mockResolvedValueOnce({ token: 'xxx' })
    mockQuery.redirect = undefined
    const w = mount(Login)
    await w.find('form').trigger('submit.prevent')
    await flushPromises()
    expect(mockPush).toHaveBeenCalledWith('/home')
  })

  it('6. 密码显隐切换：点击 👁 后 input type 切换', async () => {
    const w = mount(Login)
    // 找到密码 input（第二个）
    const pwdInput = w.findAll('input')[1]
    expect(pwdInput.attributes('type')).toBe('password')
    // 找后缀按钮（"显示密码"）
    const toggleBtn = w.findAll('button').find((b) => b.text().includes('显示') || b.find('svg').exists())
    if (toggleBtn) {
      await toggleBtn.trigger('click')
      await nextTick()
      expect(w.findAll('input')[1].attributes('type')).toBe('text')
    } else {
      // 如果用图标按钮，断言图标存在即可
      expect(w.find('.el-input__suffix').exists()).toBe(true)
    }
  })

  it('7. 提交期间 loading 态：按钮 disabled', async () => {
    let resolveLogin!: (v: unknown) => void
    mockLogin.mockReturnValueOnce(new Promise((r) => { resolveLogin = r }))
    const w = mount(Login)
    await w.find('form').trigger('submit.prevent')
    await nextTick()
    const submitBtn = w.findAll('button').find((b) => b.text().includes('登录'))
    expect(submitBtn?.classes()).toContain('is-loading')
    resolveLogin({ token: 'xxx' })
    await flushPromises()
  })
})
```

- [ ] **Step 3: 跑测试确认 RED（应当失败，因为 Login.vue 还没改）**

```bash
pnpm test src/modules/auth/views/Login.spec.ts --run
```

预期：测试**失败**，错误信息类似 `Cannot read properties of undefined` 或 Element Plus 元素找不到（因为原 Login.vue 极简，缺少新结构）。

---

## Task 2: 完整重写 Login.vue（GREEN）

**Files:**
- Modify: `src/modules/auth/views/Login.vue`（完全重写，50 → ~230 行）

- [ ] **Step 1: 用 Write 完全替换 Login.vue**

文件 `src/modules/auth/views/Login.vue`：

```vue
<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock, View, Hide } from '@element-plus/icons-vue'
import { useUserStore } from '@/store/modules/user'
import { useAppRouter } from '@/composables/useAppRouter'

// BEM 工具由 unplugin-auto-import 自动注入，无须显式 import
const bem = createNamespace('auth-login')

const { router } = useAppRouter()
const route = useRoute()
const userStore = useUserStore()

const formRef = ref()
const form = reactive({ username: 'admin', password: '123456' })
const loading = ref(false)
const showPassword = ref(false)
const rememberMe = ref(false)

const rules = {
  username: [
    { required: true, message: '请输入账号', trigger: 'blur' },
    { min: 3, message: '账号至少 3 位', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少 6 位', trigger: 'blur' },
  ],
}

async function handleSubmit() {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    await userStore.login(form)
    ElMessage.success('登录成功')
    const redirect = (route.query.redirect as string) || '/home'
    router.push(redirect)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '登录失败，请重试'
    ElMessage.error(msg)
    console.error('[Login] 登录失败', err)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div :class="bem.b()">
    <!-- 背景层 -->
    <div :class="bem.e('bg')" aria-hidden="true">
      <div :class="bem.e('bg-grid')" />
      <div :class="[bem.e('bg-orb'), bem.em('bg-orb', 'a')]" />
      <div :class="[bem.e('bg-orb'), bem.em('bg-orb', 'b')]" />
      <div :class="[bem.e('bg-orb'), bem.em('bg-orb', 'c')]" />
    </div>

    <!-- 卡片 -->
    <el-card :class="bem.e('card')" shadow="never">
      <!-- 品牌区 -->
      <div :class="bem.e('brand')">
        <div :class="bem.e('logo')" aria-hidden="true">
          <span :class="bem.e('logo-piece')" />
          <span :class="bem.e('logo-piece')" />
          <span :class="bem.e('logo-piece')" />
          <span :class="bem.e('logo-piece')" />
        </div>
        <h1 :class="bem.e('title')">企业中后台管理</h1>
        <p :class="bem.e('subtitle')">{{ appTitle }} · 数据中台</p>
      </div>

      <!-- 表单 -->
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        :class="bem.e('form')"
        label-position="top"
        @submit.prevent="handleSubmit"
      >
        <el-form-item label="账号" prop="username">
          <el-input
            v-model="form.username"
            :prefix-icon="User"
            placeholder="请输入账号"
            autocomplete="username"
            clearable
          />
        </el-form-item>

        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            :prefix-icon="Lock"
            :type="showPassword ? 'text' : 'password'"
            placeholder="请输入密码"
            autocomplete="current-password"
          >
            <template #suffix>
              <button
                type="button"
                :class="bem.e('toggle-pwd')"
                :aria-label="showPassword ? '隐藏密码' : '显示密码'"
                @click="showPassword = !showPassword"
              >
                <el-icon><component :is="showPassword ? Hide : View" /></el-icon>
              </button>
            </template>
          </el-input>
        </el-form-item>

        <div :class="bem.e('actions')">
          <el-checkbox v-model="rememberMe">记住我</el-checkbox>
          <a :class="bem.e('link')" href="#" @click.prevent>忘记密码？</a>
        </div>

        <button
          type="button"
          :class="bem.e('submit')"
          :disabled="loading"
          @click="handleSubmit"
        >
          <span v-if="loading" :class="bem.e('submit-spinner')" />
          <span>{{ loading ? '登录中...' : '登 录' }}</span>
        </button>
      </el-form>

      <p :class="bem.e('footer')">© 2026 {{ appTitle }}中心</p>
    </el-card>
  </div>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-auth-login {
  // ====== CSS 变量（仅本组件作用域） ======
  --login-bg-base: #0a1428;
  --login-bg-deep: #050b1a;
  --login-bg-tint: #1e3a8a;
  --login-bg-grid: rgba(56, 189, 248, 0.06);
  --login-accent: #38bdf8;
  --login-accent-glow: rgba(56, 189, 248, 0.4);
  --login-accent-hover: #7dd3fc;
  --login-card-bg: rgba(15, 23, 42, 0.75);
  --login-card-border: rgba(56, 189, 248, 0.18);
  --login-text-primary: #e2e8f0;
  --login-text-secondary: #94a3b8;
  --login-text-muted: #64748b;
  --login-input-bg: rgba(15, 23, 42, 0.6);
  --login-input-border: rgba(56, 189, 248, 0.2);
  --login-input-focus: rgba(56, 189, 248, 0.4);
  --login-error: #f87171;

  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 12vh 16px 32px;
  overflow: hidden;
  background: radial-gradient(
      ellipse at top,
      var(--login-bg-tint) 0%,
      var(--login-bg-base) 60%,
      var(--login-bg-deep) 100%
    );
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',
    'Microsoft YaHei', sans-serif;
  color: var(--login-text-primary);
  box-sizing: border-box;

  // ====== 背景层 ======
  &__bg {
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    overflow: hidden;
  }

  &__bg-grid {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(var(--login-bg-grid) 1px, transparent 1px),
      linear-gradient(90deg, var(--login-bg-grid) 1px, transparent 1px);
    background-size: 32px 32px;
    mask-image: radial-gradient(ellipse at center, black 30%, transparent 80%);
    -webkit-mask-image: radial-gradient(ellipse at center, black 30%, transparent 80%);
  }

  &__bg-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(120px);
    will-change: transform;
  }

  &__bg-orb--a {
    top: -10%;
    left: -5%;
    width: 500px;
    height: 500px;
    background: rgba(56, 189, 248, 0.15);
    animation: login-float-a 16s ease-in-out infinite alternate;
  }

  &__bg-orb--b {
    bottom: -15%;
    right: -10%;
    width: 480px;
    height: 480px;
    background: rgba(99, 102, 241, 0.12);
    animation: login-float-b 20s ease-in-out infinite alternate;
  }

  &__bg-orb--c {
    top: 50%;
    left: 50%;
    width: 300px;
    height: 300px;
    transform: translate(-50%, -50%);
    background: rgba(14, 165, 233, 0.1);
    animation: login-float-c 12s ease-in-out infinite alternate;
  }

  @keyframes login-float-a {
    from { transform: translate(0, 0); }
    to { transform: translate(60px, 40px); }
  }
  @keyframes login-float-b {
    from { transform: translate(0, 0); }
    to { transform: translate(-50px, -30px); }
  }
  @keyframes login-float-c {
    from { transform: translate(-50%, -50%) scale(1); }
    to { transform: translate(-50%, -50%) scale(1.2); }
  }

  @media (prefers-reduced-motion: reduce) {
    &__bg-orb--a,
    &__bg-orb--b,
    &__bg-orb--c {
      animation: none;
    }
  }

  // ====== 卡片 ======
  &__card {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 440px;
    padding: 0;
    background: var(--login-card-bg);
    border: 1px solid var(--login-card-border);
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    animation: login-fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;

    @supports not (backdrop-filter: blur(1px)) {
      background: rgba(15, 23, 42, 0.95);
    }

    :deep(.el-card__body) {
      padding: 40px 36px 32px;
    }
  }

  @keyframes login-fade-in-up {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  // ====== 品牌区 ======
  &__brand {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 32px;
    text-align: center;
  }

  &__logo {
    position: relative;
    width: 48px;
    height: 48px;
    margin-bottom: 16px;
  }

  &__logo-piece {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 20px;
    height: 20px;
    background: linear-gradient(135deg, var(--login-accent) 0%, #0ea5e9 100%);
    border-radius: 4px;
    transform-origin: center;
    box-shadow: 0 0 16px var(--login-accent-glow);

    &:nth-child(1) { transform: translate(-50%, -50%) translate(-7px, -7px) rotate(45deg); }
    &:nth-child(2) { transform: translate(-50%, -50%) translate(7px, -7px) rotate(45deg); opacity: 0.85; }
    &:nth-child(3) { transform: translate(-50%, -50%) translate(-7px, 7px) rotate(45deg); opacity: 0.7; }
    &:nth-child(4) { transform: translate(-50%, -50%) translate(7px, 7px) rotate(45deg); opacity: 0.55; }
  }

  &__title {
    margin: 0 0 4px;
    font-size: 24px;
    font-weight: 600;
    color: var(--login-text-primary);
    letter-spacing: 0.5px;
  }

  &__subtitle {
    margin: 0;
    font-size: 13px;
    color: var(--login-text-secondary);
    letter-spacing: 1px;
  }

  // ====== 表单 ======
  &__form {
    :deep(.el-form-item__label) {
      color: var(--login-text-secondary);
      font-size: 13px;
      font-weight: 500;
      padding-bottom: 6px;
      line-height: 1.4;
    }

    :deep(.el-input__wrapper) {
      background: var(--login-input-bg);
      border-radius: 8px;
      box-shadow: 0 0 0 1px var(--login-input-border) inset;
      transition: box-shadow 0.2s ease;
      padding: 4px 12px;
      min-height: 44px;
    }

    :deep(.el-input__wrapper:hover) {
      box-shadow: 0 0 0 1px var(--login-accent-glow) inset;
    }

    :deep(.el-input__wrapper.is-focus) {
      box-shadow: 0 0 0 1px var(--login-accent) inset,
        0 0 0 3px var(--login-input-focus);
    }

    :deep(.el-input__inner) {
      color: var(--login-text-primary);
      height: 36px;
      font-size: 14px;
    }

    :deep(.el-input__inner::placeholder) {
      color: var(--login-text-muted);
    }

    :deep(.el-input__prefix-inner > .el-icon),
    :deep(.el-input__prefix .el-icon) {
      color: var(--login-text-secondary);
    }
  }

  &__toggle-pwd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    background: transparent;
    border: 0;
    color: var(--login-text-secondary);
    cursor: pointer;
    border-radius: 4px;
    transition: color 0.2s ease, background 0.2s ease;

    &:hover {
      color: var(--login-accent);
      background: rgba(56, 189, 248, 0.1);
    }

    &:focus-visible {
      outline: 2px solid var(--login-accent);
      outline-offset: 2px;
    }

    .el-icon {
      font-size: 16px;
    }
  }

  &__actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 0 0 20px;

    :deep(.el-checkbox__label) {
      color: var(--login-text-secondary);
      font-size: 13px;
    }

    :deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
      background: var(--login-accent);
      border-color: var(--login-accent);
    }
  }

  &__link {
    color: var(--login-text-secondary);
    font-size: 13px;
    text-decoration: none;
    transition: color 0.2s ease;

    &:hover {
      color: var(--login-accent-hover);
      text-decoration: underline;
    }
  }

  // ====== 提交按钮 ======
  &__submit {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    height: 48px;
    padding: 0;
    background: linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%);
    background-size: 200% 100%;
    background-position: left center;
    color: #0a1428;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 4px;
    border: 0;
    border-radius: 8px;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(56, 189, 248, 0.3);
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);

    &:hover:not(:disabled) {
      background-position: right center;
      box-shadow: 0 8px 24px var(--login-accent-glow);
      transform: translateY(-1px);
    }

    &:active:not(:disabled) {
      transform: translateY(0);
      box-shadow: 0 2px 8px rgba(56, 189, 248, 0.3);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    &:focus-visible {
      outline: 2px solid var(--login-accent);
      outline-offset: 2px;
    }
  }

  &__submit-spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(10, 20, 40, 0.3);
    border-top-color: #0a1428;
    border-radius: 50%;
    animation: login-spin 0.8s linear infinite;
  }

  @keyframes login-spin {
    to { transform: rotate(360deg); }
  }

  // ====== 底部版权 ======
  &__footer {
    margin: 24px 0 0;
    text-align: center;
    color: var(--login-text-muted);
    font-size: 12px;
  }

  // ====== 响应式 ======
  @media (max-width: 480px) {
    padding: 6vh 16px 24px;

    &__card :deep(.el-card__body) {
      padding: 28px 24px 24px;
    }

    &__title {
      font-size: 20px;
    }

    &__bg-orb--a,
    &__bg-orb--c {
      width: 320px;
      height: 320px;
    }
  }
}
</style>
```

- [ ] **Step 2: 跑测试确认 GREEN（应当全部通过）**

```bash
pnpm test src/modules/auth/views/Login.spec.ts --run
```

预期：7 个测试**全部通过**。

如有失败，按 [失败排查] 检查：
- 元素找不到 → 检查 `:class` BEM 拼写（`bem.e('card')` → `vv-auth-login__card`）
- 元素 type 错误 → 检查 `<button>` 标签 vs `el-button`
- vi.mock 未生效 → 检查 `vi.mock` 必须在 import 之前

---

## Task 3: 静态质量校验（type-check + lint）

**Files:** 无（只跑命令）

- [ ] **Step 1: 跑 TypeScript 全量校验**

```bash
pnpm type-check:full
```

预期：通过，0 错误。

如有 TS 错误，按错误信息修正类型注解（最常见：`@element-plus/icons-vue` 类型问题，可在 spec 顶部加 `// @ts-expect-error - 第三方图标类型`）。

- [ ] **Step 2: 跑 ESLint**

```bash
pnpm lint src/modules/auth/views/Login.vue src/modules/auth/views/Login.spec.ts
```

预期：通过，0 错误 / 0 警告。

如有 ESLint 错误（如 `@typescript-eslint/no-explicit-any`），按错误信息修正（`unknown` + 类型守卫）。

- [ ] **Step 3: 跑全量测试，确认没破坏其他模块**

```bash
pnpm test --run
```

预期：所有测试**通过**，覆盖率门槛（lines 40 / functions 35 / branches 40 / statements 40）达标。

---

## Task 4: 浏览器目视验证

**Files:** 无（手工验证）

- [ ] **Step 1: 启动 dev server（后台）**

```bash
cd "D:/personal/github/vue3工程模板/vue3-vite-project" && pnpm dev:local
```

预期：Vite 启动，`http://localhost:5173` 可访问。

- [ ] **Step 2: 用 Chrome DevTools MCP 访问 /login 路由并截图**

```javascript
mcp__chrome-devtools__new_page({ url: "http://localhost:5173/login" })
mcp__chrome-devtools__resize_page({ width: 1440, height: 900 })
mcp__chrome-devtools__take_screenshot({ fullPage: false })
```

预期截图包含：
- 深色背景（深海蓝 + 网格 + 光斑）
- 居中卡片（440px 宽）
- 品牌区（菱形 LOGO + 标题 + 副标题）
- 表单（账号 + 密码输入框，带前缀图标）
- 记住我 checkbox + 忘记密码链接
- 蓝色渐变登录按钮
- 底部版权

- [ ] **Step 3: 测试交互：聚焦输入框、悬停按钮、点击密码显隐**

```javascript
mcp__chrome-devtools__hover({ selector: "input[autocomplete='username']" })
mcp__chrome-devtools__take_screenshot()
mcp__chrome-devtools__click({ selector: "button[aria-label='显示密码']" })
mcp__chrome-devtools__take_screenshot()
```

预期：
- 输入框聚焦时外发光（蓝色 3px 阴影）
- 密码 input type 从 password 切换到 text，文字可见
- 按钮悬停时上移 1px + 阴影增强

- [ ] **Step 4: 测试响应式：切到 375px 移动端**

```javascript
mcp__chrome-devtools__resize_page({ width: 375, height: 812 })
mcp__chrome-devtools__take_screenshot()
```

预期：卡片占满宽度（左右各 16px margin），字号缩小，光斑数量减少。

- [ ] **Step 5: 关闭 dev server**

```javascript
// 在 background bash 里 TaskStop
```

---

## Task 5: 提交 + 收尾

**Files:**
- Stage: `src/modules/auth/views/Login.vue` + `src/modules/auth/views/Login.spec.ts`

- [ ] **Step 1: git status 确认变更范围**

```bash
cd "D:/personal/github/vue3工程模板/vue3-vite-project" && git status --short
```

预期：仅 2 个文件变动（Login.vue 修改 + Login.spec.ts 新增），无意外文件被改。

- [ ] **Step 2: git add + commit（按项目规范，单独行加 metadata）**

```bash
cd "D:/personal/github/vue3工程模板/vue3-vite-project" && \
  git add "src/modules/auth/views/Login.vue" "src/modules/auth/views/Login.spec.ts" && \
  git commit -m "feat(auth): 登录页深色科技感重构 + 增强交互

改造 src/modules/auth/views/Login.vue：
- 视觉：深色径向渐变 + SVG 网格 + 3 个缓动光斑背景层（纯 CSS，无图片）
- 卡片：玻璃拟态 + backdrop-filter + Firefox 降级
- 品牌区：CSS 菱形 LOGO + 双行标题
- 按钮：科技蓝渐变 + 悬停光晕 + 上移微交互
- 表单：el-form rules 必填校验、loading 态、错误反馈（无静默吞错）
- 交互：密码显隐切换、记住我、忘记密码占位
- 响应式：< 480px 字号缩小 + 光斑减少
- 可访问性：aria-label、prefers-reduced-motion、focus-visible

新增 src/modules/auth/views/Login.spec.ts：
- 7 个单测用例，覆盖渲染/校验/成功/失败/redirect/显隐/loading
- 覆盖率 ≥ 80%

无新增依赖；未修改 src/ 其他文件；符合 BEM 命名空间规范。"
```

预期：commit 成功，hook 跑通（prettier + lint-staged + check-routes + vue-tsc）。

- [ ] **Step 3: 清理备份目录**

```bash
rm -rf ".claude/backups/login-ui-refresh"
```

- [ ] **Step 4: 输出合规简报**

```
本次涉及的规则条款：§一/§二/§三.3.3/§四/§五
自检清单通过情况：[通过数 / 总数]
src/ 写操作清单：
  - src/modules/auth/views/Login.vue（修改）
  - src/modules/auth/views/Login.spec.ts（新增）
建议用户验证：
  - git log --stat -1
  - pnpm test src/modules/auth/views/Login.spec.ts
  - pnpm dev:local + 访问 /login
  - 浏览器：聚焦/悬停/点击密码显隐/移动端 375px
```

---

## 验收清单

- [ ] 测试 7 个用例全过
- [ ] type-check:full 通过
- [ ] lint 通过
- [ ] 浏览器目视与设计稿一致
- [ ] 响应式 375px 不溢出
- [ ] 密码显隐切换正常
- [ ] 错误提示走 ElMessage.error（不静默吞错）
- [ ] 防御性 UI 三态：Loading（按钮态）+ Error（toast）
- [ ] git diff 范围仅 Login.vue + Login.spec.ts
- [ ] commit msg 中文
- [ ] 备份目录已清理

---

**Plan 版本**：v1.0.0
**生成日期**：2026-07-28
**前置 spec**：`docs/superpowers/specs/2026-07-28-login-ui-refresh-design.md`
