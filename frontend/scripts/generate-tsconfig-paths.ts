/**
 * tsconfig.app.json paths 生成器（v2，Monorepo）
 *
 * 用法：
 *   node --experimental-strip-types scripts/generate-tsconfig-paths.ts [--check]
 *
 * --check 模式：仅校验 paths 是否一致，不写入（check:aliases 复用本模式，单一逻辑来源）
 * 默认模式：读取目标 tsconfig.app.json 的 base + 其他字段，写入新的 paths 块
 *
 * 单一来源：packages/config/src/app-aliases.ts 的 createAppAliases
 * （vite resolve.alias 与 tsconfig paths 同一数据源，杜绝双维护漂移）
 *
 * v2 变更（P1-1）：
 *   - 数据源从 build/aliases.ts（已删）切换到 @vv/config 包源码
 *   - 目标 tsconfig 锚定脚本相对位置（不再依赖 cwd——P0-2 后 cwd=根而 tsconfig 在
 *     apps/admin，cwd 相对解析已失效一次，教训固化为此处绝对锚定）
 *   - 多 app 化（P5-1）时把 APP_ROOT 参数化遍历 apps/* 即可
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createAppAliases } from '../packages/config/src/app-aliases.ts'

/**
 * 目标 app 根清单（绝对路径，锚定脚本位置而非 cwd）。
 *
 * P2 参数化：遍历 apps/* 下所有存在 tsconfig.app.json 的目录（admin / docs / ...），
 * 每个 app 独立生成/校验；新增 app 只需落 tsconfig.app.json，无需改本脚本。
 */
const APPS_DIR = fileURLToPath(new URL('../apps', import.meta.url))

function findAppRoots(): string[] {
  return readdirSync(APPS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(APPS_DIR, entry.name))
    .filter((root) => existsSync(path.join(root, 'tsconfig.app.json')))
}

interface TsConfig {
  extends?: string
  compilerOptions?: Record<string, unknown>
  [key: string]: unknown
}

/**
 * vite alias（绝对路径）→ tsconfig paths（相对 tsconfig 所在目录的可移植形态）
 *
 * - '@' 只生成 '@/*'（catch-all）；bare '@' 无消费场景
 * - 其余别名生成 bare（指向 index.ts）+ '/*' 两条——tsconfig paths 必须显式列两条，
 *   否则 IDE 对 bare import（如 `from '@api'`）跳转不工作；vite resolve 会自动追加
 *   /index.ts 所以 alias 侧一条够用
 * - 指到 appRoot 之外的路径（如 @mock → 仓库根 mock/）输出 '../../mock/*' 上探形态，
 *   这是 P0-2 手修过的语义，生成器必须保留（被 check:aliases 锁定）
 */
export function aliasesToTsconfigPaths(
  aliases: Record<string, string>,
  appRoot: string,
  // 2026-10-28 T-3：fs 探针注入——spec 传 stub 消除 mock 框架依赖（孤儿 spec 转 node:test
  // 接入 test:check-scripts 链路）；processApp 调用方不传第三参即真实 fs
  probe: { existsSync: (p: string) => boolean } = { existsSync }
): Record<string, string[]> {
  const paths: Record<string, string[]> = {}
  for (const [alias, absDir] of Object.entries(aliases)) {
    const relRaw = path.relative(appRoot, absDir).split(path.sep).join('/')
    const rel = relRaw.startsWith('..') ? relRaw : `./${relRaw}`
    if (alias === '@') {
      paths['@/*'] = [`${rel}/*`]
      continue
    }
    // 精确映射仅在目标 index.ts 真实存在时生成：悬空映射会让 vite（目录解析命中）
    // 与 tsconfig（指向不存在文件）分叉，首个 bare import 即编译错（P1-3 审查发现）
    if (probe.existsSync(path.join(absDir, 'index.ts'))) {
      paths[alias] = [`${rel}/index.ts`]
    }
    paths[`${alias}/*`] = [`${rel}/*`]
  }
  return paths
}

/**
 * 生成最终的 tsconfig.app.json 内容（JSON 字符串）
 *
 * 输入：现有 tsconfig.app.json 解析对象 + 新的 paths 块
 * 输出：JSON 字符串，paths 数组紧凑单行（与手写原版格式一致），其他字段 2 空格缩进
 *
 * 为什么不直接用 JSON.stringify(..., null, 2)：
 *   - JSON.stringify 默认会把所有数组展开（每个元素一行），与手写原版的
 *     `"@/*": ["./src/*"]` 紧凑格式不一致——即使 paths 内容完全一样，hash 也会变
 *   - 这会导致 check:aliases 报"不一致"，且 pre-commit 永远会触发写入
 *
 * 策略：手动拼字符串，paths 数组单独用紧凑序列化，再嵌入到整体 2 空格缩进的结构里
 */
export function generateTsconfigContent(
  baseContent: TsConfig,
  paths: Record<string, string[]>
): string {
  const sortedPaths = Object.keys(paths)
    .sort()
    .reduce<Record<string, string[]>>((acc, key) => {
      acc[key] = paths[key]
      return acc
    }, {})

  const result: TsConfig = {
    ...baseContent,
    compilerOptions: {
      ...baseContent.compilerOptions,
      paths: sortedPaths,
    },
  }

  // 第一步：把整个 result 序列化为 2 空格缩进的字符串（paths 数组会被展开）
  const expanded = JSON.stringify(result, null, 2)

  // 第二步：把所有「@ 别名数组 + include/exclude 数组」的展开格式替换为紧凑格式
  // （include/exclude 必须一并处理：P1-3 手加的 shared d.ts 条目经 prettier 会回卷单行，
  //  而 JSON.stringify 默认展开——两处形态不一致会让 check:aliases 永远报漂移；
  //  P3-2/P3-3 补 exclude：lint-staged 对暂存 json 跑 prettier --write，展开形态会被当场压回，
  //  生成器与 pre-commit 钩子在 tsconfig.app.json 上互相改写死循环）
  const compact = expanded.replace(
    /"((?:@\/?[^"]+)|(?:@[\w-]+)|include|exclude)": \[\s*\n(\s*"[^"]+"(?:,\s*\n\s*"[^"]+")*)\s*\n\s*\]/g,
    (_match, key: string, items: string) => {
      // items 是展开的多行内容，提取后用逗号拼接为单行
      const flat = items.replace(/\s*\n\s*/g, ' ').trim()
      return `"${key}": [${flat}]`
    }
  )

  return compact + '\n'
}

/** 单 app 处理：读取 → 计算 paths → 写入（或仅校验）。返回 true 表示一致/已修复 */
function processApp(appRoot: string, isCheck: boolean): boolean {
  const appName = path.basename(appRoot)
  const tsconfigApp = path.join(appRoot, 'tsconfig.app.json')
  const existing = JSON.parse(readFileSync(tsconfigApp, 'utf-8')) as TsConfig
  // legacyRoot 传 appRoot 自身，与 create-vite-config 工厂消费形态一致
  // （packages/shared、packages/ui 落地前回落 app 旧位置）
  const expectedPaths = aliasesToTsconfigPaths(createAppAliases(appRoot, appRoot), appRoot)
  const newContent = generateTsconfigContent(existing, expectedPaths)
  const currentContent = readFileSync(tsconfigApp, 'utf-8')
  const newHash = createHash('sha256').update(newContent).digest('hex')
  // 行尾归一：Windows core.autocrlf=true 会把工作区 LF checkout 成 CRLF，
  // 而 generateTsconfigContent 输出固定 LF——按字节比对会把纯行尾差误判为漂移
  // （2026-11-03 本地 6 端全红实证；CI ubuntu 无此问题，故此前未暴露）
  const currentHash = createHash('sha256')
    .update(currentContent.replace(/\r\n/g, '\n'))
    .digest('hex')

  if (isCheck) {
    if (newHash === currentHash) {
      console.log(`✅ [${appName}] tsconfig.app.json 与 @vv/config app-aliases 一致`)
      return true
    }
    console.error(`❌ [${appName}] tsconfig.app.json 与 @vv/config app-aliases 不一致：`)
    console.error('   跑 `pnpm generate:tsconfig-paths` 自动修复')
    return false
  }

  // 默认模式：仅当内容变更时写入（避免 git diff 噪声）
  if (newHash === currentHash) {
    console.log(`✅ [${appName}] tsconfig.app.json 无变更（hash 一致）`)
    return true
  }

  writeFileSync(tsconfigApp, newContent)
  console.log(`✅ [${appName}] tsconfig.app.json 已更新`)
  return true
}

/** 主流程：遍历 apps/* 下所有含 tsconfig.app.json 的 app */
function main(): void {
  const isCheck = process.argv.includes('--check')
  const appRoots = findAppRoots()

  // 反向校验（2026-10-23 扩展性审查）：apps/ 下存在但缺 tsconfig.app.json 的目录被
  // findAppRoots 静默跳过——paths 全缺会让该 app 的 IDE 跳转 / type-check 静默劣化。
  // 新增 app 必须先落 tsconfig.app.json（可仿 apps/big/tsconfig.app.json 骨架）再跑本脚本。
  const configuredNames = new Set(appRoots.map((root) => path.basename(root)))
  const unconfigured = readdirSync(APPS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !configuredNames.has(entry.name))
    // 只把「有 src 的目录」视为真 app——纯空壳 / 仅残留目录（如刚删除未释放句柄的
    // smoke app）无 src 不算 app，跳过不报（与 check-routes 的「有 src 必有 X」守卫同口径）
    .filter((entry) => existsSync(path.join(APPS_DIR, entry.name, 'src')))
    .map((entry) => entry.name)
  if (unconfigured.length > 0) {
    console.error(
      `❌ apps/${unconfigured.join('、')} 缺少 tsconfig.app.json（generate-tsconfig-paths 已静默跳过其 paths 生成）\n   先为该 app 建 tsconfig.app.json（仿 apps/big/tsconfig.app.json 骨架），再跑 pnpm generate:tsconfig-paths`
    )
    process.exit(1)
  }

  if (appRoots.length === 0) {
    console.error(`❌ ${APPS_DIR} 下未找到任何 tsconfig.app.json`)
    process.exit(1)
  }

  const failed = appRoots.filter((root) => !processApp(root, isCheck))
  if (failed.length > 0) {
    process.exit(1)
  }
}

// 入口判断：用绝对路径比对，兼容 Windows / POSIX
const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : ''
const modulePath = fileURLToPath(import.meta.url)
if (entryPath && entryPath === modulePath) {
  main()
}
