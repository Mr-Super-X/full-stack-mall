/**
 * ProTable utils barrel —— 配套工具函数唯一出口。
 *
 * 项目角色：ProTable 相关纯函数工具的聚合出口，业务方经
 * `import { exportCsv, importCsv } from '@components/ProTable/utils'` 按需取用。
 *
 * JSDoc IDE 提示规范：barrel 用 `export { type X }` 保留真实定义位置的注释（CLAUDE.md §5.1 陷阱 #3）。
 *
 * @group ProTable 工具
 */

/** CSV 导出 —— BOM + RFC4180 转义 + 浏览器下载 @see ./exportCsv.ts @group ProTable 工具 */
export { exportCsv, type CsvColumn, type ExportCsvOptions } from './exportCsv'

/** CSV 导入 —— File → 行数据（引号感知状态机 + 表头列名映射）@see ./importCsv.ts @group ProTable 工具 */
export { importCsv, parseCsvText, type ImportCsvOptions } from './importCsv'
