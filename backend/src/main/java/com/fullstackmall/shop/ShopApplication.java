package com.fullstackmall.shop;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * 商城后端启动类。按业务分包（product/user/cart/order…），slice1 仅含 product 与公共层。
 * Mapper 扫描走各接口上的 @Mapper 注解（MyBatis-Plus 自动扫描），
 * 避免 @MapperScan 让 @WebMvcTest 切片误注册 Mapper Bean。
 */
@SpringBootApplication
public class ShopApplication {

    public static void main(String[] args) {
        SpringApplication.run(ShopApplication.class, args);
    }
}
