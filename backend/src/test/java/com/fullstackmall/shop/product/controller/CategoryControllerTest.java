package com.fullstackmall.shop.product.controller;

import com.fullstackmall.shop.product.dto.CategoryTreeDTO;
import com.fullstackmall.shop.product.service.CategoryService;
import com.fullstackmall.shop.user.service.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(CategoryController.class)
class CategoryControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CategoryService categoryService;

    /** WebMvcConfig 注册拦截器需要 JwtService；@WebMvcTest 不加载该 @Component，打桩补齐 */
    @MockitoBean
    private JwtService jwtService;

    @Test
    void 分类树应返回两级结构() throws Exception {
        CategoryTreeDTO child = new CategoryTreeDTO();
        child.setId(21L);
        child.setParentId(2L);
        child.setName("上装");
        CategoryTreeDTO women = new CategoryTreeDTO();
        women.setId(2L);
        women.setParentId(0L);
        women.setName("女装");
        women.setIcon("dress-s");
        women.setChildren(List.of(child));
        CategoryTreeDTO men = new CategoryTreeDTO();
        men.setId(3L);
        men.setParentId(0L);
        men.setName("男装");
        men.setChildren(List.of());
        given(categoryService.tree()).willReturn(List.of(women, men));

        mockMvc.perform(get("/mall/product/category/tree"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].name").value("女装"))
                .andExpect(jsonPath("$.data[0].icon").value("dress-s"))
                .andExpect(jsonPath("$.data[0].children[0].name").value("上装"))
                .andExpect(jsonPath("$.data[1].children.length()").value(0));
    }
}
