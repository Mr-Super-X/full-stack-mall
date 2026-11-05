/**
 * new-app 脚手架单测（node:test runner，同 node-gateway.spec.ts 形态——scripts 不经 turbo/vitest）。
 *
 * 运行：pnpm exec node --test --experimental-strip-types scripts/new-app.spec.ts
 *
 * 覆盖（设计 §7.3）：
 *   - validateAppName：非 kebab-case 拒绝 / 合法名放行
 *   - allocatePort：空目录回退 5174 / 现有最大 +1 / 撞网关 8080 跳过 / 重复 port 抛错
 *   - scaffoldApp：目录已存在拒绝且不写任何文件
 *   - 真实模板渲染到临时目录：manifest 可读、占位符零残留、必需文件齐全、
 *     package.json 的 name / 白名单谓词名 / 端口与入参一致
 */
import assert from 'node:assert/strict'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'

import { readAppManifest } from '../packages/config/src/app-manifest.mjs'
import { allocatePort, scaffoldApp, validateAppName } from './new-app.ts'

/** 真实模板目录（renderTemplates 的 templateDir 注入点此处指向仓库实际模板） */
const TEMPLATE_DIR = resolve(import.meta.dirname, 'templates/app')

/** 建临时目录并注册用例级清理 */
function useTempDir(t: { after: (fn: () => void) => void }): string {
  const dir = mkdtempSync(join(tmpdir(), 'new-app-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  return dir
}

/** 在临时 apps 目录造一个仅含 manifest 的假 app */
function seedApp(appsDir: string, name: string, port: number): void {
  const dir = join(appsDir, name)
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'app.manifest.json'),
    JSON.stringify({ name, port, requiredRoutes: ['NotFound'] }),
    'utf-8'
  )
}

// ── validateAppName ─────────────────────────────────────────────

test('validateAppName：合法 kebab-case 放行', () => {
  for (const name of ['admin', 'ops-center', 'data-hub2']) {
    assert.doesNotThrow(() => validateAppName(name))
  }
})

test('validateAppName：非 kebab-case 拒绝（大写 / 数字开头 / 下划线 / 空串）', () => {
  for (const name of ['Admin', '1app', 'my_app', '', 'ops center']) {
    assert.throws(() => validateAppName(name), /kebab-case/)
  }
})

// ── allocatePort ────────────────────────────────────────────────

test('allocatePort：apps 目录不存在 / 无 manifest 时回退 5174', (t) => {
  const dir = useTempDir(t)
  assert.equal(allocatePort(join(dir, 'not-exists')), 5174)
  const appsDir = join(dir, 'apps')
  mkdirSync(appsDir, { recursive: true })
  assert.equal(allocatePort(appsDir), 5174)
})

test('allocatePort：取现有最大 port + 1', (t) => {
  const appsDir = join(useTempDir(t), 'apps')
  seedApp(appsDir, 'admin', 5174)
  seedApp(appsDir, 'auth', 5179)
  assert.equal(allocatePort(appsDir), 5180)
})

test('allocatePort：撞网关 8080 时跳过（8079 → 8081）', (t) => {
  const appsDir = join(useTempDir(t), 'apps')
  seedApp(appsDir, 'edge', 8079)
  assert.equal(allocatePort(appsDir), 8081)
})

test('allocatePort：现有 manifest 重复 port 时抛错（discoverAppManifests 契约）', (t) => {
  const appsDir = join(useTempDir(t), 'apps')
  seedApp(appsDir, 'foo', 5174)
  seedApp(appsDir, 'bar', 5174)
  assert.throws(() => allocatePort(appsDir), /重复 port 5174/)
})

// ── scaffoldApp 预检 ─────────────────────────────────────────────

test('scaffoldApp：目录已存在时拒绝且不写任何文件', (t) => {
  const appsDir = join(useTempDir(t), 'apps')
  const existing = join(appsDir, 'demo-app')
  mkdirSync(existing, { recursive: true })
  writeFileSync(join(existing, 'sentinel.txt'), 'keep-me', 'utf-8')

  assert.throws(() => scaffoldApp('demo-app', appsDir, TEMPLATE_DIR), /已存在/)
  assert.deepEqual(readdirSync(existing), ['sentinel.txt'])
  assert.equal(readFileSync(join(existing, 'sentinel.txt'), 'utf-8'), 'keep-me')
})

test('scaffoldApp：非法名称在写盘前抛错（不产生目录）', (t) => {
  const appsDir = join(useTempDir(t), 'apps')
  assert.throws(() => scaffoldApp('BadName', appsDir, TEMPLATE_DIR), /kebab-case/)
  assert.equal(existsSync(join(appsDir, 'BadName')), false)
})

// ── 真实模板渲染（临时 APPS_DIR）─────────────────────────────────

test('scaffoldApp：真实模板渲染 —— manifest 可读 / 占位符零残留 / 必需文件齐全', (t) => {
  const appsDir = join(useTempDir(t), 'apps')
  seedApp(appsDir, 'admin', 5174) // 模拟现有最大端口
  const { port, files } = scaffoldApp('demo-app', appsDir, TEMPLATE_DIR)
  assert.equal(port, 5175)

  const appDir = join(appsDir, 'demo-app')

  // manifest 可读且字段与入参一致（readAppManifest 自带契约校验）
  const manifest = readAppManifest(appDir)
  assert.deepEqual(manifest, { name: 'demo-app', port: 5175, requiredRoutes: ['NotFound'] })

  // 必需文件齐全（可独立 dev / build / test 的最小集）
  const required = [
    'app.manifest.json',
    'package.json',
    'index.html',
    'env.d.ts',
    'uno.config.ts',
    'vite.config.ts',
    'vitest.config.ts',
    'tsconfig.json',
    'tsconfig.app.json',
    'tsconfig.vitest.json',
    'src/main.ts',
    'src/App.vue',
    'src/store/index.ts',
    'src/plugins/index.ts',
    'src/router/index.ts',
    'src/router/auto-register.ts',
    'src/router/fallback.ts',
    'src/router/whitelist.ts',
    'src/views/NotFound.vue',
    'src/layouts/blank/index.vue',
    'src/modules/home/routes/index.ts',
    'src/modules/home/views/index.vue',
    'src/modules/home/routes/index.spec.ts',
    'src/styles/index.scss',
    'src/styles/tokens.scss',
    'src/styles/ui-overwrite.scss',
  ]
  for (const rel of required) {
    assert.ok(existsSync(join(appDir, rel)), `缺文件：${rel}`)
    assert.ok(files.includes(rel), `产物清单未登记：${rel}`)
  }

  // 占位符零残留（逐文件断言）
  for (const rel of files) {
    const content = readFileSync(join(appDir, rel), 'utf-8')
    assert.ok(!/__[A-Z_]+__/.test(content), `${rel} 残留占位符：${content.match(/__[A-Z_]+__/)}`)
  }

  // 关键替换结果落位
  const pkg = JSON.parse(readFileSync(join(appDir, 'package.json'), 'utf-8'))
  assert.equal(pkg.name, '@vv-app/demo-app')
  const whitelist = readFileSync(join(appDir, 'src/router/whitelist.ts'), 'utf-8')
  assert.match(whitelist, /export function isDemoAppWhiteListed\(/)
  const manifestRaw = readFileSync(join(appDir, 'app.manifest.json'), 'utf-8')
  assert.match(manifestRaw, /"port": 5175/)
})
