package com.fullstackmall.shop.consignment.service;

import com.fullstackmall.shop.consignment.dto.ConsignmentDTO;
import com.fullstackmall.shop.consignment.dto.ConsignmentSubmitRequest;
import com.fullstackmall.shop.consignment.dto.ReviewRequest;

import java.util.List;

/**
 * 寄卖业务。归属边界：C 端方法全部限定当前登录卖家，他人单据按 404 处理防探测。
 */
public interface ConsignmentService {

    /** 提交寄卖（状态 SUBMITTED） */
    ConsignmentDTO submit(ConsignmentSubmitRequest req);

    /** 我的寄卖列表（createTime 降序） */
    List<ConsignmentDTO> mine();

    /**
     * 寄卖单详情（仅本人可见）。
     *
     * @throws com.fullstackmall.shop.common.BusinessException CONSIGNMENT_NOT_FOUND 不存在或属于他人
     */
    ConsignmentDTO detail(Long id);

    /**
     * 卖家确认定价：PRICED → LISTED，同事务铸造 Product + ProductItem + ProductImage。
     * 重复调用由状态机拦截（CONSIGNMENT_STATE_ILLEGAL）。
     */
    ConsignmentDTO accept(Long id);

    /** 管理端：按状态查寄卖单（缺省 SUBMITTED 审核池） */
    List<ConsignmentDTO> adminList(String status);

    /**
     * 管理端核价/驳回：(SUBMITTED|REVIEWING) → PRICED/REJECTED。
     * 其他状态流转抛 CONSIGNMENT_STATE_ILLEGAL。
     */
    ConsignmentDTO review(Long id, ReviewRequest req);
}
