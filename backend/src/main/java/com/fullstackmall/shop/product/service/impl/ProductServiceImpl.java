package com.fullstackmall.shop.product.service.impl;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fullstackmall.shop.common.BusinessException;
import com.fullstackmall.shop.common.PageResult;
import com.fullstackmall.shop.common.ResultCode;
import com.fullstackmall.shop.product.dto.ProductDetailDTO;
import com.fullstackmall.shop.product.dto.ProductItemDTO;
import com.fullstackmall.shop.product.dto.ProductListRequest;
import com.fullstackmall.shop.product.dto.ProductSummaryDTO;
import com.fullstackmall.shop.product.entity.Product;
import com.fullstackmall.shop.product.entity.ProductImage;
import com.fullstackmall.shop.product.entity.ProductItem;
import com.fullstackmall.shop.product.mapper.ProductImageMapper;
import com.fullstackmall.shop.product.mapper.ProductItemMapper;
import com.fullstackmall.shop.product.mapper.ProductMapper;
import com.fullstackmall.shop.product.service.ProductService;
import com.fullstackmall.shop.product.utils.SearchQuerySupport;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.Comparator;
import java.util.List;
import java.util.Objects;

/**
 * 商品查询：列表走 XML 聚合（ProductMapper.xml，MIN/MAX 聚合规格价），
 * 详情 = product + items + images 三次查询组装（单商品粒度，无 join 必要）。
 */
@Service
public class ProductServiceImpl implements ProductService {

    private final ProductMapper productMapper;
    private final ProductItemMapper productItemMapper;
    private final ProductImageMapper productImageMapper;
    private final com.fullstackmall.shop.seckill.service.SeckillService seckillService;

    public ProductServiceImpl(ProductMapper productMapper,
                              ProductItemMapper productItemMapper,
                              ProductImageMapper productImageMapper,
                              com.fullstackmall.shop.seckill.service.SeckillService seckillService) {
        this.productMapper = productMapper;
        this.productItemMapper = productItemMapper;
        this.productImageMapper = productImageMapper;
        this.seckillService = seckillService;
    }

    @Override
    public PageResult<ProductSummaryDTO> pageProducts(ProductListRequest request) {
        // keyword trim + sanitize：BOOLEAN 操作符经 SearchQuerySupport 转义防 AGAINST 语法 500；
        // sanitize 后为空视同未传，置 null 让 XML 跳过 MATCH 条件（全量）
        if (StringUtils.hasText(request.getKeyword())) {
            request.setKeyword(SearchQuerySupport.sanitize(request.getKeyword().trim()));
        } else {
            request.setKeyword(null);
        }
        // 成色非法值静默忽略（同 sort 回退风格）：避免拼写错误入参产生"0 结果"误导用户
        if (StringUtils.hasText(request.getConditionGrade())
                && java.util.Arrays.stream(com.fullstackmall.shop.product.enums.ConditionGrade.values())
                        .noneMatch(g -> g.name().equals(request.getConditionGrade()))) {
            request.setConditionGrade(null);
        }
        // 价格区间倒挂（min > max）整体忽略：入参容错，不报错不打断浏览
        if (request.getPriceMin() != null && request.getPriceMax() != null
                && request.getPriceMin().compareTo(request.getPriceMax()) > 0) {
            request.setPriceMin(null);
            request.setPriceMax(null);
        }
        Page<ProductSummaryDTO> page = new Page<>(request.getPage(), request.getPageSize());
        productMapper.selectSummaryPage(page, request);
        return PageResult.of(page);
    }

    @Override
    public ProductDetailDTO getDetail(Long id) {
        Product product = productMapper.selectOne(Wrappers.<Product>lambdaQuery()
                .eq(Product::getId, id)
                .eq(Product::getStatus, 1));
        if (product == null) {
            // 不存在与已下架对前端统一口径，避免枚举有效商品 id
            throw new BusinessException(ResultCode.PRODUCT_NOT_FOUND);
        }
        List<ProductItem> items = productItemMapper.selectList(Wrappers.<ProductItem>lambdaQuery()
                .eq(ProductItem::getProductId, id)
                .orderByAsc(ProductItem::getPrice));
        List<String> images = productImageMapper.selectList(Wrappers.<ProductImage>lambdaQuery()
                        .eq(ProductImage::getProductId, id)
                        .orderByAsc(ProductImage::getSort))
                .stream().map(ProductImage::getUrl).toList();

        ProductDetailDTO detail = new ProductDetailDTO();
        BeanUtils.copyProperties(product, detail);
        detail.setOwnerType(product.getOwnerType().name());
        detail.setSaleMode(product.getSaleMode().name());
        // 卡片字段语义与列表聚合对齐：price=最低规格价，originPrice=最大划线价，成色取最低价规格
        items.stream().min(Comparator.comparing(ProductItem::getPrice)).ifPresent(cheapest -> {
            detail.setPrice(cheapest.getPrice());
            detail.setConditionGrade(cheapest.getConditionGrade().name());
        });
        items.stream().map(ProductItem::getOriginPrice).filter(Objects::nonNull)
                .max(Comparator.naturalOrder()).ifPresent(detail::setOriginPrice);
        detail.setImageUrl(images.isEmpty() ? null : images.get(0));
        detail.setItems(items.stream().map(this::toItemDTO).toList());
        detail.setImages(images);
        // 秒杀插件出参：生效中活动才非空（由 SeckillService 判定时间窗）
        detail.setActiveSeckill(seckillService.findActiveItemByProductId(id));
        return detail;
    }

    private ProductItemDTO toItemDTO(ProductItem item) {
        ProductItemDTO dto = new ProductItemDTO();
        BeanUtils.copyProperties(item, dto);
        dto.setConditionGrade(item.getConditionGrade().name());
        return dto;
    }
}
