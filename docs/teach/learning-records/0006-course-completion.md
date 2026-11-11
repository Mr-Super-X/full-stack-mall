# 学习记录 · 2026-11-11 · 主线六课全交付

## 背景

MISSION（docs/teach/MISSION.md）：**面试讲清这个项目**。用户从零开始，要求循序渐进、以仓库真实代码为教材。

## 已完成交付

| 课 | 主题 | 教材核心 | 状态 |
|---|---|---|---|
| 1 | 一次请求的完整旅程 | WebMvcConfig / AuthInterceptor / Result / GlobalExceptionHandler | ✅ |
| 2 | 登录注册与 JWT | AuthServiceImpl / JwtService / AuthController / UserContext | ✅ |
| 3 | 事务与下单 | OrderServiceImpl（下单事务/条件扣库存/uk 重试/快照/惰性关单） | ✅ |
| 4 | 支付与幂等 | PaymentServiceImpl.notify 八步（验签/金额/三层幂等/资金黑洞 TODO） | ✅ |
| 5 | 秒杀三策略对照 | SeckillDeductStrategy / DbPessimisticDeductor / RedisStockDeductor / benchmark 矩阵 | ✅ |
| 6 | 寄卖与结算闭环 | ConsignmentStatus 状态机 / accept 铸造事务 / PayoutServiceImpl / 佣金计算 | ✅ |

## 观察到的学习行为

- 用户以"继续下一课"节奏推进，未逐课提交测验答案——**最近发展区数据不足**，模拟面试前的理解深度未知。
- 建议下一步：用户完成全部测验后自报正确率，或用第 6 课末尾的"面试官追问"提示做一轮模拟面试，据答题质量定位薄弱课回炉。

## 下次衔接点

- 若测验全对 → 进入模拟面试（深挖秒杀/幂等/事务三主题）
- 若某课错 ≥2 → 该课出"加强版"补练（换代码场景重考同一概念）
- 进阶专题候选：令牌桶限流（RateLimitAspect）、ngram 搜索、容器化部署链路

## 风险与备忘

- 测验答案尚未回收，理解度未经检验——不要在未验证的情况下宣称"已学会"。
- 全部课程素材行号基于 2026-11-11 的 develop 分支；后续代码变更会使课程行号漂移（课程内引用的是文件+行号，文件路径仍准确）。
