package com.fullstackmall.shop.cart;

import com.fullstackmall.shop.cart.dto.AddCartItemRequest;
import com.fullstackmall.shop.cart.dto.CartItemDTO;
import com.fullstackmall.shop.cart.entity.CartItem;
import com.fullstackmall.shop.cart.mapper.CartItemMapper;
import com.fullstackmall.shop.cart.service.CartService;
import com.fullstackmall.shop.cart.service.impl.CartServiceImpl;
import com.fullstackmall.shop.common.BusinessException;
import com.fullstackmall.shop.common.ResultCode;
import com.fullstackmall.shop.product.entity.Product;
import com.fullstackmall.shop.product.entity.ProductItem;
import com.fullstackmall.shop.product.enums.ConditionGrade;
import com.fullstackmall.shop.product.enums.OwnerType;
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
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * CartServiceImpl 真逻辑单测：uk 叠加、寄卖拦截、失效标记、越权 404。
 * Controller 切片 mock 了 service，这些行为必须在这里锚定。
 */
@ExtendWith(MockitoExtension.class)
class CartServiceImplTest {

    @Mock
    private CartItemMapper cartItemMapper;
    @Mock
    private ProductItemMapper productItemMapper;
    @Mock
    private ProductMapper productMapper;
    @Mock
    private com.fullstackmall.shop.product.mapper.ProductImageMapper productImageMapper;

    private CartService cartService;

    @BeforeEach
    void setUp() {
        cartService = new CartServiceImpl(cartItemMapper, productItemMapper, productMapper, productImageMapper);
        UserContext.set(new LoginUser(3L, "buyer", "USER"));
    }

    @AfterEach
    void tearDown() {
        UserContext.clear();
    }

    @Test
    void 重复加购应叠加数量而非新建() {
        given(productItemMapper.selectById(1L)).willReturn(platformItem(1L, 200));
        given(productMapper.selectById(1L)).willReturn(platformProduct());
        CartItem existing = cartRow(9L, 1L, 2);
        given(cartItemMapper.selectOne(any())).willReturn(existing);

        AddCartItemRequest req = new AddCartItemRequest();
        req.setProductItemId(1L);
        req.setQuantity(3);
        cartService.add(req);

        // 叠加：2 + 3 = 5，走 update 而非 insert
        ArgumentCaptor<CartItem> captor = ArgumentCaptor.forClass(CartItem.class);
        verify(cartItemMapper).updateById(captor.capture());
        assertThat(captor.getValue().getQuantity()).isEqualTo(5);
        verify(cartItemMapper, never()).insert(any(CartItem.class));
    }

    @Test
    void 重复加购叠加后应封顶99() {
        given(productItemMapper.selectById(1L)).willReturn(platformItem(1L, 200));
        given(productMapper.selectById(1L)).willReturn(platformProduct());
        CartItem existing = cartRow(9L, 1L, 98);
        given(cartItemMapper.selectOne(any())).willReturn(existing);

        AddCartItemRequest req = new AddCartItemRequest();
        req.setProductItemId(1L);
        req.setQuantity(5);
        cartService.add(req);

        // 98 + 5 = 103 → 封顶 99
        ArgumentCaptor<CartItem> captor = ArgumentCaptor.forClass(CartItem.class);
        verify(cartItemMapper).updateById(captor.capture());
        assertThat(captor.getValue().getQuantity()).isEqualTo(99);
    }

    @Test
    void 寄卖商品加购应抛直购提示() {
        ProductItem consignmentItem = platformItem(33L, 1);
        consignmentItem.setProductId(14L);
        given(productItemMapper.selectById(33L)).willReturn(consignmentItem);
        Product consignment = platformProduct();
        consignment.setId(14L);
        consignment.setOwnerType(OwnerType.CONSIGNMENT);
        given(productMapper.selectById(14L)).willReturn(consignment);

        AddCartItemRequest req = new AddCartItemRequest();
        req.setProductItemId(33L);
        req.setQuantity(1);

        assertThatThrownBy(() -> cartService.add(req))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.CONSIGNMENT_DIRECT_ONLY);
    }

    @Test
    void 列表中下架或缺货条目标记失效() {
        given(cartItemMapper.selectList(any())).willReturn(List.of(cartRow(1L, 1L, 2), cartRow(2L, 2L, 1)));
        ProductItem inStock = platformItem(1L, 200);
        ProductItem soldOut = platformItem(2L, 0);
        soldOut.setProductId(2L);
        given(productItemMapper.selectBatchIds(any())).willReturn(List.of(inStock, soldOut));
        Product online = platformProduct();
        Product offline = platformProduct();
        offline.setId(2L);
        offline.setStatus(0);
        given(productMapper.selectBatchIds(any())).willReturn(List.of(online, offline));

        List<CartItemDTO> list = cartService.list();

        assertThat(list).hasSize(2);
        assertThat(list.get(0).getInvalid()).isFalse();
        assertThat(list.get(1).getInvalid()).isTrue(); // stock=0 失效
    }

    @Test
    void 修改他人条目应抛404() {
        given(cartItemMapper.selectOne(any())).willReturn(null);

        com.fullstackmall.shop.cart.dto.UpdateCartItemRequest req =
                new com.fullstackmall.shop.cart.dto.UpdateCartItemRequest();
        req.setQuantity(5);
        assertThatThrownBy(() -> cartService.update(9L, req))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.CART_ITEM_NOT_FOUND);
    }

    private CartItem cartRow(Long id, Long productItemId, int quantity) {
        CartItem row = new CartItem();
        row.setId(id);
        row.setUserId(3L);
        row.setProductItemId(productItemId);
        row.setQuantity(quantity);
        row.setChecked(1);
        return row;
    }

    private ProductItem platformItem(Long id, int stock) {
        ProductItem item = new ProductItem();
        item.setId(id);
        item.setProductId(1L);
        item.setSize("M");
        item.setConditionGrade(ConditionGrade.NEW);
        item.setPrice(new BigDecimal("399.00"));
        item.setStock(stock);
        return item;
    }

    private Product platformProduct() {
        Product product = new Product();
        product.setId(1L);
        product.setOwnerType(OwnerType.PLATFORM);
        product.setName("陶土色垂感风衣");
        product.setStatus(1);
        return product;
    }
}
