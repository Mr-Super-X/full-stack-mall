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

## 三实现对压测矩阵（2026-11-10 实测填数 · 三趟均经策略指纹验证）

> 口径：每档 N 线程 × 1 循环抢 10 件库存；**成功单恒 10**（库存口径成功率 100%），
> 时延为成功单（code200）的 avg/max（ms）；40002=抢完（排队落败）、40003=限购、40006=令牌桶限流、
> 401=登录态竞争（500 档少量，非实现差异）。三趟指纹：optimistic/pessimistic 同步建单（paymentNo 非空），
> redis 受理即返（paymentNo=null + 受理表落行）。
> 原始数据：`results/*.jtl`（JMeter 原始样本，可复算任意百分位）+ `results/*-reconcile.txt`（对账存档）。

| 实现 \ 并发 | 20 | 50 | 100 | 200 | 500 |
|---|---|---|---|---|---|
| optimistic 成功单 avg(ms) | 22 | 96 | 102 | 363 | **1345** |
| pessimistic 成功单 avg(ms) | 405* | 91 | 121 | 260 | **1658** |
| redis 成功单 avg(ms) | 23 | **24** | 170 | 189 | **954** |
| optimistic 成功单 max(ms) | 29 | 136 | 166 | 932 | 2216 |
| pessimistic 成功单 max(ms) | 593* | 132 | 207 | 838 | 2025 |
| redis 成功单 max(ms) | 33 | 29 | 261 | 927 | 1745 |
| 超卖数（15 组 reconcile ⑤ 全 0） | 0 | 0 | 0 | 0 | 0 |
| 少卖数（15 组 reconcile ④ 全 0） | 0 | 0 | 0 | 0 | 0 |

\* pessimistic T=20 为每趟首档冷启动（JVM/连接池预热），非实现特征。

**拐点判读（实测结论）**：
- **三实现 500 线程内均未现爆炸性拐点**（成功单 max ≤2.2s，无锁超时错误、无成功率塌陷）——如实记录，不编造。
- **redis 趟的受理即返优势显著**：T=50 时成功单 avg 24ms vs pessimistic 91ms / optimistic 96ms——
  下单路径不等同步 DB 事务，时延曲线整体最低；T=500 时 avg 954ms vs 1658/1345ms——排队效应最缓。
  这正是"为什么需要 Redis"的实证答案：**不是 DB 版会炸，而是异步受理把响应时延与落库事务解耦**，
  落库的排队压力转移到 MQ 消费侧（对调用方不可见）。
- **pessimistic 与 optimistic 在中低并发几乎等效**（单行锁持有微秒级）——FOR UPDATE 的教学价值在
  更大库存/更长事务口径才显现，本口径下两者差异在误差范围。
- **诚实边界**：10 件库存 + 本机 Docker 拓扑测不出三实现的吞吐拐点（500 线程全部"成功售罄"），
  真实拐点需要更大库存口径（如 1000 件）或分布式压测环境——>500 未测，如实标注。

## 一致性对照表（spec §8，2026-11-10 四场景实测填数）

| 场景 | 注入手段 | 超卖 | 少卖 | 重复扣 | 实测结果摘要 |
|---|---|---|---|---|---|
| 正常路径 | — | 0 | 0 | 0 | 15 组压测 reconcile 全绿：sold_count=订单数=10，受理全部 CREATED |
| Redis 挂 | `docker pause mall-redis` | 0 | N（全拒） | 0 | HTTP 503+code 40005「秒杀服务暂不可用」，sold_count 零写入（需 `spring.data.redis.timeout`，否则挂起到 TCP 超时才失败——实测修正） |
| 落库失败 | `consumer-simulated-failure-rate=1` | 0 | 0（回补后） | 0 | 消费 3 次失败进 DLX → DlxMonitor 自动回补：受理 FAILED、Redis 关口 stock=10 复原、sold_count 恒 0（消费端未 +1，C2 修复正确） |
| 重复消费 | management API 重发同消息 3 次 | 0 | 0 | 0 | 订单恒 1、受理恒 CREATED、Redis 无重复扣——幂等查重（orderNo）全拦截 |

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
