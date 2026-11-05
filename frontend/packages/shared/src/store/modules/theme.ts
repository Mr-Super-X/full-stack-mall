/**
 * 主题 store（持久化）。
 *
 * 持久化：mode 字段通过 pinia-plugin-persistedstate 自动写入 localStorage
 * 跟随系统：mode === 'auto' 时监听 prefers-color-scheme 媒体查询
 *
 * 切换 API：
 *   useThemeStore().setMode('dark')   // 强制深色
 *   useThemeStore().setMode('light')  // 强制浅色
 *   useThemeStore().setMode('auto')   // 跟随系统
 *   useThemeStore().toggleMode()      // 智能切换（auto → 显式；light ↔ dark）
 *
 * 推荐在组件中使用 useTheme() composable（本包 composables/useTheme），更简洁。
 *
 * @see `./composables/useTheme`（本包内文件）—— 推荐消费入口
 * @group 状态管理：主题
 */

import { ref } from 'vue'
import { defineStore } from 'pinia'

/** 主题模式：light（强制浅色）/ dark（强制深色）/ auto（跟随系统） */
export type ThemeMode = 'light' | 'dark' | 'auto'

// persist key 前缀 = app 标识（D6/R8：monorepo 多 app 共存时 localStorage 互相隔离）。
// VITE_APP_ID 由 @vv/config 工厂 define 注入（admin='admin'）；单测等无注入场景回落 'app'
const appId = import.meta.env.VITE_APP_ID ?? 'app'
const STORAGE_KEY = `${appId}:theme-mode`
// 2026-09-09 之前 persist key 是裸 'theme-mode'，老用户 localStorage 可能残留该 key，
// 一次性读取兜底并在命中后清除（persist 订阅随后只写新 key）。
// 注：2026-10-22 前的 `vue3-vite-project:theme-mode`（VITE_STORAGE_NAMESPACE 时代）
// 不做迁移——miss 仅回退默认 'auto'，可接受
const LEGACY_STORAGE_KEY = 'theme-mode'

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'auto'
}

/**
 * 解析 localStorage 里持久化的 mode，非法值返回 null。
 * 必须兼容两种历史格式：
 * - pinia-plugin-persistedstate 的 JSON 序列化对象 `{"mode":"dark"}`（当前 persist 写入格式）
 * - 早期版本直存的裸字符串 `dark`（含 JSON 字符串 `"dark"`）
 * 只比对裸字符串是本项目历史 bug：persist 写入的 JSON 永不命中，每次刷新都兜底
 * 回 'auto'（亮色系统下表现为"切暗色刷新又回到亮色"，2026-09-10 实证修复）
 */
function parseStoredMode(raw: string | null): ThemeMode | null {
  if (raw === null) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed === 'string') return isThemeMode(parsed) ? parsed : null
    if (parsed !== null && typeof parsed === 'object' && 'mode' in parsed) {
      const { mode } = parsed as { mode: unknown }
      return isThemeMode(mode) ? mode : null
    }
    return null
  } catch {
    return isThemeMode(raw) ? raw : null
  }
}

/**
 * 从 localStorage 读取初始 mode，非法值兜底为 'auto'。
 */
function readInitialMode(): ThemeMode {
  const legacy = parseStoredMode(localStorage.getItem(LEGACY_STORAGE_KEY))
  if (legacy !== null) {
    localStorage.removeItem(LEGACY_STORAGE_KEY)
    return legacy
  }
  return parseStoredMode(localStorage.getItem(STORAGE_KEY)) ?? 'auto'
}

export const useThemeStore = defineStore(
  'theme',
  () => {
    const mode = ref<ThemeMode>(readInitialMode())
    const isDark = ref(false)

    /**
     * 把 mode 应用到 <html> 上：auto 移除属性（让 CSS @media 接管），
     * 其他值设置 data-theme 属性（CSS 选择器精确命中）。
     * 同步维护 dark class——element-plus dark/css-vars 经 html.dark 识别（EP 组件
     * 暗色轨道）；data-theme 驱动 themes/ 业务变量轨道。双轨同一 isDark 真值。
     */
    function applyTheme(value: ThemeMode) {
      if (typeof document === 'undefined') return // SSR 安全

      const root = document.documentElement
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches

      if (value === 'auto') {
        root.removeAttribute('data-theme')
        root.classList.toggle('dark', prefersDark)
        isDark.value = prefersDark
      } else {
        root.setAttribute('data-theme', value)
        root.classList.toggle('dark', value === 'dark')
        isDark.value = value === 'dark'
      }
    }

    /**
     * 设置主题模式并应用。
     */
    function setMode(value: ThemeMode) {
      mode.value = value
      applyTheme(value)
    }

    /**
     * 智能切换：
     *   - 当前深色（含 auto + 系统深色） → 切换到 light
     *   - 当前浅色 → 切换到 dark
     */
    function toggleMode() {
      const next: ThemeMode = isDark.value ? 'light' : 'dark'
      setMode(next)
    }

    // 初始化应用主题（复读代码型注释清理：applyTheme 自解释——2026-10-28 注释审计 L 级）
    applyTheme(mode.value)

    // 监听系统主题变化（仅 mode === 'auto' 时响应）
    if (typeof window !== 'undefined') {
      const mql = window.matchMedia('(prefers-color-scheme: dark)')
      mql.addEventListener('change', (e) => {
        if (mode.value === 'auto') {
          // data-theme 缺位时业务变量轨道由 CSS @media 自动跟随；dark class 需手动同步
          document.documentElement.classList.toggle('dark', e.matches)
          isDark.value = e.matches
        }
      })
    }

    return { mode, isDark, setMode, toggleMode }
  },
  {
    persist: {
      key: STORAGE_KEY,
      storage: localStorage,
      pick: ['mode'],
    },
  }
)
