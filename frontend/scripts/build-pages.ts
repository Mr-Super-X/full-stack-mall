/**
 * gh-pages 多应用聚合构建（Monorepo 版）。
 *
 * 依次构建 apps/* 下每个 app（env 注入 hash + local 菜单 + mock + base 子路径），
 * 产物复制到根 `dist/<app>/`，并生成根 `dist/index.html` 落地导航页。
 *
 * 用法：
 *   node --experimental-strip-types scripts/build-pages.ts
 *
 * 设计要点：
 * - env 经 spawn 注入（不依赖 shell 展开，Windows Git Bash 无 MSYS2_ARG_CONV_EXCL 坑）
 * - 每 app 的 base = `/vue3-vite-project/<app>/`（仓库名子路径；部署到根域时改 REPO_PREFIX）
 * - hash 模式：Pages 无 SPA fallback，沿用各 app vite.config 的 VITE_HISTORY_MODE 机制
 * - 新增 app 无需改本脚本：自动发现 apps/* 下含 vite.config.ts 的目录
 *
 * @see docs/40-GitHubPages自动部署.md（P5-3 将更新为 monorepo 版）
 */

import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
const APPS_DIR = path.join(REPO_ROOT, 'apps')
const OUT_DIR = path.join(REPO_ROOT, 'dist')
/** 仓库名子路径前缀（gh-pages 项目页部署形态；自定义域部署时改为 '/'） */
const REPO_PREFIX = '/vue3-vite-project'

/** 自动发现 apps/* 下可构建的应用（含 vite.config.ts 即视为应用） */
function findBuildableApps(): string[] {
  return readdirSync(APPS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => existsSync(path.join(APPS_DIR, name, 'vite.config.ts')))
}

/** 单 app 构建：注入演示 env 后跑 build-only（不做 type-check，CI 已先行门禁） */
function buildApp(appName: string): void {
  const env = {
    ...process.env,
    VITE_BASE: `${REPO_PREFIX}/${appName}/`,
    VITE_HISTORY_MODE: 'hash',
    VITE_MENU_SOURCE: 'local',
    VITE_USE_MOCK: 'true',
    // mock 统一前缀（2026-10-26）：prod 演示构建与 dev 同口径 /mock——
    // 缺省则回退工厂 define 默认 /api，gh-pages 的 mockjs 按 /api 注册会全挂
    VITE_API_BASE_URL: '/mock',
    VITE_DEMO_NO_AUTH: 'true',
    // 统一登录协议基址（2026-10-30 修复退出/未登录跳 404）：`#` 尾巴承载 auth app 的
    // hash 路由形态（本构建注入 VITE_HISTORY_MODE=hash）——origin + '/login' 拼出
    // /<repo>/auth/#/login，Pages 经 auth/index.html 接住；只注前缀不带 # 则 /auth/login
    // 非静态文件仍 404。dev/history 形态由各 app .env 的 VITE_AUTH_ORIGIN 承担（进程 env 优先）
    VITE_AUTH_ORIGIN: `${REPO_PREFIX}/auth/#`,
    // auth 登录成功兜底（gh-pages 演示形态）：落地导航页 / 地址栏直进 auth 时 referrer
    // 剥前缀后无 app 段（推断不出来源），注入 /admin/ 登录后直达管理后台——语义对齐
    // dev-gateway 的 VITE_POST_LOGIN_FALLBACK（裸 app 路径，消费端 withRepoPrefix 加前缀）
    ...(appName === 'auth' ? { VITE_POST_LOGIN_FALLBACK: '/admin/' } : {}),
  }
  const result = spawnSync('pnpm', ['-C', `apps/${appName}`, 'build-only'], {
    cwd: REPO_ROOT,
    env,
    stdio: 'inherit',
    shell: true,
  })
  if (result.status !== 0) {
    throw new Error(`[${appName}] build-only 失败（exit ${result.status}）`)
  }
}

/** 产物复制：apps/<a>/dist → 根 dist/<a>/ */
function copyDist(appName: string): void {
  const src = path.join(APPS_DIR, appName, 'dist')
  const dest = path.join(OUT_DIR, appName)
  if (!existsSync(src)) {
    throw new Error(`[${appName}] 产物不存在：${src}`)
  }
  rmSync(dest, { recursive: true, force: true })
  cpSync(src, dest, { recursive: true })
  console.log(`✅ [${appName}] 产物已聚合 → dist/${appName}/`)
}

/** 落地页 app 中文名（口径对齐 README §项目简介；new-app 产物未收录时回落英文 app 名） */
const APP_LABELS: Record<string, string> = {
  admin: '管理后台',
  auth: '统一登录',
  big: '数据大屏',
  docs: '组件示例文档',
  h5: 'H5 移动端',
  portal: '门户企业官网',
}

/** 落地导航页（根 dist/index.html）：列全部 app 入口 */
function writeLandingPage(appNames: string[]): void {
  const links = appNames
    .map(
      (name) =>
        `    <li><a href="${REPO_PREFIX}/${name}/">${APP_LABELS[name] ?? name}（/${name}/）</a></li>`
    )
    .join('\n')
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>vue3-vite-project 演示导航</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 640px; margin: 80px auto; padding: 0 24px; }
    h1 { font-size: 20px; } li { margin: 12px 0; } a { color: #409eff; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>vue3-vite-project 演示导航</h1>
  <ul>
${links}
  </ul>
</body>
</html>
`
  writeFileSync(path.join(OUT_DIR, 'index.html'), html, 'utf-8')
  console.log('✅ 落地导航页 dist/index.html 已生成')
}

/** GitHub Pages 安全头（2026-10-29 /autoplan Round 3 R3-E4）：Pages 无服务器配置能力，
 *  安全头经发布根目录 _headers 文件生效。CSP 比 nginx 宽——script 允许 unsafe-inline
 *  （演示构建存在内联脚本注入），定位是演示站基线而非生产级策略。 */
function writePagesHeaders(): void {
  writeFileSync(
    path.join(OUT_DIR, '_headers'),
    `/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' data:; frame-ancestors 'none'
`,
    'utf-8'
  )
  console.log('✅ Pages 安全头 dist/_headers 已生成')
}

function main(): void {
  const apps = findBuildableApps()
  if (apps.length === 0) {
    throw new Error('apps/* 下未发现可构建应用')
  }
  console.log(`🔍 发现 ${apps.length} 个应用：${apps.join(', ')}`)

  // 先清空聚合目录：根 dist/ 可能残留历史单应用构建产物（Pages 整目录发布，陈旧文件会被一并带上）
  rmSync(OUT_DIR, { recursive: true, force: true })
  mkdirSync(OUT_DIR, { recursive: true })
  for (const name of apps) {
    console.log(`🏗️  构建 [${name}]…`)
    buildApp(name)
    copyDist(name)
  }
  writeLandingPage(apps)
  writePagesHeaders()
  console.log(`\n🎉 聚合完成：dist/ 下 ${apps.length} 个应用 + 落地页 + _headers`)
}

main()
