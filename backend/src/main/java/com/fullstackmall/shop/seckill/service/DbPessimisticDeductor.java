package com.fullstackmall.shop.seckill.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fullstackmall.shop.common.BusinessException;
import com.fullstackmall.shop.common.ResultCode;
import com.fullstackmall.shop.seckill.entity.SeckillActivity;
import com.fullstackmall.shop.seckill.mapper.SeckillActivityMapper;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 悲观锁（FOR UPDATE）扣减对照组：SELECT 锁行 → 判库存 → 条件扣减。
 *
 * 仅压测/教学用途——行锁串行化吞吐上限低、锁等待可调优放大拐点（innodb_lock_wait_timeout
 * 调小到 5s 让 500 线程内可见，spec §7）。生产形态请用 OPTIMISTIC / REDIS。
 */
@Component
public class DbPessimisticDeductor {

    private final SeckillActivityMapper seckillActivityMapper;

    public DbPessimisticDeductor(SeckillActivityMapper seckillActivityMapper) {
        this.seckillActivityMapper = seckillActivityMapper;
    }

    /**
     * 锁行判库存扣减。须在事务内调用（placeOrder 的 @Transactional 传播 REQUIRED 加入即可）；
     * FOR UPDATE 在事务外执行会立即释放锁，失去串行化意义。
     */
    @Transactional(propagation = Propagation.REQUIRED)
    public void deduct(Long activityId) {
        SeckillActivity locked = seckillActivityMapper.selectForUpdate(activityId);
        if (locked == null) {
            throw new BusinessException(ResultCode.SECKILL_NOT_FOUND);
        }
        int sold = locked.getSoldCount() == null ? 0 : locked.getSoldCount();
        if (sold >= locked.getSeckillStock()) {
            throw new BusinessException(ResultCode.SOLD_OUT);
        }
        // 条件守卫双保险：锁内读到 sold 值作为下界，防并发幻影（教学实现，非生产推荐）
        int rows = seckillActivityMapper.update(null, Wrappers.<SeckillActivity>update()
                .setSql("sold_count = sold_count + 1")
                .eq("id", activityId)
                .ge("sold_count", sold));
        if (rows == 0) {
            throw new BusinessException(ResultCode.SOLD_OUT);
        }
    }
}
