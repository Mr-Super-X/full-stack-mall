/**
 * E2E 关键路径 —— 搜索→列表（v3.5 PR1-A Task 12；monorepo 版迁入 docs project）
 *
 * 路径：
 *   1. 打开 `/demo/pro-table-overview`（docs app 全站白名单公开，免登录直达）
 *   2. 填搜索框 "用户-1" → 等 mock 返回 → 断言表格行数减少（127 → 39）
 *   3. 重置搜索 → 断言恢复分页行数
 *
 * 迁移说明（2026-10-23）：
 * - 蓝本为单应用 tests/e2e/protable/search-list.spec.ts，选择符原样沿用
 *   （.vv-pro-table / [data-test=search-btn] / input[placeholder*=姓名] 均在 @vv/ui 包保留）；
 *   仅 demo 模块物理归属从单应用 src/ 变为 apps/docs（路由 /demo/... 不变）。
 * - overview 页含两个 ProTable（主表 + 跨页选择演示表），所有行数/搜索断言
 *   限定主表（第一个 .vv-pro-table）作用域，两表行数不互相污染。
 * - 搜索列 label 为「姓名」（按"名称"匹配是列名漂移）。
 *
 * dev server 由 playwright.config.ts docs project 的 webServer 自动启动。
 *
 * @group E2E 测试
 */
import { test, expect, type Page } from '@playwright/test'

/** 主表作用域：overview 页第一个 ProTable（第二个为跨页选择演示表） */
function mainTable(page: Page) {
  return page.locator('.vv-pro-table').first()
}

test.describe('ProTable E2E 搜索→列表', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/pro-table-overview')
    // 等待首次加载完成（mock API 延迟 500ms）；主表根本身即 role=grid[aria-label=数据表格]
    await expect(mainTable(page).locator('.el-table__body tbody tr').first()).toBeVisible({
      timeout: 10000,
    })
    await expect(mainTable(page)).toBeVisible()
  })

  test('搜索「用户-1」后总行数收敛（127 → 39）', async ({ page }) => {
    const grid = mainTable(page)
    // aria-rowcount = total + 1（ProTable 根 grid 语义属性，对 pageSize 免疫——
    // overview 首个场景表 pageSize=5，行数断言会满载 5↔5 失真，total 才是真证据）
    const totalRows = () => grid.getAttribute('aria-rowcount').then((n) => Number(n))
    expect(await totalRows()).toBe(128) // 127 行 + 表头

    const nameInput = mainTable(page).locator('input[placeholder*="姓名"]').first()
    await nameInput.fill('用户-1')
    // 点击搜索按钮触发（data-test=search-btn 是 SearchForm 测试钩子）
    await mainTable(page).locator('[data-test="search-btn"]').click()
    // 等请求完成 + 列表刷新
    await page.waitForTimeout(800)
    // includes 语义匹配 39 行：用户-1 / 用户-10~19 / 用户-100~127（旧注释"19 行"漏算 100+ 段）
    expect(await totalRows()).toBe(40)
    // 第一页满载但不超过 pageSize
    const filteredRows = await grid.locator('.el-table__body tbody tr').count()
    expect(filteredRows).toBeGreaterThan(0)
    expect(filteredRows).toBeLessThanOrEqual(5)
  })

  test('重置搜索后总行数恢复 127', async ({ page }) => {
    const grid = mainTable(page)
    const totalRows = () => grid.getAttribute('aria-rowcount').then((n) => Number(n))

    const nameInput = mainTable(page).locator('input[placeholder*="姓名"]').first()
    await nameInput.fill('用户-100')
    await mainTable(page).locator('[data-test="search-btn"]').click()
    await page.waitForTimeout(800)
    expect(await totalRows()).toBe(2) // 精确匹配 id=100 一行 + 表头

    // 「重置筛选」按钮（作用域内有 2 个 data-test=reset-btn：筛选重置 + 列设置重置，按可访问名区分）
    await mainTable(page).getByRole('button', { name: '重置筛选' }).click()
    await page.waitForTimeout(800)
    expect(await totalRows()).toBe(128)
  })
})
