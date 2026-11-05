#!/usr/bin/env node
// 模块拆卸
//
// 用途：与 scripts/new-module.ts 对偶的移除命令。
//   1. 验证 kebab-case 命名 + --app 目标应用（默认 admin）
//   2. 检查 apps/<app>/src/modules/<name>/ 存在（不存在则报错）
//   3. 收集"将删清单"：模块目录 + mock/<name>.ts + locales menu.<name> 死键
//   4. dry-run：打印清单 + 计数；非 --force 时 stdin 询问 y/N
//   5. 执行：rmSync 删目录与 mock + 改写 locales 文件移除 key
//
// 不需清理的位置（架构自动收敛）：
//   - 路由：src/router/auto-register.ts 用 import.meta.glob 扫描 routes/index.ts，
//     目录删除后路由自动从表里消失
//   - types.ts RouteName：项目已改为 string alias，无联合类型需同步
//   - component-registry.ts：已被 auto-register 派生映射替代
//
// P5-A 变更：目标路径从 apps/admin/src/modules 参数化为 apps/<app>/src/modules（--app 指定）。
//
// 用法：
//   pnpm remove-module <kebab-case-name> [--app <app-name>]           # 交互式确认
//   pnpm remove-module <kebab-case-name> --app portal --force         # 跳过 y/N（适合 CI）
//   pnpm remove-module <kebab-case-name> --force                      # 管道/CI 环境必须传 --force

import { existsSync, readFileSync, writeFileSync, rmSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const APPS_DIR = resolve(ROOT, 'apps')
const MOCK_DIR = resolve(ROOT, 'mock')

/**
 * 列出 apps/ 下所有含 src/modules/ 的合法目标应用（与 check-routes 同口径）。
 * 用于 --app 校验的错误提示。
 */
function listValidApps(): string[] {
  return readdirSync(APPS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(APPS_DIR, entry.name, 'src/modules')))
    .map((entry) => entry.name)
    .sort()
}

/**
 * 校验 --app 目标应用存在且含 src/modules/。错误时打印合法应用列表并 process.exit(1)。
 */
function resolveAppModulesDir(app: string): string {
  const appModulesDir = join(APPS_DIR, app, 'src/modules')
  if (!existsSync(appModulesDir)) {
    console.error(`✖ 目标应用 "${app}" 不存在或缺少 src/modules/：${appModulesDir}`)
    console.error(`  合法应用：${listValidApps().join(' / ')}`)
    process.exit(1)
  }
  return appModulesDir
}

/**
 * 解析 argv。支持 `--app <app-name>`（默认 admin）与 `--force` flag 跳过交互确认。
 * 错误时 process.exit(1)。
 */
function parseArgs(argv: string[]): { name: string; app: string; force: boolean } {
  const args = argv.slice(2)
  const rest: string[] = []
  let app = 'admin'
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!
    if (arg === '--app') {
      const value = args[++i]
      if (!value || value.startsWith('--')) {
        console.error('✖ --app 需要一个应用名（如 --app admin）')
        process.exit(1)
      }
      app = value
    } else if (arg.startsWith('--app=')) {
      app = arg.slice('--app='.length)
    } else {
      rest.push(arg)
    }
  }
  const flags = new Set(rest.filter((a) => a.startsWith('--')))
  const positional = rest.filter((a) => !a.startsWith('--'))
  const name = positional[0]
  if (!name) {
    console.error('✖ 用法: pnpm remove-module <kebab-case-name> [--app <app-name>] [--force]')
    console.error('  示例: pnpm remove-module orders')
    console.error('         pnpm remove-module orders --app admin --force   # CI 脚本')
    process.exit(1)
  }
  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    console.error(`✖ 模块名必须是 kebab-case：以小写字母开头，仅含小写字母/数字/短横线`)
    console.error(`  当前: "${name}"`)
    process.exit(1)
  }
  return { name, app, force: flags.has('--force') }
}

/** 检查 stdin 是否是 TTY（管道 / CI 环境为 false）。 */
function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY)
}

/**
 * 从 locales/<locale>.ts 的 menu 段移除 `${name}: '...',` 行。
 * 通过正则精确匹配单行避免误伤其他 key（name 已校验 kebab-case）。
 *
 * @returns true 表示实际改写了文件；false 表示 key 不存在。
 */
function removeI18nKey(localePath: string, name: string): boolean {
  if (!existsSync(localePath)) return false
  let content = readFileSync(localePath, 'utf-8').replace(/\r\n/g, '\n')
  const keyAlt = `(?:'${name}'|${name})`

  // 兼容单行 / 多行 menu 段。
  // 单行 menu: { a: 'v', target: 'val' } —— 行内字符串替换
  // 多行 menu: target 独立成行 —— 按行过滤
  // key 含 `-` 时 syncI18nKeys 会自动加引号包裹（避免 TS 非法标识符），这里兼容两种形式
  const inlineRe = new RegExp(`,\\s*${keyAlt}:\\s*'[^']*'`, 'g')
  const firstRe = new RegExp(`\\{\\s*${keyAlt}:\\s*'[^']*'(?:,\\s*)?(?=\\s*\\})`, 'g')

  if (inlineRe.test(content)) {
    content = content.replace(inlineRe, '')
  } else if (firstRe.test(content)) {
    content = content.replace(firstRe, '')
  } else {
    const lines = content.split('\n')
    const lineRe = new RegExp(`^\\s*${keyAlt}:\\s*'`)
    const filtered = lines.filter((line) => !lineRe.test(line))
    if (filtered.length === lines.length) return false
    writeFileSync(localePath, filtered.join('\n'), 'utf-8')
    return true
  }
  writeFileSync(localePath, content, 'utf-8')
  return true
}

/** 在终端打印"确认删除？(y/N): "并读一行。管道 / CI 环境应传 --force。 */
async function askConfirm(): Promise<boolean> {
  if (!isInteractive()) {
    console.error('✖ 非交互式终端（CI / 管道）必须传 --force 跳过确认')
    process.exit(1)
  }
  process.stdout.write('确认删除？(y/N): ')
  return new Promise((resolve) => {
    let input = ''
    process.stdin.setEncoding('utf-8')
    process.stdin.once('data', (chunk) => {
      input += chunk
      process.stdin.pause()
      resolve(input.trim().toLowerCase() === 'y')
    })
  })
}

/** 收集"将删清单"：模块目录 + mock 文件（可选）+ i18n 死键（可选）。 */
function collectTargets(name: string, app: string, localesDir: string): string[] {
  const targets: string[] = []
  targets.push(`apps/${app}/src/modules/${name}/`)
  const mockPath = join(MOCK_DIR, `${name}.ts`)
  if (existsSync(mockPath)) targets.push(`mock/${name}.ts`)
  for (const locale of ['zh-CN', 'en-US'] as const) {
    const localePath = join(localesDir, `${locale}.ts`)
    if (!existsSync(localePath)) continue
    const content = readFileSync(localePath, 'utf-8')
    // 检测 key 在 `^` 行首 / `{` 后 / `,` 后三种位置，覆盖单行与多行 menu 段
    if (new RegExp(`(?:^\\s*|[,{]\\s*)(?:'${name}'|${name}):\\s*'`, 'm').test(content)) {
      targets.push(`apps/${app}/src/locales/${locale}.ts 的 menu.${name} 键`)
    }
  }
  return targets
}

// ─── 入口 ─────────────────────────────────────────────────────────

const { name, app, force } = parseArgs(process.argv)
const MODULES_DIR = resolveAppModulesDir(app)
const LOCALES_DIR = join(APPS_DIR, app, 'src/locales')
const moduleDir = join(MODULES_DIR, name)

if (!existsSync(moduleDir)) {
  console.error(`✖ 模块 "${name}" 不存在：${moduleDir}`)
  process.exit(1)
}

const targets = collectTargets(name, app, LOCALES_DIR)

console.log(`📦 将删除模块：${name}（app: ${app}）`)
console.log('')
console.log('将影响以下文件 / 键：')
for (const item of targets) console.log(`  · ${item}`)
console.log(`  共 ${targets.length} 项`)
console.log('')

if (!force) {
  const ok = await askConfirm()
  if (!ok) {
    console.log('已取消，未做任何变更')
    process.exit(0)
  }
}

// 执行删除。locales 读写失败会自然抛出，避免半完成状态。
rmSync(moduleDir, { recursive: true, force: true })
console.log(`  ✓ 删除 apps/${app}/src/modules/${name}/`)

const mockPath = join(MOCK_DIR, `${name}.ts`)
if (existsSync(mockPath)) {
  rmSync(mockPath, { force: true })
  console.log(`  ✓ 删除 mock/${name}.ts`)
}

for (const locale of ['zh-CN', 'en-US'] as const) {
  const localePath = join(LOCALES_DIR, `${locale}.ts`)
  if (removeI18nKey(localePath, name)) {
    console.log(`  ✓ 从 apps/${app}/src/locales/${locale}.ts 移除 menu.${name}`)
  }
}

console.log('')
console.log(`🎉 模块 "${name}" 已移除`)
console.log('')
console.log('▶ 接下来手动做的事：')
console.log(`  1. 跑 pnpm check:routes 验证路由一致性`)
console.log(`  2. 跑 pnpm type-check:full 确认无遗留类型错误`)
console.log(`  3. git diff 检查是否还有其他未提交的相关改动`)
