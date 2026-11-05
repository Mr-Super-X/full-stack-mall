/**
 * redirect.ts 单测：跨应用统一登录协议。
 *
 * jsdom 的 Location 实例 href 为 non-configurable（不可 defineProperty 拦截），
 * 但 window.location 本身 configurable——经 `vi.stubGlobal('location', {...})`
 * 整体替换为普通对象做断言（探针验证过，2026-10-22）。
 * 夹具收敛至 `@vv/shared/test-utils/fakeLocation` 单源（2026-10-30 基建）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createFakeLocation, installFakeLocation } from '@vv/shared/test-utils/fakeLocation'
import { redirectToAuthLogin, resolvePostLoginRedirect } from './redirect'

const fakeLocation = createFakeLocation()

beforeEach(() => {
  fakeLocation.href = 'http://localhost/'
  fakeLocation.search = ''
  fakeLocation.hash = ''
  installFakeLocation(fakeLocation)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('redirectToAuthLogin', () => {
  it('未注入 VITE_AUTH_ORIGIN 时回落 /auth，redirect 经 encodeURIComponent 编码', () => {
    expect(() => redirectToAuthLogin('/workbench?tab=1')).toThrow('AUTH_REDIRECTING')
    expect(window.location.href).toBe('/auth/login?redirect=%2Fworkbench%3Ftab%3D1')
  })

  it('redirect 非 / 开头时降级为 /（防畸形跳转目标）', () => {
    expect(() => redirectToAuthLogin('workbench')).toThrow('AUTH_REDIRECTING')
    expect(window.location.href).toBe('/auth/login?redirect=%2F')
  })

  it('赋 href 后抛 AUTH_REDIRECTING 中断守卫链', () => {
    let caught: unknown
    try {
      redirectToAuthLogin('/a')
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(Error)
    expect((caught as Error).message).toBe('AUTH_REDIRECTING')
    // 赋值先于 throw（整页跳转已发起）
    expect(window.location.href).toBe('/auth/login?redirect=%2Fa')
  })

  // gh-pages 演示形态回归网（2026-10-30 退出/未登录跳 404 修复）：build-pages 注入
  // '/<repo>/auth/#'，origin 带 '#' 尾巴时拼接必须产出 hash 路由形态 /#/login——
  // 不带 # 的 history 形态 /<repo>/auth/login 在 Pages 静态托管上不是文件，404
  it('origin 带 # 尾巴（gh-pages 注入形态）拼出 /#/login + redirect 编码', () => {
    vi.stubEnv('VITE_AUTH_ORIGIN', '/vue3-vite-project/auth/#')
    expect(() => redirectToAuthLogin('/admin/')).toThrow('AUTH_REDIRECTING')
    expect(window.location.href).toBe('/vue3-vite-project/auth/#/login?redirect=%2Fadmin%2F')
  })
})

describe('resolvePostLoginRedirect', () => {
  it('redirect 参数合法（/ 开头且非 //）→ 原样返回', () => {
    fakeLocation.search = '?redirect=%2Fworkbench'
    expect(resolvePostLoginRedirect('/admin/')).toBe('/workbench')
  })

  // hash 形态回归网（2026-10-30 同上修复的连带修复）：gh-pages 演示形态登录页 URL 为
  // /<repo>/auth/#/login?redirect=...，redirect 位于 location.hash 的 query 段，
  // location.search 为空——读不到则回跳永远落 fallback
  it('hash 模式：redirect 位于 location.hash query 段 → 原样返回', () => {
    fakeLocation.hash = '#/login?redirect=%2Fworkbench'
    expect(resolvePostLoginRedirect('/admin/')).toBe('/workbench')
  })

  it('hash 模式：hash 无 query 段 → fallback', () => {
    fakeLocation.hash = '#/login'
    expect(resolvePostLoginRedirect('/admin/')).toBe('/admin/')
  })

  it('无 redirect 参数 → fallback', () => {
    expect(resolvePostLoginRedirect('/admin/')).toBe('/admin/')
  })

  it('// 开头的协议相对 URL → fallback（防开放重定向到外域）', () => {
    fakeLocation.search = '?redirect=%2F%2Fevil.com'
    expect(resolvePostLoginRedirect('/admin/')).toBe('/admin/')
  })

  // 反斜杠双形态（2026-10-28 /autoplan E2 修复的回归网）：WHATWG URL 解析器将 \ 归一化为 /，
  // `/\evil.com` 会按协议相对 URL 解析跳出——仅排除 // 前缀的校验可被绕过（实证 CWE-601）
  it('含反斜杠的 redirect → fallback（/\\evil.com 归一化绕过）', () => {
    fakeLocation.search = `?redirect=${encodeURIComponent(String.raw`/\evil.com`)}`
    expect(resolvePostLoginRedirect('/admin/')).toBe('/admin/')
  })

  it('裸反斜杠开头（无 / 前缀）→ fallback', () => {
    fakeLocation.search = `?redirect=${encodeURIComponent(String.raw`\evil.com`)}`
    expect(resolvePostLoginRedirect('/admin/')).toBe('/admin/')
  })

  it('绝对 URL → fallback（只允许同源路径）', () => {
    fakeLocation.search = `?redirect=${encodeURIComponent('https://evil.com/x')}`
    expect(resolvePostLoginRedirect('/admin/')).toBe('/admin/')
  })

  // 以下两形态只有第二层（origin 白名单）能拦——防线 1（// 前缀 + 反斜杠排除）均不命中
  // （2026-10-28 /autoplan R2-E5：若未来有人「简化」掉 origin 白名单，这两个用例变红）
  it('前导空格协议相对（"  //evil.com"）→ fallback（空格被 WHATWG 剥离后跳出，仅 origin 层可拦）', () => {
    fakeLocation.search = `?redirect=${encodeURIComponent('  //evil.com')}`
    expect(resolvePostLoginRedirect('/admin/')).toBe('/admin/')
  })

  it('tab-scheme（"java\\tscript:"）→ fallback（tab 被剥离后成 javascript: 协议，origin=null）', () => {
    fakeLocation.search = `?redirect=${encodeURIComponent('java\tscript:alert(1)')}`
    expect(resolvePostLoginRedirect('/admin/')).toBe('/admin/')
  })

  it('自定义 fallback 生效', () => {
    expect(resolvePostLoginRedirect('/portal/')).toBe('/portal/')
  })
})
