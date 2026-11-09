package com.fullstackmall.shop.consignment.service.impl;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fullstackmall.shop.common.BusinessException;
import com.fullstackmall.shop.common.ResultCode;
import com.fullstackmall.shop.consignment.dto.ConsignmentDTO;
import com.fullstackmall.shop.consignment.dto.ConsignmentSubmitRequest;
import com.fullstackmall.shop.consignment.dto.ReviewRequest;
import com.fullstackmall.shop.consignment.entity.ConsignmentListing;
import com.fullstackmall.shop.consignment.enums.ConsignmentStatus;
import com.fullstackmall.shop.consignment.mapper.ConsignmentListingMapper;
import com.fullstackmall.shop.consignment.service.ConsignmentService;
import com.fullstackmall.shop.product.enums.ConditionGrade;
import com.fullstackmall.shop.product.enums.OwnerType;
import com.fullstackmall.shop.product.enums.SaleMode;
import com.fullstackmall.shop.product.entity.Product;
import com.fullstackmall.shop.product.entity.ProductImage;
import com.fullstackmall.shop.product.entity.ProductItem;
import com.fullstackmall.shop.product.mapper.ProductImageMapper;
import com.fullstackmall.shop.product.mapper.ProductItemMapper;
import com.fullstackmall.shop.product.mapper.ProductMapper;
import com.fullstackmall.shop.user.context.UserContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 寄卖业务实现。images 的 JSON 列与 List<String> 互转集中在本类（Jackson）。
 * 并发红线（终审修复）：状态流转不做"读-判-写"，走条件更新原子迁移——
 * UPDATE ... SET status=目标 WHERE id=? AND status IN (合法前置)，影响行数 0 即非法流转，
 * 由数据库保证并发下只有一个请求能迁移成功（防重复铸造/审核终态覆盖）。
 */
@Slf4j
@Service
public class ConsignmentServiceImpl implements ConsignmentService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final ConsignmentListingMapper consignmentListingMapper;
    private final ProductMapper productMapper;
    private final ProductItemMapper productItemMapper;
    private final ProductImageMapper productImageMapper;

    public ConsignmentServiceImpl(ConsignmentListingMapper consignmentListingMapper,
                                  ProductMapper productMapper,
                                  ProductItemMapper productItemMapper,
                                  ProductImageMapper productImageMapper) {
        this.consignmentListingMapper = consignmentListingMapper;
        this.productMapper = productMapper;
        this.productItemMapper = productItemMapper;
        this.productImageMapper = productImageMapper;
    }

    @Override
    public ConsignmentDTO submit(ConsignmentSubmitRequest req) {
        Long sellerId = UserContext.getRequired().userId();
        ConsignmentListing listing = new ConsignmentListing();
        listing.setSellerId(sellerId);
        listing.setCategoryId(req.getCategoryId());
        listing.setBrand(req.getBrand());
        listing.setTitle(req.getTitle());
        listing.setSize(req.getSize());
        listing.setConditionGrade(ConditionGrade.valueOf(req.getConditionGrade()));
        listing.setImages(writeImages(req.getImages()));
        listing.setDescription(req.getDescription());
        listing.setExpectedPrice(req.getExpectedPrice());
        listing.setStatus(ConsignmentStatus.SUBMITTED);
        consignmentListingMapper.insert(listing);
        return toDTO(listing);
    }

    @Override
    public List<ConsignmentDTO> mine() {
        Long sellerId = UserContext.getRequired().userId();
        List<ConsignmentListing> listings = consignmentListingMapper.selectList(
                Wrappers.<ConsignmentListing>lambdaQuery()
                        .eq(ConsignmentListing::getSellerId, sellerId)
                        .orderByDesc(ConsignmentListing::getCreateTime));
        return listings.stream().map(this::toDTO).toList();
    }

    @Override
    public ConsignmentDTO detail(Long id) {
        return toDTO(requireOwned(id));
    }

    /**
     * 卖家确认定价（PRICED → LISTED）：同事务铸造商品三表 + 回写寄卖单。
     * 四写任一失败整体回滚，不留半截商品；重复调用由状态机拦截（LISTED 再调即非法流转）。
     */
    @Override
    @Transactional
    public ConsignmentDTO accept(Long id) {
        ConsignmentListing listing = requireOwned(id);
        // 原子迁移占位：并发下只有一个请求能把 PRICED 改为 LISTED，其余命中 0 行被拦
        migrateStatus(id, ConsignmentStatus.LISTED, ConsignmentStatus.PRICED);

        // 1. 铸造商品（寄卖身份 + 卖家归属 + 分类随单）
        Product product = new Product();
        product.setCategoryId(listing.getCategoryId());
        product.setOwnerType(OwnerType.CONSIGNMENT);
        // 寄卖铸造恒为普通售卖；秒杀/众筹玩法只挂自营商品（设计文档 §4.6：寄卖不参与秒杀）
        product.setSaleMode(SaleMode.NORMAL);
        product.setSellerId(listing.getSellerId());
        product.setBrand(listing.getBrand());
        product.setName(listing.getTitle());
        product.setTag("寄卖");
        product.setSellingPoint("成色 " + listing.getConditionGrade().name());
        product.setSales(0);
        product.setStatus(1);
        product.setDetailHtml(listing.getDescription());
        productMapper.insert(product);

        // 2. 单件（寄卖库存恒 1，价格为平台核价）
        ProductItem item = new ProductItem();
        item.setProductId(product.getId());
        item.setSize(listing.getSize());
        item.setConditionGrade(listing.getConditionGrade());
        item.setPrice(listing.getPlatformPrice());
        item.setStock(1);
        item.setVersion(0);
        productItemMapper.insert(item);

        // 3. 实拍图逐个落库（sort 递增，首张为主图）
        List<String> images = readImages(listing.getImages());
        for (int i = 0; i < images.size(); i++) {
            ProductImage image = new ProductImage();
            image.setProductId(product.getId());
            image.setUrl(images.get(i));
            image.setSort(i);
            productImageMapper.insert(image);
        }

        // 4. 寄卖单流转 LISTED 并回写铸造产物 id
        listing.setStatus(ConsignmentStatus.LISTED);
        listing.setListedProductId(product.getId());
        consignmentListingMapper.updateById(listing);
        return toDTO(listing);
    }

    @Override
    public List<ConsignmentDTO> adminList(String status) {
        ConsignmentStatus target;
        try {
            target = ConsignmentStatus.valueOf(
                    org.springframework.util.StringUtils.hasText(status) ? status : "SUBMITTED");
        } catch (IllegalArgumentException e) {
            // 非法状态枚举值按参数错误处理（不暴露堆栈给前端）
            throw new BusinessException(ResultCode.BAD_REQUEST);
        }
        List<ConsignmentListing> listings = consignmentListingMapper.selectList(
                Wrappers.<ConsignmentListing>lambdaQuery()
                        .eq(ConsignmentListing::getStatus, target)
                        .orderByDesc(ConsignmentListing::getCreateTime));
        return listings.stream().map(this::toDTO).toList();
    }

    @Override
    @Transactional
    public ConsignmentDTO review(Long id, ReviewRequest req) {
        ConsignmentListing listing = consignmentListingMapper.selectById(id);
        if (listing == null) {
            throw new BusinessException(ResultCode.CONSIGNMENT_NOT_FOUND);
        }
        // 字段级交叉校验先行（参数层面，不做状态写入）
        if (Boolean.TRUE.equals(req.getApprove())) {
            if (req.getPlatformPrice() == null || req.getCommissionRate() == null) {
                throw new BusinessException(ResultCode.BAD_REQUEST);
            }
        } else if (!org.springframework.util.StringUtils.hasText(req.getRejectReason())) {
            throw new BusinessException(ResultCode.BAD_REQUEST);
        }

        // 原子迁移：仅审核池（SUBMITTED/REVIEWING）可流转；并发审核/驳回只有一个成功
        ConsignmentStatus target = Boolean.TRUE.equals(req.getApprove())
                ? ConsignmentStatus.PRICED : ConsignmentStatus.REJECTED;
        migrateStatus(id, target, ConsignmentStatus.SUBMITTED, ConsignmentStatus.REVIEWING);

        // 迁移成功后回填字段（同事务）
        listing.setStatus(target);
        if (target == ConsignmentStatus.PRICED) {
            listing.setPlatformPrice(req.getPlatformPrice());
            listing.setCommissionRate(req.getCommissionRate());
        } else {
            listing.setRejectReason(req.getRejectReason());
        }
        consignmentListingMapper.updateById(listing);
        return toDTO(listing);
    }

    /**
     * 原子状态迁移：UPDATE ... SET status=to WHERE id=? AND status IN (from...)。
     * 影响行数 0 即非法流转/并发竞争失败——状态机由数据库兜底，不做内存"读-判-写"。
     * 用字符串列名的 UpdateWrapper 而非 LambdaUpdateWrapper：纯单测（无 MP 容器初始化）
     * 下 Lambda 列名解析依赖 TableInfo 缓存会炸，字符串列名无此依赖（列名与 DDL 对齐，重命名需手动同步）。
     */
    private void migrateStatus(Long id, ConsignmentStatus to, ConsignmentStatus... from) {
        int rows = consignmentListingMapper.update(null, Wrappers.<ConsignmentListing>update()
                .set("status", to.name())
                .eq("id", id)
                .in("status", java.util.Arrays.stream(from).map(Enum::name).toList()));
        if (rows == 0) {
            throw new BusinessException(ResultCode.CONSIGNMENT_STATE_ILLEGAL);
        }
    }

    /** 按 id + 本人归属双条件取寄卖单；查不到一律 404（不暴露存在性） */
    ConsignmentListing requireOwned(Long id) {
        Long sellerId = UserContext.getRequired().userId();
        ConsignmentListing listing = consignmentListingMapper.selectOne(
                Wrappers.<ConsignmentListing>lambdaQuery()
                        .eq(ConsignmentListing::getId, id)
                        .eq(ConsignmentListing::getSellerId, sellerId));
        if (listing == null) {
            throw new BusinessException(ResultCode.CONSIGNMENT_NOT_FOUND);
        }
        return listing;
    }

    /** images 数组 → JSON 列字符串；写不进去视为参数错误（调用方已做非空/数量校验） */
    String writeImages(List<String> images) {
        try {
            return OBJECT_MAPPER.writeValueAsString(images);
        } catch (Exception e) {
            throw new BusinessException(ResultCode.BAD_REQUEST);
        }
    }

    /** JSON 列字符串 → images 数组；库里非法 JSON 按空数组兜底 + 记日志（烂数据不炸 C 端但要可追踪） */
    List<String> readImages(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return OBJECT_MAPPER.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            log.warn("寄卖单 images JSON 解析失败，按无图兜底展示：{}", json, e);
            return List.of();
        }
    }

    ConsignmentDTO toDTO(ConsignmentListing listing) {
        ConsignmentDTO dto = new ConsignmentDTO();
        BeanUtils.copyProperties(listing, dto, "images", "conditionGrade", "status");
        dto.setImages(readImages(listing.getImages()));
        dto.setConditionGrade(listing.getConditionGrade() != null ? listing.getConditionGrade().name() : null);
        dto.setStatus(listing.getStatus() != null ? listing.getStatus().name() : null);
        return dto;
    }
}
