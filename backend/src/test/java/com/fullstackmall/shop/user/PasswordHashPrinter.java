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
    void 打印种子用户密码哈希并自校验() {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        String[] plain = {"admin123", "seller123", "buyer123"};
        for (String p : plain) {
            String hash = encoder.encode(p);
            System.out.println(p + " -> " + hash);
            assertThat(encoder.matches(p, hash)).isTrue();
        }
    }
}
