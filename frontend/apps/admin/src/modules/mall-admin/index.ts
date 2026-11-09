// mall-admin 模块对外接口（公开 API）。
//
// 模块对外只暴露本文件（§1.2）；消费方必须只 import 本文件。
//
// 统一登录接线 shared 契约（计划 07 v2）：认证归 @vv/shared authApi / userStore，
// 模块级「清商城 cookie」钩子与自建 useMallAuth 已随方案 A 撤销——shared userStore.logout
// 原生指向 /mall/auth/logout（Task 1 Step 3），登出语义免费获得，无需额外挂接。
// 本文件由 Task 2/3 追加业务 composable 导出（useConsignmentReview / usePayoutApproval）。

export {}
