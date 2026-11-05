#!/usr/bin/env node
// 路由配置一致性校验（Monorepo 多应用版）
//
// 用途：检查各应用（apps/*）的路由相关源头是否一致，任何不一致都会让 CI 失败。
//   1. apps/<a>/src/router/whitelist.ts 中的 ROUTE_WHITE_LIST（白名单）
//   2. apps/<a>/src/modules/*/routes/index.ts 中的 name 字段（实现）
//   3. apps/<a>/src/router/index.ts 中的根级具名路由（如 NotFound 兜底页）
//
// 多应用语义（P5-A）：
//   - 自动发现 apps/ 下含 src/modules/ 的应用，逐 app 独立校验、按 app 分组输出
//   - whitelist 支持 `...xxxRouteNames` 展开语法：经 import 表解析到
//     `@/modules/<m>/routes`，用该模块 routes 的实际 name 展开（与运行时吸收行为一致）
//   - 系统兜底名单按 app 注册表差异化（B/C 校验），单一事实源 scripts/apps-registry.mjs：
//       auth → ['Login', 'NotFound']（登录路由宿主 + 登出落地页匿名可达）
//       admin → ['Forbidden', 'NotFound', 'ServerError']（系统错误页宿主）
//       其余 app（docs/portal/h5/big）→ ['NotFound']（全公开 app 只有 404 兜底）
//   - 路由检查收尾时自动复跑 manifest 完整性校验（有 src 必有 app.manifest.json，CI 单点覆盖；
//     原「端口双写锁死」随 P2 消灭——端口已单源到 manifest，无双写可锁）
//
// 5 个校验（语义与单应用时代一致，逐 app 执行）：
//   A. whitelist ⊆ implementedNames（白名单元素必须有 route 实现）
//   B. 系统兜底名单 ⊆ whitelist（任何项目都必须能匿名访问的兜底）
//   C. 系统兜底名单 ⊆ implementedNames（兜底页面必须有真实路由）
//   D. 双向一致性最终汇总
//   E. 注册表反向校验：apps/ 下发现的应用必须登记 apps-registry.mjs（防静默失效）
// 收尾另跑 manifest 完整性校验（原端口双写锁死已随 P2 消灭——端口单源到 app.manifest.json；
// 网关路由表由 scripts/node-gateway.ts 的 buildGatewayRoutes(APPS) 单源代码派生，无第二事实源）
//
// 设计变更（2026-07-24 方案 A）：
//   - 移除 RouteName 联合类型校验（types.ts RouteName 改为 string alias）
//   - 单一事实源：modules/<feature>/routes/index.ts 的 name 字段
//   - auto-register.ts 自动捕获（Vite 编译期 import.meta.glob）
//
// 用法：pnpm check:routes
// 失败退出码：1（可在 CI 阶段阻断）

import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { APPS } from './apps-registry.mjs'

const ROOT = resolve(import.meta.dirname, '..')
const APPS_DIR = resolve(ROOT, 'apps')

/**
 * 发现所有含 src/modules/ 的应用目录（apps/* 下的独立应用）。
 * docs/h5/big/portal/auth/admin 均在此列；未来新增 app 只要建了 src/modules 即自动纳入校验。
 */
export function discoverApps(): string[] {
  return readdirSync(APPS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(APPS_DIR, entry.name, 'src/modules')))
    .map((entry) => entry.name)
    .sort()
}

/**
 * B/C 校验的系统兜底名单：由 app 注册表（scripts/apps-registry.mjs）派生，
 * 名单语义（可匿名访问的兜底路由）在注册表条目注释中说明；未登记的 app 不校验。
 */
export function requiredFor(app: string): readonly string[] {
  return APPS.find((entry) => entry.name === app)?.requiredRoutes ?? []
}

/**
 * 端口双写锁死：apps-registry.mjs 的绝对 port 与各 app vite.config.ts 的 portOffset
 * 是同一事实的两处手写（port = SERVER_DEFAULTS.port + offset），历史上无任何静态
 * 校验——dev 直启时实际端口与注册表漂移，表现是「某 app 经网关 404 / waitForPort 超时」
 * 且报错现象指向网络层，排查成本高。此处静态锁死，漂移即 CI 红。
 * （2026-10-26 自 scripts/check-gateway-conf.ts 迁入：nginx 网关配置校验随 node 网关
 * 方案删除，本校验与 nginx 无关故保留）
 */
/**
 * manifest 完整性校验（P2，2026-10-27）：app 元数据单源是各 app 的 app.manifest.json——
 * apps/ 下每个含 src 的 app 必须登记 manifest（否则 ESLint 边界/网关路由/requiredRoutes
 * 校验静默跳过它）；有 manifest 但无 src 是孤儿。原「端口双写锁死」（apps-registry port ↔
 * vite.config portOffset）随 P2 消灭：端口已单源到 manifest，无双写可锁。
 */
export function validateManifestPresence(): string[] {
  const errors: string[] = []
  const appsDir = resolve(ROOT, 'apps')
  for (const entry of readdirSync(appsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const appDir = join(appsDir, entry.name)
    const hasSrc = existsSync(join(appDir, 'src'))
    const hasManifest = existsSync(join(appDir, 'app.manifest.json'))
    if (hasSrc && !hasManifest) {
      errors.push(
        `apps/${entry.name} 有 src 但缺 app.manifest.json（ESLint 边界 / 网关路由 / requiredRoutes 校验将静默跳过它）`
      )
    }
    if (!hasSrc && hasManifest) {
      errors.push(`apps/${entry.name} 有 app.manifest.json 但无 src（孤儿 manifest）`)
    }
  }
  return errors
}

/**
 * nginx 生产模板 app 名单对账（/autoplan Round 3 R3-E2，2026-10-29）：
 * deploy/nginx.prod.conf.template 手写 6 app 名单（assets 缓存正则 + 逐 app location 块），
 * 是 apps-registry 之外的第二事实源——第 7 app 上线时模板未同步 = 该 app 生产 404
 * （Round 3 R3-F2，子代理原话「dev 侧被单源消灭的双写在生产面完整保留」）。
 * 从 assets 正则提取模板自认名单，与注册表名单双向比对；每个注册表 app 还须有
 * 专属 location 块。模板文件不存在（fork 裁剪部署面）时由 main 跳过，不报错。
 */
export function validateNginxTemplateApps(
  content: string,
  expectedApps: readonly string[]
): string[] {
  const errors: string[] = []
  // assets 缓存正则：location ~* ^/(admin|auth|portal|h5|big|docs)/assets/...
  const assetsMatch = content.match(/location\s+~\*\s+\^\/\(([^)]+)\)\/assets\//)
  if (!assetsMatch) {
    errors.push(
      'nginx 模板缺 assets 缓存正则（location ~* ^/(…)/assets/）——模板结构被改动，无法提取模板 app 名单'
    )
    return errors
  }
  const templateApps = assetsMatch[1]!
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)
  const missingInTemplate = expectedApps.filter((a) => !templateApps.includes(a))
  const extraInTemplate = templateApps.filter((a) => !expectedApps.includes(a))
  if (missingInTemplate.length > 0) {
    errors.push(
      `nginx 模板缺 app：${missingInTemplate.join(' / ')} → assets 缓存正则与 location 块按注册表名单补齐（漏 = 该 app 生产 404）`
    )
  }
  if (extraInTemplate.length > 0) {
    errors.push(
      `nginx 模板多出手写 app：${extraInTemplate.join(' / ')} → 注册表已无这些 app，从 assets 正则与 location 块删除`
    )
  }
  for (const app of expectedApps) {
    if (!content.includes(`location /${app}/ {`)) {
      errors.push(`nginx 模板缺 location /${app}/ 块（静态托管 + history SPA fallback）`)
    }
  }
  return errors
}

/**
 * 一致性豁免前缀——以这些字符串开头的路由 name 跳过 A/D 两处一致性校验。
 *
 * 适用场景：动态/可选模块（docs 的 demo 路由虽经 routeNames 吸收全量白名单，
 * 仍保留豁免以兼容未来"故意不枚举"的可选模块）。新增同类模块时只需在此追加前缀。
 */
export const EXEMPT_PREFIXES: readonly string[] = ['Demo']

export function isExempt(name: string): boolean {
  return EXEMPT_PREFIXES.some((prefix) => name.startsWith(prefix))
}

/** 读取应用内文件统一换行符（Windows CRLF → LF），避免正则 ^ 锚点跨平台失效 */
export function readAppText(app: string, relativePath: string): string {
  return readFileSync(join(APPS_DIR, app, relativePath), 'utf-8').replace(/\r\n/g, '\n')
}

/** 提取 routes 文件中的所有 `name: 'Xxx'` 字段（兼容 `name: 'Xxx',` 与行尾无逗号） */
export function extractRouteNames(content: string): string[] {
  const matches = [...content.matchAll(/name:\s*'([A-Za-z][\w-]*)'/g)]
  return [...new Set(matches.map((m) => m[1]!))]
}

/**
 * 提取应用内所有已实现的路由 name。
 *
 * 扫描模拟 src/router/auto-register.ts 的 import.meta.glob 行为：
 *   - 仅扫描 `src/modules/<dir>/routes/index.ts`（不是 routes.ts）
 *   - 嵌套 children 中的 name 同样提取（业务可能写多级菜单）
 *   - 附加扫描 `src/router/index.ts` 的根级具名路由：各 app 的 NotFound 兜底页
 *     在 router/index.ts 注册（非 modules），不纳入会让 auth/portal 等全公开 app 的
 *     A 校验误报"白名单 NotFound 无实现"
 */
export function extractImplementedNames(app: string): Set<string> {
  const names = new Set<string>()
  const modulesDir = join(APPS_DIR, app, 'src/modules')
  for (const moduleDir of readdirSync(modulesDir)) {
    const routesFile = join(modulesDir, moduleDir, 'routes/index.ts')
    let content: string
    try {
      content = readFileSync(routesFile, 'utf-8').replace(/\r\n/g, '\n')
    } catch {
      // 模块没有 routes 子目录或文件，跳过（不是所有模块都必须有路由）
      continue
    }
    for (const n of extractRouteNames(content)) names.add(n)
  }
  try {
    for (const n of extractRouteNames(readAppText(app, 'src/router/index.ts'))) names.add(n)
  } catch {
    // 无 router/index.ts（理论不存在）则仅依据 modules 扫描结果
  }
  return names
}

/**
 * 提取 ROUTE_WHITE_LIST 生效名单（三种形态）。
 *
 * whitelist.ts 三种形态：
 *   1. createWhiteList('NotFound', xxxRouteNames)——5 公开 app 收敛形态（2026-10-23），
 *      字面量 + 数组引用混传（createWhiteList 拍平嵌套）
 *   2. 吸收展开（遗留形态，与新 Set 同结构）：
 *        import { routeNames as authRouteNames } from '@/modules/auth/routes'
 *        new Set<string>([ 'NotFound', ...authRouteNames ])
 *   3. 纯字面量（admin）：new Set<string>([ 'Forbidden', ... ])
 *
 * 展开条目按 import 表解析到具体模块，用该模块 routes 文件的实际 name 展开——
 * 与运行时"routeNames 全量吸收进白名单"的行为严格一致。
 */
export function extractWhitelist(content: string, app: string): Set<string> {
  const names = new Set<string>()

  // import { routeNames as <alias> } from '@/modules/<module>/routes'
  const aliasToModule = new Map<string, string>()
  const importRe =
    /import\s*\{\s*routeNames\s+as\s+(\w+)\s*\}\s*from\s*'@\/modules\/([\w-]+)\/routes'/g
  for (const m of content.matchAll(importRe)) aliasToModule.set(m[1]!, m[2]!)

  const expandAlias = (alias: string): void => {
    const moduleName = aliasToModule.get(alias)
    if (!moduleName) return
    try {
      for (const n of extractRouteNames(
        readAppText(app, `src/modules/${moduleName}/routes/index.ts`)
      )) {
        names.add(n)
      }
    } catch {
      // 展开指向的模块无 routes 文件：运行时吸收为空集，此处同样忽略
    }
  }

  // 形态 1：createWhiteList(...args)（参数区无嵌套括号，首个 ) 即闭合；去行注释后提取）
  const clMatch = content.match(/createWhiteList\s*\(([^)]*)\)/s)
  if (clMatch) {
    const argsText = clMatch[1]!.replace(/\/\/[^\n]*/g, '')
    for (const m of argsText.matchAll(/'([A-Za-z][\w-]*)'/g)) names.add(m[1]!)
    // 数组引用形态（routeNames as xxx 直接传名）与遗留展开形态（...xxx）都要解析——
    // 引号字面量内的词也会命中该正则，但 Map.get 未命中即跳过，无附带伤害
    for (const m of argsText.matchAll(/\.\.\.(\w+)|(?<!['\w])([a-zA-Z_]\w*)(?!['\w])/g)) {
      expandAlias(m[1] ?? m[2]!)
    }
    return names
  }

  // 形态 2/3：new Set<string>([...])
  const setMatch = content.match(/new Set<[^>]+>\s*\(\s*\[([^\]]+)\]/s)
  if (!setMatch) return names

  const body = setMatch[1]!
  for (const m of body.matchAll(/'([A-Za-z][\w-]*)'/g)) names.add(m[1]!)
  for (const m of body.matchAll(/\.\.\.(\w+)/g)) expandAlias(m[1]!)
  return names
}

export function main(): void {
  // ─── 主流程 ───────────────────────────────────────────────────

  const apps = discoverApps()
  let totalErrors = 0

  console.log(`🔍 检查路由配置一致性（${apps.length} 个应用）...\n`)

  // E. 注册表反向校验：apps/ 下发现的应用（含 src/modules）必须登记 apps-registry.mjs。
  //    漏登记是高危静默失效点（2026-10-23 扩展性审查 P0）——boundary-apps-<new> ESLint
  //    规则不会生成（新 app 引用兄弟 app 无 error 拦截），requiredFor 返回空集让 B/C
  //    校验静默跳过，网关校验也不覆盖它：三道防线同时失明，唯有反向校验能暴露。
  const registeredApps = new Set(APPS.map((entry) => entry.name))
  for (const app of apps) {
    if (!registeredApps.has(app)) {
      console.error(
        `✖ [E] apps/${app} 存在 src/modules 但未登记 scripts/apps-registry.mjs（ESLint 边界规则 / B/C 兜底校验 / 网关校验将静默跳过它）`
      )
      totalErrors++
    }
  }

  for (const app of apps) {
    const whitelistedNames = extractWhitelist(readAppText(app, 'src/router/whitelist.ts'), app)
    const implementedNames = extractImplementedNames(app)
    const required = requiredFor(app)
    const routesGlob = `apps/${app}/src/modules/**/routes/*.ts`

    const checks: Array<[string, boolean]> = [
      // A. whitelist 元素必须在实际 routes 中存在（豁免前缀跳过此检查）
      ...[...whitelistedNames]
        .filter((name) => !isExempt(name))
        .map((name): [string, boolean] => [
          `[A] whitelist 中的 '${name}' 必须在 ${routesGlob} 或 router/index.ts 中存在（当前${implementedNames.has(name) ? '✓' : '✗ 缺失'}）`,
          implementedNames.has(name),
        ]),

      // B. 系统兜底名单必须在 whitelist 中（任何项目都必须能匿名访问的兜底）
      ...required.map((name): [string, boolean] => [
        `[B] 系统路由 '${name}' 必须在 whitelist 中（兜底页面必须能匿名访问）`,
        whitelistedNames.has(name),
      ]),

      // C. 系统兜底名单必须在实际 routes 中实现
      ...required.map((name): [string, boolean] => [
        `[C] 系统路由 '${name}' 必须在 ${routesGlob} 或 router/index.ts 中实现（兜底页面必须有真实路由）`,
        implementedNames.has(name),
      ]),

      // D. 双向一致性最终汇总（豁免前缀不参与对比）
      [
        (() => {
          const whitelistedEffective = [...whitelistedNames].filter((n) => !isExempt(n))
          const implementedEffective = [...implementedNames].filter((n) => !isExempt(n))
          return `[D] 双向一致性：whitelisted(${whitelistedEffective.length}) ⊆ implemented(${implementedEffective.length})（已豁免前缀: ${EXEMPT_PREFIXES.join(', ')}）`
        })(),
        (() => {
          const whitelistedEffective = new Set([...whitelistedNames].filter((n) => !isExempt(n)))
          return [...whitelistedEffective].every((n) => implementedNames.has(n))
        })(),
      ],
    ]

    let appErrors = 0
    console.log(`━━━ ${app} ━━━`)
    for (const [message, ok] of checks) {
      if (ok) {
        console.log(`✓ ${message}`)
      } else {
        console.error(`✖ ${message}`)
        appErrors++
      }
    }

    console.log('')
    console.log(
      `whitelist 白名单：${whitelistedNames.size} 个（${[...whitelistedNames].sort().join(', ')}）`
    )
    console.log(
      `routes 实现：${implementedNames.size} 个（${[...implementedNames].sort().join(', ')}）`
    )
    console.log('')

    totalErrors += appErrors
  }

  // ─── manifest 完整性（P2：app 元数据单源到 app.manifest.json）──────────────────
  // 原「端口双写锁死」随 P2 消灭——端口已单源到 manifest，无双写可锁；改为校验
  // 「有 src 必有 manifest，有 manifest 必有 src」，防 ESLint 边界/网关/requiredRoutes 静默跳过。

  console.log('━━━ app.manifest.json 完整性（有 src 必有 manifest，反之亦然）━━━')
  const manifestErrors = validateManifestPresence()
  if (manifestErrors.length === 0) {
    console.log(`✓ ${APPS.length} 个 app 的 app.manifest.json 与 src 目录一一对应`)
  } else {
    for (const message of manifestErrors) console.error(`✖ ${message}`)
    totalErrors += manifestErrors.length
  }
  console.log('')

  // ─── nginx 生产模板 app 名单对账（Round 3 R3-E2：模板手写名单 vs 注册表单源）───
  const nginxTemplatePath = resolve(ROOT, 'deploy/nginx.prod.conf.template')
  if (existsSync(nginxTemplatePath)) {
    console.log('━━━ nginx 生产模板 app 名单对账（模板 vs apps-registry 单源）━━━')
    const nginxErrors = validateNginxTemplateApps(
      readFileSync(nginxTemplatePath, 'utf-8'),
      APPS.map((entry) => entry.name)
    )
    if (nginxErrors.length === 0) {
      console.log(`✓ nginx 模板 ${APPS.length} 个 app 名单与注册表一致`)
    } else {
      for (const message of nginxErrors) console.error(`✖ ${message}`)
      totalErrors += nginxErrors.length
    }
    console.log('')
  } else {
    // fork 裁剪部署面的场景：模板不存在则无从对账，显式声明跳过（非静默）
    console.log('━━━ nginx 生产模板对账：跳过（deploy/nginx.prod.conf.template 不存在）━━━')
    console.log('')
  }

  if (totalErrors > 0) {
    console.error(`✖ 共 ${totalErrors} 个错误`)
    // 修复映射（2026-10-28 /autoplan R2-DX-4）：失败输出只报名单曾让首次踩坑者做
    // 源码考古——每类检查补一行「怎么修」，与 check:aliases 的 what+why+fix 对齐
    console.error('')
    console.error('修复指引（按检查类对号入座）：')
    console.error(
      '  [A] whitelist 有但 routes 没有 → 在 apps/<app>/src/modules/<m>/routes/*.ts 补路由实现；或从 apps/<app>/src/router/whitelist.ts 移除该 name'
    )
    console.error(
      '  [B] 系统路由不在 whitelist → 把该 name 加进 apps/<app>/src/router/whitelist.ts（兜底页必须可匿名访问）'
    )
    console.error(
      '  [C] 系统路由未实现 → 在 routes 中实现该兜底路由（error 模块骨架可参照既有 app）'
    )
    console.error(
      '  [D] 双向不一致 → 以 routes 实现为准对齐 whitelist；豁免前缀见 scripts/check-routes.ts 的 EXEMPT_PREFIXES'
    )
    console.error(
      '  [Nginx] 模板 app 名单漂移 → deploy/nginx.prod.conf.template 的 assets 正则与 location 块按 apps-registry 名单补齐/删除（漏 = 生产 404）'
    )
    console.error(
      '  manifest 完整性 → apps/<app>/app.manifest.json 与 src/ 目录一一对应（新增 app 用 pnpm new-app 一键生成）'
    )
    process.exit(1)
  } else {
    console.log(`✓ 所有应用的路由检查通过（${apps.join(' / ')}）`)
  }
}

// CLI 守卫：被 spec import 时不执行 main（2026-10-28 /autoplan E3 可测化改造）
const invokedDirectly =
  process.argv[1] !== undefined && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) main()
