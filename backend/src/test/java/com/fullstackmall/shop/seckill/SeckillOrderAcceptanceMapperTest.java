package com.fullstackmall.shop.seckill;

import com.baomidou.mybatisplus.core.MybatisSqlSessionFactoryBuilder;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fullstackmall.shop.seckill.entity.SeckillOrderAcceptance;
import com.fullstackmall.shop.seckill.mapper.SeckillOrderAcceptanceMapper;
import org.apache.ibatis.session.SqlSession;
import org.apache.ibatis.session.SqlSessionFactory;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.sql.Connection;
import java.sql.Statement;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 受理登记表真库契约（Testcontainers MySQL 8.4，镜像本地已有）：
 * 全量执行 init.sql（顺带验证新增 DDL 可跑）后测插入/按单号查/状态推进三断言。
 * 项目首个真库测试——受理表是少卖口径载体，出错代价高于其他表。
 */
@Testcontainers
class SeckillOrderAcceptanceMapperTest {

    @Container
    static final MySQLContainer<?> MYSQL =
            new MySQLContainer<>("mysql:8.4").withDatabaseName("mall")
                    .withUsername("root").withPassword("test");

    private static SqlSessionFactory factory;

    @BeforeAll
    static void initDb() throws Exception {
        // 全量执行 init.sql（DDL + 种子）：验证 4b 新增受理表在完整初始化流程下可建
        try (Connection c = MYSQL.createConnection("");
             Statement st = c.createStatement()) {
            String sql = Files.readString(Paths.get("sql/init.sql"));
            for (String stmt : sql.split(";\\s*(\\r?\\n|$)")) {
                String trimmed = stmt.trim();
                if (!trimmed.isEmpty()) {
                    st.execute(trimmed);
                }
            }
        }
        // 手动装配 MyBatis-Plus（无 Spring 先例，保持项目 Mockito 式轻量）：
        // MySQLContainer 的 JDBC DataSource + MP 的 MybatisConfiguration（内置 BaseMapper 方法注入）
        com.mysql.cj.jdbc.MysqlDataSource ds = new com.mysql.cj.jdbc.MysqlDataSource();
        ds.setUrl(MYSQL.getJdbcUrl());
        ds.setUser(MYSQL.getUsername());
        ds.setPassword(MYSQL.getPassword());
        org.apache.ibatis.mapping.Environment env =
                new org.apache.ibatis.mapping.Environment("tc",
                        new org.apache.ibatis.transaction.jdbc.JdbcTransactionFactory(), ds);
        com.baomidou.mybatisplus.core.MybatisConfiguration config =
                new com.baomidou.mybatisplus.core.MybatisConfiguration(env);
        config.addMapper(SeckillOrderAcceptanceMapper.class);
        factory = new MybatisSqlSessionFactoryBuilder().build(config);
    }

    private SeckillOrderAcceptanceMapper mapper;

    @BeforeEach
    void openSession() {
        SqlSession session = factory.openSession(true);
        mapper = session.getMapper(SeckillOrderAcceptanceMapper.class);
    }

    private SeckillOrderAcceptance acceptance(String orderNo, String status) {
        SeckillOrderAcceptance a = new SeckillOrderAcceptance();
        a.setOrderNo(orderNo);
        a.setActivityId(16L);
        a.setUserId(3L);
        a.setStatus(status);
        return a;
    }

    @Test
    @DisplayName("插入 + 按 orderNo 查：ACCEPTED 态落库可读回")
    void insert_andSelectByOrderNo() {
        mapper.insert(acceptance("M-T6-001", "ACCEPTED"));

        SeckillOrderAcceptance found = mapper.selectOne(Wrappers.<SeckillOrderAcceptance>lambdaQuery()
                .eq(SeckillOrderAcceptance::getOrderNo, "M-T6-001"));
        assertThat(found).isNotNull();
        assertThat(found.getStatus()).isEqualTo("ACCEPTED");
        assertThat(found.getActivityId()).isEqualTo(16L);
        assertThat(found.getUserId()).isEqualTo(3L);
    }

    @Test
    @DisplayName("状态推进：ACCEPTED → CREATED 条件更新（消费者成功路径）")
    void updateStatus_acceptedToCreated() {
        mapper.insert(acceptance("M-T6-002", "ACCEPTED"));

        int rows = mapper.update(null, Wrappers.<SeckillOrderAcceptance>update()
                .set("status", "CREATED")
                .eq("order_no", "M-T6-002")
                .eq("status", "ACCEPTED"));
        assertThat(rows).isEqualTo(1);

        SeckillOrderAcceptance found = mapper.selectById("M-T6-002");
        assertThat(found.getStatus()).isEqualTo("CREATED");
    }

    @Test
    @DisplayName("FAILED 登记（DLX 路径）+ 按 user 查全量（轮询端点数据源）")
    void failed_andSelectByUser() {
        mapper.insert(acceptance("M-T6-003", "ACCEPTED"));
        mapper.update(null, Wrappers.<SeckillOrderAcceptance>update()
                .set("status", "FAILED")
                .eq("order_no", "M-T6-003"));

        List<SeckillOrderAcceptance> mine = mapper.selectList(
                Wrappers.<SeckillOrderAcceptance>lambdaQuery()
                        .eq(SeckillOrderAcceptance::getUserId, 3L)
                        .eq(SeckillOrderAcceptance::getStatus, "FAILED"));
        assertThat(mine).extracting(SeckillOrderAcceptance::getOrderNo).contains("M-T6-003");
    }
}
