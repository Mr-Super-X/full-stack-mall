/**
 * generate-tsconfig-paths 单测（node:test runner）——T-3 孤儿 spec 执行链路接入。
 *
 * 原为 vitest 形态（vi.mock node:fs），但 scripts/ 非 workspace 包、无任何 runner 引用——
 * 2026-10-28 转 node:test：被测函数 aliasesToTsconfigPaths 增加 fs 探针注入参数
 * （第三参，缺省真实 fs），用例传 stub 消除 mock 框架依赖。
 *
 * 运行：pnpm test:check-scripts（与 check-*.spec.ts 同批）
 * @see scripts/generate-tsconfig-paths.ts —— 被测实现
 */
import assert from 'node:assert/strict'
import path from 'node:path'
import { describe, it } from 'node:test'

import { aliasesToTsconfigPaths, generateTsconfigContent } from './generate-tsconfig-paths.ts'

// 精确映射仅在目标 index.ts 真实存在时生成（P1-3）：用例的 appRoot 是假路径，
// 统一注入 existsSync → true 探针，让裸映射断言不受磁盘真实状态影响
const STUB_FS = { existsSync: () => true }

describe('generateTsconfigContent', () => {
  it('输入基础 base.json + paths 对象，输出完整 tsconfig.app.json 字符串', () => {
    const base = { extends: './tsconfig.app.base.json', compilerOptions: {} }
    const paths = { '@/*': ['./src/*'], '@api': ['./src/api/index.ts'], '@api/*': ['./src/api/*'] }
    const result = generateTsconfigContent(base, paths)

    assert.ok(result.includes('"extends": "./tsconfig.app.base.json"'))
    assert.ok(result.includes('"paths"'))
    assert.ok(result.includes('"@/*"'))
    assert.ok(result.includes('"./src/*"'))
  })

  it('保留 base 中其他 compilerOptions 字段', () => {
    const base = { extends: './tsconfig.app.base.json', compilerOptions: { noEmit: true } }
    const result = generateTsconfigContent(base, { '@/*': ['./src/*'] })

    assert.ok(result.includes('"noEmit": true'))
    assert.ok(result.includes('"paths"'))
  })

  it('paths 按 key 字母序排序（保证 git diff 稳定）', () => {
    const base = { extends: './base.json', compilerOptions: {} }
    const paths = { '@z/*': ['./src/z/*'], '@a/*': ['./src/a/*'] }
    const result = generateTsconfigContent(base, paths)

    assert.ok(result.indexOf('"@a/*"') < result.indexOf('"@z/*"'))
  })

  it('exclude 数组紧凑单行（与 prettier 回卷口径一致，P3-3：防生成器与 pre-commit 互相改写）', () => {
    const base = {
      extends: './base.json',
      include: ['env.d.ts', 'src/**/*'],
      exclude: ['src/**/__tests__/*', 'src/**/*.spec.ts', 'src/**/*.test-d.ts'],
      compilerOptions: {},
    }
    const result = generateTsconfigContent(base, { '@/*': ['./src/*'] })

    assert.ok(
      result.includes('"exclude": ["src/**/__tests__/*", "src/**/*.spec.ts", "src/**/*.test-d.ts"]')
    )
    assert.ok(!result.includes('"exclude": [\n'))
  })

  it('生成物为 LF 行尾（processApp 比对前归一 currentContent 行尾——Windows autocrlf 误判防线，2026-11-03 实证）', () => {
    const result = generateTsconfigContent({ compilerOptions: {} }, { '@/*': ['./src/*'] })
    assert.ok(!result.includes('\r'))
  })
})

describe('aliasesToTsconfigPaths', () => {
  const appRoot = path.join('D:', 'proj', 'apps', 'admin')

  it("@ 只生成 '@/*'（catch-all），不生成 bare '@'", () => {
    const paths = aliasesToTsconfigPaths({ '@': path.join(appRoot, 'src') }, appRoot, STUB_FS)
    assert.deepEqual(paths, { '@/*': ['./src/*'] })
  })

  it('常规别名生成 bare（index.ts）+ /* 两条', () => {
    const paths = aliasesToTsconfigPaths(
      { '@api': path.join(appRoot, 'src/api') },
      appRoot,
      STUB_FS
    )
    assert.deepEqual(paths['@api'], ['./src/api/index.ts'])
    assert.deepEqual(paths['@api/*'], ['./src/api/*'])
  })

  it('appRoot 之外的路径输出上探形态（@mock → ../../mock，P0-2 手修语义必须保留）', () => {
    const mockDir = path.join('D:', 'proj', 'mock')
    const paths = aliasesToTsconfigPaths({ '@mock': mockDir }, appRoot, STUB_FS)
    assert.deepEqual(paths['@mock'], ['../../mock/index.ts'])
    assert.deepEqual(paths['@mock/*'], ['../../mock/*'])
  })

  it('index.ts 不存在时不生成 bare 精确映射（P1-3 悬空映射分叉防线，注入 false 探针）', () => {
    const paths = aliasesToTsconfigPaths({ '@api': path.join(appRoot, 'src/api') }, appRoot, {
      existsSync: () => false,
    })
    assert.equal(paths['@api'], undefined)
    assert.deepEqual(paths['@api/*'], ['./src/api/*'])
  })
})
