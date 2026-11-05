/**
 * jsdom Location 整页跳转断言的共享测试夹具。
 *
 * 背景（2026-10-30 测试基建）：统一登录协议 / 登出流程的 spec 需断言 `window.location.href`
 * 整页跳转——jsdom 的 Location 无法被 vitest spy 拦截赋值，必须 `vi.stubGlobal` 整体替换。
 * 该样板曾在 4 个 spec 逐字重复（Login / auth redirect / router-guards login / useLogout），
 * 收敛为本模块的标准入口；后续新 spec 有整页跳转断言时一律经此夹具，不再各自手写。
 *
 * 用法（spec 三件套）：
 * ```ts
 * const fakeLocation = createFakeLocation('http://localhost/login')
 * beforeEach(() => {
 *   fakeLocation.href = 'http://localhost/login' // 每用例重置初始值
 *   fakeLocation.search = ''
 *   installFakeLocation(fakeLocation)
 * })
 * afterEach(() => { vi.unstubAllGlobals() })
 * ```
 * 特例（断言跳转抛错路径）：`vi.stubGlobal('location', { set href(v) { throw ... } })` 仍
 * 就地书写，不属于本夹具的常规形态。
 *
 * @group 测试基建
 */
import { vi } from 'vitest'

/** fake location 对象形态（索引签名容纳各 spec 的扩展字段，如 throw setter 之外的额外属性） */
export interface FakeLocation {
  href: string
  search: string
  [key: string]: unknown
}

/** 创建 fake location 对象（href 模拟初始导航完成态，search 预置空串） */
export function createFakeLocation(href = 'http://localhost/'): FakeLocation {
  return { href, search: '' }
}

/** 安装：stubGlobal 整体替换 window.location（在 spec 的 beforeEach 中调用，配合 afterEach 的 unstabAllGlobals） */
export function installFakeLocation(fake: FakeLocation): void {
  // 补齐 Location 标准属性 origin（2026-10-28 /autoplan E2）：redirect.ts 同源校验消费
  // window.location.origin，而 fake 对象本身只有 href/search——不补则 origin undefined，
  // new URL(path, undefined) 抛错让合法 redirect 误判落 fallback。
  // 注意必须直接挂在 fake 上（保持引用）：spec 用例在 install 后仍对 fakeLocation.search 赋值驱动断言，
  // 若浅拷贝 stub 会破坏该模式（stub 的是拷贝，赋值改不到 stub 对象上）。
  fake.origin = new URL(fake.href).origin
  vi.stubGlobal('location', fake)
}
