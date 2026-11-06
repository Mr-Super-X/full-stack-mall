# 商城后端 slice1 实施计划：商品模块（2026-11-05）

> **⚠️ 历史文档（已执行完毕）**：本计划基于旧的"普通自营商城"目标编写，商品模型已被 2026-11-06 的转卖商城设计取代——`Product` 价格/库存将下沉至 `ProductItem`，新增 `ownerType`/`saleMode`。
> 唯一设计基准见：[../specs/2026-11-06-resale-mall-design.md](../specs/2026-11-06-resale-mall-design.md)。下方"后续切片路线"一节作废，以设计文档 §9 阶段路线为准。

> **执行方式**：主会话逐文件实现（native），每个文件完成后自检并回看本计划。步骤用 `- [ ]` 跟踪。

**Goal**：搭建 Spring Boot 后端工程骨架，跑通商品展示切片——首页聚合、分页商品列表、商品详情、分类树四个无鉴权接口，MySQL 内存种子数据与前端 h5-mall 原型（`config/mall.ts`）平移对齐。

**Architecture**：按业务分包（`product/` 单模块起步，`user/`/`cart/`/`order/` 留待 slice 2-4 生长）；经典 Controller → Service → Mapper(MyBatis-Plus) 分层；Entity 只映射数据库表，Controller 出入参一律 DTO；common 层提供统一信封 `{code, message, data}` 与分页 `{list, total, page, pageSize}`，与前端 `packages/shared/src/api/http.ts` 的约定零适配对齐。

**Tech Stack**：Java 17 · Spring Boot 3.5.9（3.3.x 已 EOL，见变更说明）· MyBatis-Plus 3.5.18.1 + mybatis-plus-jsqlparser（分页必需）· MySQL 8.4（Docker）· Maven · 端口 18080 · context-path `/api`

**Spec**：用户 2026-11-05 需求（按业务分包、DTO/Entity 分离、MyBatis-Plus、参考 macrozheng/mall、slice 渐进、JWT 延后到 slice 2、本次零前端改动）＋ 前端契约事实（Explore 代理勘察，见下）

## 需求来源与前端契约事实

1. h5-mall 当前为纯静态原型，数据硬编码于 `frontend/apps/h5/src/modules/h5-mall/config/mall.ts`，文件头注明"将来接 API 时逐字段平移"——后端字段命名向该文件看齐。
2. 响应信封 `{code:200, message, data}`，code=200 为成功；分页原生形状 `{list, total, page, pageSize}`，请求参数 `page/pageSize`，无需 pageAdapter。
3. 鉴权为 HttpOnly Cookie + withCredentials（slice 2 实现 `/auth/login|logout|profile|refresh` 四件套），slice 1 无鉴权。
4. 商品模型参照：`MallGoodsItem{id,name,price,ph,garm,minitag}`；限时甄选含 `originPrice/tag`；`MALL_CATS` 6 个一级分类。

## 变更说明（相对已确认方案）

| 项 | 原方案 | 现方案 | 原因 |
|---|---|---|---|
| Spring Boot | 3.3.x | 3.5.9 | 3.3.13 为 3.3.x 最后一版（2025-06），开源支持已终止；3.5.9 经 MyBatis-Plus 3.5.18.1 依赖对齐验证存在 |
| 构建/运行方式 | 本机 mvn | Docker-first | 本机未安装 JDK/Maven（已实测 `command not found`），Docker 29.8.2 可用；compose 内完成构建与运行，本机工具链可后装 |

## Global Constraints

- 信封 `Result{code,message,data}`，code=200 成功；分页 `PageResult{list,total,page,pageSize}`
- context-path=`/api`，Controller 映射以 `/mall` 开头；业务代码不写 `/api` 前缀
- 端口 18080（避开前端 dev-gateway 的 8080）
- 仅 `status=1`（上架）商品对外可见；详情查不到/未上架统一返回 code=404、message="商品不存在"
- Entity 不出 Controller；出参一律 DTO
- 单文件 ≤400 行；公共 API 附中文 Javadoc（用途/边界，不复述类型）
- 本次不引入 jjwt 及任何鉴权依赖；不改 frontend 任何文件
- commit message 中文约定式（feat/chore/...），禁止 AI 痕迹（frontend `check-commit-msg.sh` 同口径）
- MySQL 8.4：compose 端口 13306:3306，库名 `mall`，root 密码 `mall-root`（仅本地，env 可覆盖）

## Review Focus（规格未明说但最易咬人的 5 处）

1. `keyword` 为空白串或超长（>50）→ trim 后为空则不拼 LIKE 条件
2. `page<1`、`pageSize<1` 或 `>50` → 参数校验兜底（@Min/@Max），非法值返回 code=400
3. `categoryId` 不存在 → 返回空分页而非报错
4. `sort` 非法值 → 静默回退默认排序（按 id desc），白名单映射防注入
5. 首页聚合中某个区块（如限时甄选）无数据 → 该区块返回空数组，整体仍 200

---

## Task 1：工程骨架与 Docker 化

**Files**：
- Create: `backend/pom.xml`（parent=spring-boot-starter-parent:3.5.9；deps：web、validation、mybatis-plus-spring-boot3-starter:3.5.18.1、mybatis-plus-jsqlparser:3.5.18.1、mysql-connector-j(runtime)、lombok、spring-boot-starter-test(test)）
- Create: `backend/docker-compose.yml`（mysql:8.4 服务：13306、库 mall、挂 `./sql/init.sql` 到 `/docker-entrypoint-initdb.d/`；app 服务：maven:3.9-eclipse-temurin-17 镜像，挂载源码，工作目录 /app，依赖 mysql healthy）
- Create: `backend/.gitignore`（target/、*.class、.idea/、*.iml）
- Create: `backend/src/main/resources/application.yml`（server.port=18080、context-path=/api、datasource 走 `${DB_URL:...13306/mall}` `${DB_USER:root}` `${DB_PASSWORD:mall-root}`、mybatis-plus：map-underscore-to-camel-case=true、banner 关闭）
- Create: `backend/src/main/java/com/fullstackmall/shop/ShopApplication.java`（`@SpringBootApplication` + `@MapperScan("com.fullstackmall.shop.product.mapper")`）

- [x] Step 1：编写上述 5 个文件
- [x] Step 2：`docker compose up -d mysql` 后 `docker compose ps` 确认 healthy
- [x] Step 3：`docker compose run --rm app mvn -q compile` 编译通过（此时无业务代码，验证骨架）

## Task 2：数据库 schema 与种子数据

**Files**：
- Create: `backend/sql/init.sql`

**Interfaces（表结构，平移 mall.ts）**：
- `product_category(id, parent_id, name, level, icon, sort, status, create_time, update_time)`，种子：一级 6 类（今日上新/女装/男装/鞋靴/箱包/配饰，icon 对应 mall-i-* 后缀），女装/男装下各挂 2 个二级类
- `product(id, category_id, name, price, origin_price, image_url, tag, selling_point, garm, sales, stock, status, detail_html, create_time, update_time)`，`garm` 保留原型线稿 key（shirt/sweater/...）便于前端过渡；种子：MALL_GOODS 6 条（id 1-6 对齐）+ MALL_FLASH 3 条 + MALL_NEWS 4 条，共 13 条，含 sales/stock 合理值
- `home_banner(id, title, pic_url, link_url, sort, status)`，种子 3 条
- [x] Step 1：编写 init.sql（utf8mb4；DROP TABLE IF EXISTS 顺序建表，幂等可重跑）
- [x] Step 2：重建 mysql 容器后 `docker compose exec mysql mysql -uroot -pmall-root mall -e "SELECT COUNT(*) FROM product;"` 返回 13

## Task 3：common 层（先写测试）

**Files**：
- Test: `backend/src/test/java/com/fullstackmall/shop/common/ResultTest.java`
- Test: `backend/src/test/java/com/fullstackmall/shop/common/GlobalExceptionHandlerTest.java`
- Create: `backend/src/main/java/com/fullstackmall/shop/common/Result.java`（`success(T)` / `error(ResultCode)` / `error(int,String)`）
- Create: `backend/src/main/java/com/fullstackmall/shop/common/ResultCode.java`（SUCCESS(200)、BAD_REQUEST(400)、PRODUCT_NOT_FOUND(404,"商品不存在")、INTERNAL_ERROR(500)）
- Create: `backend/src/main/java/com/fullstackmall/shop/common/PageResult.java`（`of(Page<T>)`：records→list、total、current→page、size→pageSize）
- Create: `backend/src/main/java/com/fullstackmall/shop/common/BusinessException.java`（携带 ResultCode）
- Create: `backend/src/main/java/com/fullstackmall/shop/common/GlobalExceptionHandler.java`（`@RestControllerAdvice`：BusinessException→对应 code、MethodArgumentNotValidException/BindException→400+首条校验消息、Exception→500+log）

- [x] Step 1：写 ResultTest（成功/错误形态断言）与 GlobalExceptionHandlerTest（standalone MockMvc + 桩 Controller：抛 BusinessException 断言 code=404；@Valid 失败断言 code=400）
- [x] Step 2：`docker compose run --rm app mvn test -Dtest=ResultTest,GlobalExceptionHandlerTest` 红（编译失败）
- [x] Step 3：实现 5 个类
- [x] Step 4：同命令转绿

## Task 4：config 层

**Files**：
- Create: `backend/src/main/java/com/fullstackmall/shop/config/MybatisPlusConfig.java`（MybatisPlusInterceptor + PaginationInnerInterceptor(DbType.MYSQL)）
- Create: `backend/src/main/java/com/fullstackmall/shop/config/CorsConfig.java`（allowedOriginPatterns 读 `${app.cors.allowed-origins}`，默认 6 个 vite 端口 + 8080；allowCredentials=true；maxAge=3600）
- [x] Step 1：编写 2 个类（随 Task 5 集成验证，无独立测试）

## Task 5：product 模块（TDD：先写 Controller 测试）

**Files**：
- Test: `backend/src/test/java/com/fullstackmall/shop/product/controller/ProductControllerTest.java`（@WebMvcTest + @MockBean）
- Test: `backend/src/test/java/com/fullstackmall/shop/product/controller/CategoryControllerTest.java`
- Test: `backend/src/test/java/com/fullstackmall/shop/product/controller/HomeControllerTest.java`
- Create: `.../product/entity/Product.java`、`entity/ProductCategory.java`、`entity/HomeBanner.java`（MyBatis-Plus 注解：`@TableName`、`@TableId(IdType.AUTO)`；金额用 `BigDecimal`）
- Create: `.../product/mapper/ProductMapper.java`、`mapper/ProductCategoryMapper.java`、`mapper/HomeBannerMapper.java`（继承 `BaseMapper<T>`）
- Create: `.../product/dto/ProductListRequest.java`（`@NotNull @Min(1) page`、 `@NotNull @Min(1) @Max(50) pageSize`、`@Size(max=50) keyword`、`categoryId`、`sort`）
- Create: `.../product/dto/ProductSummaryDTO.java`（id/name/price/originPrice/imageUrl/tag/sellingPoint/garm/sales）
- Create: `.../product/dto/ProductDetailDTO.java`（继承 summary 字段 + categoryId/stock/detailHtml/createTime）
- Create: `.../product/dto/CategoryTreeDTO.java`（id/parentId/name/icon/children）
- Create: `.../product/dto/HomeContentDTO.java`（notice/banners/categories/flash{title,items}/news/recommend；均允许空集合）
- Create: `.../product/service/ProductService.java` + `service/impl/ProductServiceImpl.java`（`pageProducts`：wrapper=status=1 + like keyword(trim 非空才拼) + eq categoryId + sort 白名单{newest: id desc, price_asc, price_desc, sales_desc}；`getDetail`：查不到→BusinessException(PRODUCT_NOT_FOUND)）
- Create: `.../product/service/CategoryService.java` + `impl/CategoryServiceImpl.java`（查 status=1 全量，内存组树，一级按 sort）
- Create: `.../product/service/HomeService.java` + `impl/HomeServiceImpl.java`（notice 常量；banner status=1 按 sort；分类树取一级；flash 取 origin_price>price 前 3 按 update_time；news 取最新 4；recommend 取 sales 前 6）
- Create: `.../product/controller/ProductController.java`（GET `/mall/product/list`、`GET /mall/product/{id}`）
- Create: `.../product/controller/CategoryController.java`（GET `/mall/product/category/tree`）
- Create: `.../product/controller/HomeController.java`（GET `/mall/home/content`）

**Produces（slice 2+ 依赖的签名）**：`Result.success(PageResult<ProductSummaryDTO>)`、`Result.success(ProductDetailDTO)`、`Result.success(List<CategoryTreeDTO>)`、`Result.success(HomeContentDTO)`

- [x] Step 1：写 3 个 Controller 测试（红）：list 分页形状 `{code:200, data:{list,total,page,pageSize}}`；keyword 空白不传参不报错；非法 page=0 → 400；详情不存在 → 404+"商品不存在"；category/tree 两级结构；home/content 五区块键齐全且允许空数组
- [x] Step 2：运行确认红（编译失败）
- [x] Step 3：实现 entity/mapper/dto/service/controller
- [x] Step 4：3 个测试类全绿：`docker compose run --rm app mvn test -Dtest='*ControllerTest'`

## Task 6：端到端验证（真 MySQL + curl）

- [x] Step 1：`docker compose up -d`（mysql + app）
- [x] Step 2：`curl "http://localhost:18080/api/mall/product/list?page=1&pageSize=4"` 断言信封与 list≤4 且 id 含 1-6 种子
- [x] Step 3：`curl ".../mall/product/1"` 返回"陶土色垂感风衣 · 中长款双面呢"，price=399
- [x] Step 4：`curl ".../mall/product/999"` 返回 code=404
- [x] Step 5：`curl ".../mall/product/category/tree"` 一级 6 节点、女装含二级
- [x] Step 6：`curl ".../mall/home/content"` 五区块齐全，flash 3 条、recommend 6 条
- [x] Step 7：对照 mall.ts 逐区块核对种子一致性

## Task 7：交付

- [x] Step 1：合规简报（全部写操作表格）+ 自检 10 项
- [x] Step 2：经用户同意后 `git add backend/ && git commit`（中文 message）

---

## 后续切片路线（本计划不含，仅索引）

- **slice 2 用户认证**：新增 `user/` 包 + jjwt；`/auth/login|logout|profile|refresh` 四件套；HttpOnly Cookie `token`（SameSite=Lax）；CORS 已允许凭证
- **slice 3 购物车**：新增 `cart/` 包；需 token；对比前端 cart store 与后端契约适配
- **slice 4 订单**：新增 `order/` 包；事务 + 库存扣减；支付模拟

## 参考来源

- [MyBatis-Plus Spring Boot3 Starter - Maven Central](https://central.sonatype.com/artifact/com.baomidou/mybatis-plus-spring-boot3-starter/3.5.13) · [mvnrepository](https://mvnrepository.com/artifact/com.baomidou/mybatis-plus-spring-boot3-starter)（3.5.18.1 最新，分页需配 mybatis-plus-jsqlparser）
- [Spring Boot 3.3.13 available now（3.3.x 终结版）](https://spring.io/blog/2025/06/19/spring-boot-3-3-13-available-now) · [Spring Boot 版本发布博客索引](https://spring.io/blog)
