package com.fullstackmall.shop.product.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fullstackmall.shop.product.dto.ProductListRequest;
import com.fullstackmall.shop.product.dto.ProductSummaryDTO;
import com.fullstackmall.shop.product.entity.Product;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface ProductMapper extends BaseMapper<Product> {

    /**
     * 卡片聚合分页：price 取该商品最低规格价（MIN），originPrice 取 MAX 划线价，
     * imageUrl 取 sort=0 主图，conditionGrade 取最低价规格的成色。
     * 排序仅走 XML 内白名单（price_asc/price_desc/sales_desc/默认 id desc），杜绝注入。
     * MP 分页插件自动生成 count（GROUP BY 包装）。
     */
    IPage<ProductSummaryDTO> selectSummaryPage(Page<ProductSummaryDTO> page, @Param("q") ProductListRequest q);
}
