-- 转卖商城数据库初始化：全部 MVP 核心表 + 双货源种子数据（2026-11-06 重构）
-- 设计基准：docs/superpowers/specs/2026-11-06-resale-mall-design.md
-- 幂等可重跑：DROP + CREATE。无物理外键（逻辑外键）。
-- 用户种子密码为 BCrypt 哈希（admin123 / seller123 / buyer123，由 PasswordHashPrinter 生成并自校验）

SET NAMES utf8mb4;

DROP TABLE IF EXISTS seckill_activity;
DROP TABLE IF EXISTS payout;
DROP TABLE IF EXISTS payment;
DROP TABLE IF EXISTS order_item;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS cart_item;
DROP TABLE IF EXISTS consignment_listing;
DROP TABLE IF EXISTS home_banner;
DROP TABLE IF EXISTS product_image;
DROP TABLE IF EXISTS product_item;
DROP TABLE IF EXISTS product;
DROP TABLE IF EXISTS product_category;
DROP TABLE IF EXISTS address;
DROP TABLE IF EXISTS user;

-- ========== 用户域 ==========

CREATE TABLE user (
  id          BIGINT       NOT NULL AUTO_INCREMENT,
  username    VARCHAR(32)  NOT NULL COMMENT '登录名（CI 校对，大小写不敏感）',
  password    VARCHAR(64)  NOT NULL COMMENT 'BCrypt 哈希',
  nickname    VARCHAR(20)  DEFAULT NULL,
  avatar      VARCHAR(512) DEFAULT NULL,
  role        VARCHAR(16)  NOT NULL DEFAULT 'USER' COMMENT 'USER 买家/卖家同号 / ADMIN',
  status      INT          NOT NULL DEFAULT 1 COMMENT '1 正常 0 禁用',
  create_time DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_username (username)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT ='用户';

CREATE TABLE address (
  id            BIGINT       NOT NULL AUTO_INCREMENT,
  user_id       BIGINT       NOT NULL,
  receiver_name VARCHAR(32)  NOT NULL,
  phone         VARCHAR(20)  NOT NULL,
  province      VARCHAR(32)  NOT NULL,
  city          VARCHAR(32)  NOT NULL,
  district      VARCHAR(32)  NOT NULL,
  detail        VARCHAR(255) NOT NULL,
  is_default    TINYINT      NOT NULL DEFAULT 0,
  create_time   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_user (user_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT ='收货地址';

-- ========== 商品域 ==========

CREATE TABLE product_category (
  id          BIGINT      NOT NULL AUTO_INCREMENT,
  parent_id   BIGINT      NOT NULL DEFAULT 0 COMMENT '父分类 id，0 表示一级分类',
  name        VARCHAR(64) NOT NULL COMMENT '分类名',
  level       INT         NOT NULL DEFAULT 1 COMMENT '层级：1 一级 / 2 二级',
  icon        VARCHAR(64) DEFAULT NULL COMMENT '前端金刚区图标 key（mall-i-* 后缀）',
  sort        INT         NOT NULL DEFAULT 0 COMMENT '排序，越小越前',
  status      INT         NOT NULL DEFAULT 1 COMMENT '状态：1 启用 0 停用',
  create_time DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_parent (parent_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT ='商品分类';

CREATE TABLE product (
  id            BIGINT       NOT NULL AUTO_INCREMENT,
  category_id   BIGINT       NOT NULL COMMENT '所属一级分类 id',
  owner_type    VARCHAR(16)  NOT NULL DEFAULT 'PLATFORM' COMMENT 'PLATFORM 自营 / CONSIGNMENT 寄卖',
  sale_mode     VARCHAR(16)  NOT NULL DEFAULT 'NORMAL' COMMENT 'NORMAL/SECKILL/CROWDFUND/SUBSCRIPTION（后两者 v2 占位）',
  seller_id     BIGINT       DEFAULT NULL COMMENT '寄卖商品卖家 user.id',
  brand         VARCHAR(64)  DEFAULT NULL,
  name          VARCHAR(128) NOT NULL COMMENT '商品名',
  tag           VARCHAR(32)  DEFAULT NULL COMMENT '角标，如 -27%、本季主打',
  selling_point VARCHAR(64)  DEFAULT NULL COMMENT '卡内小标签（材质/卖点）',
  garm          VARCHAR(32)  DEFAULT NULL COMMENT '前端线稿图标 key（mall-g-* 后缀，过渡期字段）',
  sales         INT          NOT NULL DEFAULT 0 COMMENT '销量',
  status        INT          NOT NULL DEFAULT 1 COMMENT '状态：1 上架 0 下架',
  detail_html   TEXT         DEFAULT NULL COMMENT '详情页富文本',
  create_time   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_category (category_id),
  KEY idx_status_sales (status, sales),
  KEY idx_seller (seller_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT ='商品';

CREATE TABLE product_item (
  id              BIGINT        NOT NULL AUTO_INCREMENT,
  product_id      BIGINT        NOT NULL,
  size            VARCHAR(16)   DEFAULT NULL COMMENT '尺码/规格；寄卖单件可为 NULL',
  color           VARCHAR(32)   DEFAULT NULL,
  condition_grade VARCHAR(16)   NOT NULL DEFAULT 'NEW' COMMENT '成色：NEW/LIKE_NEW/GOOD/FAIR，寄卖必填',
  price           DECIMAL(10,2) NOT NULL COMMENT '现价（元）',
  origin_price    DECIMAL(10,2) DEFAULT NULL COMMENT '划线价（元）',
  stock           INT           NOT NULL DEFAULT 0 COMMENT '寄卖商品恒 1',
  version         INT           NOT NULL DEFAULT 0 COMMENT '乐观锁版本号（阶段 2 下单扣减用）',
  create_time     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_product (product_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT ='商品规格/单件';

CREATE TABLE product_image (
  id          BIGINT       NOT NULL AUTO_INCREMENT,
  product_id  BIGINT       NOT NULL,
  url         VARCHAR(512) NOT NULL,
  sort        INT          NOT NULL DEFAULT 0 COMMENT 'sort=0 为主图',
  create_time DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_product (product_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT ='商品图片';

CREATE TABLE home_banner (
  id          BIGINT       NOT NULL AUTO_INCREMENT,
  title       VARCHAR(128) NOT NULL,
  pic_url     VARCHAR(512) NOT NULL COMMENT '图片 URL',
  link_url    VARCHAR(512) DEFAULT NULL COMMENT '跳转链接',
  sort        INT          NOT NULL DEFAULT 0,
  status      INT          NOT NULL DEFAULT 1,
  create_time DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT ='首页轮播';

-- ========== 寄卖域 ==========

CREATE TABLE consignment_listing (
  id                BIGINT        NOT NULL AUTO_INCREMENT,
  seller_id         BIGINT        NOT NULL COMMENT '卖家 user.id',
  brand             VARCHAR(64)   NOT NULL,
  title             VARCHAR(128)  NOT NULL,
  size              VARCHAR(16)   DEFAULT NULL,
  condition_grade   VARCHAR(16)   NOT NULL COMMENT '成色：LIKE_NEW/GOOD/FAIR',
  images            JSON          DEFAULT NULL COMMENT '图床 URL 数组（MVP 不做真实上传）',
  description       TEXT          DEFAULT NULL,
  expected_price    DECIMAL(10,2) NOT NULL COMMENT '卖家期望价',
  platform_price    DECIMAL(10,2) DEFAULT NULL COMMENT '平台核价（review 后回填）',
  commission_rate   DECIMAL(5,2)  DEFAULT NULL COMMENT '抽佣百分比，如 15.00',
  status            VARCHAR(16)   NOT NULL DEFAULT 'SUBMITTED' COMMENT 'SUBMITTED/REVIEWING/PRICED/LISTED/SOLD/SETTLED/REJECTED',
  reject_reason     VARCHAR(255)  DEFAULT NULL,
  listed_product_id BIGINT        DEFAULT NULL COMMENT '卖家确认定价后铸造的 product.id',
  create_time       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_seller_status (seller_id, status)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT ='寄卖单';

-- ========== 交易域 ==========

CREATE TABLE cart_item (
  id              BIGINT   NOT NULL AUTO_INCREMENT,
  user_id         BIGINT   NOT NULL,
  product_item_id BIGINT   NOT NULL,
  quantity        INT      NOT NULL DEFAULT 1,
  checked         TINYINT  NOT NULL DEFAULT 1 COMMENT '1 选中 0 未选中',
  create_time     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_user_item (user_id, product_item_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT ='购物车';

-- order 是 MySQL 保留字，表名用 orders
CREATE TABLE orders (
  id               BIGINT        NOT NULL AUTO_INCREMENT,
  order_no         VARCHAR(32)   NOT NULL COMMENT '订单号（业务唯一）',
  user_id          BIGINT        NOT NULL,
  type             VARCHAR(16)   NOT NULL DEFAULT 'NORMAL' COMMENT 'NORMAL/SECKILL/CROWDFUND/SUBSCRIPTION',
  status           VARCHAR(16)   NOT NULL DEFAULT 'PENDING_PAYMENT' COMMENT 'PENDING_PAYMENT/PAID/SHIPPED/COMPLETED/CANCELLED',
  pay_amount       DECIMAL(10,2) NOT NULL COMMENT '应付总额（快照）',
  address_snapshot JSON          DEFAULT NULL COMMENT '下单时地址快照',
  expired_at       DATETIME      DEFAULT NULL COMMENT '超时关单时间（惰性关单）',
  create_time      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_order_no (order_no),
  KEY idx_user_status (user_id, status)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT ='订单';

CREATE TABLE order_item (
  id              BIGINT        NOT NULL AUTO_INCREMENT,
  order_id        BIGINT        NOT NULL,
  product_item_id BIGINT        NOT NULL,
  item_snapshot   JSON          NOT NULL COMMENT '标题/图片/成色/尺码快照，定格下单瞬间',
  price           DECIMAL(10,2) NOT NULL COMMENT '成交价快照',
  quantity        INT           NOT NULL DEFAULT 1,
  seller_id       BIGINT        DEFAULT NULL COMMENT '寄卖件卖家（结算用，不回联商品）',
  create_time     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_order (order_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT ='订单明细';

CREATE TABLE payment (
  id          BIGINT        NOT NULL AUTO_INCREMENT,
  payment_no  VARCHAR(32)   NOT NULL COMMENT '支付流水号（幂等键）',
  order_id    BIGINT        NOT NULL,
  amount      DECIMAL(10,2) NOT NULL,
  provider    VARCHAR(16)   NOT NULL DEFAULT 'FAKE' COMMENT 'FAKE/ALIPAY_SANDBOX',
  status      VARCHAR(16)   NOT NULL DEFAULT 'CREATED' COMMENT 'CREATED/PAYING/SUCCESS/FAILED',
  create_time DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_payment_no (payment_no),
  KEY idx_order (order_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT ='支付流水';

CREATE TABLE payout (
  id            BIGINT        NOT NULL AUTO_INCREMENT,
  seller_id     BIGINT        NOT NULL,
  order_item_id BIGINT        NOT NULL,
  seller_amount DECIMAL(10,2) NOT NULL COMMENT '卖家应得 = 成交价 × (1 - 抽佣)',
  commission    DECIMAL(10,2) NOT NULL COMMENT '平台抽佣金额',
  status        VARCHAR(16)   NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING/CONFIRMED/PAID',
  create_time   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_seller (seller_id),
  UNIQUE KEY uk_order_item (order_item_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT ='卖家结算单';

-- ========== 玩法域 ==========

CREATE TABLE seckill_activity (
  id             BIGINT        NOT NULL AUTO_INCREMENT,
  product_id     BIGINT        NOT NULL,
  seckill_price  DECIMAL(10,2) NOT NULL,
  seckill_stock  INT           NOT NULL COMMENT '独立库存池（从自营库存划拨）',
  sold_count     INT           NOT NULL DEFAULT 0,
  start_time     DATETIME      NOT NULL,
  end_time       DATETIME      NOT NULL,
  limit_per_user INT           NOT NULL DEFAULT 1 COMMENT '每人限购件数',
  status         VARCHAR(16)   NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING/ACTIVE/ENDED',
  create_time    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_product (product_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT ='秒杀场次';

-- ========== 种子数据 ==========

-- 用户：admin（平台管理员）/ seller（演示卖家「阿珍的衣柜」）/ buyer（演示买家）
INSERT INTO user (id, username, password, nickname, role) VALUES
  (1, 'admin',  '$2a$10$qtzByZqa1qq3FHRjdkkyUuBn1seDmzzsD368wAuKJ9hqUwLp8HOC2', '平台管理员', 'ADMIN'),
  (2, 'seller', '$2a$10$isW/sR0wpKpm5lTsorcXXeHCTWJ4txUB2JklpHuN7NDG9n7iSuI4C', '阿珍的衣柜', 'USER'),
  (3, 'buyer',  '$2a$10$Ugm4mdltQRITQ8xfaKVlwuM3sruh56YYdqyh7bjB71rEED8CQaXP6', '演示买家',   'USER');

-- 一级分类（icon 为 mall-i-* 后缀）
INSERT INTO product_category (id, parent_id, name, level, icon, sort) VALUES
  (1, 0, '今日上新', 1, 'spark',   1),
  (2, 0, '女装',     1, 'dress-s', 2),
  (3, 0, '男装',     1, 'coat-s',  3),
  (4, 0, '鞋靴',     1, 'shoe-s',  4),
  (5, 0, '箱包',     1, 'bag',     5),
  (6, 0, '配饰',     1, 'gem-s',   6);

-- 二级分类
INSERT INTO product_category (id, parent_id, name, level, sort) VALUES
  (21, 2, '上装', 2, 1),
  (22, 2, '裙装', 2, 2),
  (23, 3, '外套', 2, 1),
  (24, 3, '裤装', 2, 2);

-- 商品：id 1-13 自营（拙衣），id 14-15 寄卖演示（卖家 seller / id=2）
INSERT INTO product (id, category_id, owner_type, sale_mode, seller_id, brand, name, tag, selling_point, garm, sales, status, detail_html) VALUES
  (1,  2, 'PLATFORM', 'NORMAL', NULL, '拙衣', '陶土色垂感风衣 · 中长款双面呢', NULL,   '棉 100%',  'trench', 1200, 1, '<p>中长款双面呢风衣，陶土色系，垂感剪裁。</p>'),
  (2,  2, 'PLATFORM', 'NORMAL', NULL, '拙衣', '月白法式衬衫 · 微泡纱免烫',     NULL,   '免烫',     'shirt',  2300, 1, '<p>微泡纱肌理，免烫好打理。</p>'),
  (3,  2, 'PLATFORM', 'NORMAL', NULL, '拙衣', '雾蓝伞形半身裙 · 高腰过膝',     NULL,   '显瘦',     'skirt',  1800, 1, '<p>高腰伞形剪裁，过膝长度。</p>'),
  (4,  2, 'PLATFORM', 'NORMAL', NULL, '拙衣', '燕麦圆领针织衫 · 细密罗纹',     NULL,   '软糯',     'sweater',3100, 1, '<p>细密罗纹，燕麦色系。</p>'),
  (5,  3, 'PLATFORM', 'NORMAL', NULL, '拙衣', '陶白条纹 T 恤 · 有机棉',        NULL,   '有机棉',   'tshirt', 5200, 1, '<p>有机棉条纹基础款。</p>'),
  (6,  5, 'PLATFORM', 'NORMAL', NULL, '拙衣', '焦糖色托特包 · 头层牛皮',       NULL,   '头层牛皮', 'tote',   800,  1, '<p>头层牛皮托特包，焦糖色。</p>'),
  (7,  2, 'PLATFORM', 'NORMAL', NULL, '拙衣', '云朵感圆领针织',               '-27%', '软糯',     'sweater',2000, 1, '<p>云朵触感圆领针织。</p>'),
  (8,  3, 'PLATFORM', 'NORMAL', NULL, '拙衣', '垂感锥形阔腿裤',               '-27%', '垂感',     'pants',  1600, 1, '<p>垂感面料，锥形剪裁。</p>'),
  (9,  4, 'PLATFORM', 'NORMAL', NULL, '拙衣', '头层牛皮乐福鞋',               '-28%', '头层牛皮', 'shoe',   950,  1, '<p>头层牛皮乐福鞋。</p>'),
  (10, 2, 'PLATFORM', 'NORMAL', NULL, '拙衣', '陶土色垂感风衣',               '本季主打', '棉 100%',  'trench', 900,  1, '<p>本季主打风衣。</p>'),
  (11, 2, 'PLATFORM', 'NORMAL', NULL, '拙衣', '燕麦色针织开衫',               NULL,   '软糯',     'sweater',700,  1, '<p>燕麦色针织开衫。</p>'),
  (12, 2, 'PLATFORM', 'NORMAL', NULL, '拙衣', '月白法式衬衫',                 NULL,   '免烫',     'shirt',  650,  1, '<p>月白法式衬衫。</p>'),
  (13, 2, 'PLATFORM', 'NORMAL', NULL, '拙衣', '雾蓝伞形半身裙',               NULL,   '显瘦',     'skirt',  800,  1, '<p>雾蓝伞形半身裙。</p>'),
  (14, 5, 'CONSIGNMENT', 'NORMAL', 2, 'Chanel',  '中古 Chanel CF 黑金牛皮',       '寄卖', '成色 GOOD',   'bag', 12, 1, '<p>经典 CF 中号，黑金牛皮，正常使用痕迹。</p>'),
  (15, 6, 'CONSIGNMENT', 'NORMAL', 2, 'Acne Studios', '95新 Acne Studios 羊毛围巾', '寄卖', '成色 LIKE_NEW', 'scarf', 27, 1, '<p>羊毛围巾，仅试戴，无起球。</p>');

-- 规格/单件：自营多规格（condition_grade=NEW），寄卖单件（stock=1）
INSERT INTO product_item (product_id, size, color, condition_grade, price, origin_price, stock) VALUES
  (1, 'S', '陶土色', 'NEW', 399.00, NULL, 200), (1, 'M', '陶土色', 'NEW', 399.00, NULL, 200), (1, 'L', '陶土色', 'NEW', 399.00, NULL, 100),
  (2, 'S', '月白', 'NEW', 149.00, NULL, 300), (2, 'M', '月白', 'NEW', 149.00, NULL, 300), (2, 'L', '月白', 'NEW', 149.00, NULL, 200),
  (3, 'S', '雾蓝', 'NEW', 179.00, NULL, 220), (3, 'M', '雾蓝', 'NEW', 179.00, NULL, 220), (3, 'L', '雾蓝', 'NEW', 179.00, NULL, 160),
  (4, 'S', '燕麦', 'NEW', 189.00, NULL, 350), (4, 'M', '燕麦', 'NEW', 189.00, NULL, 350), (4, 'L', '燕麦', 'NEW', 189.00, NULL, 200),
  (5, 'S', '陶白条纹', 'NEW', 99.00, NULL, 400), (5, 'M', '陶白条纹', 'NEW', 99.00, NULL, 400), (5, 'L', '陶白条纹', 'NEW', 99.00, NULL, 400), (5, 'XL', '陶白条纹', 'NEW', 99.00, NULL, 300),
  (6, NULL, '焦糖色', 'NEW', 259.00, NULL, 300),
  (7, 'S', '米白', 'NEW', 189.00, 259.00, 250), (7, 'M', '米白', 'NEW', 189.00, 259.00, 250), (7, 'L', '米白', 'NEW', 189.00, 259.00, 200),
  (8, 'S', '深灰', 'NEW', 159.00, 219.00, 250), (8, 'M', '深灰', 'NEW', 159.00, 219.00, 250), (8, 'L', '深灰', 'NEW', 159.00, 219.00, 150),
  (9, '38', '黑色', 'NEW', 329.00, 459.00, 150), (9, '39', '黑色', 'NEW', 329.00, 459.00, 150), (9, '40', '黑色', 'NEW', 329.00, 459.00, 100),
  (10, 'S', '陶土色', 'NEW', 399.00, NULL, 250), (10, 'M', '陶土色', 'NEW', 399.00, NULL, 300),
  (11, 'S', '燕麦', 'NEW', 219.00, NULL, 240), (11, 'M', '燕麦', 'NEW', 219.00, NULL, 240),
  (12, 'S', '月白', 'NEW', 149.00, NULL, 210), (12, 'M', '月白', 'NEW', 149.00, NULL, 210),
  (13, 'S', '雾蓝', 'NEW', 179.00, NULL, 230), (13, 'M', '雾蓝', 'NEW', 179.00, NULL, 230),
  (14, NULL, '黑金', 'GOOD',     12800.00, NULL, 1),
  (15, NULL, '燕麦色', 'LIKE_NEW', 680.00,  NULL, 1);

-- 商品图片：picsum 占位图，sort=0 为主图；每商品 2 张（详情页轮播演示）
INSERT INTO product_image (product_id, url, sort)
SELECT p.id, CONCAT('https://picsum.photos/seed/mall-p', p.id, '-1/750/750'), 0 FROM product p;

INSERT INTO product_image (product_id, url, sort)
SELECT p.id, CONCAT('https://picsum.photos/seed/mall-p', p.id, '-2/750/750'), 1 FROM product p;

INSERT INTO home_banner (id, title, pic_url, link_url, sort) VALUES
  (1, '新客立减 ¥30',       'https://picsum.photos/seed/mall-banner-1/750/320', '/h5-mall', 1),
  (2, '秋季陶土系列上新',   'https://picsum.photos/seed/mall-banner-2/750/320', '/h5-mall', 2),
  (3, '满 ¥299 顺丰包邮',   'https://picsum.photos/seed/mall-banner-3/750/320', '/h5-mall', 3);

-- 寄卖演示商品对应的寄卖单（状态已走完：LISTED，listed_product_id 指回商品）
INSERT INTO consignment_listing (seller_id, brand, title, condition_grade, images, expected_price, platform_price, commission_rate, status, listed_product_id) VALUES
  (2, 'Chanel', '中古 Chanel CF 黑金牛皮', 'GOOD', JSON_ARRAY('https://picsum.photos/seed/mall-p14-1/750/750'), 15000.00, 12800.00, 15.00, 'LISTED', 14),
  (2, 'Acne Studios', '95新 Acne Studios 羊毛围巾', 'LIKE_NEW', JSON_ARRAY('https://picsum.photos/seed/mall-p15-1/750/750'), 800.00, 680.00, 15.00, 'LISTED', 15);

