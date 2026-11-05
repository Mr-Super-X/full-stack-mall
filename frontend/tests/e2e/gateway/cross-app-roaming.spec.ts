/**
 * 跨应用漫游 E2E（gateway project，蓝本为单应用时期 four-panels.spec.ts 用例 2/6 的跨 app 部分）。
 *
 * 覆盖（须 :8080 同域网关，pnpm dev:gateway 一体化单命令拉起）：
 *   1. 未登录访问 /admin/workbench → 整页跳 /auth/login（统一登录协议）
 *   2. 登录后回跳 admin 工作台，TagsView 页签快照
 *   3. 漫游 h5/big 演示页（网关保留前缀：/h5/h5-demo、/big/big-demo、/big/big-demo/state-demo）
 *   4. 回 /admin/workbench：TagsView 页签守恒（noTags 路由不污染）
 *
 * 环境说明：e2e 不硬依赖 docker——用例先探测 :8080 网关可达性，不可达则自跳过；
 * 有网关时覆盖统一登录整页漫游的真实链路（cookie 同域 + sessionStorage 同域共享）。
 *
 * @group E2E 测试
 */
import { test, expect } from '@playwright/test'

/** 网关可达性探测（dev:gateway 未启动时整个文件的用例跳过） */
async function isGatewayUp(): Promise<boolean> {
  try {
    const res = await fetch('http://localhost:8080', { signal: AbortSignal.timeout(2000) })
    return res.ok || res.status === 404 // 网关 404（无落地页路由）也算存活
  } catch {
    return false
  }
}

test.beforeEach(async ({}, testInfo) => {
  testInfo.skip(!(await isGatewayUp()), '同域网关未启动（需 pnpm dev:gateway）')
})

test('未登录访问 admin → 整页跳统一登录 → 登录回跳工作台', async ({ page }) => {
  await page.goto('/admin/workbench')
  // 未登录守卫整页跳 auth app，并带 redirect 回跳参数（统一登录协议）
  await expect(page).toHaveURL(/\/auth\/login\?redirect=/)
  await page.locator('input[placeholder="请输入账号"]').fill('admin')
  await page.locator('input[placeholder="请输入密码"]').fill('123456')
  await page.getByRole('button', { name: /登/ }).click()
  // 登录成功整页回跳 redirect 目标（/admin/workbench）
  await expect(page).toHaveURL(/\/admin\/workbench/)
  await expect(page.locator('.vv-workbench-home')).toBeVisible()
})

test('跨 app 漫游不污染 TagsView 页签（meta.noTags）', async ({ page }) => {
  // 登录进 admin（与上一用例同一协议：未登录整页跳 auth，登录后回跳工作台）。
  // 注意守卫是 location.href 整页跳转——goto 返回时 URL 可能尚未翻到 /auth/login，
  // 必须等 URL 落稳再填表，否则会在 admin 页面上找登录框等到超时
  await page.goto('/admin/workbench')
  await expect(page).toHaveURL(/\/auth\/login/)
  await page.locator('input[placeholder="请输入账号"]').fill('admin')
  await page.locator('input[placeholder="请输入密码"]').fill('123456')
  await page.getByRole('button', { name: /登/ }).click()
  await expect(page.locator('.vv-workbench-home')).toBeVisible()

  const tagBar = page.locator('.vv-default-tags-view')
  await expect(tagBar).toBeVisible()
  const before = await tagBar.innerText()

  // 漫游三个免登录演示页（跨 app 整页跳转，经网关保留前缀）
  for (const path of ['/h5/h5-demo', '/big/big-demo', '/big/big-demo/state-demo']) {
    await page.goto(path)
    await expect(page.locator('#app')).toBeVisible()
  }
  await page.goto('/admin/workbench')

  const after = await tagBar.innerText()
  expect(after).toBe(before)
  expect(after).not.toContain('H5')
  expect(after).not.toContain('数据大屏')
  expect(after).not.toContain('五态')
})
