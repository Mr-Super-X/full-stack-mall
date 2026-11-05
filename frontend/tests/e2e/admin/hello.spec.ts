/**
 * Hello World E2E 测试（v3.5 PR1-A；monorepo 版归入 admin project）
 *
 * 目的：验证 Playwright + admin dev server 基础链路通畅。
 * 步骤：
 *   1. 启动 dev server（project webServer 自动拉起 apps/admin dev:local），访问根路径
 *   2. 断言页面有 Vue 挂载点（#app 存在）
 *
 * @group E2E 测试
 */
import { test, expect } from '@playwright/test'

test('dev server 启动 + Vue 挂载点存在', async ({ page }) => {
  await page.goto('/')
  // Vue 根节点 #app 应存在
  await expect(page.locator('#app')).toBeVisible()
})
