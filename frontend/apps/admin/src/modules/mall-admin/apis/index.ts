// mall-admin 模块 API 层 barrel（模块内强内聚，§1.2）。
// 显式具名 re-export：barrel 会让 JSDoc 丢失，逐导出补注释（注释规范陷阱 #3）。

/** 寄卖审核端点（/mall/admin/consignments/*）与 ConsignmentDTO 对齐类型 */
export { adminConsignmentApi } from './consignments'
export type { AdminConsignmentItem, ReviewPayload } from './consignments'

/** 结算审批端点（/mall/admin/payouts/*）与 PayoutDTO 对齐类型 */
export { adminPayoutApi } from './payouts'
export type { AdminPayoutItem } from './payouts'
