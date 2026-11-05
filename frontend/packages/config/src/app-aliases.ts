import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 应用路径别名（单一来源，Monorepo 版）
 *
 * 三处消费方共享同一解析结果，杜绝双维护漂移：
 *   1. create-vite-config.ts 的 resolve.alias（vite 构建期）
 *   2. scripts/generate-tsconfig-paths.ts（tsconfig.app.json paths 生成器，IDE 跳转）
 *   3. scripts/check-aliases.ts（一致性校验，CI 门禁）
 *
 * 包界划分（设计稿 D4）：
 *   - @api/@composables/@directives/@enums/@locales/@store/@utils → @vv/shared 包源码
 *   - @components/@assets → @vv/ui 包源码
 *   - @mock → @vv/mock 包源码（packages/mock/src）
 *   - @vv/shared / @vv/ui → 包名裸路径（2026-10-27 补录）：vue-tsc --build 对 workspace
 *     链接的 exports 深路径（'@vv/shared/api/error-events' 等）解析失败——vite/vitest
 *     走 exports 正常，仅 TS 需 paths 兜底。alias 值指包 src 目录（生成器派生 bare→index.ts
 *     + /*→src/* 两条 tsconfig 映射；vite 侧 alias 命中与 exports 指向同一文件，语义等价）
 *   - @、@modules、@layouts、@router、@plugins → 各 app 自身 src（app 私有，永不留包）
 *
 * 注：曾有的 '@types' 条目已删除（P1-4 结转）——'@types' 与 TS 的 @types 包解析命名空间
 * 冲突（tsconfig paths 命中时报 TS6137），且全仓零消费；类型统一经 '@vv/shared' 包名引出。
 */

/** @vv/ui 包 src 目录（P1-4 迁入前不存在，经 resolvePkgFirst 回落 legacy 位置） */
export const UI_SRC_DIR = fileURLToPath(new URL('../../ui/src', import.meta.url))
/** @vv/shared 包 src 目录（P1-3 迁入前不存在，经 resolvePkgFirst 回落 legacy 位置） */
export const SHARED_SRC_DIR = fileURLToPath(new URL('../../shared/src', import.meta.url))
// @mock 自 P1-2 起指 @vv/mock 包源码（P0 期间曾暂指仓库根 mock/）
export const MOCK_ROOT_DIR = fileURLToPath(new URL('../../mock/src', import.meta.url))

/**
 * 包目录优先、legacy 目录兜底的过渡态解析。
 * packages/* 目标目录已落地（existsSync 命中）→ 指包源码；否则回落到 app 旧位置。
 * P1-3/P1-4 迁入包后 existsSync 自动切换，legacyRoot 入参留待 P5 清理。
 */
export function resolvePkgFirst(pkgDir: string, legacyDir?: string): string {
  if (existsSync(pkgDir)) return pkgDir
  return legacyDir ?? pkgDir
}

/**
 * 生成某 app 的 resolve.alias（单一来源）。
 * 包间一律映射到 @vv/* 包源码；app 私有别名（@/、@modules、@layouts、@router、@plugins）指向 app 自身 src。
 *
 * legacyRoot：过渡态回落根（admin 消费时传自身 appRoot）。packages/shared、packages/ui
 * 在本任务期间尚不存在——vite 别名指向不存在目录仅在真有 import 命中时才报错，而
 * @utils/@api 等别名必须指向实体目录（test/type-check 立即消费），故需要此回落。
 */
export function createAppAliases(appRoot: string, legacyRoot?: string): Record<string, string> {
  const pick = (pkgDir: string, legacySub: string): string =>
    resolvePkgFirst(pkgDir, legacyRoot ? path.join(legacyRoot, legacySub) : undefined)
  return {
    '@': path.join(appRoot, 'src'),
    '@api': pick(path.join(SHARED_SRC_DIR, 'api'), 'src/api'),
    '@composables': pick(path.join(SHARED_SRC_DIR, 'composables'), 'src/composables'),
    '@directives': pick(path.join(SHARED_SRC_DIR, 'directives'), 'src/directives'),
    '@enums': pick(path.join(SHARED_SRC_DIR, 'enums'), 'src/enums'),
    '@locales': pick(path.join(SHARED_SRC_DIR, 'locales'), 'src/locales'),
    '@store': pick(path.join(SHARED_SRC_DIR, 'store'), 'src/store'),
    '@utils': pick(path.join(SHARED_SRC_DIR, 'utils'), 'src/utils'),
    '@components': pick(path.join(UI_SRC_DIR, 'components'), 'src/components'),
    '@assets': pick(path.join(UI_SRC_DIR, 'assets'), 'src/assets'),
    '@mock': MOCK_ROOT_DIR,
    // 包名裸路径兜底（vue-tsc 对 workspace exports 深路径解析失败时的 TS 侧出口，
    // 见头注）；生成器按目录形态派生 '@vv/shared'→index.ts + '@vv/shared/*'→src/*
    '@vv/shared': SHARED_SRC_DIR,
    '@vv/ui': UI_SRC_DIR,
    '@modules': path.join(appRoot, 'src/modules'),
    '@layouts': path.join(appRoot, 'src/layouts'),
    '@router': path.join(appRoot, 'src/router'),
    '@plugins': path.join(appRoot, 'src/plugins'),
  }
}
