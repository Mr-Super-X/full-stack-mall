# full-stack-mall 转卖商城

四种玩法的全栈商城：**二手寄卖（主线）** + 限时秒杀 + 预售众筹 + 订阅盲盒（后两者 v2，枚举已占位）。Vue3 monorepo + Spring Boot + MySQL。

## 核心洞察：四种玩法 = 两种货源

```
用户货源 ──→ 二手寄卖（C2C，用户既是买家也是卖家）

平台货源 ──→ 限时秒杀（自营尾货清仓）
         ──→ 订阅盲盒 / 预售众筹【v2】
```

`Product` 以 `ownerType`（自营/寄卖）+ `saleMode`（普通/秒杀/众筹/订阅）建模；寄卖商品全平台唯一一件（库存恒 1），自营商品才有规格库存池——统一由 `ProductItem` 承载。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 + TypeScript + Vite + Pinia（pnpm monorepo：apps/h5 买家端 Vant · apps/admin 管理端 Element Plus） |
| 后端 | Java 17 · Spring Boot 3.5.9 · MyBatis-Plus 3.5.18.1 |
| 数据库 | MySQL 8.4（Docker，端口 13306，库 `mall`） |
| 缓存 | Redis（阶段 4 秒杀引入，MVP 不用） |
| 认证 | JWT + HttpOnly Cookie（SameSite=Lax） |
| 支付 | PaymentProvider 抽象：FakeProvider（开发）/ 支付宝沙箱（联调） |
| 部署 | Docker + 云服务器（阶段 5） |

## 架构形态

```
浏览器 ──→ 前端 SPA ──HTTP REST + JWT──▶ Spring Boot API ──▶ MySQL 8.4
                                            ├─▶ Redis（秒杀演进时引入）
                                            └─▶ 支付宝沙箱网关
```

## 阶段路线（每阶段有可运行产物）

| 阶段 | 内容 | 产物 | 状态 |
|------|------|------|------|
| 0 | 需求梳理 + ER 图 + 接口契约 | 设计文档 | ✅ 2026-11-06 |
| 1 | 商品域重构 + JWT 鉴权 + 前端对接 | **能逛的商城** | ✅ 2026-11-06 |
| 2 | 寄卖全流程 + 地址 + 购物车 + 下单 + 模拟支付 | **能买能卖的商城 ⭐MVP** | ✅ 2026-11-09 |
| 3 | 订单流转 + Payout 结算 + 管理后台 | **能运营的商城** | ✅ 2026-11-09（后端；admin 页面见计划 07） |
| 4 | 秒杀（条件更新 → Redis 预扣演进）+ 搜索优化 | **有技术深度的商城** | ⬜ |
| 5 | 部署上线 + README 作品集化 | **作品集素材** | ⬜ |

## 快速开始

```bash
# 后端（MySQL 走 Docker；应用本体本机 mvn 启动，需 JDK 17 + Maven 3.8.9+）
cd backend
docker compose up -d mysql   # MySQL 8.4，端口 13306，root 密码 mall-root（仅本地）
mvn spring-boot:run          # Spring Boot，端口 18080，context-path /api

# 前端（pnpm monorepo，Node >=22.18，pnpm >=11）
cd frontend
pnpm install
pnpm -C apps/h5 dev          # h5 买家端（Vant）
```

## 目录结构

```
full-stack-mall/
├── frontend/   # Vue3 pnpm monorepo（apps/* × packages/*，治理规则见 frontend/AGENTS.md）
├── backend/    # Spring Boot（按业务分包，MySQL Docker 化，sql/init.sql 幂等可重跑）
└── docs/       # superpowers/specs 设计文档 · superpowers/plans 实施计划
```

## 文档索引

- **设计基准（single source of truth）**：[docs/superpowers/specs/2026-11-06-resale-mall-design.md](docs/superpowers/specs/2026-11-06-resale-mall-design.md)
- 实施计划：`docs/superpowers/plans/`
- 前端工程规范：`frontend/AGENTS.md`

## 技术难点（本项目的技术含金量）

1. **防超卖**：数据库条件更新（MVP）→ Redis 预扣 + 异步落库（阶段 4 演进）
2. **事务边界**：下单 = 建订单 + 扣库存 + 清购物车，原子性
3. **支付幂等**：验签 + paymentNo 幂等 + 状态机单向迁移（异步回调驱动，不靠前端点击）
4. **寄卖审核流 + 分账结算**：ConsignmentListing 六态状态机；确认收货才生成 Payout——买家付款 ≠ 卖家钱到手
5. **快照铁律**：OrderItem 定格下单瞬间的价格/标题/成色，永不回联实时商品

