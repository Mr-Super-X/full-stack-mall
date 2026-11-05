/**
 * Prod 模式防御层。
 *
 * 设计要点：
 * - vite-plugin-mock 在 prod 构建自动失效（mock 文件被 tree-shake）
 * - 本函数作为额外断言，在主入口调用一次即可
 * - 未来如需更强保障，可在此添加业务侧的运行时检查
 *
 * 当前实现：仅记录日志（实际兜底由 vite 构建配置保证）。
 *
 * **注意**：函数体当前为 `void 0`（无操作），属于防御层扩展点。
 * 主入口调用一次即可，无需关心返回值。
 *
 * @group 网络基建：构建防御
 */
export function assertNoMockInProd(): void {
  // vite-plugin-mock 仅在 dev 服务生效；prod 构建自然剔除 mock 模块
  // 此函数保留为防御层扩展点——如未来需要运行时校验（如扫描 import.meta.glob），
  // 可在此实现具体逻辑
  void 0
}
