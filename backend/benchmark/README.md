# 阶段 4b 秒杀压测（三实现 × 五档并发对照实验）

> 证据链第一层产出（spec §9）：拐点曲线数据 + 一致性对照表。JMeter 原始报告入 `results/`，
> 每轮跑完执行 `reconcile.sql` 填下表。

## 环境（QPS 脚注的测量条件）

| 项 | 值 |
|---|---|
| 机器 | 本机 Windows + Docker Desktop（WSL2 后端） |
| 拓扑 | mysql:8.4 + redis:7 + rabbitmq:3.13-management（docker-compose 全容器）+ 后端 `spring-boot:run`（单实例，默认 Hikari 10 连接） |
| 场景 | 活动 18（10 件库存）× N 线程抢同一活动，账号池 500（perf001~perf500，JMeter CSV 轮询 + Cookie Manager 每线程独立会话） |
| 场景脚本 | `seckill-jmeter.jmx`（线程数/爬坡经 `-Jthreads/-Jrampup` 参数注入） |

## 执行步骤（每实现一趟，共三趟）

```bash
# 0. 重建库（新种子 + 500 账号；⚠️ 销毁现有卷数据，全为种子可重建）
docker compose down -v && docker compose up -d

# 1. 启动后端（按实现切换）
SECKILL_STRATEGY=optimistic  mvn spring-boot:run -f backend/pom.xml
# 或 pessimistic / redis

# 2. 每档执行（20/50/100/200/500 线程，结果落 results/）
for T in 20 50 100 200 500; do
  jmeter -n -t backend/benchmark/seckill-jmeter.jmx \
    -Jthreads=$T -Jrampup=$(($T/10)) \
    -l backend/benchmark/results/${SECKILL_STRATEGY}-${T}.jtl \
    -e -o backend/benchmark/results/${SECKILL_STRATEGY}-${T}-report
done

# 3. 每组跑完对账（填下表"超卖/少卖"列）
mysql -h127.0.0.1 -P13306 -uroot -pmall-root mall < backend/benchmark/reconcile.sql
# 跑下一档前重置活动 18：UPDATE seckill_activity SET sold_count=0 WHERE id=18;（并清 orders/受理表——见步骤 0 重建最稳）
```

> **档间重置**：每档跑完把活动 18 恢复（sold_count=0 + 删该活动订单/受理记录），或整体重建库。
> 10 件口径下每档成功单恒为 10，重点看成功率（=10/N）、P50/P99 与错误码分布。

## 三实现对压测矩阵（填实测值）

| 实现 \ 并发 | 20 | 50 | 100 | 200 | 500 |
|---|---|---|---|---|---|
| **optimistic** 成功率 | | | | | |
| **pessimistic** 成功率 | | | | | |
| **redis** 成功率 | | | | | |
| **optimistic** P99(ms) | | | | | |
| **pessimistic** P99(ms) | | | | | |
| **redis** P99(ms) | | | | | |
| 超卖数（全档） | | | | | |
| 少卖数（全档，reconcile ④） | | | | | |

**拐点判读**（spec §12.2）：
- pessimistic 预期在 ≤500 线程内出现 P99 爆炸/成功率骤降（innodb_lock_wait_timeout=5s 已调小）；
- redis 若 500 线程内未现拐点，如实记录「>500 未测」，**不编造数据**。

## 一致性对照表（spec §8，四场景实测填数）

| 场景 | 注入手段 | 超卖 | 少卖 | 重复扣 | 实测结果摘要 |
|---|---|---|---|---|---|
| 正常路径 | — | 0 | 0 | 0 | |
| Redis 挂 | `docker pause mall-redis` | 0 | N（全拒） | 0 | |
| 落库失败 | `SECKILL_MQ_FAILURE_RATE=1`（消费者 3 次后进 DLX，DlxMonitor 回补） | 0 | =DLQ 深度（回补后收敛） | 0 | |
| 重复消费 | DLQ 消息经 management 控制台手动 requeue | 0 | 0 | 0 | |

## 取舍声明（第三层证据链，README 落字 = spec §14 原文）

1. **最终一致，宁可少卖不超卖**：Redis 宕机且无 AOF 持久化时预扣记录丢失 → 少卖且无法自动感知，
   需人工按受理表对账。超卖 = 资损 + 客诉，少卖 = 损失一次成交，代价不对称。
   强一致需 Redis 事务 + DB 本地消息表，吞吐掉约 ___%（压测后填实测）。
2. **不做 Redlock**：单 Redis 实例下分布式锁的复杂度大于收益；扩多实例的演进路径是
   Redis Cluster + 槽位亲和。
3. **限流会误伤**：令牌桶超发时 429 对真实用户不友好——保护系统优先；演进方向是用户画像分级限流。
4. **>500 线程**：本机 Docker 拓扑的瓶颈先在网络与连接池，真实拐点需更大压测环境——如实标注未测。
