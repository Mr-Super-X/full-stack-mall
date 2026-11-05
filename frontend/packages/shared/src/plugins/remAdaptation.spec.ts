import { describe, expect, it, beforeEach } from 'vitest'
import type { App } from 'vue'
import remAdaptation, { ensureViewportMeta } from './remAdaptation.ts'

describe('plugins/remAdaptation — viewport meta 幂等确保', () => {
  beforeEach(() => {
    document.querySelectorAll('meta[name="viewport"]').forEach((el) => el.remove())
  })

  it('无 viewport meta 时创建，content 与 VIEWPORT_CONTENT 唯一事实源一致', () => {
    ensureViewportMeta()
    const meta = document.querySelector('meta[name="viewport"]')
    expect(meta).not.toBeNull()
    expect(meta?.getAttribute('content')).toBe(
      'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
    )
  })

  it('已有 viewport meta 时幂等（重复调用不重复创建）', () => {
    ensureViewportMeta()
    ensureViewportMeta()
    expect(document.querySelectorAll('meta[name="viewport"]')).toHaveLength(1)
  })

  it('install 调用 ensureViewportMeta（插件形态）', () => {
    remAdaptation.install({} as App)
    expect(document.querySelectorAll('meta[name="viewport"]')).toHaveLength(1)
  })

  it('已存在不同 content 的 viewport meta 时不覆盖（只查存在性）', () => {
    const meta = document.createElement('meta')
    meta.setAttribute('name', 'viewport')
    meta.setAttribute('content', 'width=750')
    document.head.appendChild(meta)
    ensureViewportMeta()
    const all = document.querySelectorAll('meta[name="viewport"]')
    expect(all).toHaveLength(1)
    expect(all[0]?.getAttribute('content')).toBe('width=750')
  })
})
