# 更新日志

本项目的所有显著变更都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本按项目的**阶段交付**组织（阶段 0 ~ 5，见 `docs/superpowers/specs/2026-11-06-resale-mall-design.md` 路线章节），
每个阶段都有可运行产物。

## [Unreleased]

### Added（前端 · admin 后台 + 统一登录，计划 07）

- **统一登录接线商城后端**：`@vv/shared` 认证契约四端点改指 `/mall/auth/*`（login/register/me/logout），`userProfileSchema.transform` 把商城 `UserInfoDTO` 映射为 shared `UserProfile`（`ROLE_PERMISSIONS`：ADMIN→`mall:admin`、USER→`mall:user`，未知 role 空数组不静默放行）——apps/auth 统一登录页 / apps/admin 守卫 / apps/h5 登录全 monorepo 一套商城账号会话
- **admin 经网关同源接后端**：`packages/config/src/proxy.ts` 补 `/api → 18080` 代理（原空壳占位），admin `VITE_API_BASE_URL` 用相对 `/api` 经 `dev:gateway` 8080 同源代理，HttpOnly Cookie（path=/api）同源匹配，统一登录会话跨 app 漫游（P4 协议落地）
- **apps/admin 商城管理后台**（`mall-admin` 模块，`pnpm new-module` 骨架）：
  - 寄卖审核队列页：`GET /mall/admin/consignments` 状态 Tab 筛选 + ProTable，SUBMITTED 行「通过」（平台定价+佣金率 dialog）/「驳回」（原因 + useConfirm 二次确认）
  - 结算审批页：`GET /mall/admin/payouts` 三步状态机（PENDING→CONFIRMED→PAID），`useConfirm` 拦截，金额列 hover 拆账恒等提示
  - 两业务路由 `meta.permissions=['mall:admin']`（`checkPermission` 拦截，seller 登录后 403 无权限页；后端 AdminInterceptor 独立 403 双保险）
- **表格迁移 ProTable**：业务页原生 `el-table` + 手写三态 → 全局组件 `ProTable`（columns + request-api 声明式，内建 Loading/Error/Empty 与工具栏），去掉手动 import element-plus icons
- **h5 登录切换**：`h5-mall` 删除自有 auth 端点，`useAuthForm` 改走 shared `userStore.login` / `authApi.register`（与 admin/auth 同一套会话与权限模型，不再平行登录态）
- **mock 对齐**：`/mock/mall/auth/*` 处理器（dev `rawResponse` + prod 内联）返回商城 `UserInfoDTO` 形状（ADMIN 演示账号），`check:mock-wiring` 保持绿

### Added（前端 · h5 买家端，计划 08）

- **tabbar 常驻**（`h5-mall` 模块外壳 `views/shell.vue`）：MallTabbar + `useMallTabNav` + 新增 `useTabbarRouteSync`（route.name ↔ activeTab，浏览器前进/后退/刷新选中态跟随路由）上移至模块外壳——切 tab 页不消失；订单/工作台挂外壳下享常驻 tabbar，详情/登录/404 平级不渲染（模块边界裁决：AGENTS.md §1.2 禁 layouts 引用 modules/，常驻落模块外壳而非 `layouts/h5`）；首页移除局部 tabbar 与底部留白
- **买家订单页**（`views/orders.vue`）：`GET /mall/orders` 卡片列表（订单号/商品快照/金额/状态标签），SHIPPED 订单「确认收货」（`useConfirm` 二次确认 + 防重点击），成功/400 均 reload 列表对齐真态（错误 toast 后端消息，不留幻觉成功）；`useMallTabNav` 补漏接线「我的」tab → 订单页
- **卖家工作台**（`views/seller.vue`）：van-tabs 双列表——我的寄卖（`GET /mall/consignments/mine`，PRICED 单「接受定价」`useConfirm` 明示不可撤销 + 防重，驳回原因展示）+ 售出订单（`GET /mall/orders/sold`，PAID 单「发货」）；订单页顶部「我是卖家」入口分流（后端无 seller 角色字段，user tab 固定落订单页）
- **页面级登录守卫**：订单/工作台路由 `beforeEnter requireMallLogin`（Session 'auth' 标记 → 模块内 H5MallLogin 带 redirect 回跳；h5 全局无登录守卫，拦截落路由级）

### Fixed（前端 · admin 后台）

- 状态 Tab 切换不重取数据：ProTable 靠分页参数变化触发 `request-api` 重取，不因闭包里的 status 变化自动刷新——`:key=status` 强制重挂载触发 `onMounted` 重拉（浏览器实测修复）

## [阶段 3] - 2026-11-09

可运行产物：订单全生命周期流转 + 平台对卖家的三步结算闭环（后端；admin 页面见计划 07）。

### Added（后端 · 阶段 3：订单流转与 Payout 三步结算）

- 支付成功联动寄卖单 `LISTED → SOLD`（条件 UPDATE 状态迁移，`PaymentServiceImpl` 注入 `ConsignmentListingMapper`）
- 卖家订单列表 `GET /mall/orders/sold`：按 `OrderItem.sellerId` 归集我售出的订单，含商品快照/订单状态/金额，支付信息批量加载
- 发货 `POST /mall/orders/{id}/ship`：主体鉴权（寄卖件验卖家本人，不符 404；自营件验 ADMIN，不符 403），`PAID → SHIPPED` 条件迁移
- 确认收货 `POST /mall/orders/{id}/confirm`：`SHIPPED → COMPLETED`，同事务按寄卖件生成 `Payout PENDING`
  - 佣金经 `productItem → consignment_listing.listed_product_id` 回联取率，`gross × rate / 100`（HALF_UP 两位小数），`sellerAmount = gross - commission`
  - `uk(order_item_id)` 幂等：重复确认不产生重复 Payout
- Payout 审批三步条件迁移（`payout` 新包）：管理员列表（默认 PENDING）/ `confirm`（PENDING → CONFIRMED）/ `pay`（CONFIRMED → PAID），PAID 时寄卖单 `SOLD → SETTLED` 联动

### Fixed（后端 · 阶段 3 终审修复）

- `PayoutServiceImpl.confirm` 补充 `@Transactional`，与 `pay` 对齐
- `OrderServiceImpl.parseAddress` / `toItemDTO` 快照 JSON 解析失败的静默 catch 补充 `log.warn`（兜底展示但可追踪，不吞错）

## [阶段 2] - 2026-11-09

可运行产物：买家直购闭环（购物车 → 下单 → 模拟支付）+ 卖家寄卖申请到商品上架全链路。

### Added（后端 · 阶段 2 下半场：购物车下单与模拟支付）

- 购物车 CRUD（MySQL 存储）：`GET/POST/PUT/DELETE /mall/cart/**`，勾选状态管理
- 下单 `POST /mall/orders`：单 `@Transactional` 内完成地址归属校验 → 购物车归属校验 → 快照行组装（`itemSnapshot` JSON + 价格快照，快照铁律）→ 条件 UPDATE 扣库存（行数 0 即 `STOCK_NOT_ENOUGH` 回滚）→ 订单落库（订单号时间戳+随机，重试 ≤3）→ 清空购物车 → 创建 `Payment CREATED`
- 惰性关单：`expiredAt` 下单时写入，查询时发现过期则同事务标记 `CANCELLED` 并回补库存，无需调度器
- 模拟支付（`PaymentProvider` 抽象 + `FakeProvider` 本地闭环）：
  - `GET /mall/payments/fake/checkout` 收银台页面（金额字符串携带，对齐真实支付宝）
  - `POST /mall/payments/fake/notify` 异步通知：验签（md5）→ `paymentNo` 幂等 → 状态机单向迁移 → 金额校验 → 订单 `PAID` 条件迁移（行数守卫防销量重复累加）
- 订单查询：`GET /mall/orders`（我的订单列表）、`GET /mall/orders/{id}`（详情，含地址/商品快照组装）
- 寄卖商品直购约束：寄卖件库存恒为 1，不走购物车，报错 `CONSIGNMENT_DIRECT_ONLY`

### Added（后端 · 阶段 2 上半场：寄卖全流程与地址 CRUD）

- 寄卖申请 `POST /mall/consignments`：用户提交闲置（标题/描述/成色/期望价/类目/图片）
- 我的寄卖列表 `GET /mall/consignments/mine`、详情 `GET /mall/consignments/{id}`
- 管理员审核 `GET /mall/admin/consignments` + `POST /mall/admin/consignments/{id}/review`：`SUBMITTED|REVIEWING → PRICED/REJECTED` 条件迁移（含平台定价与佣金率）
- 卖家接受定价 `POST /mall/consignments/{id}/accept`：单事务铸造商品（`Product ownerType=CONSIGNMENT` + `ProductItem stock=1` + 图片），`PRICED → LISTED` 条件迁移防重复铸造
- 地址 CRUD `GET/POST/PUT/DELETE /mall/addresses/**`：归属校验、默认地址唯一性（MySQL 生成列 `default_guard` + 唯一键兜底并发）

### Fixed（前端 · 阶段 1 遗留）

- 分类 Tab 不跳转：新增 `useMallTabNav` 组合式 API，grid Tab 跳转列表页，未实现 Tab 回退首页并提示（`312eb79`）

### Chore

- 删除冗余的 GitHub issue 模板与 CI/CD 配置文件（`0ed314d`）

## [阶段 1] - 2026-11-06

可运行产物：H5 买家端浏览器真实可逛（首页/列表/详情对接真实后端），注册登录鉴权闭环。

### Added（后端：商品域重构与 JWT 用户鉴权）

- 商品域按设计蓝图重建：`Product`（`ownerType` PLATFORM/CONSIGNMENT + `saleMode` NORMAL/SECKILL/CROWDFUND/SUBSCRIPTION，后两者 v2 占位）/ `ProductItem`（多 SKU 库存）/ `ProductImage` / `Category`
- 统一响应信封 `{code, message, data}`（`code=200` 成功），分页统一 `PageResult{list,total,page,pageSize}`，业务错误 HTTP 200 + 非 200 业务码
- JWT 鉴权（jjwt 0.12.6 HS256）：注册/登录 `POST /mall/auth/register|login`（BCrypt 密码散列），HttpOnly Cookie 携带，`AuthInterceptor` 注入 `UserContext`
- `AdminInterceptor`：`/mall/admin/**` 仅 ADMIN 角色可访问
- 商品接口：首页聚合 `GET /mall/home`、列表 `GET /mall/products`（分页/类目筛选）、详情 `GET /mall/products/{id}`（含 SKU 与图片）
- 种子数据：3 用户（admin/seller/buyer）+ 13 个自营多 SKU 商品 + 2 个寄卖商品
- 设计文档与 5 阶段路线：`docs/superpowers/specs/2026-11-06-resale-mall-design.md`

### Added（前端：H5 对接后端与登录注册）

- `h5-mall` 模块：首页（轮播/分类 Tab/商品流）、列表页（分页加载）、详情页（轮播 + 成色报告 + 卖家卡片）、登录/注册页、404 页
- `apis/index.ts` 对接真实后端契约；`useMallHome` / `useProductList` / `useProductDetail` / `useAuthForm` 组合式 API
- 统一 `http.ts`（axios `withCredentials`），分页适配器对接后端 `PageResult` 字段
- vitest 配置内联 `vant` 依赖修复 CSS 加载

### Fixed（前端）

- 首页异步内容不可见：`useReveal` 增加 MutationObserver 监听动态插入元素（`2c361ce`）
- 详情页轮播不显示修复（`2c361ce`）

## [阶段 0] - 2026-11-05

可运行产物：monorepo 工程骨架可安装、可启动。

### Added

- `frontend` 前端工程初始化：pnpm workspace + turbo monorepo，Vue 3 + TypeScript + Vite + Pinia + Vant（H5 买家端）+ UnoCSS（`3b61b7a`）
- 根目录 `.gitignore` 补全（`c80d38c`）
- `README.md` 项目结构说明（`0605002`）

[Unreleased]: https://github.com/Mr-Super-X/full-stack-mall/compare/9cd9862...HEAD
[阶段 3]: https://github.com/Mr-Super-X/full-stack-mall/compare/312eb79...9cd9862
[阶段 2]: https://github.com/Mr-Super-X/full-stack-mall/compare/2c361ce...312eb79
[阶段 1]: https://github.com/Mr-Super-X/full-stack-mall/compare/0605002...2c361ce
[阶段 0]: https://github.com/Mr-Super-X/full-stack-mall/commits/0605002
