/**
 * composables/barrel 集成测试
 *
 * 目的：确保 barrel.ts 集中 re-export 的 14 个公共 API 全部可用，防止未来被误删
 * （典型场景：清理 build-slots.ts 内部函数时顺手删 barrel re-export，调用方静默断链）。
 *
 * 策略：枚举每个 export 名称，断言它是函数（绝大多数）或非 undefined 的值。
 * 不验证具体行为 —— 那是各子模块 spec 的职责，本测试只做"barrel 单源契约"。
 */
import { describe, expect, it } from 'vitest'
import * as barrel from './barrel'

describe('composables/barrel —— 14 个公共 API 全部可用', () => {
  describe('resolve-component 系列', () => {
    it('EL_COMPONENT_MAP 可访问且是对象', () => {
      expect(barrel.EL_COMPONENT_MAP).toBeDefined()
      expect(typeof barrel.EL_COMPONENT_MAP).toBe('object')
    })
    it('resolveComponentFor 是函数', () => {
      expect(typeof barrel.resolveComponentFor).toBe('function')
    })
    it('isElUpload / isPictureCardUpload / isDragUpload 是函数', () => {
      expect(typeof barrel.isElUpload).toBe('function')
      expect(typeof barrel.isPictureCardUpload).toBe('function')
      expect(typeof barrel.isDragUpload).toBe('function')
    })
  })

  describe('compile-rules', () => {
    it('compileRules 是函数', () => {
      expect(typeof barrel.compileRules).toBe('function')
    })
  })

  describe('wrap-with-elcol 系列', () => {
    it('wrapWithElCol / pickBreakpointConfig / mergeColResponsive / mergeRowResponsive 是函数', () => {
      expect(typeof barrel.wrapWithElCol).toBe('function')
      expect(typeof barrel.pickBreakpointConfig).toBe('function')
      expect(typeof barrel.mergeColResponsive).toBe('function')
      expect(typeof barrel.mergeRowResponsive).toBe('function')
    })
  })

  describe('build-slots 系列', () => {
    it('renderChildren 是函数', () => {
      expect(typeof barrel.renderChildren).toBe('function')
    })
    it('buildSlotFn / buildUploadDefaultSlot / buildUploadTipSlot 是函数', () => {
      expect(typeof barrel.buildSlotFn).toBe('function')
      expect(typeof barrel.buildUploadDefaultSlot).toBe('function')
      expect(typeof barrel.buildUploadTipSlot).toBe('function')
    })
    it('getComponentDefaultProps / buildAsyncProps 是函数', () => {
      expect(typeof barrel.getComponentDefaultProps).toBe('function')
      expect(typeof barrel.buildAsyncProps).toBe('function')
    })
  })

  describe('总量守卫', () => {
    it('barrel 模块默认导出数量 = 16（防止漏增 / 误删）', () => {
      // 动态枚举：列出全部 key 供调试
      const keys = Object.keys(barrel).sort()
      // 调试用：console.log(keys) // 取消注释可查看完整 key 列表
      expect(keys.length).toBe(16)
    })
  })
})
