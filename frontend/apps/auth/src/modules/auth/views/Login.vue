<script setup lang="ts">
/**
 * 登录页（blank 布局，apps/auth 统一登录入口）。
 *
 * 视觉（2026-11-03 重设计 v2）：暖米灰双栏卡片——左品牌区 + 右表单区，
 * 参考用户提供的 unified-login.html 风格。拆分为 LoginBrand + LoginForm 两个子组件。
 * 样式见 [`../styles/login.scss`](../styles/login.scss)。
 *
 * 提交流程：
 * 1. `formRef.value.validate()` 同步校验账号 / 密码（≥3 / ≥6 位）
 * 2. 调用 `userStore.login(form)` 触发 authApi
 * 3. 成功后 `resolvePostLoginRedirect(resolveDefaultFallback())` 解析回跳目标（同源前缀校验，
 *    防开放重定向），整页 `location.href` 跳回原 app——跨应用无共享 router 实例，
 *    不可 router.push（P4 跨应用统一登录协议，@vv/shared auth/redirect.ts）
 * 4. 失败统一 ElMessage.error，错误对象归一化（Error.message / '登录失败'）
 *
 * 表单默认值：`admin / 123456`（仅演示用，生产应改 SSO / 短信验证码）。
 *
 * @see [`@/store/modules/user`](../../../store/modules/user.ts) 登录态
 * @see `@vv/shared/auth/redirect` 回跳协议
 * @see [`../styles/login.scss`](../styles/login.scss) 样式抽离
 * @group 业务模块：Auth
 */
import { useI18n } from 'vue-i18n'
import { useUserStore } from '@vv/shared'
import { resolvePostLoginRedirect, stripRepoPrefix, withRepoPrefix } from '@vv/shared'
import LoginBrand from '../components/LoginBrand.vue'
import LoginForm from '../components/LoginForm.vue'

// BEM 工具由 unplugin-auto-import 自动注入，无须显式 import
const bem = createNamespace('login')

const { t } = useI18n()
const userStore = useUserStore()

const formRef = ref()
const form = reactive({ username: 'admin', password: '123456' })
const loading = ref(false)
const showPassword = ref(false)
const rememberMe = ref(false)
const activeTab = ref('account')

const appTitle = import.meta.env.VITE_APP_TITLE || '统一登录'

const rules = {
  username: [
    { required: true, message: t('auth.accountRequired'), trigger: 'blur' },
    { min: 3, message: t('auth.accountMin'), trigger: 'blur' },
  ],
  password: [
    { required: true, message: t('auth.passwordRequired'), trigger: 'blur' },
    { min: 6, message: t('auth.passwordMin'), trigger: 'blur' },
  ],
}

// ─── Toast 轻提示 ───
const toastVisible = ref(false)
const toastMessage = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined

function showToast(msg: string): void {
  toastMessage.value = msg
  toastVisible.value = true
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastVisible.value = false
  }, 2400)
}

onUnmounted(() => clearTimeout(toastTimer))

async function handleSubmit() {
  if (!formRef.value) return
  // validate 是 LoginForm 代理方法，内部已 catch 返回 boolean
  const valid = await formRef.value.validate()
  if (!valid) {
    nextTick(() => {
      if (!form.username) markFieldError('username')
      if (!form.password) markFieldError('password')
    })
    return
  }

  loading.value = true
  try {
    await userStore.login(form)
    ElMessage.success(t('auth.loginSuccessRedirect'))
    window.location.href = resolvePostLoginRedirect(withRepoPrefix(resolveDefaultFallback()))
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : t('auth.loginFailed')
    ElMessage.error(msg)
    console.error('[Login] 登录失败', err)
  } finally {
    loading.value = false
  }
}

/**
 * 动态识别默认落地 app（不写死）：
 * resolvePostLoginRedirect 已优先消费 ?redirect= 参数（redirectToAuthLogin 写入），
 * 本函数仅在无 redirect 参数时作 fallback，优先级：
 * referrer 推断来源 app → dev:gateway / build-pages 注入的 VITE_POST_LOGIN_FALLBACK
 * （子集感知，见 scripts/dev-gateway.ts resolvePostLoginFallback /
 * scripts/build-pages.ts auth 构建注入）→ auth 自身首页。
 * 绝不硬编码 admin/big 等 app 名。
 *
 * referrer 推断必须先经 stripRepoPrefix 剥部署前缀再取首段——gh-pages 形态
 * （VITE_BASE=/<repo>/<app>/）下 referrer pathname 首段是 repo 名而非 app 名，
 * 直接取首段会把 repo 名误当来源 app，再经 withRepoPrefix 二次加前缀拼出
 * /<repo>/<repo>/ 404（2026-11-04 线上事故根因）。
 */
function resolveDefaultFallback(): string {
  // referrer 路径剥部署前缀后首段才是来源 app 名（dev 根部署下 strip 恒为恒等）
  try {
    const refPath = stripRepoPrefix(new URL(document.referrer).pathname)
    const refSeg = refPath.split('/').filter(Boolean)[0]
    if (refSeg && refSeg !== 'auth') return `/${refSeg}/`
  } catch {
    // referrer 为空（地址栏直开）或跨源——走下两级兜底
  }
  // dev:gateway / build-pages 构建注入（portal 优先或显式指定 / 第一个非 auth app）；
  // 单 app 直起无注入 → undefined，走 /auth/ 兜底
  const envFallback = import.meta.env.VITE_POST_LOGIN_FALLBACK
  if (envFallback) return envFallback
  return '/auth/'
}

function markFieldError(field: 'username' | 'password'): void {
  const item = formRef.value?.fields?.find((f: { prop: string }) => f.prop === field)
  const wrapper = item?.$el?.querySelector('.el-input__wrapper')
  if (!wrapper) return
  wrapper.classList.add('is-error')
  setTimeout(() => wrapper.classList.remove('is-error'), 1600)
}
</script>

<template>
  <div :class="bem.b()">
    <div :class="[bem.e('blob'), bem.em('blob', 'a')]" aria-hidden="true" />
    <div :class="[bem.e('blob'), bem.em('blob', 'b')]" aria-hidden="true" />

    <div :class="bem.e('scene')">
      <div :class="bem.e('shell')">
        <LoginBrand :app-title="appTitle" />
        <LoginForm
          ref="formRef"
          v-model:form="form"
          v-model:show-password="showPassword"
          v-model:remember-me="rememberMe"
          v-model:active-tab="activeTab"
          :loading="loading"
          :rules="rules"
          @submit="handleSubmit"
          @toast="showToast"
        />
      </div>

      <footer :class="bem.e('footer')">
        © 2026 统一身份认证平台 ·
        <a href="#" @click.prevent="showToast('《统一认证服务协议》（演示）')">用户协议</a>
        ·
        <a href="#" @click.prevent="showToast('《隐私政策》（演示）')">隐私政策</a>
        ·
        <a href="#" @click.prevent="showToast('帮助中心（演示）')">帮助中心</a>
        · ICP备2026001188号
      </footer>
    </div>

    <div
      :class="[bem.e('toast'), toastVisible && bem.em('toast', 'show')]"
      role="status"
      aria-live="polite"
    >
      {{ toastMessage }}
    </div>
  </div>
</template>

<style lang="scss">
@use '../styles/login.scss';
</style>
