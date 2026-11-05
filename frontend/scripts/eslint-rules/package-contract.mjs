/**
 * packages/* 依赖契约检查（本地 ESLint 规则，error 级）。
 *
 * 检查对象：packages/<pkg>/ 下 .ts/.mts/.tsx/.vue 的静态 import、re-export（export ... from）
 * 与字面量动态 import。
 *
 * 契约：
 * 1. 生产源码的值导入必须声明在 dependencies / peerDependencies；纯类型导入与
 *    spec/test/.d.ts/vite|vitest.config 文件允许落在 devDependencies
 *    （类型在编译期擦除，不构成运行时依赖）
 * 2. @vv/* 方向铁律：mock → shared、ui → shared；shared/config 不依赖任何 @vv 包；
 *    自引用（@vv/x 内部 import '@vv/x/...'）合法
 * 3. 相对路径 / node builtins / virtual:* / 项目既定别名不是 npm 包，跳过
 *
 * 已知边界（2026-10-28 /autoplan R2-E9，刻意取舍）：
 * - 仅查字面量说明符：变量动态 import（`import(name)`）无法静态解析包名，
 *   静默放行（spec 已固化为合法）——覆盖率换零误报；
 * - `#` 前缀的 Node subpath imports 当前会被当包名误报 undeclared——本仓未启用
 *   package.json imports 字段，启用时需先在包名解析处排除 `#` 前缀。
 *
 * 为什么不引新依赖：规则只需「说明符 → 包名 → 读所属包 manifest」三步，Node 内置足够。
 */
import { readFileSync } from 'node:fs'
import { builtinModules } from 'node:module'
import path from 'node:path'

const BUILTINS = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)])

/** @vv/* 允许方向：键 = 当前包，值 = 允许依赖的 @vv/* 集合（新增包必须先登记） */
const VV_DIRECTION = {
  '@vv/shared': new Set(),
  '@vv/config': new Set(),
  '@vv/ui': new Set(['@vv/shared']),
  '@vv/mock': new Set(['@vv/shared']),
}

/** 项目既定别名（CLAUDE.md §1.6.2 既有例外）——不是 npm 包名 */
const ALIAS_PREFIXES = [
  '@api',
  '@assets',
  '@components',
  '@composables',
  '@directives',
  '@enums',
  '@layouts',
  '@locales',
  '@mock',
  '@modules',
  '@plugins',
  '@router',
  '@store',
  '@utils',
]

/** spec / 测试 / bench / 声明 / 配置 / test-utils 目录：测试与基准基建，允许消费 devDependencies */
const DEV_OK_PATTERN =
  /\.(spec|test|bench)\.[cm]?[jt]sx?$|\.d\.[cm]?ts$|(?:vite|vitest|uno)\.config\.[cm]?[jt]s$|[/\\]test-utils[/\\]/

/**
 * 构建装配配置（vite|vitest.config）：跑在 Node 工具链、不进浏览器产物——
 * 豁免 @vv/* 方向检查（vitest.config 消费 @vv/config 工厂是既定合法形态），
 * 但仍走声明检查。spec/test 文件不豁免（测试里的反向 import 同样腐蚀方向）。
 */
const CONFIG_FILE_PATTERN = /(?:^|[/\\])(?:vite|vitest|uno)\.config\.[cm]?[jt]s$/

const manifestCache = new Map()

function isProjectAlias(spec) {
  if (spec.startsWith('@/')) return true
  return ALIAS_PREFIXES.some((alias) => spec === alias || spec.startsWith(`${alias}/`))
}

function packageNameOf(spec) {
  const segs = spec.split('/')
  return spec.startsWith('@') ? `${segs[0]}/${segs[1]}` : segs[0]
}

/** 从文件路径定位所属 packages/<name>/ 或 apps/<name>/ 并读取其 package.json（带缓存；读不到返回 null → 规则静默跳过） */
function locatePackage(filename) {
  const parts = path.resolve(filename).split(path.sep)
  // 锚点：packages 或 apps（2026-10-28 C4 扩展——app 消费侧同样纳入依赖声明契约）
  let idx = -1
  for (const anchor of ['packages', 'apps']) {
    const i = parts.lastIndexOf(anchor)
    if (i !== -1 && (idx === -1 || i < idx)) idx = i
  }
  if (idx === -1 || idx >= parts.length - 1) return null
  const dir = parts.slice(0, idx + 2).join(path.sep)
  if (!manifestCache.has(dir)) {
    try {
      manifestCache.set(dir, JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')))
    } catch {
      manifestCache.set(dir, null)
    }
  }
  const manifest = manifestCache.get(dir)
  return manifest ? { dirName: parts[idx + 1], host: parts[idx], manifest } : null
}

/** 返回声明所在字段名；未声明返回 null。allowDev 时 devDependencies 也算合法 */
function declaredField(manifest, pkgName, allowDev) {
  if (manifest.dependencies?.[pkgName]) return 'dependencies'
  if (manifest.peerDependencies?.[pkgName]) return 'peerDependencies'
  if (allowDev && manifest.devDependencies?.[pkgName]) return 'devDependencies'
  return null
}

export default {
  meta: {
    type: 'problem',
    docs: { description: 'packages/* 依赖声明与 @vv/* 包间方向契约' },
    schema: [],
    messages: {
      undeclared:
        "{{host}}/{{dirName}} 的 '{{pkgName}}' 未声明：dependencies / peerDependencies{{devHint}} 中均不存在 → 修复：把 '{{pkgName}}' 加进该 package.json 的 dependencies（apps 运行时依赖）或 peerDependencies（packages 库）",
      forbiddenDirection:
        "packages/{{dirName}} 禁止依赖 '{{pkgName}}'（@vv/* 方向铁律：mock → shared、ui → shared，其余组合禁止）",
      unknownVvPackage: "'{{pkgName}}' 不在 @vv/* 方向表（VV_DIRECTION）——新增包须先在本规则登记方向",
    },
  },
  create(context) {
    const pkg = locatePackage(context.physicalFilename ?? context.filename)
    if (!pkg) return {}
    const ownName = pkg.manifest.name
    const allowDevByFile = DEV_OK_PATTERN.test(context.filename)
    const isConfigFile = CONFIG_FILE_PATTERN.test(context.filename)

    function check(spec, node, isTypeImport) {
      if (typeof spec !== 'string') return
      if (spec.startsWith('.') || path.isAbsolute(spec) || spec.startsWith('virtual:')) return
      if (spec.startsWith('node:') || BUILTINS.has(spec)) return
      if (isProjectAlias(spec)) return
      const pkgName = packageNameOf(spec)
      if (pkgName === ownName) return
      // @vv/* 方向铁律只约束 packages/*（库间依赖）；apps/* 作为最终宿主可消费全部 @vv/*（2026-10-28 C4）
      if (pkgName.startsWith('@vv/') && !isConfigFile && pkg.host === 'packages') {
        if (!(pkgName in VV_DIRECTION)) {
          context.report({ node, messageId: 'unknownVvPackage', data: { pkgName } })
          return
        }
        if (!VV_DIRECTION[ownName]?.has(pkgName)) {
          context.report({ node, messageId: 'forbiddenDirection', data: { pkgName, dirName: pkg.dirName } })
          return
        }
      }
      const allowDev = allowDevByFile || isTypeImport
      if (!declaredField(pkg.manifest, pkgName, allowDev)) {
        context.report({
          node,
          messageId: 'undeclared',
          data: { pkgName, dirName: pkg.dirName, host: pkg.host, devHint: allowDev ? ' / devDependencies' : '' },
        })
      }
    }

    return {
      ImportDeclaration(node) {
        check(node.source.value, node.source, node.importKind === 'type')
      },
      ExportNamedDeclaration(node) {
        if (node.source) check(node.source.value, node.source, node.exportKind === 'type')
      },
      ExportAllDeclaration(node) {
        check(node.source.value, node.source, node.exportKind === 'type')
      },
      ImportExpression(node) {
        if (node.source.type === 'Literal') check(node.source.value, node.source, false)
      },
    }
  },
}
