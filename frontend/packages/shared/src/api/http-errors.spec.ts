import { describe, it, expect } from 'vitest'
import { resolveHttpStatusMessage } from './http-errors'

describe('resolveHttpStatusMessage', () => {
  describe('4xx 客户端错误', () => {
    it('400 → "请求参数错误"', () => {
      expect(resolveHttpStatusMessage(400)).toBe('请求参数错误')
    })

    it('401 → "请先登录"', () => {
      expect(resolveHttpStatusMessage(401)).toBe('请先登录')
    })

    it('403 → "无权限访问"', () => {
      expect(resolveHttpStatusMessage(403)).toBe('无权限访问')
    })

    it('404 → "资源不存在"', () => {
      expect(resolveHttpStatusMessage(404)).toBe('资源不存在')
    })

    it('未列出的 4xx（如 418）走客户端 fallback', () => {
      expect(resolveHttpStatusMessage(418)).toBe('请求失败，请检查后重试')
    })
  })

  describe('5xx 服务器错误', () => {
    it('500 → "服务器错误"', () => {
      expect(resolveHttpStatusMessage(500)).toBe('服务器错误')
    })

    it('502 → "网关错误"', () => {
      expect(resolveHttpStatusMessage(502)).toBe('网关错误')
    })

    it('503 → "服务暂不可用"', () => {
      expect(resolveHttpStatusMessage(503)).toBe('服务暂不可用')
    })

    it('504 → "网关超时"', () => {
      expect(resolveHttpStatusMessage(504)).toBe('网关超时')
    })

    it('未列出的 5xx（如 507）走服务器 fallback', () => {
      expect(resolveHttpStatusMessage(507)).toBe('服务异常，请稍后重试')
    })
  })

  describe('网络异常（status undefined）', () => {
    it('undefined → "网络异常，请稍后重试"', () => {
      expect(resolveHttpStatusMessage(undefined)).toBe('网络异常，请稍后重试')
    })

    it('3xx 重定向未列出走网络 fallback', () => {
      // 3xx 不在 4xx/5xx 范围，按网络兜底
      expect(resolveHttpStatusMessage(301)).toBe('网络异常，请稍后重试')
    })

    it('2xx 不应进入此函数（成功路径不走错误拦截器），但保守起见也走网络 fallback', () => {
      expect(resolveHttpStatusMessage(200)).toBe('网络异常，请稍后重试')
    })
  })
})
