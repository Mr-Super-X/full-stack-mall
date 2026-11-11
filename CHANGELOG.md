# 更新日志

本项目的所有显著变更都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本按项目的**阶段交付**组织（阶段 0 ~ 5，见 `docs/superpowers/specs/2026-11-06-resale-mall-design.md` 路线章节），
每个阶段都有可运行产物。

## [Unreleased]

### Changed（代码风格 · 2026-11-11）

- **测试方法名全量英文化**：backend/src/test 下 31 个文件约 172 处中文测试方法名改为英文（`shouldXxx_whenYyy` / `testXxx` 句式），用户规则「禁止中文方法名」（含测试方法名）；@DisplayName 中文值保留（展示文案不受规则约束），测试逻辑零改动，209 用例全绿

### Added（阶段 5：部署上线 + README 作品集化，2026-11-11）

#### 后端
- **应用本体容器化**：`backend/Dockerfile`（multi-stage：maven:3.9-eclipse-temurin-17 构建可执行 JAR → eclipse-temurin:17-jre-alpine 运行，非 root + busybox wget 健康检查 `/api/mall/product/list`）；构建期不跑测试（209 用例由本地 mvn 门禁承担），可复现由 pom 锁定版本 + base image tag 锁定保障

#### 部署
- **根目录全栈 compose**：`docker compose up -d` 一键起 web(nginx 托管 6 app 产物 + /api 反代，:8080 唯一对外口) + backend(JAR) + mysql/redis/rabbitmq（基础设施仅容器网络）；RabbitMQ 首启建 mall/mall 替代 guest（loopback_users 禁远程）；教学密钥显式进 compose（生产必须经环境变量覆盖）
- **后端容器时区修正** `JAVA_TOOL_OPTIONS=-Duser.timezone=Asia/Shanghai`——init.sql 时间窗按上海墙钟写入，JVM 默认 UTC 致秒杀时间窗误判 40001（全栈冒烟实测捕获）
- **nginx 根 302 → /h5/h5-mall**（favicon/portal 落地页保留可访问）

#### 前端
- **存量修复：登录不再预载模板字典**——`PRELOAD_DICT_KEYS(user_status/role)` 为模板遗留，mall 后端无 `/dict` 端点，登录后预载触发 500「系统繁忙」toast ×2（订单页可见）；业务模块零字典消费（useDict 声明式加载保留在 dict.ts），user store 登录路径移除 preloadDict 调用（user.spec 断言反转）

#### 文档
- **README 作品集化**：黄金一页「技术亮点」区（4b 压测三层证据摘要：三实现对照数字 + 取舍金句 + 证据链接）+「功能截图」区六张全栈实截（h5 买家链路/admin/RabbitMQ 队列）+ 深读索引
- **截图素材入库** `docs/screenshots/`（六张，全栈容器实截）

### Added（后端 · 阶段 4b：秒杀高并发演进）

- **三实现配置开关** `seckill.strategy`（optimistic 条件更新 / pessimistic FOR UPDATE 对照组 / redis Lua+MQ 异步出单）：同一契约三实现，对照实验公平性由建单三步抽 `SeckillOrderAssembler` 共用保证
- **Redis Lua 预扣**：`seckill:stock:{id}` 关口三分支原子脚本（1 成功/0 抢完/-1 缺失/-2 占位；SET NX 失败返 Lua false 非 0，`== 0` 判断会让限购失效——TDD 捕获已修）+ key 缺失 DB 自愈重建 + 占位 key TTL 900s 对齐订单超时 + 生命周期挂接（激活 SET/关单 INCR/结束与取消 DEL，失败仅 warn 不阻断）
- **RabbitMQ 完全异步出单**：受理即返（Controller 预生成 orderNo）→ 受理表同事务落库（本地消息表简化形态）→ `afterCommit` 发 MQ（防幽灵订单）→ 消费者幂等查重重试（x-retry-count 重新发布——requeue 不保留 header）→ DLX 死信由 DlxMonitor 自动回补（受理置 FAILED + Redis INCR，不动 DB：消费端未 +1，-1 会误减他人售出）；发送失败/事务回滚双路 INCR 补偿
- **令牌桶限流** `@RateLimit` + AOP 双层桶（全局+用户，Lua 原子），超限 40006/HTTP 429；Redis 挂了限流放行（warn——限流非正确性关卡）
- **错误码 40005/40006 + HTTP 语义映射**（503/429；存量业务码维持 200+body code 信封契约）；`GET /mall/seckill/orders/{orderNo}` 轮询端点（订单优先→受理表回退→404，归属校验防越权探测）
- **故障注入开关** `consumer-simulated-failure-rate`（启动 warn + 消费 warn；一致性对照表"落库失败"场景）
- 一致性对照表四场景实测（spec §8）：正常 15 组全绿 / Redis 挂=503+40005 零写入（`spring.data.redis.timeout=3s` 快速失败——默认无超时会挂起到 TCP 超时，实测修正）/ 落库失败=DLX 回补收敛（受理 FAILED+关口复原+sold_count 恒 0）/ 重复消费×3=订单恒 1
- 三实现对压测矩阵（JMeter，20/50/100/200/500 线程 × 10 件库存，策略指纹验证）：redis 趟受理即返优势显著（T=50 成功单 avg 24ms vs pessimistic 91/optimistic 96），15 组超卖/少卖全 0；`benchmark/` 资产入库（jmx/users.csv/reconcile.sql/README 含实测数据与取舍声明）

### Added（前端 · h5 买家端 · 阶段 4b）

- **秒杀异步出单轮询**：`useSeckillOrderPolling`（setInterval 1s/上限 15s/卸载自动清理/stop 以 TIMEOUT 收尾防 Promise 泄漏）；结算页受理态分支（paymentNo 缺失→「排队出单中…」→ 轮询到 CREATED 携 paymentNo 跳既有收银台，FAILED 提示库存已回补）；40005/40006 局部特判文案（shared 层按 HTTP 状态取消息不含业务语义，不改全局）

### Fixed（前端 · h5 买家端）

- **列表页输入态误吞浏览态（4c 回归）**：4c 以「keyword 为空」判定输入态，tabbar「分类」入口进列表页（keyword 恒空）只见历史/热搜面板、商品列表不可见——改为搜索框 focus 判定（focusin/focusout 冒泡监听），失焦 + keyword 空回全量列表，回车提交主动 blur 出结果态

### Added（后端 · 阶段 4c：列表搜索优化）

- **ngram 全文索引**：product 表 `FULLTEXT KEY ft_search (name, selling_point, tag) WITH PARSER ngram`；`selectSummaryPage` 的 keyword 条件由 `LIKE '%kw%'`（前导模糊不走索引）改 `MATCH ... AGAINST (? IN BOOLEAN MODE)`
- **SearchQuerySupport.sanitize**：BOOLEAN 操作符（`+-~*><()"@`）替换空格防 AGAINST 语法 500、连续空白压缩、空词返 null 回退全量
- **热搜词接口** `GET /mall/search/hot-words`（匿名）：运营位常量 8 词（接入配置中心是 v2 事）
- 分词实测记录：二字词「条纹」命中；单字「恤」经预编译参数返回空（ngram 短查询前缀行为差异，不报错即达标——验收口径）；「T恤」vs 商品名「T 恤」空格差异不跨匹配（ngram 固有边界，v2 可查询归一化）

### Added（前端 · h5 买家端 · 阶段 4c）

- **列表页搜索增强**：输入态（keyword 为空）渲染「搜索历史」（localStorage 去重置顶/上限 10/可清空，隐私模式降级不抛错）+「热门搜索」（后端常量 8 词）chips；点击词或回车提交记录历史并触发查询；结果态既有列表整体替换（列表不空载）

### Added（后端 · 阶段 4a：秒杀业务闭环）

- **秒杀场次域**（`com.fullstackmall.shop.seckill` 新包，表阶段 0 已建零迁移）：`seckill_activity` 实体/Mapper/`SeckillStatus`（PENDING/ACTIVE/ENDED/CANCELLED），`orders` 加 `seckill_activity_id` + `uk_user_activity` 唯一键（一人一场并发兜底）
- **admin 场次管理**：创建（限购恒 1 + 单 SKU 自营挂载校验 + 划拨事务 `stock>=N` 行数守卫）/取消（仅 PENDING，归还划拨库存）/分页；`GET /mall/admin/seckill-activities/products` 候选商品（单 SKU 有库存，DB 过滤 + 内存双保险）
- **C 端活动查询** `GET /mall/seckill/active`（匿名）：live/upcoming 分组；过期 ACTIVE 读路径惰性推进 ENDED + 归还剩余（同事务），到点 PENDING 惰性激活
- **秒杀下单** `POST /mall/seckill/{id}/orders`（Auth 拦截）：七步事务（查活动→惰性推进→挂载校验含商品在售→限购查数→扣独立池条件更新 `ltSql(sold_count, seckill_stock)`→建单快照定格秒杀价→返回 orderNo/paymentNo）；四错误码 40001 未开始/已结束、40002 已抢完、40003 超限购、40004 撞唯一键（+ 计划内 `SECKILL_NOT_FOUND`）
- **惰性关单/主动取消回补分支**：`restock(Order)` 按 type 分派——秒杀单回补独立池 `sold_count-1 WHERE sold_count>0` 条件防负，普通单原逐行回补
- **出参装配**：`ProductDetailDTO.activeSeckill`（详情页插件）、`HomeContentDTO.seckill` 区块（live ≤2 + upcomingCount）；`SeckillService.deductStock` 独立方法埋 4b Redis 预扣演进位
- 种子：id 16/17 两个单 SKU 秒杀商品 + LIVE/UPCOMING 两场活动（NOW() 相对时间保幂等）

### Added（前端 · h5 买家端与 admin · 阶段 4a）

- **详情页秒杀插件**（`MallSeckillBar` 组件复用）：秒杀价大字 + 划线原价 + 截止倒计时（`useDeadlineCountdown`）+ 抢购进度条；操作栏三分支「立即抢购/立即购买/加入购物袋」，秒杀跳结算页携 `seckillActivityId`，规格选择器隐藏（单 SKU 裁决）
- **结算页秒杀模式**：query 识别 `seckillActivityId` 改调 `h5SeckillApi.placeOrder`，四错误码 toast 穿透，收银台闭环复用
- **秒杀会场页** `/h5-mall/seckill`（挂常驻外壳）：van-tabs 抢购中/即将开始，场卡片复用 MallSeckillBar，三态齐全；**首页秒杀区块**（MallSeckill.vue）：live 场卡 + 「全部」入口 + 预告计数，无 live 整块不渲染
- **admin 秒杀场次管理页**（ProTable + 原生按钮组状态筛选 + 新建 dialog 原生 select 候选商品 + PENDING 取消 useConfirm）
- **Ruling**：秒杀无 mock 处理器（商城业务接口无先例，dev 走网关）；el-tabs/el-option 的 `@ts-expect-error` 压制依赖 vue-tsc 生成代码行映射不可复制（admin 全量 type-check 实证 Consignments/Payouts 同为报错存量），新页改用原生控件——存量 4 个 TS 错误已如实上报，不在本计划修复

### Fixed（前端 · h5 买家端）

- **列表页输入态误吞浏览态（4c 回归）**：4c 以「keyword 为空」判定输入态，tabbar「分类」入口进列表页（keyword 恒空）只见历史/热搜面板、商品列表不可见——改为搜索框 focus 判定（focusin/focusout 冒泡监听），失焦 + keyword 空回全量列表，回车提交主动 blur 出结果态

- **切离首页后 tabbar/商品线稿 icon 全丢**

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

- **完整购物车与结算闭环**：详情页自营「加入购物袋」（POST /mall/cart/items，uk 叠加）+ 寄卖「立即购买」（DIRECT 直购，符合后端 CONSIGNMENT_DIRECT_ONLY 约束）；购物袋 tab 落地购物车页（数量步进/本地勾选/失效标记/合计/删除）；结算页（地址选择/新建 + CART/DIRECT 双模式下单 + FakeProvider 收银台新窗口支付 + 状态轮询自动回订单页）；tabbar 角标实时联动（加购/改量/删除/支付后刷新）
- **tabbar 常驻**（`h5-mall` 模块外壳 `views/shell.vue`）：MallTabbar + `useTabbarRouteSync`（route.name 派生选中态，浏览器前进/后退/刷新跟随路由）上移至模块外壳——切 tab 页不消失；订单/工作台/购物袋/结算挂外壳下享常驻 tabbar，详情/登录/404 平级不渲染（模块边界裁决：AGENTS.md §1.2 禁 layouts 引用 modules/）；首页移除局部 tabbar 与底部留白
- **买家订单页**（`views/orders.vue`）：`GET /mall/orders` 卡片列表（订单号/商品快照/金额/状态标签），SHIPPED 订单「确认收货」（`useConfirm` 二次确认 + 防重点击），成功/400 均 reload 列表对齐真态（错误 toast 后端消息，不留幻觉成功）；「我的」tab → 订单页
- **卖家工作台**（`views/seller.vue`）：van-tabs 双列表——我的寄卖（`GET /mall/consignments/mine`，PRICED 单「接受定价」`useConfirm` 明示不可撤销 + 防重，驳回原因展示）+ 售出订单（`GET /mall/orders/sold`，PAID 单「发货」，实收按本卖家明细行合计）；订单页顶部「我是卖家」入口分流（后端无 seller 角色字段，user tab 固定落订单页）
- **页面级登录守卫**：订单/工作台/购物袋/结算路由 `beforeEnter requireMallLogin`（Session 'auth' 标记 → 模块内 H5MallLogin 带 redirect 回跳；h5 全局无登录守卫，拦截落路由级）
- **首页导航接线**：商品卡（限时甄选/新品/为你推荐）点击 → 详情页；金刚区/Hero CTA/「全部」/专题 → 列表页（原型锚点死链路由化）

### Fixed（前端 · h5 买家端）

- **tabbar 购物袋角标位置偏移**：角标节点从 tab 命中区子级移入 `__ic`（24px 图标）内部，定位参照由 73×146px 按钮改为图标自身（top -4px / right -8px 设计稿坐标）——贴合图标右上角，且跟随抛球动画位移（旧实现钉死在按钮顶部，动画时脱离图标）
- **tabbar 按钮命中区超出可见面板易误触**：命中区 y∈[-4,142] 收进面板轮廓 y∈[36,134]（顶=凹槽底上方 6px、底=面板底），向上不再覆盖 tabbar 上方页面内容、向下不戳出面板；图标/标签视觉位置不变（几何常量同步折算）
- **切离首页后 tabbar/商品线稿 icon 全丢**：MallSprite（SVG symbol 唯一定义源）随常驻外壳上移 shell.vue，detail.vue 与 shell 平级自带一份（路由互斥，同一时刻全页仍唯一）
- **加购接口 500**：购物车端点契约为 `POST /mall/cart/items` / `PATCH /mall/cart/items/{id}` / `DELETE /mall/cart/items/{id}`（方法级 `/items` 子路径曾按 REST 惯例误写为 `POST /mall/cart` + PUT，405 被全局兜底为「系统繁忙」）；并以当前源码起 18081 诊断实例拿真实堆栈定位
- **useAuthForm 运行时白屏**：shared barrel 刻意不导出 authApi 值（http.ts 值加载副作用），改经 `@api/modules/auth`（§1.6.2 既定例外路径）；h5 type-check 由 1 错归零
- **结算跳「路由跳转失败」**：`pushWithTitle` 内含 useI18n（仅 setup 顶层可用），事件回调内改经 useAppRouter 暴露的 router 实例直跳（`router.push`）

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
