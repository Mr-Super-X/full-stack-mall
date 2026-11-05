/**
 * 能力演示导航卡 E2E（admin project，蓝本为单应用时期 four-panels.spec.ts 用例 1）。
 *
 * monorepo 变化：
 * - workbench panelLinks 已改为跨应用网关路径（/portal/home、/h5/h5-demo、/big/big-demo 等，
 *   点击经 openPanel 新窗口整页跳转）——本 spec 只断言导航卡链接文本齐全，
 *   跨 app 实际漫游归 gateway project（tests/e2e/gateway/cross-app-roaming.spec.ts）。
 * - admin 已无自有登录页：未登录守卫整页跳 /auth/login（独立 dev 下 404）。
 *   故登录改走真实 mock 登录接口（/api/auth/login 会 Set-Cookie 凭证）+
 *   注入 sessionStorage 登录标记（守卫同步判断依据，key 带 VITE_STORAGE_NAMESPACE 前缀），
 *   与手动登录后的浏览器状态等价。
 *
 * @group E2E 测试
 */
import { test, expect } from '@playwright/test'

/** admin 登录标记的 sessionStorage key（namespace 前缀见 packages/shared storage.ts） */
const AUTH_MARK_KEY = 'vue3-vite-project:auth'

test.beforeEach(async ({ page }) => {
  // 真实登录接口换 HttpOnly 凭证 cookie（page.request 与页面共享 cookie jar）
  // mock 统一前缀（2026-10-26）：登录端点注册在 /mock/*
  const loginRes = await page.request.post('/mock/auth/login', {
    data: { username: 'admin', password: '123456' },
  })
  expect(loginRes.ok()).toBe(true)
  // 守卫的同步判断依据：sessionStorage 登录标记（Session.set('auth', true) 的 JSON 形态）
  await page.addInitScript((key) => {
    sessionStorage.setItem(key, 'true')
  }, AUTH_MARK_KEY)
})

test('能力演示导航卡：五栖链接齐全', async ({ page }) => {
  await page.goto('/workbench')
  await expect(page.locator('.vv-workbench-home')).toBeVisible()

  const card = page.locator('.vv-workbench-home__card', { hasText: '能力演示导航' })
  // 断言 workbench panelLinks 五行的完整链接文本（2026-10 monorepo 版文案：
  // 门户/h5/big×3 五栖，链接本体为无 href 的 el-link，点击经 openPanel 新窗口打开）
  for (const label of [
    '门户首页',
    'H5 移动端演示',
    '数据大屏演示（1920）',
    '超宽拼接屏演示（9000×1080）',
    '大屏五态示范',
  ]) {
    // el-link 无 href 时渲染为无隐式 role 的 <a>，用文本定位而非 getByRole('link')
    await expect(card.getByText(label, { exact: true })).toBeVisible()
  }
})
