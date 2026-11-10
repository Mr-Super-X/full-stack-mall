-- 4b 压测对账（spec §12.7 恒等式）：
--   DB sold_count = 成功订单数 = Redis 预扣数 − DLQ 深度 − 受理未出单数
-- 超卖守卫：sold_count ≤ seckill_stock 任意时刻恒成立（超卖列应恒 0）。
-- 用法：每组压测跑完在 mall 库执行本脚本，把输出填入 benchmark/README.md 对照表。

SELECT '① 活动库存口径' AS 项,
       CONCAT('sold_count=', sold_count, ' / seckill_stock=', seckill_stock) AS 值
FROM seckill_activity WHERE id = 18;

SELECT '② 成功订单数（type=SECKILL 且挂活动 18）' AS 项, COUNT(*) AS 值
FROM orders WHERE seckill_activity_id = 18 AND type = 'SECKILL';

SELECT '③ 受理表分态' AS 项, status AS 状态, COUNT(*) AS 数量
FROM seckill_order_acceptance WHERE activity_id = 18 GROUP BY status;

SELECT '④ 少卖口径：ACCEPTED 且无对应订单' AS 项, COUNT(*) AS 值
FROM seckill_order_acceptance a
WHERE a.activity_id = 18
  AND a.status = 'ACCEPTED'
  AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.order_no = a.order_no);

SELECT '⑤ 超卖守卫（sold_count > stock 的违规行数，应恒 0）' AS 项, COUNT(*) AS 值
FROM seckill_activity WHERE id = 18 AND sold_count > seckill_stock;

-- ⑥ Redis 侧（容器内执行：docker exec mall-redis redis-cli GET seckill:stock:18）
--    预期 = seckill_stock - sold_count（活动进行中）；ENDED 后 key 已 DEL。
