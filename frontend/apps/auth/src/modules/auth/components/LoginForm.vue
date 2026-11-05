<script setup lang="ts">
/**
 * 登录页右表单区：欢迎语 + 三 tab（账号密码 / 短信 / 扫码）+ 其他登录方式。
 *
 * 账号密码走真实登录流程（emit submit）；短信与扫码为演示 UI（emit toast）。
 */
import { User, Lock, View, Hide } from '@element-plus/icons-vue'

interface Props {
  /** 是否正在登录请求中（按钮 loading） */
  loading: boolean
  /** 账号密码表单（v-model） */
  form: { username: string; password: string }
  /** EP 校验规则 */
  rules: Record<string, unknown[]>
  /** 密码可见性 */
  showPassword: boolean
  /** 记住我 */
  rememberMe: boolean
  /** 当前激活 tab */
  activeTab: string
}
const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:form', val: { username: string; password: string }): void
  (e: 'update:showPassword', val: boolean): void
  (e: 'update:rememberMe', val: boolean): void
  (e: 'update:activeTab', val: string): void
  (e: 'submit'): void
  (e: 'toast', msg: string): void
}>()

const bem = createNamespace('login')
const formRef = ref()

// 账号密码本地副本（避免直接改 props）
const localForm = computed({
  get: () => props.form,
  set: (val) => emit('update:form', val),
})
const localShowPassword = computed({
  get: () => props.showPassword,
  set: (val) => emit('update:showPassword', val),
})
const localRememberMe = computed({
  get: () => props.rememberMe,
  set: (val) => emit('update:rememberMe', val),
})
const localActiveTab = computed({
  get: () => props.activeTab,
  set: (val) => emit('update:activeTab', val),
})

// ─── 短信登录（演示 UI，字段级红字校验 + toast 提示） ───
const smsForm = reactive({ mobile: '', code: '' })
const smsErrors = reactive({ mobile: '', code: '' })
const codeCountdown = ref(0)
let codeTimer: ReturnType<typeof setInterval> | undefined

function sendCode(): void {
  smsErrors.mobile = ''
  if (!/^1[3-9]\d{9}$/.test(smsForm.mobile)) {
    smsErrors.mobile = '请输入正确的手机号'
    return
  }
  codeCountdown.value = 60
  emit('toast', '验证码已发送（演示环境，不会发送真实短信）')
  codeTimer = setInterval(() => {
    codeCountdown.value--
    if (codeCountdown.value <= 0) clearInterval(codeTimer)
  }, 1000)
}

function handleSmsSubmit(): void {
  smsErrors.mobile = ''
  smsErrors.code = ''
  if (!/^1[3-9]\d{9}$/.test(smsForm.mobile)) {
    smsErrors.mobile = '请输入正确的手机号'
  }
  if (!/^\d{6}$/.test(smsForm.code)) {
    smsErrors.code = '请输入 6 位验证码'
  }
  if (smsErrors.mobile || smsErrors.code) return
  emit('toast', '短信登录暂未接入，请使用账号密码登录')
}

onUnmounted(() => clearInterval(codeTimer))

// ─── 扫码登录（canvas 模拟二维码，演示环境） ───
const qrCanvasRef = ref<HTMLCanvasElement | null>(null)

function drawQR(): void {
  const canvas = qrCanvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const W = canvas.width
  const n = 25
  const s = W / (n + 2)
  const off = s
  let seed = Math.floor(Date.now() / 1000) + 7
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
  ctx.clearRect(0, 0, W, W)
  ctx.fillStyle = '#3E4144'
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const inFinder = (x < 8 && y < 8) || (x >= n - 8 && y < 8) || (x < 8 && y >= n - 8)
      if (inFinder) continue
      if (rnd() < 0.44) ctx.fillRect(off + x * s, off + y * s, s * 0.92, s * 0.92)
    }
  const finder = (fx: number, fy: number) => {
    for (let y = 0; y < 7; y++)
      for (let x = 0; x < 7; x++) {
        const edge = x === 0 || x === 6 || y === 0 || y === 6
        const core = x >= 2 && x <= 4 && y >= 2 && y <= 4
        if (edge || core) ctx.fillRect(off + (fx + x) * s, off + (fy + y) * s, s * 0.92, s * 0.92)
      }
  }
  finder(0, 0)
  finder(n - 7, 0)
  finder(0, n - 7)
}

/** 刷新二维码 + toast 提示（提取为方法，避免模板内联多行表达式被格式化器拆行引发编译错误） */
function refreshQr(): void {
  drawQR()
  emit('toast', '二维码已刷新，请在 5 分钟内完成扫码')
}

/** 切换 tab：清除全部校验状态（EP 红字 + 短信字段错误） */
function switchTab(tab: string): void {
  formRef.value?.clearValidate()
  smsErrors.mobile = ''
  smsErrors.code = ''
  localActiveTab.value = tab
}

watch(localActiveTab, (tab) => {
  if (tab === 'qr') nextTick(drawQR)
})

/** 代理 el-form 的 validate 给父组件（formRef.value.validate() 直接可用） */
async function validate(): Promise<boolean> {
  if (!formRef.value) return false
  return formRef.value.validate().catch(() => false)
}

/** 暴露 validate + formRef 给父组件 */
defineExpose({ validate, formRef })
</script>

<template>
  <main :class="bem.e('panel')">
    <div :class="bem.e('panel-inner')">
      <div :class="bem.e('welcome')">
        <h2 :class="bem.e('welcome-title')">欢迎登录</h2>
        <p :class="bem.e('welcome-sub')">
          使用企业统一账号，访问
          <b>全部已授权应用</b>
        </p>
      </div>

      <!-- 登录方式 Tab -->
      <div :class="bem.e('seg')" role="tablist">
        <button
          type="button"
          :class="[bem.e('seg-btn'), localActiveTab === 'account' && bem.em('seg-btn', 'active')]"
          role="tab"
          :aria-selected="localActiveTab === 'account'"
          @click="switchTab('account')"
        >
          账号密码
        </button>
        <button
          type="button"
          :class="[bem.e('seg-btn'), localActiveTab === 'sms' && bem.em('seg-btn', 'active')]"
          role="tab"
          :aria-selected="localActiveTab === 'sms'"
          @click="switchTab('sms')"
        >
          短信登录
        </button>
        <button
          type="button"
          :class="[bem.e('seg-btn'), localActiveTab === 'qr' && bem.em('seg-btn', 'active')]"
          role="tab"
          :aria-selected="localActiveTab === 'qr'"
          @click="switchTab('qr')"
        >
          扫码登录
        </button>
      </div>

      <!-- 账号密码面板（唯一走真实登录流程） -->
      <div
        :class="[
          bem.e('panel-account'),
          localActiveTab === 'account' && bem.em('panel-account', 'active'),
        ]"
        role="tabpanel"
      >
        <el-form
          ref="formRef"
          :model="localForm"
          :rules="rules"
          :class="bem.e('form')"
          label-position="top"
          @submit.prevent="emit('submit')"
        >
          <el-form-item :label="$t('auth.account')" prop="username">
            <el-input
              v-model="localForm.username"
              :prefix-icon="User"
              :placeholder="$t('auth.accountRequired')"
              autocomplete="username"
              clearable
            />
          </el-form-item>

          <el-form-item :label="$t('auth.password')" prop="password">
            <el-input
              v-model="localForm.password"
              :prefix-icon="Lock"
              :type="localShowPassword ? 'text' : 'password'"
              :placeholder="$t('auth.passwordRequired')"
              autocomplete="current-password"
            >
              <template #suffix>
                <button
                  type="button"
                  :class="bem.e('toggle-pwd')"
                  :aria-label="
                    localShowPassword ? $t('auth.hidePassword') : $t('auth.showPassword')
                  "
                  @click="localShowPassword = !localShowPassword"
                >
                  <el-icon><component :is="localShowPassword ? Hide : View" /></el-icon>
                </button>
              </template>
            </el-input>
          </el-form-item>

          <div :class="bem.e('actions')">
            <el-checkbox v-model="localRememberMe">{{ $t('auth.rememberMe') }}</el-checkbox>
            <a
              :class="bem.e('link')"
              href="#"
              @click.prevent="emit('toast', '演示环境：忘记密码请联系管理员')"
            >
              {{ $t('auth.forgotPassword') }}
            </a>
          </div>

          <button
            type="button"
            :class="bem.e('submit')"
            :disabled="loading"
            @click="emit('submit')"
          >
            <span v-if="loading" :class="bem.e('submit-spinner')" />
            <span>{{ loading ? $t('auth.loggingIn') : $t('auth.loginSubmit') }}</span>
          </button>
        </el-form>
      </div>

      <!-- 短信登录面板（演示 UI） -->
      <div
        :class="[bem.e('panel-sms'), localActiveTab === 'sms' && bem.em('panel-sms', 'active')]"
        role="tabpanel"
      >
        <form :class="bem.e('form')" @submit.prevent="handleSmsSubmit">
          <div>
            <div :class="[bem.e('sms-field'), smsErrors.mobile && bem.em('sms-field', 'error')]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
                style="width: 18px; height: 18px; flex-shrink: 0; color: #8b8e87"
              >
                <rect x="7" y="2.5" width="10" height="19" rx="2.6" />
                <path d="M11 18.3h2" />
              </svg>
              <input
                v-model="smsForm.mobile"
                type="tel"
                maxlength="11"
                placeholder="请输入手机号"
                autocomplete="tel"
              />
            </div>
            <p :class="bem.e('sms-error')">{{ smsErrors.mobile }}</p>
          </div>
          <div>
            <div :class="[bem.e('sms-field'), smsErrors.code && bem.em('sms-field', 'error')]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
                style="width: 18px; height: 18px; flex-shrink: 0; color: #8b8e87"
              >
                <path d="M12 3l7 3v6c0 4.6-3 7.6-7 9-4-1.4-7-4.4-7-9V6l7-3Z" />
                <path d="M9.4 12.2l1.9 1.9 3.6-3.7" />
              </svg>
              <input
                v-model="smsForm.code"
                type="text"
                inputmode="numeric"
                maxlength="6"
                placeholder="6 位验证码"
              />
              <button
                type="button"
                :class="bem.e('code-btn')"
                :disabled="codeCountdown > 0"
                @click="sendCode"
              >
                {{ codeCountdown > 0 ? `${codeCountdown}s 后重发` : '获取验证码' }}
              </button>
            </div>
            <p :class="bem.e('sms-error')">{{ smsErrors.code }}</p>
          </div>
          <button type="submit" :class="bem.e('submit')">
            <span>{{ $t('auth.loginSubmit') }}</span>
          </button>
          <p :class="bem.e('tip')">
            手机号未绑定？
            <a :class="bem.e('link')" href="#" @click.prevent="localActiveTab = 'account'">
              使用账号密码登录
            </a>
          </p>
        </form>
      </div>

      <!-- 扫码登录面板（演示 UI） -->
      <div
        :class="[bem.e('panel-qr'), localActiveTab === 'qr' && bem.em('panel-qr', 'active')]"
        role="tabpanel"
      >
        <div :class="bem.e('qr-wrap')">
          <div :class="bem.e('qr-box')">
            <canvas ref="qrCanvasRef" :class="bem.e('qr-canvas')" width="196" height="196" />
            <div :class="bem.e('qr-scanline')" />
          </div>
          <p :class="bem.e('qr-tip')">
            打开
            <b>企业微信 / 钉钉</b>
            ，扫一扫快速登录
          </p>
          <a :class="[bem.e('link'), bem.e('qr-refresh')]" href="#" @click.prevent="refreshQr">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M20 12a8 8 0 1 1-2.34-5.66" />
              <path d="M20 4v4.5h-4.5" />
            </svg>
            刷新二维码
          </a>
        </div>
      </div>

      <!-- 其他登录方式（演示环境，点击以 toast 提示为主） -->
      <div :class="bem.e('divider')"><span>其他登录方式</span></div>
      <div :class="bem.e('socials')">
        <button
          type="button"
          :class="bem.e('soc')"
          @click="emit('toast', '演示环境：企业微信登录暂未接入')"
        >
          <span :class="bem.e('soc-ic')">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M21 11.6a8.6 8.6 0 0 1-12.5 7.7L4 20.6l1.3-4A8.6 8.6 0 1 1 21 11.6Z" />
              <circle cx="9" cy="11.6" r="1" fill="currentColor" stroke="none" />
              <circle cx="12.6" cy="11.6" r="1" fill="currentColor" stroke="none" />
              <circle cx="16.2" cy="11.6" r="1" fill="currentColor" stroke="none" />
            </svg>
          </span>
          <em :class="bem.e('soc-label')">企业微信</em>
        </button>
        <button
          type="button"
          :class="bem.e('soc')"
          @click="emit('toast', '演示环境：钉钉登录暂未接入')"
        >
          <span :class="bem.e('soc-ic')">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M13 2 4.8 13.4h6L9.6 22l8.6-11.4h-6L13 2Z" />
            </svg>
          </span>
          <em :class="bem.e('soc-label')">钉钉</em>
        </button>
        <button
          type="button"
          :class="bem.e('soc')"
          @click="emit('toast', '演示环境：飞书登录暂未接入')"
        >
          <span :class="bem.e('soc-ic')">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M21.5 2.5 11 13" />
              <path d="M21.5 2.5l-6.8 19-3.7-8.5-8.5-3.7 19-6.8Z" />
            </svg>
          </span>
          <em :class="bem.e('soc-label')">飞书</em>
        </button>
        <button
          type="button"
          :class="bem.e('soc')"
          @click="emit('toast', '演示环境：OA 账号登录暂未接入')"
        >
          <span :class="bem.e('soc-ic')">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="5" y="3" width="14" height="18" rx="1.8" />
              <path d="M9 7.2h2M13 7.2h2M9 11h2M13 11h2" />
              <path d="M10.5 21v-3.5h3V21" />
            </svg>
          </span>
          <em :class="bem.e('soc-label')">OA 帐号</em>
        </button>
      </div>
    </div>
  </main>
</template>
