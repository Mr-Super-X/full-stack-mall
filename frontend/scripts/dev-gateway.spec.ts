/**
 * dev-gateway 纯函数单测（node:test runner）——/autoplan E8。
 *
 * 覆盖：resolveAppSubset（未知 app 名抛错）/ resolveRootRedirect（portal 优先 + 空子集防御）/
 * cleanStaleMockBundled（启动前预清 mock bundled 临时文件，2026-10-29 登录 404 事故根治）/
 * resolvePostLoginFallback（登录 fallback：portal 优先 / 第一个非 auth / 单 auth 不注入）。
 * 守卫已统一为 invokedDirectly 模式（与 check-* 脚本一致），import 本模块不触发 main()。
 *
 * 运行：pnpm test:gateway（与 node-gateway.spec.ts 同批）
 * @see scripts/dev-gateway.ts —— 被测实现
 */
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  cleanStaleMockBundled,
  resolveAppSubset,
  resolvePostLoginFallback,
  resolveRootRedirect,
} from './dev-gateway.ts'

// 当前注册表形状（apps-registry 派生）：name/port 用于构造最小子集夹具
type AppEntry = { name: string; port: number; requiredRoutes: string[] }
const entry = (name: string, port: number): AppEntry => ({
  name,
  port,
  requiredRoutes: ['NotFound'],
})

/** 每个用例独立的临时 mock 目录夹具，用例结束自动整树删除 */
function makeMockDir(t: import('node:test').TestContext): string {
  const dir = mkdtempSync(join(tmpdir(), 'vv-mock-clean-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  return dir
}

test('resolveAppSubset：未知 app 名抛错并列出可用项', () => {
  assert.throws(() => resolveAppSubset(['ghost-app']), /未知 app 名：ghost-app/)
})

test('resolveRootRedirect：子集含 portal → /portal/', () => {
  assert.equal(resolveRootRedirect([entry('admin', 5174), entry('portal', 5176)]), '/portal/')
})

test('resolveRootRedirect：无 portal → 跳子集第一个', () => {
  assert.equal(resolveRootRedirect([entry('auth', 5179), entry('admin', 5174)]), '/auth/')
})

test('resolveRootRedirect：空子集抛错（防御未来调用方）', () => {
  assert.throws(() => resolveRootRedirect([]), /空子集无根 302 目标/)
})

test('resolvePostLoginFallback：portal 优先于其他 app（全量语义一致）', () => {
  assert.equal(
    resolvePostLoginFallback([entry('admin', 5174), entry('portal', 5176), entry('auth', 5179)]),
    '/portal/'
  )
})

test('resolvePostLoginFallback：无 portal 取第一个非 auth（auth+big → /big/）', () => {
  // 子集顺序按 APPS（port 升序）：big(5178) 在 auth(5179) 前，对齐 resolveAppSubset 契约
  assert.equal(resolvePostLoginFallback([entry('big', 5178), entry('auth', 5179)]), '/big/')
  assert.equal(resolvePostLoginFallback([entry('h5', 5177), entry('auth', 5179)]), '/h5/')
  assert.equal(resolvePostLoginFallback([entry('admin', 5174), entry('auth', 5179)]), '/admin/')
})

test('resolvePostLoginFallback：子集不含 auth 时取第一个 app', () => {
  assert.equal(resolvePostLoginFallback([entry('admin', 5174), entry('big', 5178)]), '/admin/')
})

test('resolvePostLoginFallback：单 auth 子集返回 undefined（不注入 env，前端走原兜底）', () => {
  assert.equal(resolvePostLoginFallback([entry('auth', 5179)]), undefined)
})

test('cleanStaleMockBundled：递归删除全部 bundled 临时文件并返回删除数', (t) => {
  const dir = makeMockDir(t)
  mkdirSync(join(dir, 'pro-table'))
  // 命中：根 + 子目录各一（.mjs/.cjs 双后缀）
  writeFileSync(join(dir, '_auth.bundled_1_aaa.mjs'), '')
  writeFileSync(join(dir, 'pro-table', '_filter.bundled_2_bbb.mjs'), '')
  writeFileSync(join(dir, '_x.bundled_3_ccc.cjs'), '')
  // 保留：真实 mock 源 / 命名不符合硬约束的文件
  writeFileSync(join(dir, 'auth.ts'), '')
  writeFileSync(join(dir, 'normal.bundled_4_ddd.mjs'), '')
  writeFileSync(join(dir, '_keep.ts'), '')

  assert.equal(cleanStaleMockBundled(dir), 3)
  assert.equal(existsSync(join(dir, '_auth.bundled_1_aaa.mjs')), false)
  assert.equal(existsSync(join(dir, 'pro-table', '_filter.bundled_2_bbb.mjs')), false)
  assert.equal(existsSync(join(dir, '_x.bundled_3_ccc.cjs')), false)
  assert.equal(existsSync(join(dir, 'auth.ts')), true)
  assert.equal(existsSync(join(dir, 'normal.bundled_4_ddd.mjs')), true)
  assert.equal(existsSync(join(dir, '_keep.ts')), true)

  // 二次调用无残留可删（幂等）
  assert.equal(cleanStaleMockBundled(dir), 0)
})

test('cleanStaleMockBundled：目录不存在时返回 0（防御调用方传错路径）', () => {
  assert.equal(cleanStaleMockBundled(join(tmpdir(), 'vv-mock-not-exists-xyz')), 0)
})
