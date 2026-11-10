# AGENTS.md

> 本文件收录对本仓库任何 AI 编码工具与协作者都成立的工程标准——只写长期为真的常量，一律以祈使句表述。
> 前端 Monorepo 细则见 `frontend/AGENTS.md`（本文件不重复收录）；个人偏好与全局规则见 `~/.claude/CLAUDE.md`。

## 项目定位

- 视本仓库为四种玩法的全栈转卖商城：**二手寄卖（主线，C2C 用户货源）** + 限时秒杀（平台自营货源）+ 预售众筹 + 订阅盲盒（后两者 v2 占位，`SaleMode` 枚举已留位）。
- 以「双货源」理解全部商品建模：`ownerType`（PLATFORM 自营 / CONSIGNMENT 寄卖）× `saleMode`（NORMAL/SECKILL/CROWDFUND/SUBSCRIPTION）；寄卖商品全平台唯一一件（库存恒 1），自营商品才有规格库存池，统一由 `ProductItem` 承载。
- 形态：浏览器 SPA ──HTTP REST + JWT（HttpOnly Cookie）──▶ Spring Boot 单体 ──▶ MySQL 8.4；Redis 阶段 4 秒杀才引入，MVP 不用。
- 阶段路线与完成状态是易变信息，统一维护在 `README.md`，本文件不收录。

## 仓库结构

| 路径 | 内容 | 细则归属 |
|---|---|---|
| `frontend/` | Vue 3 + TS pnpm monorepo（apps/\* × packages/\*） | `frontend/AGENTS.md` |
| `backend/` | Spring Boot 3.5 单体（Java 17 · MyBatis-Plus 3.5 · JWT 自实现） | 本文件「后端架构不变量」 |
| `docs/superpowers/specs/` | 设计基准（single source of truth） | — |
| `docs/superpowers/plans/` | 分阶段实施计划 | — |

## 环境要求

- 后端：JDK 17 + Maven 3.8.9+（仓库无 mvnw，直接 `mvn`）。
- 前端：Node `>=22.18` 或 `>=24.12`、pnpm `>=11`（硬强制与细则见 frontend/AGENTS.md）。
- 数据库：Docker 跑 MySQL 8.4（端口 13306）；后端应用本体不走容器，本机 `mvn` 启动。

## 常用命令

| 任务 | 命令 |
|---|---|
| 启动本地 MySQL（13306，库 `mall`，root 密码 `mall-root` 仅本地） | `cd backend && docker compose up -d mysql` |
| 重建数据库（清数据卷，init.sql 幂等重跑） | `cd backend && docker compose down -v && docker compose up -d mysql` |
| 启动后端（18080，context-path `/api`，业务接口前缀 `/api/mall/**`） | `cd backend && mvn spring-boot:run` |
| 后端全量单测 | `cd backend && mvn test` |
| 后端仅编译检查 | `cd backend && mvn compile` |
| 前端 install / dev / test / build / lint | 见 `frontend/AGENTS.md`「常用命令」 |

## 后端架构不变量

- 统一响应信封：controller 一律返回 `Result<T>`（code=200 成功 + message + data，契约对齐前端 `packages/shared/src/api/http.ts`）；禁止裸对象 / 裸 Map / 裸 String 出参。
- 错误通道：业务异常只抛 `BusinessException`（携带 `ResultCode`），由 `GlobalExceptionHandler` 统一转 `Result`（业务码直出 / 校验失败 400 带首条消息 / 未知异常兜底 500 记日志不回显堆栈）；禁止在 controller / service 手写 try-catch 拼装错误响应。
- 按业务域分包 `com.fullstackmall.shop.<domain>`，域内分层固定为 `controller / service(+impl) / mapper / entity / dto / enums`；`common`（Result / BusinessException / ResultCode / GlobalExceptionHandler / PageResult）与 `config` 跨域共享，禁止反向依赖任何业务域类型。
- 新增受保护接口必须显式登记路径：`WebMvcConfig.addInterceptors` 是唯一清单（Auth 先解析身份写 `UserContext`，Admin 后读上下文校验角色）；匿名浏览的商品 / 首页接口刻意不挂拦截器。
- `UserContext` 是 ThreadLocal：受保护路径取登录用户用 `getRequired()`（未登录抛 401），可空场景用 `get()` 自行判空；任何新拦截器必须在 `afterCompletion` 调 `UserContext.clear()`——Tomcat 线程复用，漏清即串号。
- 认证 = JWT + HttpOnly Cookie（cookie-name `token`），不引 Spring Security 全家桶，仅用 `spring-security-crypto` 的 BCryptPasswordEncoder；JWT 密钥与支付验签密钥分离（`JWT_SECRET` / `PAYMENT_SECRET`）。
- 数据层：MyBatis-Plus 开启 `map-underscore-to-camel-case`；XML 映射文件位置 `classpath*:mapper/*.xml`；`mybatis-plus-jsqlparser` 是 3.5.9+ 拆包后的分页必配 companion，删除即分页静默失效。
- 建表唯一来源是 `backend/sql/init.sql`：幂等可重跑（DROP + CREATE）、无物理外键（逻辑外键）、utf8mb4；改表结构必须同步 init.sql，禁止在 mapper XML 或代码中维护第二份建表 SQL。
- 金额一律 `BigDecimal` / `DECIMAL(10,2)`，禁止 double / float。
- 防超卖走 `product_item.version` 乐观锁条件更新（`stock >= ?` 条件 + version 自增），禁止先查后写。
- 快照铁律：`OrderItem` 定格下单瞬间的价格 / 标题 / 成色，任何场景不回联实时商品数据。
- 支付幂等：paymentNo 全局唯一 + 状态机单向迁移（`PaymentStatus` / `OrderStatus` / `ConsignmentStatus`），状态推进只由异步回调驱动，不信任前端点击。
- 订单号经 `OrderNoGenerator` 统一生成，禁止在 Controller / Service 内拼字符串。

## 测试与验收规则（强制）

> 本节是前后端一体适用的测试方法论；前端测试栈与命令见 `frontend/AGENTS.md`「常用命令」。

- 测试预期必须独立于实现代码——禁止「先写实现、再看着实现写测试、以测试全绿作为正确性证据」；绿灯只证明实现与测试一致，不证明实现与需求一致。
- 实现 Agent 只写代码：可看验收标准，但不得读取、修改、弱化测试用例文件。
- 测试 Agent 在独立会话中仅凭验收标准生成测试：不得读取实现代码（前端 `src/`、后端 `src/main/java/`），不得参考实现 Agent 的对话历史。
- 人类负责人确认验收标准，并裁决测试失败时「改测试还是改实现」。
- 验收标准是测试断言的唯一来源：只接受人工确认的验收标准、Given/When/Then 条件、输入-输出对照表、契约定义；验收标准存放在独立位置（如 `specs/acceptance/`、`docs/superpowers/specs/`），实现开始前即存在，实现 Agent 无权修改；验收标准缺失或模糊时测试 Agent 必须停止并报告，禁止自行猜测后生成断言。
- 只测功能边界与外部行为，不测内部方法、私有函数、实现细节。
- 黑盒测试从外部接口模拟用户真实行为，断言可观察的输出与副作用。
- 契约测试验证服务 / 模块间接口语义符合消费者期望，独立于提供者实现。
- 流量回放优先于 AI 生成用例：可用时回放真实请求对比响应差异，输入与预期均来自真实世界、不经过 AI 生成。
- 故障注入场景必须来自验收标准写明的异常条件（依赖超时、空返回、部分失败），验证鲁棒性。
- 用变异测试（Stryker 等）验证测试有效性：关键路径注入人为缺陷后测试仍全绿，判定该测试无效并打回重写；禁止实现 Agent 自行认证自己的测试，变异测试结果由独立验证者或人类审查。
- 测试失败先判断是否偏离验收标准：偏离则修正测试并记录原因；测试与验收标准一致而实现失败则修改实现；严禁为让测试变绿而删除断言、放宽断言、跳过测试或修改验收标准迁就代码。
- 禁止实现 Agent 读取或编辑测试文件；禁止在实现完成后依据实现逻辑反推测试断言。
- 禁止把 AI 自生成的测试全绿作为交付证据——交付证据必须包含验收标准来源、独立测试会话记录、变异测试结果。

### 后端测试栈

- 测试栈：JUnit 5 + Mockito + MockMvc（spring-boot-starter-test 自带）；测试包镜像主代码业务域（`src/test/java/com/fullstackmall/shop/<domain>/`）。
- 种子用户密码（admin123 / seller123 / buyer123）以 BCrypt 哈希存 init.sql；新增种子用户或改密码一律用测试工具类 `PasswordHashPrinter` 生成并自校验后粘贴，禁止手算哈希。

## 项目约束

1. 构建入口锁定：后端 `mvn`、前端 `pnpm`；引入替代工具链（gradle / npm / mvnw 等）须先经用户批准。
2. 应用本体不容器化（阶段 5 部署前）：Docker 仅承担 MySQL，`backend/docker-compose.yml` 只有 mysql 服务——后端只走 `mvn spring-boot:run`，勿引用 `docker compose up -d app` 一类容器化应用本体的过时命令。
3. 新增 / 升级后端依赖前确认必要性，保持 pom 精简；版本号集中在 `<properties>` 管理。
4. 密钥只走环境变量：`JWT_SECRET` / `PAYMENT_SECRET` / `DB_PASSWORD` 生产必须覆盖；application.yml 中的 dev 默认值禁止带入生产，真实密钥禁止写入任何入库文件。
5. 新增前端 dev server 端口（跨域来源）时，同步 `application.yml` 的 `app.cors.allowed-origins`（或用 `CORS_ALLOWED_ORIGINS` 环境变量整体覆盖）。
6. 改架构级约定或目录职责前，先在 `docs/superpowers/specs/` 写设计稿并等批准；spec 命名 `YYYY-MM-DD-中文主题.md`、plan 命名 `NN-中文主题.md`。
7. 功能性变更同步 `README.md` 阶段状态表（仅 typo 免记）；frontend 子树内的功能性变更另按 frontend/AGENTS.md 约束同步 CHANGELOG。
8. 用中文写 commit message（约定式前缀 `feat:`/`fix:`/`refactor:`/`docs:`/`test:`/`chore:`/`perf:`）；未经用户明确同意不 commit / push。

## 文档速查

- 设计基准（single source of truth）：[docs/superpowers/specs/2026-11-06-resale-mall-design.md](docs/superpowers/specs/2026-11-06-resale-mall-design.md)
- 实施计划索引：`docs/superpowers/plans/`
- 前端工程规范：`frontend/AGENTS.md`（含 Claude 专属的 `frontend/CLAUDE.md`）
