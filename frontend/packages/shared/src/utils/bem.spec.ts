import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { createNamespace } from './bem'

describe('createNamespace', () => {
  const bem = createNamespace('button')

  describe('b()', () => {
    it('返回基础 block 类名', () => {
      expect(bem.b()).toBe('vv-button')
    })

    it('带 blockSuffix 返回 vv-button-group', () => {
      expect(bem.b('group')).toBe('vv-button-group')
    })

    it('空字符串后缀等价于无后缀', () => {
      expect(bem.b('')).toBe('vv-button')
    })
  })

  describe('e()', () => {
    it('返回 element 类名', () => {
      expect(bem.e('icon')).toBe('vv-button__icon')
    })

    it('空字符串返回空字符串（避免 vv-button__）', () => {
      expect(bem.e('')).toBe('')
    })
  })

  describe('m()', () => {
    it('返回 modifier 类名', () => {
      expect(bem.m('large')).toBe('vv-button--large')
    })

    it('空字符串返回空字符串（避免 vv-button--）', () => {
      expect(bem.m('')).toBe('')
    })
  })

  describe('be()', () => {
    it('返回 block + element 类名', () => {
      expect(bem.be('group', 'icon')).toBe('vv-button-group__icon')
    })

    it('任一参数缺失返回空字符串', () => {
      expect(bem.be('', 'icon')).toBe('')
      expect(bem.be('group', '')).toBe('')
      expect(bem.be('', '')).toBe('')
    })
  })

  describe('bm()', () => {
    it('返回 block + modifier 类名', () => {
      expect(bem.bm('group', 'large')).toBe('vv-button-group--large')
    })

    it('任一参数缺失返回空字符串', () => {
      expect(bem.bm('', 'large')).toBe('')
      expect(bem.bm('group', '')).toBe('')
    })
  })

  describe('em()', () => {
    it('返回 element + modifier 类名', () => {
      expect(bem.em('icon', 'large')).toBe('vv-button__icon--large')
    })

    it('任一参数缺失返回空字符串', () => {
      expect(bem.em('', 'large')).toBe('')
      expect(bem.em('icon', '')).toBe('')
    })
  })

  describe('bem()', () => {
    it('返回 block + element + modifier 类名', () => {
      expect(bem.bem('group', 'icon', 'large')).toBe('vv-button-group__icon--large')
    })

    it('任一参数缺失返回空字符串', () => {
      expect(bem.bem('', 'icon', 'large')).toBe('')
      expect(bem.bem('group', '', 'large')).toBe('')
      expect(bem.bem('group', 'icon', '')).toBe('')
    })
  })

  describe('is()', () => {
    it('state 为 true 返回 is-{name}', () => {
      expect(bem.is('loading', true)).toBe('is-loading')
      expect(bem.is('checked', true)).toBe('is-checked')
      expect(bem.is('enabled', true)).toBe('is-enabled')
    })

    it('state 为 false 返回空字符串', () => {
      expect(bem.is('loading', false)).toBe('')
    })

    it('state 为 null / undefined 返回空字符串', () => {
      expect(bem.is('loading', null)).toBe('')
      expect(bem.is('loading', undefined)).toBe('')
    })
  })

  describe('createNamespace 前缀', () => {
    it('始终以 vv- 开头', () => {
      expect(createNamespace('foo').b()).toBe('vv-foo')
    })

    it('支持自定义 name（含连字符的复合名）', () => {
      expect(createNamespace('user-card').b()).toBe('vv-user-card')
      expect(createNamespace('login-form').e('submit')).toBe('vv-login-form__submit')
    })
  })

  // 注意：BEM_PREFIX 在模块加载时一次性读取 import.meta.env.VITE_BEM_PREFIX 并冻结。
  // 切换前缀必须先 vi.resetModules() 清缓存，再 vi.stubEnv() 注入新值，然后 await import() 重新加载。
  describe('VITE_BEM_PREFIX 环境变量', () => {
    beforeEach(() => {
      vi.resetModules()
      vi.unstubAllEnvs()
    })

    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('未设置 VITE_BEM_PREFIX 时回退默认 vv-', async () => {
      const mod = await import('./bem')
      expect(mod.createNamespace('foo').b()).toBe('vv-foo')
      expect(mod.createNamespace('foo').e('bar')).toBe('vv-foo__bar')
    })

    it('自定义前缀会替换 vv-', async () => {
      vi.stubEnv('VITE_BEM_PREFIX', 'app')
      const mod = await import('./bem')
      expect(mod.createNamespace('button').b()).toBe('app-button')
      expect(mod.createNamespace('button').m('large')).toBe('app-button--large')
      expect(mod.createNamespace('button').bem('group', 'icon', 'large')).toBe(
        'app-button-group__icon--large'
      )
    })

    it('空字符串前缀 → 输出无前缀类名（避免 -.button 这类多余连字符）', async () => {
      vi.stubEnv('VITE_BEM_PREFIX', '')
      const mod = await import('./bem')
      expect(mod.createNamespace('button').b()).toBe('button')
      expect(mod.createNamespace('button').e('icon')).toBe('button__icon')
    })

    it('前缀对 is() 状态类名无影响（is- 永远独立）', async () => {
      vi.stubEnv('VITE_BEM_PREFIX', 'app')
      const mod = await import('./bem')
      expect(mod.createNamespace('button').is('loading', true)).toBe('is-loading')
    })
  })
})
