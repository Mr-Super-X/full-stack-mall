package com.fullstackmall.shop.seckill.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.fullstackmall.shop.seckill.entity.SeckillActivity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface SeckillActivityMapper extends BaseMapper<SeckillActivity> {

    /**
     * 悲观锁对照组（spec §7）：行锁串行化读，须在事务内调用（事务提交或回滚才释放）。
     * 仅 strategy=pessimistic 压测路径使用；生产读走 selectById（无锁快照读）。
     */
    @Select("SELECT * FROM seckill_activity WHERE id = #{id} FOR UPDATE")
    SeckillActivity selectForUpdate(Long id);
}
