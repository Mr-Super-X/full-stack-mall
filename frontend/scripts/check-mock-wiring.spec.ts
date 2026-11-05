/**
 * check-mock-wiring 单测（node:test runner）——校验器假阳性守护（/autoplan E3）。
 *
 * 业务背景：mock 双接线一致性是 CI 阻断级门禁，历史上门禁脚本自身零测试——一次正则/
 * 解析改动可让校验静默失效且表现为绿色通过。本 spec 表驱动守护 diffWirings 的判定
 * 逻辑：合法接线必须判定一致，各漂移形态（缺 prod / 多 prod / 权限码分叉 / 权限码缺失）
 * 必须判定漂移。
 *
 * 运行：pnpm test:check-scripts（与 check-routes/check-doc-currency spec 同批）
 * @see scripts/check-mock-wiring.ts —— 被测实现（判定逻辑单源在 diffWirings）
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  PROD_INLINE_EXEMPT,
  diffWirings,
  extractPermissions,
  parseArrayLiteral,
  parseLocalModuleImports,
} from './check-mock-wiring.ts'

// ── parseLocalModuleImports：import 语句解析 ─────────────────────

test('parseLocalModuleImports：提取具名本地 import 的模块名', () => {
  const src = `import auth from './auth'\nimport userList from './user'\nimport axios from 'axios'\n`
  assert.deepEqual(parseLocalModuleImports(src), ['auth', 'user'])
})

test('parseLocalModuleImports：无本地 import → 空数组', () => {
  assert.deepEqual(parseLocalModuleImports(`import axios from 'axios'`), [])
})

// ── parseArrayLiteral：权限码数组解析 ────────────────────────────

test('parseArrayLiteral：单双引号混合与空白', () => {
  assert.deepEqual(parseArrayLiteral(`['user:add', "user:del",  'dict:view']`), [
    'user:add',
    'user:del',
    'dict:view',
  ])
})

test('parseArrayLiteral：空数组 → 空', () => {
  assert.deepEqual(parseArrayLiteral('[]'), [])
})

// ── extractPermissions：两种定义形态 ─────────────────────────────

test('extractPermissions：const MOCK_PERMISSIONS 变量形态优先', () => {
  const src = `const MOCK_PERMISSIONS = ['a']\nconst other = ['b']`
  assert.deepEqual(extractPermissions(src), ['a'])
})

test('extractPermissions：内联 permissions 字段形态（prodAuthMocks）', () => {
  const src = `const profile = { permissions: ['x', 'y'] }`
  assert.deepEqual(extractPermissions(src), ['x', 'y'])
})

test('extractPermissions：两种形态并存时变量定义优先', () => {
  const src = `const MOCK_PERMISSIONS = ['var']\nconst r = { permissions: ['inline'] }`
  assert.deepEqual(extractPermissions(src), ['var'])
})

test('extractPermissions：均无 → 空', () => {
  assert.deepEqual(extractPermissions(`const x = 1`), [])
})

// ── diffWirings：双接线漂移判定（核心守护） ──────────────────────

const devIndex = (modules: string[]) => modules.map((m) => `import x from './${m}'`).join('\n')
const prodServer = (modules: string[], perms?: string[]) =>
  [
    ...modules.map((m) => `import x from './${m}'`),
    perms ? `const prodAuthMocks = { permissions: [${perms.map((p) => `'${p}'`).join(',')}] }` : '',
  ]
    .filter(Boolean)
    .join('\n')
const authModule = (perms: string[]) =>
  `const MOCK_PERMISSIONS = [${perms.map((p) => `'${p}'`).join(',')}]`

test('diffWirings：接线一致 → 零漂移', () => {
  const diff = diffWirings(
    devIndex(['auth', 'user', 'menu', 'dict']),
    prodServer(['user', 'menu', 'dict-data'], ['p1', 'p2']),
    authModule(['p1', 'p2'])
  )
  assert.deepEqual(diff.missingInProd, [])
  assert.deepEqual(diff.unexpectedInProd, [])
  assert.equal(diff.bothHavePerms, true)
  assert.equal(diff.permsMatch, true)
})

test('diffWirings：prod 缺 dev 聚合模块 → missingInProd', () => {
  const diff = diffWirings(
    devIndex(['auth', 'user', 'menu']),
    prodServer(['user', 'dict-data'], ['p1']), // menu 被漏接
    authModule(['p1'])
  )
  assert.deepEqual(diff.missingInProd, ['menu'])
})

test('diffWirings：prod 多 dev 未聚合模块 → unexpectedInProd', () => {
  const diff = diffWirings(
    devIndex(['auth', 'user']),
    prodServer(['user', 'ghost', 'dict-data'], ['p1']),
    authModule(['p1'])
  )
  assert.deepEqual(diff.unexpectedInProd, ['ghost'])
})

test('diffWirings：豁免集（auth/dict/stream）prod 不 import 不算漂移', () => {
  assert.deepEqual([...PROD_INLINE_EXEMPT].sort(), ['auth', 'dict', 'stream'])
  const diff = diffWirings(
    devIndex(['auth', 'dict', 'stream', 'user']),
    prodServer(['user', 'dict-data'], ['p1']),
    authModule(['p1'])
  )
  assert.deepEqual(diff.missingInProd, [])
})

test('diffWirings：权限码分叉 → permsMatch=false 且明细保留', () => {
  const diff = diffWirings(
    devIndex(['auth', 'user']),
    prodServer(['user'], ['p1', 'p2']),
    authModule(['p1', 'p3'])
  )
  assert.equal(diff.bothHavePerms, true)
  assert.equal(diff.permsMatch, false)
  assert.deepEqual(diff.authPerms, ['p1', 'p3'])
  assert.deepEqual(diff.prodPerms, ['p1', 'p2'])
})

test('diffWirings：prod 未定义权限码 → bothHavePerms=false', () => {
  const diff = diffWirings(
    devIndex(['auth', 'user']),
    prodServer(['user']), // 无 permissions 字段
    authModule(['p1'])
  )
  assert.equal(diff.bothHavePerms, false)
})
