package com.fullstackmall.shop.product.service.impl;

import com.fullstackmall.shop.product.dto.SearchTrackRequest;
import com.fullstackmall.shop.product.entity.SearchLog;
import com.fullstackmall.shop.product.mapper.ProductMapper;
import com.fullstackmall.shop.product.mapper.SearchLogMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class SearchServiceImplTest {

    @Mock
    private ProductMapper productMapper;

    @Mock
    private SearchLogMapper searchLogMapper;

    @InjectMocks
    private SearchServiceImpl searchService;

    @Test
    void suggest_blankAfterSanitize_returnsEmptyWithoutQuery() {
        // 纯 BOOLEAN 操作符输入 sanitize 后为 null：不查库，联想区留空
        assertThat(searchService.suggest("+++")).isEmpty();
        assertThat(searchService.suggest("   ")).isEmpty();
        verify(productMapper, never()).selectSuggestNames(anyString());
    }

    @Test
    void suggest_normalKeyword_queriesWithSanitizedWord() {
        given(productMapper.selectSuggestNames(anyString())).willReturn(List.of("法式连衣裙"));
        assertThat(searchService.suggest(" 连衣裙 ")).containsExactly("法式连衣裙");
        ArgumentCaptor<String> captor = ArgumentCaptor.forClass(String.class);
        verify(productMapper).selectSuggestNames(captor.capture());
        assertThat(captor.getValue()).isEqualTo("连衣裙");
    }

    @Test
    void hotWords_emptyLog_fallsBackToConstants() {
        given(searchLogMapper.selectHotKeywords(anyInt(), anyInt())).willReturn(List.of());
        List<String> hot = searchService.hotWords();
        assertThat(hot).hasSize(8);
        assertThat(hot).contains("连衣裙", "风衣");
    }

    @Test
    void hotWords_partialLog_mergesWithoutDupAndKeepsOrder() {
        given(searchLogMapper.selectHotKeywords(anyInt(), anyInt()))
                .willReturn(new ArrayList<>(List.of("棉麻衬衫", "连衣裙")));
        List<String> hot = searchService.hotWords();
        // 日志词在前，常量去重补齐到 8；"连衣裙"已在日志中出现，不应二次出现
        assertThat(hot).hasSize(8);
        assertThat(hot.subList(0, 2)).containsExactly("棉麻衬衫", "连衣裙");
        assertThat(hot.stream().filter("连衣裙"::equals)).hasSize(1);
    }

    @Test
    void track_sanitizesAndPersists() {
        // insert 有 insert(T)/insert(Collection<T>) 重载，stub 用显式类型参数消歧 + Answer 捕获实参
        AtomicReference<SearchLog> saved = new AtomicReference<>();
        org.mockito.Mockito.doAnswer(inv -> {
            saved.set(inv.getArgument(0));
            return 1;
        }).when(searchLogMapper).insert(org.mockito.ArgumentMatchers.<SearchLog>any());

        SearchTrackRequest request = new SearchTrackRequest();
        request.setKeyword("牛仔外套");
        request.setResultCount(5);
        searchService.track(request);

        assertThat(saved.get().getKeyword()).isEqualTo("牛仔外套");
        assertThat(saved.get().getResultCount()).isEqualTo(5);
    }

    @Test
    void track_symbolOnlyKeyword_skipsInsert() {
        SearchTrackRequest request = new SearchTrackRequest();
        request.setKeyword("+++");
        request.setResultCount(0);
        searchService.track(request);
        verify(searchLogMapper, never()).insert(org.mockito.ArgumentMatchers.<SearchLog>any());
    }
}
