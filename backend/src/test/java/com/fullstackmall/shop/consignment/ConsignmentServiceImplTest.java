package com.fullstackmall.shop.consignment;

import com.fullstackmall.shop.common.BusinessException;
import com.fullstackmall.shop.common.ResultCode;
import com.fullstackmall.shop.consignment.entity.ConsignmentListing;
import com.fullstackmall.shop.consignment.enums.ConsignmentStatus;
import com.fullstackmall.shop.consignment.mapper.ConsignmentListingMapper;
import com.fullstackmall.shop.consignment.service.ConsignmentService;
import com.fullstackmall.shop.consignment.service.impl.ConsignmentServiceImpl;
import com.fullstackmall.shop.product.entity.Product;
import com.fullstackmall.shop.product.entity.ProductItem;
import com.fullstackmall.shop.product.enums.ConditionGrade;
import com.fullstackmall.shop.product.enums.OwnerType;
import com.fullstackmall.shop.product.mapper.ProductImageMapper;
import com.fullstackmall.shop.product.mapper.ProductItemMapper;
import com.fullstackmall.shop.product.mapper.ProductMapper;
import com.fullstackmall.shop.user.context.LoginUser;
import com.fullstackmall.shop.user.context.UserContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.lang.reflect.Method;
import java.util.List;

import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/**
 * ConsignmentServiceImpl.accept 单测：铸造四写（事务）+ 状态机防跳变 + 归属校验。
 * 这是 Review Focus 1/2 的核心锚点——Controller 切片 mock 了 service，真逻辑必须在这里验。
 */
@ExtendWith(MockitoExtension.class)
class ConsignmentServiceImplTest {

    @Mock
    private ConsignmentListingMapper listingMapper;
    @Mock
    private ProductMapper productMapper;
    @Mock
    private ProductItemMapper productItemMapper;
    @Mock
    private ProductImageMapper productImageMapper;

    private ConsignmentService consignmentService;

    @BeforeEach
    void setUp() {
        consignmentService = new ConsignmentServiceImpl(
                listingMapper, productMapper, productItemMapper, productImageMapper);
        UserContext.set(new LoginUser(2L, "seller", "USER"));
    }

    @AfterEach
    void tearDown() {
        UserContext.clear();
    }

    @Test
    void 已定价单据确认后应铸造商品四写并流转已上架() {
        given(listingMapper.selectOne(any())).willReturn(pricedListing());
        // 条件更新迁移成功（影响 1 行）
        given(listingMapper.update(org.mockito.ArgumentMatchers.isNull(), any())).willReturn(1);

        var result = consignmentService.accept(1L);

        // 四写验证：product + item + 2 张 image + listing 更新
        ArgumentCaptor<Product> productCaptor = ArgumentCaptor.forClass(Product.class);
        verify(productMapper).insert(productCaptor.capture());
        Product minted = productCaptor.getValue();
        assertThat(minted.getOwnerType()).isEqualTo(OwnerType.CONSIGNMENT);
        assertThat(minted.getSaleMode().name()).isEqualTo("NORMAL");
        assertThat(minted.getSellerId()).isEqualTo(2L);
        assertThat(minted.getName()).isEqualTo("九成新摇粒绒外套");
        assertThat(minted.getCategoryId()).isEqualTo(2L);

        ArgumentCaptor<ProductItem> itemCaptor = ArgumentCaptor.forClass(ProductItem.class);
        verify(productItemMapper).insert(itemCaptor.capture());
        assertThat(itemCaptor.getValue().getPrice()).isEqualByComparingTo("99.00");
        assertThat(itemCaptor.getValue().getStock()).isEqualTo(1);
        assertThat(itemCaptor.getValue().getConditionGrade()).isEqualTo(ConditionGrade.LIKE_NEW);

        // 两张图片逐个写入，sort 递增（any 带类型消除 MP BaseMapper 多 insert 重载歧义）
        verify(productImageMapper, times(2)).insert(any(com.fullstackmall.shop.product.entity.ProductImage.class));

        assertThat(result.getStatus()).isEqualTo("LISTED");
        verify(listingMapper).updateById(any(ConsignmentListing.class));
    }

    @Test
    void 未定价单据确认应抛非法流转() {
        ConsignmentListing submitted = pricedListing();
        submitted.setStatus(ConsignmentStatus.SUBMITTED);
        given(listingMapper.selectOne(any())).willReturn(submitted);
        // 并发语义：条件更新 WHERE status=PRICED 命中 0 行 → 非法流转（不依赖内存判断）
        given(listingMapper.update(org.mockito.ArgumentMatchers.isNull(), any())).willReturn(0);

        assertThatThrownBy(() -> consignmentService.accept(1L))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.CONSIGNMENT_STATE_ILLEGAL);
    }

    @Test
    void 已上架单据重复确认应抛非法流转_幂等兜底() {
        ConsignmentListing listed = pricedListing();
        listed.setStatus(ConsignmentStatus.LISTED);
        given(listingMapper.selectOne(any())).willReturn(listed);
        // 重复 accept：迁移命中 0 行（状态已是 LISTED，不满足 WHERE status=PRICED）
        given(listingMapper.update(org.mockito.ArgumentMatchers.isNull(), any())).willReturn(0);

        assertThatThrownBy(() -> consignmentService.accept(1L))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.CONSIGNMENT_STATE_ILLEGAL);
    }

    @Test
    void 他人单据确认应抛404() {
        // 归属双条件查询查不到 → 404
        given(listingMapper.selectOne(any())).willReturn(null);

        assertThatThrownBy(() -> consignmentService.accept(1L))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.CONSIGNMENT_NOT_FOUND);
    }

    @Test
    void accept方法必须声明事务注解_铸造四写原子性() throws Exception {
        Method accept = ConsignmentServiceImpl.class.getMethod("accept", Long.class);
        assertThat(accept.getAnnotation(Transactional.class)).isNotNull();
    }

    private ConsignmentListing pricedListing() {
        ConsignmentListing listing = new ConsignmentListing();
        listing.setId(1L);
        listing.setSellerId(2L);
        listing.setCategoryId(2L);
        listing.setBrand("优衣库");
        listing.setTitle("九成新摇粒绒外套");
        listing.setConditionGrade(ConditionGrade.LIKE_NEW);
        listing.setImages("[\"https://a.com/1.jpg\",\"https://a.com/2.jpg\"]");
        listing.setDescription("仅试穿");
        listing.setExpectedPrice(new BigDecimal("120.00"));
        listing.setPlatformPrice(new BigDecimal("99.00"));
        listing.setCommissionRate(new BigDecimal("15.00"));
        listing.setStatus(ConsignmentStatus.PRICED);
        return listing;
    }
}
