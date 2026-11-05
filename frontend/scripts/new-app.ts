#!/usr/bin/env node
// 应用脚手架（P2 应用 manifest 与脚手架——设计：docs/superpowers/specs/2026-10-27-app-manifest-scaffolding-design.md §7）
//
// 用途：生成「可独立 dev / build / test」的最小公开应用骨架（公开 Home 首页 + 站内 NotFound）。
//   1. 预检（全部通过才写盘，任一失败即报错退出、不写任何文件）：
//      - 名称 kebab-case（与 app.manifest.json 契约同正则）
//      - apps/<name>/ 不存在（拒绝覆盖）
//      - 端口分配：现有 manifest 最大 port + 1（跳过网关 8080）；apps/ 无 manifest 时回退 5174
//   2. 渲染 scripts/templates/app/ → apps/<name>/（__APP_NAME__ / __APP_PORT__ / __ROUTE_NAME__ 替换）
//   3. 只写新目录——不改其他 app / apps-registry.mjs（它自动 discover manifest）/ CI / 根 package.json
//   4. 输出下一步：pnpm install → pnpm -C apps/<name> dev → pnpm check:routes
//
// 用法：pnpm new-app <kebab-name>
// 例如：pnpm new-app ops-center
//
// 模板形态约束（scripts/templates/app/ 会被 lint-staged 的 prettier/eslint 处理）：
//   - app.manifest.json 的 port 用带引号占位符 "__APP_PORT__"（裸占位符是非法 JSON，
//     prettier 解析即炸）；替换时连引号一起换成裸数字
//   - 模板 tsconfig.app.json 与 apps/docs 逐字一致（check:aliases 按 createAppAliases
//     单源重算 hash 校验；各 app 同目录深度 → 相对 paths 同形）

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { discoverAppManifests } from '../packages/config/src/app-manifest.mjs'

const ROOT = resolve(import.meta.dirname, '..')
const APPS_DIR = resolve(ROOT, 'apps')
const TEMPLATE_DIR = resolve(ROOT, 'scripts/templates/app')

/** 本地同域网关端口（scripts/node-gateway.ts）——app 端口分配必须避开 */
const GATEWAY_PORT = 8080
/** 首个 app 的起始端口（@vv/config SERVER_DEFAULTS.port——apps/ 尚无 manifest 时的回退） */
const FIRST_APP_PORT = 5174

function kebabToPascal(s: string): string {
  return s.replace(/(^|-)(\w)/g, (_, __, c: string) => c.toUpperCase())
}

/** 校验应用名（kebab-case，与 app.manifest.json 契约同正则）。非法时抛错。 */
export function validateAppName(name: string): void {
  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    throw new Error(
      `应用名必须是 kebab-case：以小写字母开头，仅含小写字母/数字/短横线\n` +
        `  当前: "${name}"\n` +
        `  正确示例: ops-center  /  data-hub  /  report2`
    )
  }
}

/**
 * 端口分配：现有 manifest 最大 port + 1；撞网关 8080 则再 +1。
 * appsDir 不存在或无任何 manifest 时回退 FIRST_APP_PORT（首个 app）。
 * 「未被占用」按 workspace 静态语义判定（> 现有最大端口即不与任何已登记 app 冲突）；
 * OS 级端口占用不做探测（dev 启动时 vite 自会报 EADDRINUSE）。
 * discoverAppManifests 自带重复 port / 非法 manifest fail fast。
 */
export function allocatePort(appsDir: string): number {
  if (!existsSync(appsDir)) return FIRST_APP_PORT
  const manifests = discoverAppManifests(appsDir)
  if (manifests.length === 0) return FIRST_APP_PORT
  let port = Math.max(...manifests.map((m) => m.port)) + 1
  if (port === GATEWAY_PORT) port += 1
  if (port > 65535) {
    throw new Error(`端口分配越界：${port} 超出 65535（现有最大 port ${port - 1}）`)
  }
  return port
}

/** 模板占位符变量集 */
export interface ScaffoldVars {
  /** kebab-case 应用名（= 目录名 = manifest.name = 包名 @vv-app/<name> 后缀） */
  appName: string
  /** 分配的 dev 端口（manifest.port / vite dev / HMR 单源） */
  port: number
  /** PascalCase 名（白名单谓词 is<RouteName>WhiteListed 等标识符用） */
  routeName: string
}

/**
 * 占位符替换对（顺序敏感：带引号的 "__APP_PORT__" 先于裸 __APP_PORT__）。
 * 带引号形态服务 app.manifest.json（模板保持合法 JSON）；裸形态服务注释/文档性引用。
 */
function buildReplacements(vars: ScaffoldVars): ReadonlyArray<readonly [string, string]> {
  return [
    ['"__APP_PORT__"', String(vars.port)],
    ['__APP_PORT__', String(vars.port)],
    ['__ROUTE_NAME__', vars.routeName],
    ['__APP_NAME__', vars.appName],
  ]
}

/**
 * 递归渲染模板目录到目标目录：逐文件读取 → 按占位符替换 → 写入（保留相对路径）。
 * 写完后校验无 __XXX__ 占位符残留（模板新增占位符忘了在 buildReplacements 接线时 fail fast）。
 *
 * @returns 写入文件的相对路径清单（POSIX 分隔符，便于跨平台断言与打印）
 */
export function renderTemplates(
  templateDir: string,
  targetDir: string,
  vars: ScaffoldVars
): string[] {
  const replacements = buildReplacements(vars)
  const written: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const srcPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(srcPath)
        continue
      }
      const rel = relative(templateDir, srcPath).split(sep).join('/')
      let content = readFileSync(srcPath, 'utf-8')
      for (const [search, replace] of replacements) content = content.split(search).join(replace)
      const residue = content.match(/__[A-Z_]+__/)
      if (residue) {
        throw new Error(`模板 ${rel} 存在未替换占位符 ${residue[0]}（buildReplacements 未接线）`)
      }
      const destPath = join(targetDir, rel)
      mkdirSync(dirname(destPath), { recursive: true })
      writeFileSync(destPath, content, 'utf-8')
      written.push(rel)
    }
  }
  walk(templateDir)
  return written
}

export interface ScaffoldResult {
  appDir: string
  port: number
  files: string[]
}

/**
 * 脚手架主逻辑（预检全过才写盘，任何一步失败不写任何文件）：
 * kebab 校验 → 目录不存在校验 → 端口分配 → 模板渲染。
 * appsDir / templateDir 可注入（单测用临时目录，不读写真实 apps/）。
 */
export function scaffoldApp(
  name: string,
  appsDir: string = APPS_DIR,
  templateDir: string = TEMPLATE_DIR
): ScaffoldResult {
  validateAppName(name)
  const appDir = join(appsDir, name)
  if (existsSync(appDir)) {
    throw new Error(`应用 "${name}" 已存在：${appDir}（拒绝覆盖任何文件）`)
  }
  const port = allocatePort(appsDir)
  const files = renderTemplates(templateDir, appDir, {
    appName: name,
    port,
    routeName: kebabToPascal(name),
  })
  return { appDir, port, files }
}

/** 输出用户下一步的手动清单（install 链接 / dev / 路由校验 / 加模块）。 */
function printNextSteps(name: string, port: number): void {
  console.log('')
  console.log('🎉 应用骨架生成完成（最小公开应用：公开 Home 首页 + 站内 404）！')
  console.log('')
  console.log('▶ 接下来：')
  console.log('')
  console.log('  1. pnpm install（建立 workspace 链接）')
  console.log('')
  console.log(`  2. pnpm -C apps/${name} dev，本地访问 http://localhost:${port}/home`)
  console.log('')
  console.log(
    '  3. pnpm check:routes 验证路由一致性（新 app 自动纳入校验，requiredRoutes 含 NotFound）'
  )
  console.log('')
  console.log(`  4. 加业务模块：pnpm new-module <kebab-name> --app ${name}`)
  console.log('')
}

// ─── 入口 ─────────────────────────────────────────────────────────

/** 完整用法输出（/autoplan D8：原无参仅一行用法；--help / 无参均输出本帮助） */
function printUsage(): void {
  console.log(`用法: pnpm new-app <kebab-name>

一键生成可 dev/build/test 的最小公开应用（公开 Home + 站内 404）。

参数:
  <kebab-name>        应用名（kebab-case，必须等于未来目录名）

行为:
  - 预检（名称合法 / 目录不存在 / 端口 = 现有 manifest 最大 port + 1 自动分配，
    跳过网关 8080）全过才写盘
  - 注册表 / 网关路由 / check-routes / eslint 边界经 discoverAppManifests 自动派生，
    零手改注册

示例:
  pnpm new-app ops-center
  pnpm install            # 锁 workspace 链接
  pnpm -C apps/ops-center dev
  pnpm check:routes       # manifest 完整性自动覆盖新 app

详见 docs/43 §4 新增应用流程`)
}

function main(): void {
  const name = process.argv[2]
  if (name === '--help' || name === '-h') {
    printUsage()
    process.exit(0)
  }
  if (!name) {
    printUsage()
    process.exit(1)
  }
  try {
    const { port, files } = scaffoldApp(name)
    console.log(`📦 新建应用：${name}（@vv-app/${name}，dev 端口 ${port}）`)
    for (const f of files) console.log(`  ✓ ${f}`)
    printNextSteps(name, port)
  } catch (err) {
    console.error(`✖ ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }
}

// 入口判断（与 generate-tsconfig-paths.ts 同形态）：被 new-app.spec.ts import 时不执行 main
const entryPath = process.argv[1] ? resolve(process.argv[1]) : ''
if (entryPath && entryPath === fileURLToPath(import.meta.url)) {
  main()
}
