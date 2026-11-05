/**
 * new-module 单测（node:test runner）——骨架产物与现行机制的回归守护（/autoplan R3-E6/T4）。
 *
 * 业务背景：R3 审查发现骨架模板生成 `requiresAuth: true` 却无「守卫不消费此字段」
 * 说明——新人照骨架写公开页会发现「设了 requiresAuth:false 仍要登录」（公开访问唯一
 * 机制是 ROUTE_WHITE_LIST 白名单）。本 spec 以源码文本断言锁住修正后的教学注释，
 * 防模板漂移回归（同 check-scripts「解析退化 ≠ 全绿」精神）。
 *
 * 运行：pnpm test:check-scripts
 * @see scripts/new-module.ts —— 被测实现（模板为内联字符串，文本断言是最小守护面）
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const SOURCE = readFileSync(fileURLToPath(new URL('./new-module.ts', import.meta.url)), 'utf-8')

test('骨架 requiresAuth 带「守卫不消费 + 白名单是唯一公开机制」教学注释', () => {
  assert.ok(
    SOURCE.includes('登录守卫不读此字段'),
    'new-module.ts 骨架丢失了 requiresAuth 语义注释（R3-C1 教学矛盾回归）'
  )
  assert.ok(
    SOURCE.includes('ROUTE_WHITE_LIST 白名单'),
    '骨架注释未指向白名单机制（公开访问唯一机制变了？同步本断言）'
  )
})
