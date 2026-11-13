import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { injectBrandColor, initDocumentTitle } from './app-bootstrap.ts'

const PRIMARY_VAR = '--color-primary'
const EL_PRIMARY_VAR = '--el-color-primary'

beforeEach(() => {
  vi.unstubAllEnvs()
  document.documentElement.style.removeProperty(PRIMARY_VAR)
  document.documentElement.style.removeProperty(EL_PRIMARY_VAR)
  document.title = ''
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('injectBrandColor', () => {
  it('VITE_BRAND_COLOR 命中 → 注入该值为 --color-primary', () => {
    vi.stubEnv('VITE_BRAND_COLOR', '#ff0000')

    injectBrandColor()

    expect(document.documentElement.style.getPropertyValue(PRIMARY_VAR)).toBe('#ff0000')
  })

  it('不同步注入 --el-color-primary（回归锁：内联双写会压死布局级弹层变量映射）', () => {
    vi.stubEnv('VITE_BRAND_COLOR', '#ff0000')

    injectBrandColor()

    // --el-color-primary 经 theme-vars.scss 的 :root var(--color-primary) 引用链跟随，
    // 内联二次注入曾把 admin [data-layout='default'] 的 teleport 弹层主色
    // 压死在品牌色（2026-11-12 修复），此处锁死"不双写"行为
    expect(document.documentElement.style.getPropertyValue(EL_PRIMARY_VAR)).toBe('')
  })

  it('VITE_BRAND_COLOR 缺省 → 回落调用方 defaultColor', () => {
    injectBrandColor('#00ff00')

    expect(document.documentElement.style.getPropertyValue(PRIMARY_VAR)).toBe('#00ff00')
  })

  it('env 与 defaultColor 均缺省 → 兜底 EP 默认蓝 #409eff', () => {
    injectBrandColor()

    expect(document.documentElement.style.getPropertyValue(PRIMARY_VAR)).toBe('#409eff')
  })

  it('defaultColor 传空串（falsy）→ 仍兜底 #409eff', () => {
    injectBrandColor('')

    expect(document.documentElement.style.getPropertyValue(PRIMARY_VAR)).toBe('#409eff')
  })

  it('SSR（typeof document === undefined）→ 静默跳过不抛错', () => {
    vi.stubEnv('VITE_BRAND_COLOR', '#ff0000')
    vi.stubGlobal('document', undefined)

    expect(() => injectBrandColor()).not.toThrow()
  })
})

describe('initDocumentTitle', () => {
  it('VITE_APP_TITLE 命中 → 采用 env 值', () => {
    vi.stubEnv('VITE_APP_TITLE', 'EnvTitle')

    initDocumentTitle('FallbackTitle')

    expect(document.title).toBe('EnvTitle')
  })

  it('VITE_APP_TITLE 缺省 → 采用调用方默认标题', () => {
    initDocumentTitle('FallbackTitle')

    expect(document.title).toBe('FallbackTitle')
  })

  it('VITE_APP_TITLE 为空串（falsy）→ 采用调用方默认标题', () => {
    vi.stubEnv('VITE_APP_TITLE', '')

    initDocumentTitle('FallbackTitle')

    expect(document.title).toBe('FallbackTitle')
  })
})
