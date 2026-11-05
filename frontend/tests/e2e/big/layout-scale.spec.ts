/**
 * 大屏布局能力 E2E（big project，蓝本为单应用时期 four-panels.spec.ts 用例 3/4/5）。
 *
 * 覆盖：
 *   1. 大屏演示页：stage 带 transform: scale 等比缩放
 *   2. 超宽拼接页：stage 按 meta.bigScreen 声明为 9000px
 *   3. 五态示范页：状态切换可用（点「加载中」出骨架块）
 *
 * monorepo 变化：big-demo 模块自单应用 src/ 迁入 apps/big（端口 5178），
 * 全站白名单公开免登录。选择符原样沿用（.vv-big-layout__stage /
 * .vv-big-demo-state__skeleton，BEM namespace 未变），仅 baseURL/端口变化。
 *
 * dev server 由 playwright.config.ts big project 的 webServer 自动启动。
 *
 * @group E2E 测试
 */
import { test, expect } from '@playwright/test'

test('大屏演示页：stage 等比缩放', async ({ page }) => {
  await page.goto('/big-demo')
  const stage = page.locator('.vv-big-layout__stage')
  await expect(stage).toBeVisible()
  const style = await stage.getAttribute('style')
  expect(style).toContain('scale(')
})

test('超宽拼接页：stage 按 meta.bigScreen 为 9000px', async ({ page }) => {
  await page.goto('/big-demo/wide')
  const stage = page.locator('.vv-big-layout__stage')
  await expect(stage).toBeVisible()
  await expect(stage).toHaveCSS('width', '9000px')
})

test('五态示范页：切换加载中态出现骨架块', async ({ page }) => {
  await page.goto('/big-demo/state-demo')
  await expect(page.getByRole('tab', { name: '成功' })).toBeVisible()
  await page.getByRole('tab', { name: '加载中' }).click()
  await expect(page.locator('.vv-big-demo-state__skeleton').first()).toBeVisible()
})
