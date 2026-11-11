package com.fullstackmall.shop.user;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 工具型测试：为 init.sql 种子用户生成 BCrypt 哈希（Task 4 消费 stdout 输出）。
 * BCrypt salt 随机，每次输出不同但均有效；附 matches 自校验防止贴错。
 */
class PasswordHashPrinter {

    @Test
    void shouldPrintSeedUserPasswordHashesWithSelfCheck() {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        String[] plain = {"admin123", "seller123", "buyer123"};
        for (String p : plain) {
            String hash = encoder.encode(p);
            System.out.println(p + " -> " + hash);
            assertThat(encoder.matches(p, hash)).isTrue();
        }
    }

    /**
     * 4b 压测资产回归：init.sql 压测账号（perf001~perf500）复用 admin 行同款哈希，
     * 本用例锁定该哈希的明文（JMeter users.csv 依赖）。哈希若被重新生成而明文未同步会在此变红。
     */
    @Test
    void shouldVerifyPerfAccountHashPlaintextPairing() {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        String initSqlHash = "$2a$10$qtzByZqa1qq3FHRjdkkyUuBn1seDmzzsD368wAuKJ9hqUwLp8HOC2";
        assertThat(encoder.matches("admin123", initSqlHash)).isTrue();
    }
}
