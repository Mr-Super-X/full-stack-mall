/**
 * check-doc-currency 单测（node:test runner）——校验器假阳性守护（/autoplan E3）。
 *
 * 业务背景：check-doc-currency 把文档硬数据（字段数/入口数/阈值）锁在 CI 阻断级，
 * 其解析核心 countInterfaceFields（interface 体字段计数正则）与 inRange（容差判定）
 * 一旦漂移会让校验静默失效。countXxx 的文件系统扫描由 CLI 对真实仓库的每日运行
 * 天然覆盖；本 spec 表驱动守护两个纯逻辑核心。
 *
 * 运行：pnpm test:check-scripts
 * @see scripts/check-doc-currency.ts —— 被测实现
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { countInterfaceFields, inRange } from './check-doc-currency.ts'

// ── countInterfaceFields：interface 体字段计数 ──────────────────

test('countInterfaceFields：常规字段 + 可选字段计数', () => {
  const content = `export interface Demo {
  name: string
  age?: number
  tags: string[]
}`
  assert.equal(countInterfaceFields(content, 'Demo'), 3)
})

test('countInterfaceFields：注释行与方法签名不计入字段', () => {
  const content = `export interface Demo {
  // 这是注释
  name: string
  /** JSDoc 块 */
  run(): void
  age: number
}`
  // 字段声明行 = 空白开头 + 标识符 + ?: 或 : —— 注释行与 run() 均不匹配
  assert.equal(countInterfaceFields(content, 'Demo'), 2)
})

test('countInterfaceFields：CRLF 换行归一后正常计数（Windows 兼容）', () => {
  const content = 'export interface Demo {\r\n  a: string\r\n  b: number\r\n}'
  assert.equal(countInterfaceFields(content, 'Demo'), 2)
})

test('countInterfaceFields：interface 不存在 → 0（区分「无字段」与「解析失败」）', () => {
  assert.equal(countInterfaceFields('export interface Other { a: string }', 'Demo'), 0)
})

test('countInterfaceFields：空 interface 体 → 0', () => {
  assert.equal(countInterfaceFields('export interface Demo {\n}', 'Demo'), 0)
})

test('countInterfaceFields：同名非 export interface 不匹配', () => {
  // 正则锚定 export interface——内部局部 interface 不参与文档硬数据
  assert.equal(countInterfaceFields('interface Demo { a: string }', 'Demo'), 0)
})

// ── inRange：容差区间判定 ───────────────────────────────────────

test('inRange：tolerance=0 精确命中', () => {
  assert.equal(inRange(35, 35), true)
  assert.equal(inRange(34, 35), false)
  assert.equal(inRange(36, 35), false)
})

test('inRange：tolerance=2 上下界均闭区间', () => {
  assert.equal(inRange(47, 49, 2), true)
  assert.equal(inRange(49, 49, 2), true)
  assert.equal(inRange(51, 49, 2), true)
  assert.equal(inRange(46, 49, 2), false)
  assert.equal(inRange(52, 49, 2), false)
})

test('inRange：负向 actual 与 0 容差边界', () => {
  assert.equal(inRange(0, 0, 0), true)
  assert.equal(inRange(-1, 0, 0), false)
})
