package com.fullstackmall.shop.product.service.impl;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fullstackmall.shop.common.BusinessException;
import com.fullstackmall.shop.common.PageResult;
import com.fullstackmall.shop.common.ResultCode;
import com.fullstackmall.shop.product.dto.AdminProductCreateRequest;
import com.fullstackmall.shop.product.dto.AdminProductDTO;
import com.fullstackmall.shop.product.dto.AdminProductImageInput;
import com.fullstackmall.shop.product.dto.AdminProductItemDTO;
import com.fullstackmall.shop.product.dto.AdminProductItemInput;
import com.fullstackmall.shop.product.dto.AdminProductUpdateRequest;
import com.fullstackmall.shop.product.entity.Product;
import com.fullstackmall.shop.product.entity.ProductImage;
import com.fullstackmall.shop.product.entity.ProductItem;
import com.fullstackmall.shop.product.enums.ConditionGrade;
import com.fullstackmall.shop.product.enums.OwnerType;
import com.fullstackmall.shop.product.enums.SaleMode;
import com.fullstackmall.shop.product.mapper.ProductCategoryMapper;
import com.fullstackmall.shop.product.mapper.ProductImageMapper;
import com.fullstackmall.shop.product.mapper.ProductItemMapper;
import com.fullstackmall.shop.product.mapper.ProductMapper;
import com.fullstackmall.shop.product.service.AdminProductService;
import com.fullstackmall.shop.seckill.entity.SeckillActivity;
import com.fullstackmall.shop.seckill.enums.SeckillStatus;
import com.fullstackmall.shop.seckill.mapper.SeckillActivityMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 自营商品管理实现。page/create/update 风格对齐 SeckillAdminServiceImpl；
 * 下架保护落实 4a spec §10#11 未做的后半句（活动中商品禁止下架的 admin 关口），
 * 与下单事务的 status 校验互为双保险。
 */
@Service
public class AdminProductServiceImpl implements AdminProductService {

    private final ProductMapper productMapper;
    private final ProductItemMapper productItemMapper;
    private final ProductImageMapper productImageMapper;
    private final ProductCategoryMapper productCategoryMapper;
    private final SeckillActivityMapper seckillActivityMapper;

    public AdminProductServiceImpl(ProductMapper productMapper,
                                   ProductItemMapper productItemMapper,
                                   ProductImageMapper productImageMapper,
                                   ProductCategoryMapper productCategoryMapper,
                                   SeckillActivityMapper seckillActivityMapper) {
        this.productMapper = productMapper;
        this.productItemMapper = productItemMapper;
        this.productImageMapper = productImageMapper;
        this.productCategoryMapper = productCategoryMapper;
        this.seckillActivityMapper = seckillActivityMapper;
    }

    @Override
    public PageResult<AdminProductDTO> page(Integer status, String keyword, int page, int pageSize) {
        IPage<Product> result = productMapper.selectPage(new Page<>(page, pageSize),
                Wrappers.<Product>lambdaQuery()
                        .eq(Product::getOwnerType, OwnerType.PLATFORM)
                        .eq(status != null, Product::getStatus, status)
                        .like(StringUtils.hasText(keyword), Product::getName, keyword)
                        .orderByDesc(Product::getId));
        List<Product> records = result.getRecords();
        // 规格批量回填防 N+1（对齐 SeckillAdminServiceImpl.page 的商品标题回填模式）
        Map<Long, List<ProductItem>> grouped = records.isEmpty() ? Map.of()
                : productItemMapper.selectList(Wrappers.<ProductItem>lambdaQuery()
                                .in(ProductItem::getProductId, records.stream().map(Product::getId).toList()))
                        .stream().collect(Collectors.groupingBy(ProductItem::getProductId));
        PageResult<AdminProductDTO> dto = new PageResult<>();
        dto.setList(records.stream().map(p -> toDTO(p, grouped.getOrDefault(p.getId(), List.of()))).toList());
        dto.setTotal(result.getTotal());
        dto.setPage(result.getCurrent());
        dto.setPageSize(result.getSize());
        return dto;
    }

    @Override
    @Transactional
    public AdminProductDTO create(AdminProductCreateRequest req) {
        if (productCategoryMapper.selectById(req.getCategoryId()) == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "类目不存在");
        }
        // @NotEmpty 之外的 Service 层防线：直接调用（绕过 Controller 校验）时不 NPE
        if (req.getItems() == null || req.getItems().isEmpty()) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "至少需要一个规格");
        }
        // 同商品内 size 判重（null 也参与——多条无尺码规格无业务意义）
        long distinctSizes = req.getItems().stream()
                .map(AdminProductItemInput::getSize).distinct().count();
        if (distinctSizes != req.getItems().size()) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "规格 size 重复");
        }

        Product product = new Product();
        product.setCategoryId(req.getCategoryId());
        // 固化字段：本接口只造平台自营新品（基准 §2 两种货源的边界）
        product.setOwnerType(OwnerType.PLATFORM);
        product.setSaleMode(SaleMode.NORMAL);
        product.setBrand(req.getBrand());
        product.setName(req.getName());
        product.setTag(req.getTag());
        product.setSellingPoint(req.getSellingPoint());
        product.setSales(0);
        product.setStatus(1); // 新建即上架，运营路径最短；需下架走 PATCH
        product.setDetailHtml(req.getDetailHtml());
        productMapper.insert(product);

        for (AdminProductItemInput in : req.getItems()) {
            ProductItem item = new ProductItem();
            item.setProductId(product.getId());
            item.setSize(in.getSize());
            item.setColor(in.getColor());
            item.setConditionGrade(ConditionGrade.NEW); // 自营新品固定 NEW（基准 §4.3）
            item.setPrice(in.getPrice());
            item.setOriginPrice(in.getOriginPrice());
            item.setStock(in.getStock());
            productItemMapper.insert(item);
        }
        if (req.getImages() != null) {
            int sortSeq = 0;
            for (AdminProductImageInput in : req.getImages()) {
                ProductImage image = new ProductImage();
                image.setProductId(product.getId());
                image.setUrl(in.getUrl());
                // sort 缺省按提交顺序补位（0 为主图）
                image.setSort(in.getSort() != null ? in.getSort() : sortSeq);
                productImageMapper.insert(image);
                sortSeq++;
            }
        }
        return toDTO(product, itemsOf(product.getId()));
    }

    @Override
    @Transactional
    public AdminProductDTO update(Long id, AdminProductUpdateRequest req) {
        Product product = productMapper.selectById(id);
        if (product == null) {
            throw new BusinessException(ResultCode.PRODUCT_NOT_FOUND);
        }
        if (product.getOwnerType() != OwnerType.PLATFORM) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "仅支持编辑自营商品");
        }
        // 下架保护：挂载 PENDING/ACTIVE 秒杀活动禁止下架（下单 status 校验之外的运营侧关口）。
        // 惰性推进窗口内的活动仍被保护——宁可多保护不可少保护，下架操作随时可重试。
        if (Integer.valueOf(0).equals(req.getStatus()) && !Integer.valueOf(0).equals(product.getStatus())) {
            Long activeCount = seckillActivityMapper.selectCount(Wrappers.<SeckillActivity>lambdaQuery()
                    .eq(SeckillActivity::getProductId, id)
                    .in(SeckillActivity::getStatus, SeckillStatus.PENDING, SeckillStatus.ACTIVE));
            if (activeCount != null && activeCount > 0) {
                throw new BusinessException(ResultCode.SECKILL_ACTIVE_ON_PRODUCT);
            }
        }
        // PATCH 语义：MP updateById 忽略 null 字段——只更新前端显式传来的字段
        Product patch = new Product();
        patch.setId(id);
        patch.setCategoryId(req.getCategoryId());
        patch.setBrand(req.getBrand());
        patch.setName(req.getName());
        patch.setTag(req.getTag());
        patch.setSellingPoint(req.getSellingPoint());
        patch.setDetailHtml(req.getDetailHtml());
        patch.setStatus(req.getStatus());
        productMapper.updateById(patch);
        // updateById 不回读：返回以库内真态为准（重新 select 组装）
        return toDTO(productMapper.selectById(id), itemsOf(id));
    }

    private List<ProductItem> itemsOf(Long productId) {
        return productItemMapper.selectList(Wrappers.<ProductItem>lambdaQuery()
                .eq(ProductItem::getProductId, productId)
                .orderByAsc(ProductItem::getId));
    }

    private AdminProductDTO toDTO(Product product, List<ProductItem> items) {
        AdminProductDTO dto = new AdminProductDTO();
        dto.setId(product.getId());
        dto.setCategoryId(product.getCategoryId());
        dto.setBrand(product.getBrand());
        dto.setName(product.getName());
        dto.setTag(product.getTag());
        dto.setSellingPoint(product.getSellingPoint());
        dto.setDetailHtml(product.getDetailHtml());
        dto.setStatus(product.getStatus());
        dto.setSales(product.getSales());
        dto.setCreateTime(product.getCreateTime());
        dto.setUpdateTime(product.getUpdateTime());
        dto.setItems(items.stream().map(this::toItemDTO).toList());
        return dto;
    }

    private AdminProductItemDTO toItemDTO(ProductItem item) {
        AdminProductItemDTO dto = new AdminProductItemDTO();
        dto.setId(item.getId());
        dto.setSize(item.getSize());
        dto.setColor(item.getColor());
        dto.setConditionGrade(item.getConditionGrade() != null ? item.getConditionGrade().name() : null);
        dto.setPrice(item.getPrice());
        dto.setOriginPrice(item.getOriginPrice());
        dto.setStock(item.getStock());
        return dto;
    }
}
