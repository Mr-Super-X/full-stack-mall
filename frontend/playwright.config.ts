/**
 * Playwright E2E 配置（monorepo 版，projects 按 app 分组）。
 *
 * 变更记录（2026-10-23，monorepo e2e 重建）：
 *   - 单应用时期的单 project（chromium @5174）升级为按 app 分组的 projects——
 *     monorepo 拆分后布局/demo 路由已物理分布到各 app，单个 baseURL 无法覆盖：
 *     admin 5174 / docs 5175 / h5 5177 / big 5178（各 project 独立 webServer 自启 dev）。
 *   - docs（ProTable demo）/ h5 / big 全站白名单公开，spec 免登录直达；
 *     admin 无自有登录页（未登录整页跳 auth app），spec 走 API 登录 + 登录标记注入。
 *   - gateway project（:8080 同域网关，pnpm dev:gateway 一体化单命令拉起）只承载真正
 *     跨应用漫游用例；网关未启动时用例自跳过（spec 自动探测可达性，e2e 不硬依赖网关）。
 *
 * 变更记录（2026-10-23 晚，扩展性审查）：
 *   - app projects 从 scripts/apps-registry.mjs 单源派生（端口/名单与 dev-gateway /
 *     check-routes / eslint 边界同一份事实）——新增 app 只要建 `tests/e2e/<name>/`
 *     目录即自动纳入 e2e 覆盖，无须改本配置；webServer 统一 `dev:local`（不依赖
 *     remote 菜单后端，spec 可冷启动直跑）。
 *
 * 端口事实源：scripts/apps-registry.mjs（5174-5179，strictPort，check:routes 端口双写锁死）。
 *
 * 启动：pnpm test:e2e（首次需 pnpm test:e2e:install 下载 Chromium）
 * 单 project：pnpm test:e2e --project=docs
 *
 * @group E2E 配置
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

// apps-registry 是 .mjs（eslint.config.mjs 直接加载的 Node 原生 ESM 约束），
// 类型镜像在 apps-registry.d.mts；与 eslint.config.mjs / check-routes.ts 同消费形态
import { APPS } from './scripts/apps-registry.mjs'

/** 项目 dev server 启动超时（vite 冷启动 + mock 打包，本地给足余量） */
const DEV_SERVER_TIMEOUT = 120 * 1000

const REPO_ROOT = fileURLToPath(new URL('.', import.meta.url))
const E2E_DIR = join(REPO_ROOT, 'tests', 'e2e')

/**
 * app projects 从注册表单源派生：apps/<name> 存在对应 tests/e2e/<name>/ spec 目录
 * 才生成 project（portal/auth 现无 e2e 故不生成；新增 app 建目录即自动纳入）。
 * dev:local = 本地菜单模式，不依赖 remote 菜单后端，spec 冷启动可直跑。
 */
function createAppProjects() {
  return APPS.filter((app) => existsSync(join(E2E_DIR, app.name))).map((app) => ({
    name: app.name,
    testMatch: `tests/e2e/${app.name}/**/*.spec.ts`,
    use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${app.port}` },
    webServer: {
      command: `pnpm -C apps/${app.name} dev:local`,
      url: `http://localhost:${app.port}`,
      reuseExistingServer: !process.env.CI,
      timeout: DEV_SERVER_TIMEOUT,
    },
  }))
}

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  // 默认 30s 超时（vben-style 表格首屏可能略久）
  timeout: 30 * 1000,
  expect: { timeout: 5 * 1000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  // 单 worker 保证 dev server 单一访问；CI 上放宽到 2
  workers: process.env.CI ? 2 : 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    ...createAppProjects(),
    {
      // 跨应用漫游用例（统一登录 + TagsView 守恒）——依赖 :8080 同域网关
      // （pnpm dev:gateway 一体化拉起网关 + 6 dev server），e2e 不自动拉起，
      // 由 spec 内探测网关可达性后自跳过
      name: 'gateway',
      testMatch: 'tests/e2e/gateway/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:8080' },
    },
  ],
})
