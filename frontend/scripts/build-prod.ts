/**
 * 生产多应用聚合构建（Monorepo 版）。
 *
 * 依次构建 apps/* 下每个 app（env 注入 history + remote 菜单 + 真实后端形态），
 * 产物复制到根 `dist-prod/<app>/`，由生产 nginx（deploy/nginx.prod.conf.template）
 * 按路径前缀静态托管：/ → 302 /portal/、/<app>/ → 对应产物（SPA fallback）。
 *
 * 与 scripts/build-pages.ts（gh-pages 演示）的关键差异：
 * - base：`/<app>/` 无前缀（build-pages 带 `/vue3-vite-project` 仓库前缀）
 * - history 模式：不注入 VITE_HISTORY_MODE（工厂缺省 web；Pages 无 SPA fallback 才退 hash）
 * - VITE_MENU_SOURCE=remote + VITE_USE_MOCK=false + VITE_API_BASE_URL=/api（真实后端形态）
 * - 无落地导航页（生产根 302 由 nginx 承担）+ 产物目录 dist-prod（与 gh-pages 的 dist 隔离）
 *
 * 复用 build-only 而非全量 build 的原因：类型门禁由 CI 承担（turbo build =
 * build-only → type-check:full）；CI 干净环境 type-check 缺生成声明须 build 先行，
 * Docker 内再跑一遍无收益反而拖慢（gh-pages 三连坑记忆）。
 *
 * 用法：
 *   pnpm build:prod   # = node --experimental-strip-types scripts/build-prod.ts
 *
 * @see deploy/nginx.prod.conf.template 产物目录结构消费方
 * @see scripts/build-pages.ts 对照组（gh-pages 演示形态）
 */

import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
const APPS_DIR = path.join(REPO_ROOT, 'apps')
const OUT_DIR = path.join(REPO_ROOT, 'dist-prod')

/** 自动发现 apps/* 下可构建的应用（含 vite.config.ts 即视为应用；与 build-pages 同口径） */
function findBuildableApps(): string[] {
  return readdirSync(APPS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => existsSync(path.join(APPS_DIR, name, 'vite.config.ts')))
}

/** version.json buildId：git short sha + 构建时间（对齐 deploy.yml 的 sha+run_attempt 语义）。
 *  Docker context 排除 .git（.dockerignore）时 git 失败 → 'nogit' 前缀回落，仍可去重。 */
function buildId(): string {
  const sha = spawnSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
    shell: true,
  }).stdout?.trim()
  return `${sha || 'nogit'}-${Date.now().toString(36)}`
}

/** 单 app 构建：注入生产 env 后跑 build-only（类型门禁由 CI 承担，见文件头注） */
function buildApp(appName: string): void {
  const env = {
    ...process.env,
    // 路径分发：6 app 统一挂 / 下子前缀（portal 也在 /portal/，根 302 由 nginx 做）
    VITE_BASE: `/${appName}/`,
    // 真实后端形态三开关（VITE_HISTORY_MODE 不注入 = 工厂缺省 web/history 模式）：
    VITE_MENU_SOURCE: 'remote',
    VITE_USE_MOCK: 'false',
    VITE_API_BASE_URL: '/api',
    // version.json buildId（2026-10-29 /autoplan Round 3 R3-E5）：缺省随机值会在
    // versionCheck 启用后造成「每次轮询都提示刷新」死循环——Docker 构建同须可追溯。
    // sha 拼构建时间消「同 commit 重跑相同 buildId」（对齐 deploy.yml sha+run_attempt）
    VITE_BUILD_ID: buildId(),
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

/** 产物复制：apps/<a>/dist → 根 dist-prod/<a>/（nginx alias 路径契约） */
function copyDist(appName: string): void {
  const src = path.join(APPS_DIR, appName, 'dist')
  const dest = path.join(OUT_DIR, appName)
  if (!existsSync(src)) {
    throw new Error(`[${appName}] 产物不存在：${src}`)
  }
  rmSync(dest, { recursive: true, force: true })
  cpSync(src, dest, { recursive: true })
  console.log(`✅ [${appName}] 产物已聚合 → dist-prod/${appName}/`)
}

function main(): void {
  const apps = findBuildableApps()
  if (apps.length === 0) {
    throw new Error('apps/* 下未发现可构建应用')
  }
  console.log(`🔍 发现 ${apps.length} 个应用：${apps.join(', ')}`)

  // 先清空聚合目录：陈旧产物会被一并拷入镜像
  rmSync(OUT_DIR, { recursive: true, force: true })
  mkdirSync(OUT_DIR, { recursive: true })
  for (const name of apps) {
    console.log(`🏗️  构建 [${name}]…`)
    buildApp(name)
    copyDist(name)
  }
  console.log(
    `\n🎉 生产聚合完成：dist-prod/ 下 ${apps.length} 个应用（根 302 → /portal/ 由 nginx 承担）`
  )
}

main()
