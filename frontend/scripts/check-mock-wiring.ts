/**
 * mock 双接线一致性校验（架构审查健壮性项——消除「注释约定」漂移风险）。
 *
 * @vv/mock 有两份接线清单，历史上靠注释约定手工同步（mock/index.ts 头注 +
 * mockProdServer.ts @trigger），无工具强制，是全库最现实的漂移风险点：
 *   - dev 聚合入口：mock/index.ts（import auth/user/menu 模块的 default export）
 *   - prod 接线：mockProdServer.ts（内联 prodAuthMocks/prodDictMocks + import menu/user）
 *
 * 且权限码 MOCK_PERMISSIONS 在 auth.ts 与 mockProdServer.ts 两处字面量手工对齐
 * （两处无运行时共享）——增删权限码易漏改其一，致 dev/prod 行为分叉。
 *
 * 本脚本静态断言两处一致，接入 CI（ci.yml check-mock-wiring step）强制同步。
 *
 * 校验项：
 *   1. 模块清单一致：dev index.ts 聚合的具名模块，prod mockProdServer.ts 必须同样
 *      import（或显式内联覆盖并在本脚本登记豁免——auth/dict 走 prod 内联版属合理豁免，
 *      因其 rawResponse/路径参数 client 侧不支持，见 mockProdServer.ts 头注）
 *   2. MOCK_PERMISSIONS 单源：auth.ts 与 mockProdServer.ts 的权限码数组必须逐字一致
 *
 * 用法：node --experimental-strip-types scripts/check-mock-wiring.ts（exit 0 一致 / 1 漂移）
 */

import { readFileSync, realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
const MOCK_SRC = path.join(REPO_ROOT, 'packages/mock/src')

/** 解析数组字面量文本为权限码数组（如 ['a','b'] → ['a','b']） */
export function parseArrayLiteral(body: string): string[] {
  return [...body.matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1] ?? '')
}

/** 从源里提取 MOCK_PERMISSIONS 权限码数组——兼容两种形态：
 *  ① `const MOCK_PERMISSIONS = [...]` 变量定义（mock/auth.ts）
 *  ② 内联在响应 `permissions: [...]` 字段（mockProdServer.ts 的 prodAuthMocks 内联版，
 *     不定义变量、直接把权限码写在 profile 响应的 permissions 字段）
 * 取两者首个命中的。 */
export function extractPermissions(source: string): string[] {
  const varDef = source.match(/const MOCK_PERMISSIONS\s*=\s*\[([\s\S]*?)\]/)
  if (varDef) return parseArrayLiteral(varDef[1] ?? '')
  const inlineField = source.match(/permissions:\s*\[([\s\S]*?)\]/)
  if (inlineField) return parseArrayLiteral(inlineField[1] ?? '')
  return []
}

/** 从 import 语句提取具名本地模块引用（形如 `import x from './y'` 的 y） */
export function parseLocalModuleImports(source: string): string[] {
  return [...source.matchAll(/import\s+\w+\s+from\s+'\.\/([\w-]+)'/g)].map((x) => x[1] ?? '')
}

/**
 * prod 内联豁免集：auth/dict 在 prod 走内联版（prodAuthMocks/prodDictMocks），不 import
 * auth.ts/dict.ts——因 rawResponse（Set-Cookie 流）与路径参数 client 侧不支持
 * （mockProdServer.ts 头注）。stream 同为 rawResponse 且更彻底：prod 的 createProdMockServer
 * 是 mockjs XHR 劫持，不拦截 stream.ts 的 fetch——即便内联 response 形态也无法生效
 * （请求根本到不了拦截器），故 prod 无任何等价格可接，只能豁免（dev-only 能力，
 * docs demo 在 gh-pages 上降级提示）。
 */
export const PROD_INLINE_EXEMPT = new Set(['auth', 'dict', 'stream'])

/** 双接线漂移比对结果（main 与 spec 共用——校验器假阳性守护的测试钩子） */
export interface WiringDiff {
  /** dev 聚合（豁免后）在 prod 缺失 import 的模块 */
  missingInProd: string[]
  /** prod import 了 dev 未聚合的意外模块 */
  unexpectedInProd: string[]
  /** 两处是否均定义了权限码 */
  bothHavePerms: boolean
  /** 两处权限码是否逐字一致 */
  permsMatch: boolean
  /** auth.ts 解析出的权限码（诊断输出用） */
  authPerms: string[]
  /** prod 内联版解析出的权限码（诊断输出用） */
  prodPerms: string[]
}

/** 双接线漂移比对纯函数（2026-10-28 /autoplan E3 提取）——输入两接线源与 auth 源文本，
 *  输出结构化漂移结果；process 无关，spec 可直接表驱动 */
export function diffWirings(indexSrc: string, prodSrc: string, authSrc: string): WiringDiff {
  const devModules = parseLocalModuleImports(indexSrc).sort()
  // prod 接线 import 的模块（排除 './dict-data' 数据引用）
  const prodImportedModules = parseLocalModuleImports(prodSrc)
    .filter((m) => m !== 'dict-data')
    .sort()
  const expectedProdImports = devModules.filter((m) => !PROD_INLINE_EXEMPT.has(m))
  const authPerms = extractPermissions(authSrc)
  const prodPerms = extractPermissions(prodSrc)
  return {
    missingInProd: expectedProdImports.filter((m) => !prodImportedModules.includes(m)),
    unexpectedInProd: prodImportedModules.filter((m) => !devModules.includes(m)),
    bothHavePerms: authPerms.length > 0 && prodPerms.length > 0,
    permsMatch: JSON.stringify(authPerms) === JSON.stringify(prodPerms),
    authPerms,
    prodPerms,
  }
}

export function main(): void {
  let failures = 0

  function check(ok: boolean, label: string, detail = ''): void {
    if (ok) {
      console.log(`✓ ${label}`)
    } else {
      console.error(`✗ ${label}${detail ? `：${detail}` : ''}`)
      failures++
    }
  }

  // ---- 读取双接线源 ----
  const indexSrc = readFileSync(path.join(MOCK_SRC, 'index.ts'), 'utf-8')
  const prodSrc = readFileSync(path.join(MOCK_SRC, 'mockProdServer.ts'), 'utf-8')
  const authSrc = readFileSync(path.join(MOCK_SRC, 'auth.ts'), 'utf-8')

  // ---- 校验 1+2：漂移比对（判定逻辑单源在 diffWirings，spec 表驱动守护） ----
  const diff = diffWirings(indexSrc, prodSrc, authSrc)

  check(
    diff.missingInProd.length === 0,
    `[1] 模块清单一致：dev 聚合的 ${JSON.stringify(parseLocalModuleImports(indexSrc).filter((m) => !PROD_INLINE_EXEMPT.has(m)))} 在 prod 均 import`,
    diff.missingInProd.length ? `prod 缺 import：${diff.missingInProd.join(', ')}` : ''
  )
  check(
    diff.unexpectedInProd.length === 0,
    `[1] 模块清单一致：prod 无 dev 未聚合的意外模块`,
    diff.unexpectedInProd.length
      ? `prod 多 import：${diff.unexpectedInProd.join(', ')}（应同步登记进 dev index.ts 或确认豁免）`
      : ''
  )
  check(
    diff.bothHavePerms,
    `[2] MOCK_PERMISSIONS 两处均有定义`,
    diff.bothHavePerms ? '' : 'auth.ts 或 prodAuthMocks 未定义 MOCK_PERMISSIONS'
  )
  check(
    diff.permsMatch,
    `[2] MOCK_PERMISSIONS 单源（auth.ts 与 prodAuthMocks 权限码一致）`,
    !diff.permsMatch
      ? `auth=[${diff.authPerms.join(',')}] vs prod=[${diff.prodPerms.join(',')}]`
      : ''
  )

  // ---- 汇总 ----
  if (failures > 0) {
    console.error(
      `\n✗ mock 双接线漂移 ${failures} 处——删/加 mock 文件须三处同步：① index.ts import ② mockProdServer.ts 接线数组/内联模块 ③ 两处头注清单（细节见本脚本头注）`
    )
    process.exit(1)
  }
  console.log('\n✓ mock 双接线一致（模块清单 + MOCK_PERMISSIONS）')
}

// CLI 守卫：被 spec import 时不执行 main（2026-10-28 /autoplan E3 可测化改造）
const invokedDirectly =
  process.argv[1] !== undefined && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) main()
