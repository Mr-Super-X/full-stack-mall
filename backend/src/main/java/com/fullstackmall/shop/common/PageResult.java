package com.fullstackmall.shop.common;

import com.baomidou.mybatisplus.core.metadata.IPage;
import lombok.Data;

import java.util.List;

/**
 * 分页出参：形状与前端 Pagination&lt;T&gt; 原生约定一致（list/total/page/pageSize），
 * 后端按此返回时前端无需启用 pageAdapter。
 */
@Data
public class PageResult<T> {

    private List<T> list;
    private long total;
    private long page;
    private long pageSize;

    /**
     * 从 MyBatis-Plus 分页对象转换：records→list、current→page、size→pageSize。
     */
    public static <T> PageResult<T> of(IPage<T> page) {
        PageResult<T> result = new PageResult<>();
        result.setList(page.getRecords());
        result.setTotal(page.getTotal());
        result.setPage(page.getCurrent());
        result.setPageSize(page.getSize());
        return result;
    }
}
