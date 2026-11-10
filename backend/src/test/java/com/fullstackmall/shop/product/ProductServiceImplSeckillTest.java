package com.fullstackmall.shop.product;

import com.fullstackmall.shop.product.dto.ProductDetailDTO;
import com.fullstackmall.shop.product.entity.Product;
import com.fullstackmall.shop.product.entity.ProductImage;
import com.fullstackmall.shop.product.entity.ProductItem;
import com.fullstackmall.shop.product.enums.OwnerType;
import com.fullstackmall.shop.product.mapper.ProductImageMapper;
import com.fullstackmall.shop.product.mapper.ProductItemMapper;
import com.fullstackmall.shop.product.mapper.ProductMapper;
import com.fullstackmall.shop.product.service.impl.ProductServiceImpl;
import com.fullstackmall.shop.seckill.dto.SeckillActiveDTO;
import com.fullstackmall.shop.seckill.service.SeckillService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;

/**
 * 详情页秒杀插件出参装配：activeSeckill 有活动回填、无活动为 null。
 */
@ExtendWith(MockitoExtension.class)
class ProductServiceImplSeckillTest {

    @Mock
    private ProductMapper productMapper;
    @Mock
    private ProductItemMapper productItemMapper;
    @Mock
    private ProductImageMapper productImageMapper;
    @Mock
    private SeckillService seckillService;

    private ProductServiceImpl productService;

    @BeforeEach
    void setUp() {
        productService = new ProductServiceImpl(productMapper, productItemMapper, productImageMapper, seckillService);
    }

    @Test
    void 详情有生效活动_出参含activeSeckill() {
        given(productMapper.selectOne(any())).willReturn(product());
        given(productItemMapper.selectList(any())).willReturn(List.of(item()));
        given(productImageMapper.selectList(any())).willReturn(List.of(image(0), image(1)));
        SeckillActiveDTO.SeckillActivityDTO active = new SeckillActiveDTO.SeckillActivityDTO();
        active.setActivityId(1L);
        active.setSeckillPrice(new BigDecimal("299.40"));
        active.setEndTime(LocalDateTime.now().plusDays(7));
        given(seckillService.findActiveItemByProductId(16L)).willReturn(active);

        ProductDetailDTO detail = productService.getDetail(16L);

        assertThat(detail.getActiveSeckill()).isNotNull();
        assertThat(detail.getActiveSeckill().getActivityId()).isEqualTo(1L);
        assertThat(detail.getActiveSeckill().getSeckillPrice()).isEqualByComparingTo(new BigDecimal("299.40"));
    }

    @Test
    void 详情无生效活动_activeSeckill为null() {
        given(productMapper.selectOne(any())).willReturn(product());
        given(productItemMapper.selectList(any())).willReturn(List.of(item()));
        given(productImageMapper.selectList(any())).willReturn(List.of(image(0)));
        given(seckillService.findActiveItemByProductId(16L)).willReturn(null);

        ProductDetailDTO detail = productService.getDetail(16L);

        assertThat(detail.getActiveSeckill()).isNull();
    }

    private Product product() {
        Product product = new Product();
        product.setId(16L);
        product.setName("复古做旧牛仔夹克 · 秒杀进行中");
        product.setOwnerType(OwnerType.PLATFORM);
        product.setStatus(1);
        product.setSaleMode(com.fullstackmall.shop.product.enums.SaleMode.SECKILL);
        return product;
    }

    private ProductItem item() {
        ProductItem item = new ProductItem();
        item.setId(36L);
        item.setProductId(16L);
        item.setPrice(new BigDecimal("499.00"));
        item.setStock(15);
        item.setConditionGrade(com.fullstackmall.shop.product.enums.ConditionGrade.NEW);
        return item;
    }

    private ProductImage image(int sort) {
        ProductImage image = new ProductImage();
        image.setProductId(16L);
        image.setUrl("https://picsum.photos/seed/mall-p16-" + (sort + 1) + "/750/750");
        image.setSort(sort);
        return image;
    }
}
