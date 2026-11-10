package com.fullstackmall.shop.seckill.service;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * seckill.* 配置绑定（application.yml）：扣减策略开关。
 * 默认 OPTIMISTIC 保持 4a 行为；压测时经 SECKILL_STRATEGY 环境变量切换三实现跑三趟。
 */
@Component
@ConfigurationProperties("seckill")
public class SeckillProperties {

    /** 扣库存实现；非法值由 Spring 绑定阶段即失败（fail-fast） */
    private SeckillDeductStrategy strategy = SeckillDeductStrategy.OPTIMISTIC;

    public SeckillDeductStrategy getStrategy() {
        return strategy;
    }

    public void setStrategy(SeckillDeductStrategy strategy) {
        this.strategy = strategy;
    }
}
