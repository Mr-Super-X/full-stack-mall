package com.fullstackmall.shop.cart.service.impl;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fullstackmall.shop.cart.dto.AddCartItemRequest;
import com.fullstackmall.shop.cart.dto.CartItemDTO;
import com.fullstackmall.shop.cart.dto.UpdateCartItemRequest;
import com.fullstackmall.shop.cart.entity.CartItem;
import com.fullstackmall.shop.cart.mapper.CartItemMapper;
import com.fullstackmall.shop.cart.service.CartService;
import com.fullstackmall.shop.common.BusinessException;
import com.fullstackmall.shop.common.ResultCode;
import com.fullstackmall.shop.product.entity.Product;
import com.fullstackmall.shop.product.entity.ProductImage;
import com.fullstackmall.shop.product.entity.ProductItem;
import com.fullstackmall.shop.product.enums.OwnerType;
import com.fullstackmall.shop.product.mapper.ProductImageMapper;
import com.fullstackmall.shop.product.mapper.ProductItemMapper;
import com.fullstackmall.shop.product.mapper.ProductMapper;
import com.fullstackmall.shop.user.context.UserContext;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 购物车业务实现。实时信息三段查询组装（cart_item → product_item → product + 主图），
 * 不 join——商品量小（购物车通常 <50 行），内存组装比 XML join 直白。
 */
@Service
public class CartServiceImpl implements CartService {

    private final CartItemMapper cartItemMapper;
    private final ProductItemMapper productItemMapper;
    private final ProductMapper productMapper;
    private final ProductImageMapper productImageMapper;

    public CartServiceImpl(CartItemMapper cartItemMapper,
                           ProductItemMapper productItemMapper,
                           ProductMapper productMapper,
                           ProductImageMapper productImageMapper) {
        this.cartItemMapper = cartItemMapper;
        this.productItemMapper = productItemMapper;
        this.productMapper = productMapper;
        this.productImageMapper = productImageMapper;
    }

    @Override
    public List<CartItemDTO> list() {
        Long userId = UserContext.getRequired().userId();
        List<CartItem> rows = cartItemMapper.selectList(Wrappers.<CartItem>lambdaQuery()
                .eq(CartItem::getUserId, userId)
                .orderByDesc(CartItem::getId));
        if (rows.isEmpty()) {
            return List.of();
        }
        Map<Long, ProductItem> itemMap = productItemMapper.selectBatchIds(
                        rows.stream().map(CartItem::getProductItemId).toList())
                .stream().collect(Collectors.toMap(ProductItem::getId, Function.identity()));
        List<Long> productIds = itemMap.values().stream().map(ProductItem::getProductId).distinct().toList();
        Map<Long, Product> productMap = productMapper.selectBatchIds(productIds)
                .stream().collect(Collectors.toMap(Product::getId, Function.identity()));
        Map<Long, String> mainImages = loadMainImages(productIds);
        return rows.stream().map(row -> assemble(row, itemMap, productMap, mainImages)).toList();
    }

    @Override
    public CartItemDTO add(AddCartItemRequest req) {
        Long userId = UserContext.getRequired().userId();
        ProductItem item = requireItem(req.getProductItemId());
        Product product = requireProduct(item.getProductId());
        if (product.getOwnerType() == OwnerType.CONSIGNMENT) {
            // 寄卖库存恒 1：进购物车会堆积失效商品，统一走详情页"立即购买"
            throw new BusinessException(ResultCode.CONSIGNMENT_DIRECT_ONLY);
        }
        CartItem existing = cartItemMapper.selectOne(Wrappers.<CartItem>lambdaQuery()
                .eq(CartItem::getUserId, userId)
                .eq(CartItem::getProductItemId, req.getProductItemId()));
        CartItem row;
        if (existing != null) {
            // 叠加并封顶 99（单次入参 @Max(99) 只管单次，累计需在此兜底——终审 MEDIUM 修复）
            existing.setQuantity(Math.min(99, existing.getQuantity() + req.getQuantity()));
            cartItemMapper.updateById(existing);
            row = existing;
        } else {
            row = new CartItem();
            row.setUserId(userId);
            row.setProductItemId(req.getProductItemId());
            row.setQuantity(req.getQuantity());
            row.setChecked(1);
            cartItemMapper.insert(row);
        }
        return assemble(row, Map.of(item.getId(), item), Map.of(product.getId(), product),
                loadMainImages(List.of(product.getId())));
    }

    @Override
    public CartItemDTO update(Long id, UpdateCartItemRequest req) {
        if (req.getQuantity() == null && req.getChecked() == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST);
        }
        CartItem row = requireOwned(id);
        if (req.getQuantity() != null) {
            row.setQuantity(req.getQuantity());
        }
        if (req.getChecked() != null) {
            row.setChecked(req.getChecked() ? 1 : 0);
        }
        cartItemMapper.updateById(row);
        ProductItem item = requireItem(row.getProductItemId());
        Product product = requireProduct(item.getProductId());
        return assemble(row, Map.of(item.getId(), item), Map.of(product.getId(), product),
                loadMainImages(List.of(product.getId())));
    }

    @Override
    public void remove(Long id) {
        CartItem row = requireOwned(id);
        cartItemMapper.deleteById(row.getId());
    }

    private CartItem requireOwned(Long id) {
        Long userId = UserContext.getRequired().userId();
        CartItem row = cartItemMapper.selectOne(Wrappers.<CartItem>lambdaQuery()
                .eq(CartItem::getId, id)
                .eq(CartItem::getUserId, userId));
        if (row == null) {
            throw new BusinessException(ResultCode.CART_ITEM_NOT_FOUND);
        }
        return row;
    }

    private ProductItem requireItem(Long id) {
        ProductItem item = productItemMapper.selectById(id);
        if (item == null) {
            throw new BusinessException(ResultCode.PRODUCT_NOT_FOUND);
        }
        return item;
    }

    private Product requireProduct(Long id) {
        Product product = productMapper.selectById(id);
        if (product == null) {
            throw new BusinessException(ResultCode.PRODUCT_NOT_FOUND);
        }
        return product;
    }

    private Map<Long, String> loadMainImages(List<Long> productIds) {
        if (productIds.isEmpty()) {
            return Map.of();
        }
        // 主图 = sort=0；查询条件延迟解析，纯单测 mock 不拼接 SQL，Lambda 用法安全
        return productImageMapper.selectList(Wrappers.<ProductImage>lambdaQuery()
                        .in(ProductImage::getProductId, productIds)
                        .eq(ProductImage::getSort, 0))
                .stream().collect(Collectors.toMap(
                        ProductImage::getProductId, ProductImage::getUrl, (a, b) -> a));
    }

    /** 购物车行 + 实时商品信息组装；商品被物理删除（罕见）按失效兜底 */
    private CartItemDTO assemble(CartItem row, Map<Long, ProductItem> itemMap,
                                 Map<Long, Product> productMap, Map<Long, String> mainImages) {
        ProductItem item = itemMap.get(row.getProductItemId());
        Product product = item != null ? productMap.get(item.getProductId()) : null;
        CartItemDTO dto = new CartItemDTO();
        dto.setId(row.getId());
        dto.setProductItemId(row.getProductItemId());
        dto.setQuantity(row.getQuantity());
        dto.setChecked(row.getChecked() != null && row.getChecked() == 1);
        if (item == null || product == null) {
            dto.setInvalid(true);
            return dto;
        }
        dto.setProductName(product.getName());
        dto.setPrice(item.getPrice());
        dto.setStock(item.getStock());
        dto.setConditionGrade(item.getConditionGrade() != null ? item.getConditionGrade().name() : null);
        dto.setOwnerType(product.getOwnerType() != null ? product.getOwnerType().name() : null);
        dto.setImageUrl(mainImages.get(product.getId()));
        dto.setInvalid(product.getStatus() == null || product.getStatus() != 1
                || item.getStock() == null || item.getStock() < 1);
        return dto;
    }
}
