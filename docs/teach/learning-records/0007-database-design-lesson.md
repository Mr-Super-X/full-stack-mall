# 学习记录 · 2026-11-11 · 支线 B 第 7 课交付（数据库从零设计）

## 背景

MISSION（docs/teach/MISSION.md）：**面试讲清这个项目**。主线六课已交付（运行时视角）。用户新诉求："后端是怎么一步步搭建起来完成闭环的，还有 SQL 是怎么创建的"——开启支线 B（构建之路）：第 7 课 SQL/数据库设计，第 8 课后端五步闭环。

## 本课调研事实（素材溯源，供第 8 课复用）

- `backend/sql/init.sql` 379 行，15 张 CREATE TABLE，分 5 域（用户 2 / 商品 5 / 寄卖 1 / 交易 5 / 玩法 2）；文件头自述设计基准 `docs/superpowers/specs/2026-11-06-resale-mall-design.md`、声明"幂等可重跑、无物理外键"。
- **验真发现（课堂挑刺素材）**：顶部 DROP 清单只有 14 张表，漏 `seckill_order_acceptance`（252 行 CREATE 无 IF NOT EXISTS）→ 二次执行必报错；实际兜底是 docker 删卷重建（292-293 行注释）。pom 无 Flyway/Liquibase。
- 唯一键护栏清单：uk_username(36) / uk_default_guard(55) / uk_user_item(170) / uk_order_no(187) / uk_user_activity(188) / uk_payment_no(215) / uk_order_item(230)，分别回扣第 2/4/5/6 课。
- 亮点设计：address.default_guard 生成列（50 行）实现"每用户一个默认地址"；orders.address_snapshot(181) 与 order_item.item_snapshot(196) JSON 快照；product.ft_search ngram(94)；product_item.version(106)。
- 种子数据三资产：相对时间 NOW()（263-266）、递归 CTE 500 压测账号（283-297）、双货源剧本（自营 13 + 寄卖 2 + LISTED 寄卖单 376-378）。
- 表随阶段生长（git log --reverse 证据）：阶段 1-3 十三张表 → 阶段 4 秒杀（bd06d43）→ 4 搜索 d1dd46d 挂 ft_search → 4b 8c06144 加受理登记表。
- 构建路线图素材已备：docs/superpowers/plans/ 01-12 共 12 个实施计划，对应 5 阶段；backend/ 提交序列与计划一一对应。

## 第 8 课设计预案

- 主题：后端五步闭环——每阶段交付物 + 验收方式 + 为什么是这个顺序（最小可跑闭环 → 业务纵深 → 管理面 → 高并发演进 → 部署）。
- 主线：git log 提交序列 ↔ plans 编号 ↔ 各阶段"点亮"的表/端点对照。
- 闭环定义建议：买家能下单付款、卖家能寄卖收钱、平台能结算——钱货两讫即最小闭环；秒杀/搜索是增量不是闭环前提。

## 观察到的学习行为与风险

- 用户延续"继续下一课"节奏，测验答案仍未回收——第 7 课 5 题自测数据待报。
- 行号基准：2026-11-11 develop 分支；init.sql 若再演进（第 8 课素材期），本课行号会漂移。
- 禁止在测验未回收时宣称"已学会"。

## 下次衔接点

- 用户做完第 7 课自测并反馈 → 交付第 8 课（构建闭环）；若某题错 ≥2 → 该知识点先补练再推进。
