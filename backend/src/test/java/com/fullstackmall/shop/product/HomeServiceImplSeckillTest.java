package com.fullstackmall.shop.product;

import com.fullstackmall.shop.common.PageResult;
import com.fullstackmall.shop.product.dto.HomeContentDTO;
import com.fullstackmall.shop.product.dto.ProductSummaryDTO;
import com.fullstackmall.shop.product.mapper.HomeBannerMapper;
import com.fullstackmall.shop.product.service.CategoryService;
import com.fullstackmall.shop.product.service.HomeService;
import com.fullstackmall.shop.product.service.ProductService;
import com.fullstackmall.shop.product.service.impl.HomeServiceImpl;
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
 * 首页秒杀区块装配：live 最多 2 场 + upcomingCount。
 */
@ExtendWith(MockitoExtension.class)
class HomeServiceImplSeckillTest {

    @Mock
    private HomeBannerMapper homeBannerMapper;
    @Mock
    private ProductService productService;
    @Mock
    private CategoryService categoryService;
    @Mock
    private SeckillService seckillService;

    private HomeService homeService;

    @BeforeEach
    void setUp() {
        homeService = new HomeServiceImpl(homeBannerMapper, productService, categoryService, seckillService);
    }

    @Test
    void 首页秒杀区块_live最多两场并统计预告数() {
        SeckillActiveDTO active = new SeckillActiveDTO();
        active.setLive(List.of(liveItem(1L), liveItem(2L), liveItem(3L)));
        active.setUpcoming(List.of(liveItem(4L)));
        given(seckillService.active()).willReturn(active);
        given(homeBannerMapper.selectList(any())).willReturn(List.of());
        given(categoryService.levelOne()).willReturn(List.of());
        PageResult<ProductSummaryDTO> empty = new PageResult<>();
        empty.setList(List.of());
        empty.setTotal(0);
        empty.setPage(1);
        empty.setPageSize(10);
        given(productService.pageProducts(any())).willReturn(empty);

        HomeContentDTO content = homeService.homeContent();

        assertThat(content.getSeckill()).isNotNull();
        assertThat(content.getSeckill().getTitle()).isEqualTo("限时秒杀");
        assertThat(content.getSeckill().getLive()).hasSize(2);
        assertThat(content.getSeckill().getUpcomingCount()).isEqualTo(1);
    }

    private SeckillActiveDTO.SeckillActivityDTO liveItem(Long id) {
        SeckillActiveDTO.SeckillActivityDTO dto = new SeckillActiveDTO.SeckillActivityDTO();
        dto.setActivityId(id);
        dto.setProductId(16L);
        dto.setSeckillPrice(new BigDecimal("299.40"));
        dto.setOriginPrice(new BigDecimal("499.00"));
        dto.setSoldCount(0);
        dto.setSeckillStock(5);
        dto.setEndTime(LocalDateTime.now().plusDays(7));
        return dto;
    }
}
