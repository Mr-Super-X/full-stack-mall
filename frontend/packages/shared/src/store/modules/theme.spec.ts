// theme store 单测
//
// 覆盖：
//   - readInitialMode 的历史格式兼容（本 bug 核心：persist 插件 JSON 序列化的
//     {"mode":"dark"} 曾被裸字符串比对漏掉，每次刷新兜底回 'auto' 导致暗色丢失）
//   - legacy key（裸 'theme-mode'）迁移：命中后清除
//   - setMode / toggleMode 对 <html data-theme> 的应用

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useThemeStore } from './theme'

// 与被测 store 同源的 key 推导（VITE_APP_ID 由工厂 define 注入；单测无注入回落 'app'）
const STORAGE_KEY = `${import.meta.env.VITE_APP_ID ?? 'app'}:theme-mode`
const LEGACY_KEY = 'theme-mode'

describe('useThemeStore', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.classList.remove('dark')
    // jsdom 无 matchMedia，applyTheme 与系统主题监听都依赖它
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
    })
    setActivePinia(createPinia())
  })

  it('读取 persist 插件 JSON 序列化的 {"mode":"dark"}（本 bug 回归）', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: 'dark' }))
    const store = useThemeStore()
    expect(store.mode).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(store.isDark).toBe(true)
  })

  it('兼容早期版本直存的裸字符串 dark', () => {
    localStorage.setItem(STORAGE_KEY, 'dark')
    const store = useThemeStore()
    expect(store.mode).toBe('dark')
  })

  it('兼容 JSON 字符串 "light"', () => {
    localStorage.setItem(STORAGE_KEY, '"light"')
    const store = useThemeStore()
    expect(store.mode).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('非法值兜底为 auto 并移除 data-theme（亮色系系统下）', () => {
    localStorage.setItem(STORAGE_KEY, '{"mode":"blue"}')
    const store = useThemeStore()
    expect(store.mode).toBe('auto')
    expect(document.documentElement.getAttribute('data-theme')).toBeNull()
    expect(store.isDark).toBe(false)
  })

  it('legacy key 命中后迁移读取并清除旧 key', () => {
    localStorage.setItem(LEGACY_KEY, 'dark')
    const store = useThemeStore()
    expect(store.mode).toBe('dark')
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull()
  })

  it('legacy key 优先于新 key', () => {
    localStorage.setItem(LEGACY_KEY, 'light')
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: 'dark' }))
    const store = useThemeStore()
    expect(store.mode).toBe('light')
  })

  it('setMode/toggleMode 应用 data-theme 并更新 isDark', () => {
    const store = useThemeStore()
    store.setMode('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    store.toggleMode()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(store.isDark).toBe(false)
  })

  it('auto 模式按系统偏好维护 dark class（EP dark/css-vars 轨道）', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn() })
    const store = useThemeStore()
    store.setMode('auto')
    expect(document.documentElement.getAttribute('data-theme')).toBeNull()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    store.setMode('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
