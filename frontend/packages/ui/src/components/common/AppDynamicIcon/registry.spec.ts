import { describe, it, expect, vi } from 'vitest'

/**
 * vitest 无法解析 unplugin-icons 的 virtual:icons 虚拟模块（Icons 插件不在测试管线），
 * 按 AppDynamicIcon.spec.ts 同款做法：把 registry 引用的 5 个虚拟模块全部 mock 成 stub。
 * mock 路径必须与 registry.ts 内的 import specifier 完全一致才能命中。
 */
vi.mock('virtual:icons/ep/plus', () => ({ default: { name: 'StubEpPlus' } }))
vi.mock('virtual:icons/tabler/home', () => ({ default: { name: 'StubTablerHome' } }))
vi.mock('virtual:icons/tabler/settings', () => ({ default: { name: 'StubTablerSettings' } }))
vi.mock('virtual:icons/app/logo', () => ({ default: { name: 'StubAppLogo' } }))
vi.mock('virtual:icons/app/close', () => ({ default: { name: 'StubAppClose' } }))

// 动态 import：确保 vi.mock 提升注册先于 registry 模块求值
const { isAppIconName, resolveAppIcon } = await import('./registry')

describe('registry', () => {
  describe('isAppIconName', () => {
    it('对注册表内名字返回 true', () => {
      expect(isAppIconName('ep:plus')).toBe(true)
      expect(isAppIconName('app:logo')).toBe(true)
    })

    it('对注册表外名字返回 false（错误图标名 / 未登记集合）', () => {
      expect(isAppIconName('ep:notexist')).toBe(false)
      expect(isAppIconName('mdi:home')).toBe(false)
      expect(isAppIconName('')).toBe(false)
    })
  })

  describe('resolveAppIcon', () => {
    it('按名字返回注册表中的组件引用', () => {
      expect(resolveAppIcon('ep:plus')).toEqual({ name: 'StubEpPlus' })
      expect(resolveAppIcon('tabler:home')).toEqual({ name: 'StubTablerHome' })
    })
  })
})
