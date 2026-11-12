package com.fullstackmall.shop.product;

import com.fullstackmall.shop.common.BusinessException;
import com.fullstackmall.shop.common.PageResult;
import com.fullstackmall.shop.common.ResultCode;
import com.fullstackmall.shop.product.dto.AdminProductCreateRequest;
import com.fullstackmall.shop.product.dto.AdminProductDTO;
import com.fullstackmall.shop.product.dto.AdminProductItemInput;
import com.fullstackmall.shop.product.dto.AdminProductUpdateRequest;
import com.fullstackmall.shop.product.entity.Product;
import com.fullstackmall.shop.product.entity.ProductImage;
import com.fullstackmall.shop.product.entity.ProductItem;
import com.fullstackmall.shop.product.enums.ConditionGrade;
import com.fullstackmall.shop.product.enums.OwnerType;
import com.fullstackmall.shop.product.mapper.ProductCategoryMapper;
import com.fullstackmall.shop.product.mapper.ProductImageMapper;
import com.fullstackmall.shop.product.mapper.ProductItemMapper;
import com.fullstackmall.shop.product.mapper.ProductMapper;
import com.fullstackmall.shop.product.service.impl.AdminProductServiceImpl;
import com.fullstackmall.shop.seckill.mapper.SeckillActivityMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * AdminProductServiceImpl 真逻辑单测：创建固化字段与三插事务、size 判重、
 * PATCH 语义、下架秒杀挂载保护（4a spec §10#11 的 admin 关口）。
 */
@ExtendWith(MockitoExtension.class)
class AdminProductServiceImplTest {

    @Mock
    private ProductMapper productMapper;
    @Mock
    private ProductItemMapper productItemMapper;
    @Mock
    private ProductImageMapper productImageMapper;
    @Mock
    private ProductCategoryMapper productCategoryMapper;
    @Mock
    private SeckillActivityMapper seckillActivityMapper;

    private AdminProductServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new AdminProductServiceImpl(productMapper, productItemMapper, productImageMapper,
                productCategoryMapper, seckillActivityMapper);
    }

    @Test
    void createSuccess_shouldPersistWithFixedFieldsAndBackfillSort() {
        given(productCategoryMapper.selectById(2L)).willReturn(new com.fullstackmall.shop.product.entity.ProductCategory());
        // insert 回填主键（模拟 MyBatis-Plus IdType.AUTO 行为）
        given(productMapper.insert(any(Product.class))).willAnswer(inv -> {
            inv.getArgument(0, Product.class).setId(9L);
            return 1;
        });
        given(productItemMapper.selectList(any())).willReturn(List.of());

        AdminProductCreateRequest req = new AdminProductCreateRequest();
        req.setCategoryId(2L);
        req.setName("陶土色垂感风衣");
        req.setBrand("拙衣");
        req.setItems(List.of(item("M", "199.00", "299.00", 5), item("L", "199.00", "299.00", 3)));
        // 两张图都不传 sort——验证按提交顺序补位 0/1
        req.setImages(List.of(image("https://a.com/1.jpg"), image("https://a.com/2.jpg")));

        AdminProductDTO result = service.create(req);

        ArgumentCaptor<Product> productCaptor = ArgumentCaptor.forClass(Product.class);
        verify(productMapper).insert(productCaptor.capture());
        Product saved = productCaptor.getValue();
        assertThat(saved.getOwnerType()).isEqualTo(OwnerType.PLATFORM);
        assertThat(saved.getSaleMode().name()).isEqualTo("NORMAL");
        assertThat(saved.getStatus()).isEqualTo(1);
        assertThat(saved.getSales()).isEqualTo(0);
        assertThat(result.getId()).isEqualTo(9L);

        ArgumentCaptor<ProductItem> itemCaptor = ArgumentCaptor.forClass(ProductItem.class);
        verify(productItemMapper, org.mockito.Mockito.times(2)).insert(itemCaptor.capture());
        assertThat(itemCaptor.getAllValues())
                .allSatisfy(i -> {
                    assertThat(i.getProductId()).isEqualTo(9L);
                    assertThat(i.getConditionGrade()).isEqualTo(ConditionGrade.NEW);
                });

        ArgumentCaptor<ProductImage> imageCaptor = ArgumentCaptor.forClass(ProductImage.class);
        verify(productImageMapper, org.mockito.Mockito.times(2)).insert(imageCaptor.capture());
        assertThat(imageCaptor.getAllValues().stream().map(ProductImage::getSort)).containsExactly(0, 1);
    }

    @Test
    void createWithUnknownCategory_shouldReject() {
        given(productCategoryMapper.selectById(99L)).willReturn(null);
        AdminProductCreateRequest req = new AdminProductCreateRequest();
        req.setCategoryId(99L);
        req.setName("x");
        req.setItems(List.of(item("M", "9.99", null, 1)));

        assertThatThrownBy(() -> service.create(req))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.BAD_REQUEST);
    }

    @Test
    void createWithDuplicateSize_shouldReject() {
        given(productCategoryMapper.selectById(2L)).willReturn(new com.fullstackmall.shop.product.entity.ProductCategory());
        AdminProductCreateRequest req = new AdminProductCreateRequest();
        req.setCategoryId(2L);
        req.setName("x");
        req.setItems(List.of(item("M", "9.99", null, 1), item("M", "8.99", null, 2)));

        assertThatThrownBy(() -> service.create(req))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.BAD_REQUEST);
    }

    @Test
    void createWithoutItems_shouldRejectAsServiceDefense() {
        given(productCategoryMapper.selectById(2L)).willReturn(new com.fullstackmall.shop.product.entity.ProductCategory());
        AdminProductCreateRequest req = new AdminProductCreateRequest();
        req.setCategoryId(2L);
        req.setName("x");
        req.setItems(null);

        assertThatThrownBy(() -> service.create(req))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.BAD_REQUEST);
    }

    @Test
    void updateNotFound_shouldThrowProductNotFound() {
        given(productMapper.selectById(404L)).willReturn(null);
        assertThatThrownBy(() -> service.update(404L, new AdminProductUpdateRequest()))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.PRODUCT_NOT_FOUND);
    }

    @Test
    void updateConsignmentProduct_shouldReject() {
        Product consignment = platformProduct();
        consignment.setOwnerType(OwnerType.CONSIGNMENT);
        given(productMapper.selectById(5L)).willReturn(consignment);

        assertThatThrownBy(() -> service.update(5L, new AdminProductUpdateRequest()))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.BAD_REQUEST);
    }

    @Test
    void updateOffShelfWithActiveSeckill_shouldReject() {
        given(productMapper.selectById(7L)).willReturn(platformProduct());
        given(seckillActivityMapper.selectCount(any())).willReturn(1L);
        AdminProductUpdateRequest req = new AdminProductUpdateRequest();
        req.setStatus(0);

        assertThatThrownBy(() -> service.update(7L, req))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.SECKILL_ACTIVE_ON_PRODUCT);
        verify(productMapper, never()).updateById(any(Product.class));
    }

    @Test
    void updateOffShelfWithoutSeckill_shouldPatchAndReturnFreshState() {
        Product before = platformProduct();
        Product after = platformProduct();
        after.setStatus(0);
        // update 内两次 selectById：校验时（status=1）→ 回读组装时（status=0）
        given(productMapper.selectById(7L)).willReturn(before, after);
        given(seckillActivityMapper.selectCount(any())).willReturn(0L);
        given(productItemMapper.selectList(any())).willReturn(List.of());

        AdminProductUpdateRequest req = new AdminProductUpdateRequest();
        req.setStatus(0);
        AdminProductDTO result = service.update(7L, req);

        verify(productMapper).updateById(any(Product.class));
        verify(seckillActivityMapper).selectCount(any());
        assertThat(result.getStatus()).isEqualTo(0);
    }

    @Test
    void updateUpShelf_shouldNotTriggerSeckillCheck() {
        Product before = platformProduct();
        before.setStatus(0);
        given(productMapper.selectById(7L)).willReturn(before, before);
        given(productItemMapper.selectList(any())).willReturn(List.of());

        AdminProductUpdateRequest req = new AdminProductUpdateRequest();
        req.setStatus(1);
        service.update(7L, req);

        verify(productMapper).updateById(any(Product.class));
        // 上架不触碰秒杀保护（保护只针对下架方向）
        verify(seckillActivityMapper, never()).selectCount(any());
    }

    @Test
    void pageShouldFillItemsInBatch() {
        Product p1 = platformProduct();
        p1.setId(11L);
        Product p2 = platformProduct();
        p2.setId(12L);
        com.baomidou.mybatisplus.core.metadata.IPage<Product> mpPage =
                new com.baomidou.mybatisplus.extension.plugins.pagination.Page<>(1, 10);
        mpPage.setRecords(List.of(p1, p2));
        mpPage.setTotal(2);
        given(productMapper.selectPage(any(), any())).willAnswer(inv -> {
            mpPage.setRecords(List.of(p1, p2));
            return mpPage;
        });
        ProductItem item = new ProductItem();
        item.setProductId(11L);
        item.setConditionGrade(ConditionGrade.NEW);
        given(productItemMapper.selectList(any())).willReturn(List.of(item));

        PageResult<AdminProductDTO> result = service.page(null, null, 1, 10);

        assertThat(result.getList()).hasSize(2);
        assertThat(result.getList().get(0).getItems()).hasSize(1);
        assertThat(result.getList().get(1).getItems()).isEmpty();
    }

    private Product platformProduct() {
        Product product = new Product();
        product.setId(7L);
        product.setOwnerType(OwnerType.PLATFORM);
        product.setStatus(1);
        return product;
    }

    private AdminProductItemInput item(String size, String price, String originPrice, int stock) {
        AdminProductItemInput in = new AdminProductItemInput();
        in.setSize(size);
        in.setPrice(new BigDecimal(price));
        in.setOriginPrice(originPrice == null ? null : new BigDecimal(originPrice));
        in.setStock(stock);
        return in;
    }

    private com.fullstackmall.shop.product.dto.AdminProductImageInput image(String url) {
        com.fullstackmall.shop.product.dto.AdminProductImageInput in =
                new com.fullstackmall.shop.product.dto.AdminProductImageInput();
        in.setUrl(url);
        return in;
    }
}
