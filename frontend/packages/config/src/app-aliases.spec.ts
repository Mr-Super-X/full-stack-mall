import { afterEach, describe, expect, it, vi } from 'vitest'
import * as fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  MOCK_ROOT_DIR,
  SHARED_SRC_DIR,
  UI_SRC_DIR,
  createAppAliases,
  resolvePkgFirst,
} from './app-aliases'

// existsSync 默认走真实实现；仅在「包已落地」分支用例里 mockReturnValue(true)
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return { ...actual, existsSync: vi.fn(actual.existsSync) }
})
const mockedExistsSync = vi.mocked(fs.existsSync)
const realExistsSync = (await vi.importActual<typeof import('node:fs')>('node:fs')).existsSync

const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const APP_ROOT = path.join(REPO_ROOT, 'apps/admin')

afterEach(() => {
  mockedExistsSync.mockReset()
  mockedExistsSync.mockImplementation(realExistsSync)
})

describe('createAppAliases', () => {
  it('返回 17 条别名（@ + 7 shared + 2 ui + @mock + 4 app 私有 + 2 包名裸路径）', () => {
    // '@types' 条目已删除（P1-4 结转：TS6137 陷阱 + 零消费）；
    // '@vv/shared' / '@vv/ui' 包名裸路径 2026-10-27 补录（vue-tsc 对 workspace exports
    // 深路径解析失败的 paths 兜底，见 app-aliases.ts 头注）
    expect(Object.keys(createAppAliases(APP_ROOT, APP_ROOT))).toHaveLength(17)
  })

  it('@ 与 app 私有别名指向 app 自身 src', () => {
    const aliases = createAppAliases(APP_ROOT, APP_ROOT)
    expect(aliases['@']).toBe(path.join(APP_ROOT, 'src'))
    expect(aliases['@modules']).toBe(path.join(APP_ROOT, 'src/modules'))
    expect(aliases['@layouts']).toBe(path.join(APP_ROOT, 'src/layouts'))
    expect(aliases['@router']).toBe(path.join(APP_ROOT, 'src/router'))
    expect(aliases['@plugins']).toBe(path.join(APP_ROOT, 'src/plugins'))
  })

  it('@mock 恒指 @vv/mock 包源码（P1-2 起，不参与 existsSync 回落切换）', () => {
    expect(createAppAliases(APP_ROOT, APP_ROOT)['@mock']).toBe(
      path.join(REPO_ROOT, 'packages/mock/src')
    )
    expect(MOCK_ROOT_DIR).toBe(path.join(REPO_ROOT, 'packages/mock/src'))
  })

  it('P1-3 后：packages/shared 已落地 → 7 个别名恒指包源码（真实 fs existsSync 命中）', () => {
    const aliases = createAppAliases(APP_ROOT, APP_ROOT)
    for (const name of [
      '@api',
      '@composables',
      '@directives',
      '@enums',
      '@locales',
      '@store',
      '@utils',
    ]) {
      const sub = name.slice(1) // '@api' → 'api'
      expect(aliases[name]).toBe(path.join(SHARED_SRC_DIR, sub))
    }
  })

  it('P1-4 后：packages/ui 已落地 → @components/@assets 恒指包源码（真实 fs existsSync 命中）', () => {
    const aliases = createAppAliases(APP_ROOT, APP_ROOT)
    expect(aliases['@components']).toBe(path.join(UI_SRC_DIR, 'components'))
    expect(aliases['@assets']).toBe(path.join(UI_SRC_DIR, 'assets'))
  })

  it('包名裸路径恒指包 src 目录（@vv/shared / @vv/ui，不参与 existsSync 回落）', () => {
    const aliases = createAppAliases(APP_ROOT, APP_ROOT)
    expect(aliases['@vv/shared']).toBe(SHARED_SRC_DIR)
    expect(aliases['@vv/ui']).toBe(UI_SRC_DIR)
  })

  it('过渡态回落：包目录不存在时（mock existsSync=false）@components/@assets 指向 legacyRoot', () => {
    mockedExistsSync.mockReturnValue(false)
    const aliases = createAppAliases(APP_ROOT, APP_ROOT)
    expect(aliases['@components']).toBe(path.join(APP_ROOT, 'src/components'))
    expect(aliases['@assets']).toBe(path.join(APP_ROOT, 'src/assets'))
  })

  it('缺省 legacyRoot：包目录不存在也指包路径（由调用方保证包已落地）', () => {
    const aliases = createAppAliases(APP_ROOT)
    expect(aliases['@api']).toBe(path.join(SHARED_SRC_DIR, 'api'))
    expect(aliases['@components']).toBe(path.join(UI_SRC_DIR, 'components'))
  })

  it('包目录已落地（existsSync 命中）→ 优先指包源码，legacyRoot 被忽略', () => {
    mockedExistsSync.mockReturnValue(true)
    const aliases = createAppAliases(APP_ROOT, APP_ROOT)
    expect(aliases['@api']).toBe(path.join(SHARED_SRC_DIR, 'api'))
    expect(aliases['@store']).toBe(path.join(SHARED_SRC_DIR, 'store'))
    expect(aliases['@components']).toBe(path.join(UI_SRC_DIR, 'components'))
  })
})

describe('resolvePkgFirst', () => {
  it('包目录存在 → 返回包目录', () => {
    mockedExistsSync.mockReturnValue(true)
    expect(resolvePkgFirst('/pkg/x', '/legacy/x')).toBe('/pkg/x')
  })

  it('包目录不存在 → 返回 legacy 目录', () => {
    mockedExistsSync.mockReturnValue(false)
    expect(resolvePkgFirst('/pkg/x', '/legacy/x')).toBe('/legacy/x')
  })

  it('包目录不存在且无 legacy → 返回包目录（保持指包语义）', () => {
    mockedExistsSync.mockReturnValue(false)
    expect(resolvePkgFirst('/pkg/x')).toBe('/pkg/x')
  })
})
