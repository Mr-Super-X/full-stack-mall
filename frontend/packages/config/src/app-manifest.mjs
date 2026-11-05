/**
 * app.manifest.json 读取器（P2 应用 manifest 单源）。
 *
 * 为什么 .mjs 而非 .ts：eslint.config.mjs 由 ESLint 直接加载、Node 不带
 * --experimental-strip-types 读不了 .ts——与 apps-registry.mjs 同约束。
 * 类型由 app-manifest.d.mts 镜像提供（改字段时两处同步）。
 *
 * 契约（docs/superpowers/specs/2026-10-27-app-manifest-scaffolding-design.md §5）：
 *   name            kebab-case，必须等于 app 目录名
 *   port            1-65535 整数，workspace 内唯一，不与网关 8080 冲突
 *   requiredRoutes  非空字符串数组，必须含 NotFound
 * JSON 不承载注释——字段说明统一在 docs/43，避免引入 JSONC 解析依赖。
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const MANIFEST_FILE = 'app.manifest.json'

function fail(appDir, msg) {
  throw new Error(`[app-manifest] ${join(appDir, MANIFEST_FILE)}：${msg}`)
}

function dirBaseName(appDir) {
  // appRoot 常带末尾分隔符（fileURLToPath(new URL('.', ...))），须先剥离再取目录名
  const trimmed = appDir.replace(/[\\/]+$/, '')
  return trimmed.split(/[\\/]/).pop()
}

function validate(appDir, raw) {
  if (typeof raw !== 'object' || raw === null) fail(appDir, '须为 JSON 对象')
  const { name, port, requiredRoutes } = raw
  const dirName = dirBaseName(appDir)
  if (typeof name !== 'string' || !/^[a-z][a-z0-9-]*$/.test(name)) {
    fail(appDir, `name 须为 kebab-case，当前 ${JSON.stringify(name)}`)
  }
  if (name !== dirName) fail(appDir, `name「${name}」与目录名「${dirName}」不一致`)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    fail(appDir, `port 须为 1-65535 整数，当前 ${JSON.stringify(port)}`)
  }
  // 2026-10-28 /autoplan E9：上方契约注释承诺「不与网关 8080 冲突」但实现缺失——
  // 补齐特判（8080 是 node 网关占用端口，manifest 撞口要到 dev:gateway 启动时才
  // EADDRINUSE，报错指向网络层排查成本高；fail fast 在源头）
  if (port === 8080) fail(appDir, 'port 不得为 8080（node 网关占用端口）')
  if (
    !Array.isArray(requiredRoutes) ||
    requiredRoutes.length === 0 ||
    !requiredRoutes.every((r) => typeof r === 'string')
  ) {
    fail(appDir, 'requiredRoutes 须为非空字符串数组')
  }
  if (!requiredRoutes.includes('NotFound')) fail(appDir, 'requiredRoutes 必须包含 NotFound')
  return { name, port, requiredRoutes }
}

/** 读取单个 app 的 app.manifest.json（缺文件/语法错/字段非法均 fail fast，错误含文件路径）。 */
export function readAppManifest(appDir) {
  const file = join(appDir, MANIFEST_FILE)
  if (!existsSync(file)) fail(appDir, '文件不存在')
  let raw
  try {
    raw = JSON.parse(readFileSync(file, 'utf-8'))
  } catch (e) {
    fail(appDir, `JSON 语法错：${e.message}`)
  }
  return validate(appDir, raw)
}

/**
 * 发现 apps/ 下所有含 app.manifest.json 的直接子目录，按 port 升序返回（= 启动顺序）。
 * 重复 port 报错；无 manifest 的目录跳过。
 */
export function discoverAppManifests(appsDir) {
  const apps = []
  for (const entry of readdirSync(appsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const appDir = join(appsDir, entry.name)
    if (!existsSync(join(appDir, MANIFEST_FILE))) continue
    apps.push(readAppManifest(appDir))
  }
  const seen = new Map()
  for (const a of apps) {
    if (seen.has(a.port)) {
      fail(appsDir, `重复 port ${a.port}（${seen.get(a.port)} 与 ${a.name}）`)
    }
    seen.set(a.port, a.name)
  }
  return apps.sort((a, b) => a.port - b.port)
}
