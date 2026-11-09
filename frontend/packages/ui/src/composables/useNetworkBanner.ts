/**
 * 全局「网络连接异常」横幅 —— 控制器 + 命令式挂载（对齐弹窗族模式）。
 *
 * 角色（2026-10-27 拦截器事件化改造的最终消费方）：订阅 @vv/shared 的 error-events，
 * 按错误类别分流反馈——
 * - 网络级错误（无响应/502/503/504）→ 横幅聚合通道：单例横幅常驻 + 计数递增，
 *   天然免疫 Toast 轰炸（后端宕机时用户连续操作只显示一条横幅，而非逐请求弹 toast）；
 *   持续故障期间任意请求成功（http.ts 的恢复信号）→ 自动隐藏并归零
 * - 业务级错误（4xx/500/业务码）→ ElMessage.error 兜底（与事件化改造前
 *   拦截器 toast 的用户可见行为逐字一致）
 * - 探测类请求（config.silent）在拦截器层已过滤，本层无感知（见 http.ts 过滤链）
 *
 * 手动 dismiss 冷却（MANUAL_DISMISS_COOLDOWN_MS）：用户刚关掉横幅的 30s 内新网络错误
 * 只计数、不重新弹出——故障持续时最干扰的是「关掉又弹」；冷却期外的新错误重新显示
 * （真实新故障应被感知）。恢复信号会清零冷却（网络已通，旧 dismiss 不再适用）。
 *
 * 生命周期：事件订阅在**模块顶层**挂接（import 即生效，与 UI 初始化时序解耦——
 * 首个请求若早于组件挂载失败也不漏事件）；initNetworkBanner() 只做组件命令式挂载
 * （幂等；必须在 main.ts 所有 app.use(...) 之后，appContext 依赖见函数注释）。
 *
 * @see [`@vv/shared/api/error-events`](../../shared/src/api/error-events.ts) 事件源
 * @see [`../components/common/NetworkBanner.vue`](../components/common/NetworkBanner.vue) 展示组件
 * @group 网络错误反馈
 */

import { createVNode, render, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import {
  onHttpError,
  onHttpRecovered,
  isNetworkLevelError,
  type HttpErrorEvent,
} from '@vv/shared/api/error-events'
// 复用弹窗族的 appContext 注册点（useDialog 头注约定：动态挂载场景不各建一套 setXxxAppContext）
import { getDialogAppContext } from './useDialog.ts'
import NetworkBanner from '../components/common/NetworkBanner.vue'

/** 手动关闭后的冷却期（ms）：冷却期内新网络错误不重新弹出横幅 */
export const MANUAL_DISMISS_COOLDOWN_MS = 30_000

/** 瞬时网络错误（模块热重载/vite 重启/刷新取消在途请求）的横幅自动消失时长（ms）——
 *  持续故障靠恢复信号/后续错误维持横幅；无后续信号则按时长兜底消失。取 2s（短于典型页面
 *  loading 时长）：刷新时即使漏网的瞬时网络错误弹了横幅，也在页面加载完之前消失，
 *  不让用户在加载态看到「网络异常」困惑（2026-11-09 实测刷新 loading 时横幅残留根因 = TTL 偏长） */
const TRANSIENT_BANNER_TTL_MS = 2_000

/** 横幅单例状态（模块级响应式——全局横幅本就单例，组件直接渲染本状态） */
export const networkBannerState = reactive({
  visible: false,
  /** 持续故障期内的累计错误次数（横幅 ×N 徽标展示；恢复后归零） */
  count: 0,
})

/** 手动关闭时间戳（0 = 未手动关闭或已被恢复信号清零） */
let dismissedAt = 0

/** 瞬时横幅自动消失计时器（故障持续期间靠新错误/恢复信号维持，无信号则 TTL 兜底消失） */
let transientTimer: ReturnType<typeof setTimeout> | undefined

/** 页面是否已加载完成（load 事件后置 true）——加载完成前的网络错误挂起横幅，不打扰用户 */
let pageLoaded = typeof document === 'undefined' ? true : document.readyState === 'complete'

/** 加载完成前收到网络错误 → 挂起待加载完再显示（若故障持续） */
let pendingShow = false

// load 完成后：若期间挂起了网络错误（故障持续），补显示横幅
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    pageLoaded = true
    if (pendingShow) {
      pendingShow = false
      showBanner()
    }
  })
}

/** 用户点关闭：立即隐藏 + 进入冷却期 */
export function dismissNetworkBanner(): void {
  networkBannerState.visible = false
  dismissedAt = Date.now()
  clearTransientTimer()
}

function clearTransientTimer(): void {
  if (transientTimer !== undefined) {
    clearTimeout(transientTimer)
    transientTimer = undefined
  }
}

/** 网络级错误 → 横幅通道；业务级错误 → toast 兜底（拦截器事件化前的默认行为） */
function handleHttpError(event: HttpErrorEvent): void {
  const { error } = event
  if (!isNetworkLevelError(error.status)) {
    ElMessage.error(error.message)
    return
  }
  networkBannerState.count += 1
  // 冷却期内：计数照计（恢复时状态干净），但不重新弹出
  if (dismissedAt !== 0 && Date.now() - dismissedAt < MANUAL_DISMISS_COOLDOWN_MS) {
    return
  }
  // 页面加载完成前不显示横幅：页面刷新/跳转时进行中的请求被取消或超时是常态（非真实故障），
  // 此时弹「网络连接异常」是纯干扰；挂起至 load 完成，若故障持续（加载完仍有新错误）才显示。
  // 用 load 事件而非 readyState 时序判断——确定性的「加载完成」语义，不靠猜测时长。
  if (typeof document !== 'undefined' && !pageLoaded) {
    pendingShow = true
    return
  }
  showBanner()
}

/** 真正显示横幅（加载完成后，或恢复后又出错的持续故障） */
function showBanner(): void {
  dismissedAt = 0
  networkBannerState.visible = true
  // 瞬时错误（模块热重载/vite 重启）无后续成功时，TTL 兜底消失——
  // 持续故障期间新错误会重置计时器维持横幅，恢复信号立即清除
  clearTransientTimer()
  transientTimer = setTimeout(() => {
    networkBannerState.visible = false
    transientTimer = undefined
  }, TRANSIENT_BANNER_TTL_MS)
}

/** 恢复信号：任意请求成功 = 网络已通 → 隐藏归零 + 清冷却 */
function handleRecovered(): void {
  networkBannerState.visible = false
  networkBannerState.count = 0
  dismissedAt = 0
  clearTransientTimer()
}

let mounted = false

/**
 * 初始化全局网络错误反馈：挂事件订阅 + 命令式挂载 NetworkBanner 到 document.body。
 * 幂等，重复调用安全；必须在 main.ts 所有 app.use(...) 完成后调用——组件树脱离
 * 宿主渲染，经 getDialogAppContext() 注册的 appContext 获得 i18n / EP 组件解析能力
 * （与弹窗族同一注册点，不另建 setXxxAppContext）。
 *
 * 各 app 不直接调本函数——经 setupUiAppContext（同目录）与 setDialogAppContext 组合，
 * 保证 ui 侧全局运行时装配单点演进（新增能力只改 ui，6 app 零感知）。
 *
 * @see [`./setup-ui-app-context.ts`](./setup-ui-app-context.ts) 各 app main.ts 的实际调用点
 */
export function initNetworkBanner(): void {
  if (mounted || typeof document === 'undefined') return
  mounted = true
  const container = document.createElement('div')
  document.body.appendChild(container)
  const vnode = createVNode(NetworkBanner)
  const appContext = getDialogAppContext()
  if (appContext) vnode.appContext = appContext
  render(vnode, container)
}

/** 测试专用：复位模块级状态（不动订阅/挂载标记——订阅随模块生命周期常驻） */
export function resetNetworkBanner(): void {
  networkBannerState.visible = false
  networkBannerState.count = 0
  dismissedAt = 0
  pendingShow = false
  clearTransientTimer()
}

// 事件订阅挂模块顶层：import 即生效，与 UI 挂载时序解耦（首个请求的失败不依赖
// 组件已挂载；组件挂载由 initNetworkBanner 在 app 装配收尾段完成）。
// 订阅 error-events 前无须担心重复——本模块在单 app 内仅一个实例（ESM 模块单例）。
onHttpError(handleHttpError)
onHttpRecovered(handleRecovered)
