/**
 * E2E 关键路径 —— 选中→批量操作（v3.5 PR1-A Task 13；monorepo 版迁入 docs project）
 *
 * 路径：
 *   1. 打开 `/demo/pro-table-overview`（docs app 全站白名单公开，免登录直达）
 *   2. 勾选 3 行 → 断言 SelectionBar 出现 + 显示「已选 3 项」
 *   3. 验证 SelectionBar 的 role=status + aria-live=polite
 *   4. 点 SelectionBar 清除按钮 → 断言勾选清空 + SelectionBar 消失
 *
 * 迁移说明（2026-10-23）：
 * - 蓝本为单应用 tests/e2e/protable/selection-batch.spec.ts，选择符原样沿用
 *   （:has(.el-checkbox__input) / [role=status][aria-live=polite] / [data-test=selection-clear]
 *   均在 @vv/ui 包保留）；仅 demo 模块物理归属变为 apps/docs。
 * - overview 页含两个 ProTable——第一个（主表）无多选列；多选/跨页选择/SelectionBar
 *   在第二个表（474 行选择演示）。用 :has() 定位"含行 checkbox 的 ProTable"，
 *   不依赖 DOM 顺序。
 *
 * dev server 由 playwright.config.ts docs project 的 webServer 自动启动。
 *
 * @group E2E 测试
 */
import { test, expect, type Page } from '@playwright/test'

/**
 * 选中→批量操作目标表：overview 页含两个 ProTable——
 * 第一个（主表）无多选列；多选/跨页选择/SelectionBar 在第二个表（474 行选择演示）。
 * 用 :has() 定位"含行 checkbox 的 ProTable"，不依赖 DOM 顺序。
 */
function selectTable(page: Page) {
  return page.locator('.vv-pro-table:has(.el-table__body .el-checkbox__input)').first()
}

test.describe('ProTable E2E 选中→批量操作', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/pro-table-overview')
    await expect(selectTable(page).locator('.el-table__body tbody tr').first()).toBeVisible({
      timeout: 10000,
    })
  })

  test('勾选 3 行 → SelectionBar 出现 + 「已选 3 项」+ aria-live=polite', async ({ page }) => {
    // 勾选前 3 行（element-plus 内置 checkbox 在 .el-table__body tbody 第一列）
    const checkboxes = selectTable(page).locator('.el-table__body tbody tr .el-checkbox__input')
    const count = Math.min(3, await checkboxes.count())
    for (let i = 0; i < count; i++) {
      await checkboxes.nth(i).click()
    }

    // SelectionBar 应出现（role=status）
    const selectionBar = selectTable(page).locator('[role="status"][aria-live="polite"]').first()
    await expect(selectionBar).toBeVisible()
    await expect(selectionBar).toContainText('已选')
    await expect(selectionBar).toContainText('3')
    await expect(selectionBar).toContainText('项')

    // 验证 aria-live 播报区也更新
    const liveRegion = selectTable(page).locator('span.sr-only[aria-live="polite"]').first()
    await expect(liveRegion).toContainText('已选 3 项')
  })

  test('点 SelectionBar 清除按钮 → 勾选清空 + SelectionBar 消失', async ({ page }) => {
    // 勾选 2 行
    const checkboxes = selectTable(page).locator('.el-table__body tbody tr .el-checkbox__input')
    await checkboxes.nth(0).click()
    await checkboxes.nth(1).click()

    // 出现 SelectionBar
    await expect(
      selectTable(page).locator('[role="status"][aria-live="polite"]').first()
    ).toBeVisible()

    // 点击清除按钮（data-test=selection-clear）
    await selectTable(page).locator('[data-test="selection-clear"]').click()

    // SelectionBar 消失（v-if 卸载）
    await expect(selectTable(page).locator('[role="status"][aria-live="polite"]')).toHaveCount(0)

    // 验证所有 checkbox 已取消勾选（is-checked class 被移除）
    const checkedCount = await selectTable(page)
      .locator('.el-table__body tbody tr .el-checkbox__input.is-checked')
      .count()
    expect(checkedCount).toBe(0)
  })

  test('SelectionBar 清除按钮 aria-label="清除选择"', async ({ page }) => {
    const checkboxes = selectTable(page).locator('.el-table__body tbody tr .el-checkbox__input')
    await checkboxes.nth(0).click()

    const clearBtn = selectTable(page).locator('[data-test="selection-clear"]')
    await expect(clearBtn).toHaveAttribute('aria-label', '清除选择')
  })
})
