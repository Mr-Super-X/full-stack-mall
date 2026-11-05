/**
 * H5 rem 适配 E2E（h5 project，蓝本为单应用时期 four-panels.spec.ts 用例 2）。
 *
 * 覆盖：
 *   1. /h5-demo（h5 layout）激活 rem：html font-size 被写入（非空）
 *   2. 离开 h5 layout（站内 404 走 NotFound 页）后零残留：html font-size 被清除
 *
 * monorepo 变化：h5-demo 模块自单应用 src/ 迁入 apps/h5（端口 5177），
 * 全站白名单公开免登录。原用例「返回后台后零残留」的另一半（后台页无 rem 激活）
 * 已无法在 h5 app 内复现（后台归 apps/admin），本 spec 以
 * 「h5 layout → NotFound 页」切换验证 rem.ts 的清除逻辑（实现不变，仅验证入口变了）。
 *
 * dev server 由 playwright.config.ts h5 project 的 webServer 自动启动。
 *
 * @group E2E 测试
 */
import { test, expect, type Page } from '@playwright/test'

/** rem 激活的判定：h5 layout 按视口宽把 font-size 写到 documentElement 内联样式 */
function htmlFontSize(page: Page): Promise<string> {
  return page.evaluate(() => document.documentElement.style.fontSize)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/h5-demo')
  await expect(page.locator('.vv-h5-layout')).toBeVisible()
})

test('H5 演示页：rem 激活（html font-size 非空）', async ({ page }) => {
  await expect.poll(async () => await htmlFontSize(page)).not.toBe('')
})

test('离开 h5 layout 后 rem 零残留（font-size 被清除）', async ({ page }) => {
  await expect.poll(async () => await htmlFontSize(page)).not.toBe('')

  // 站内 404（catch-all 重定向 /404，NotFound 页无 h5 layout）→
  // h5 layout 卸载时应恢复 html font-size（apps/h5 rem.ts 的清理逻辑）
  await page.goto('/definitely-not-exists')
  await expect(page).toHaveURL(/\/404/)
  // 404 页根 class 归 @vv/ui ErrorPage 组件（vv-error-page），与 h5 私有写法解耦
  await expect(page.locator('.vv-error-page')).toBeVisible()
  await expect.poll(async () => await htmlFontSize(page)).toBe('')
})
