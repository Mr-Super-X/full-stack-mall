import { ref, watch } from 'vue'
// 具名子路径而非根 barrel（2026-10-26 codemod 批次 2 踩坑修正）：本模块是 spec 密集
// 重载对象（vi.resetModules + 动态 import 每用例重评估 import 图），走 '@vv/shared'
// 根 barrel 会让 5000ms 用例在 vite-node 大模块图重载下不稳定超时；'@vv/shared/utils'
// 只加载 utils 子树（与 './store' './router-guards' 具名出口同构）
import { Local } from '@vv/shared/utils'

/**
 * DocLayout sidebar 的模块级状态：
 * DocLayout 随路由切换销毁重建，组件内状态会归零——宽度与折叠状态
 * 提升到模块级，跨 demo 页面切换保留。
 *
 * 持久化（2026-09-10 升级）：
 * - sidebarWidth 升级为 localStorage 持久化，跨浏览器会话保留用户拖拽调宽结果
 * - 拖拽过程 mousemove 高频触发 width 变更 → 用 300ms debounce 合并写入
 * - 初始读取走 Local.get：合法 number 直接采用；非 number / null / 字符串等
 *   非法值兜底 200（与 use-sidebar-drag 默认 150~400 钳制范围一致）
 * - 存储 key 'demo-sidebar-width'（经 storage.ts 自动加 `<APP_NAMESPACE>:` 前缀）
 */
const STORAGE_KEY = 'demo-sidebar-width'
const DEFAULT_WIDTH = 200
const WRITE_DEBOUNCE_MS = 300

/** 从 Local 读取初始宽度；非法值兜底 default。钳制在 [min, max] 留给 useSidebarDrag，本处只兜底类型 */
function loadInitialWidth(): number {
  const raw = Local.get<number>(STORAGE_KEY)
  return typeof raw === 'number' && Number.isFinite(raw) ? Math.round(raw) : DEFAULT_WIDTH
}

export const sidebarWidth = ref(loadInitialWidth())

export const collapsedGroups = ref<Set<string>>(new Set())

/**
 * 自动持久化：模块加载即注册 watch，sidebarWidth 变化时 debounce 写回 Local。
 * useSidebarDrag 拖拽过程中 mousemove 频繁改值 → debounce 保证停止拖拽后才落盘。
 */
let writeTimer: ReturnType<typeof setTimeout> | null = null
watch(sidebarWidth, (next) => {
  if (writeTimer !== null) clearTimeout(writeTimer)
  writeTimer = setTimeout(() => {
    Local.set(STORAGE_KEY, next)
    writeTimer = null
  }, WRITE_DEBOUNCE_MS)
})
