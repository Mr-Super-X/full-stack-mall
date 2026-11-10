package com.fullstackmall.shop.seckill.service;

import com.fullstackmall.shop.common.PageResult;
import com.fullstackmall.shop.seckill.dto.SeckillActivityAdminDTO;
import com.fullstackmall.shop.seckill.dto.SeckillActivityCreateRequest;
import com.fullstackmall.shop.seckill.dto.SeckillCandidateDTO;

/**
 * 秒杀场次管理（admin）：创建（划拨事务）/取消（归还）/分页。
 */
public interface SeckillAdminService {

    /**
     * 创建场次：校验单 SKU 自营挂载、限购恒 1、时间合法后，
     * 事务内从挂载 item 划拨库存（条件更新行数守卫）并落 PENDING 活动。
     *
     * @throws com.fullstackmall.shop.common.BusinessException BAD_REQUEST（挂载/限购/时间不合法）
     *                                                          或 STOCK_NOT_ENOUGH（划拨行数 0）
     */
    SeckillActivityAdminDTO create(SeckillActivityCreateRequest request);

    /**
     * 取消场次（仅 PENDING）：状态条件迁移 + 归还未售划拨库存，同一事务。
     *
     * @throws com.fullstackmall.shop.common.BusinessException SECKILL_NOT_FOUND / CONSIGNMENT_STATE_ILLEGAL
     */
    void cancel(Long activityId);

    /** 分页列表（status 可空=全部），含商品标题回填 */
    PageResult<SeckillActivityAdminDTO> page(String status, int page, int pageSize);

    /** 新建 dialog 候选商品：单 SKU 自营且有库存（挂载约束 spec §3.1） */
    java.util.List<SeckillCandidateDTO> candidates();
}
