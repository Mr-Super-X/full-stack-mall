// mall-admin 模块对外接口（公开 API）。
//
// 模块对外只暴露本文件（§1.2）；消费方必须只 import 本文件。
//
// 统一登录接线 shared 契约（计划 07 v2）：认证归 @vv/shared authApi / userStore，
// 模块导出业务 composable（寄卖审核 / 结算审批）。

/** 寄卖审核（状态筛选 + 通过定价/驳回原因） */
export { useConsignmentReview } from './composables/useConsignmentReview'
export type { AdminConsignmentItem, ReviewPayload } from './apis/consignments'

/** 结算审批（PENDING→CONFIRMED→PAID 三步状态机） */
export { usePayoutApproval } from './composables/usePayoutApproval'
export type { AdminPayoutItem } from './apis/payouts'
