<script setup lang="ts">
// ref 由 unplugin-auto-import 注入（CLAUDE.md §1.6）
import type { MallGoodsItem } from '../apis/index'
import { h5SearchApi } from '../apis/search'
import { useProductList } from '../composables/useProductList'
import { useSearchHistory } from '../composables/useSearchHistory'
import MallPh from '../components/MallPh.vue'

/**
 * 商品列表页：搜索 + 筛选 + 分页加载。
 * 输入态（keyword 为空）：搜索历史（localStorage）+ 热搜词（后端常量）chips；
 * 结果态：既有列表。数据来源：useProductList() 拉取 /mall/product/list。
 */
const bem = createNamespace('mall-list')

/** 搜索关键词（受控，变化触发重新拉取） */
const keyword = ref('')
/** 排序（newest 默认 / price_asc / price_desc / sales_desc） */
const sort = ref<'newest' | 'price_asc' | 'price_desc' | 'sales_desc'>('newest')

const { list, total, loading, error, isEmpty, loadMore, page } = useProductList({ keyword, sort })

/** 搜索历史（去重置顶/上限 10/隐私降级） */
const { list: history, add: addHistory, clear: clearHistory } = useSearchHistory()
/** 热搜词（后端常量；失败不阻塞搜索，仅热搜区留空） */
const { data: hotWords } = useRequest(() => h5SearchApi.hotWords())

function onSearch(): void {
  // keyword 变化已由 watch 触发重新拉取并重置 page，此处仅记录历史 + 收起键盘
  addHistory(keyword.value)
}

/** 点击历史/热搜词：记录并触发查询 */
function onPickWord(word: string): void {
  addHistory(word)
  keyword.value = word
}

function onLoadMore(): void {
  void loadMore(page.value + 1)
}

/** 色块档位按 id 派生（后端无此字段，前端占位图用） */
function phOf(id: number): 'a' | 'b' | 'c' {
  return id % 3 === 0 ? 'a' : id % 3 === 1 ? 'b' : 'c'
}

/** 寄卖商品（非 NEW 成色）显示成色角标 */
function showConditionTag(item: MallGoodsItem): boolean {
  return item.ownerType === 'CONSIGNMENT' && item.conditionGrade !== 'NEW'
}
</script>

<template>
  <div :class="bem.b()">
    <!-- 搜索栏 -->
    <van-search
      v-model="keyword"
      placeholder="搜索商品"
      show-action
      :class="bem.e('search')"
      @search="onSearch"
      @cancel="keyword = ''"
    />

    <!-- 输入态：搜索历史 + 热搜词（keyword 为空时结果区整体替换，列表不加载） -->
    <div v-if="!keyword" :class="bem.e('assist')">
      <div v-if="history.length > 0" :class="bem.e('assist-block')">
        <div :class="bem.e('assist-head')">
          <span>搜索历史</span>
          <button type="button" :class="bem.e('assist-clear')" @click="clearHistory">清空</button>
        </div>
        <div :class="bem.e('chips')">
          <button
            v-for="h in history"
            :key="h"
            type="button"
            :class="bem.e('chip')"
            @click="onPickWord(h)"
          >
            {{ h }}
          </button>
        </div>
      </div>
      <div :class="bem.e('assist-block')">
        <div :class="bem.e('assist-head')"><span>热门搜索</span></div>
        <div :class="bem.e('chips')">
          <button
            v-for="w in hotWords ?? []"
            :key="w"
            type="button"
            :class="[bem.e('chip'), bem.is('hot', true)]"
            @click="onPickWord(w)"
          >
            {{ w }}
          </button>
        </div>
      </div>
    </div>

    <!-- 结果态：排序 + 列表 -->
    <template v-else>
    <!-- 排序栏 -->
    <div :class="bem.e('sortbar')">
      <button
        v-for="s in [
          { key: 'newest', label: '最新' },
          { key: 'price_asc', label: '价格↑' },
          { key: 'price_desc', label: '价格↓' },
          { key: 'sales_desc', label: '销量' },
        ]"
        :key="s.key"
        type="button"
        :class="[bem.e('sortbtn'), bem.is('active', sort === s.key)]"
        @click="sort = s.key as typeof sort"
      >
        {{ s.label }}
      </button>
    </div>

    <!-- Loading 态（首屏） -->
    <div v-if="loading && list.length === 0" :class="bem.e('loading')">
      <van-skeleton title avatar :row="3" />
    </div>

    <!-- Error 态（仅首屏无数据时整体替换；加载更多失败保留已有列表 + toast） -->
    <div v-else-if="error && list.length === 0" :class="bem.e('error')">
      <van-empty description="加载失败，请检查网络">
        <van-button round type="primary" @click="loadMore(1)">重试</van-button>
      </van-empty>
    </div>

    <!-- Empty 态 -->
    <div v-else-if="isEmpty" :class="bem.e('empty')">
      <van-empty description="没有找到相关商品" />
    </div>

    <!-- 列表 -->
    <van-list
      v-else
      :loading="loading"
      :finished="list.length >= total"
      finished-text="没有更多了"
      :class="bem.e('list')"
      @load="onLoadMore"
    >
      <div :class="bem.e('grid')">
        <router-link
          v-for="item in list"
          :key="item.id"
          :to="`/h5-mall/detail/${item.id}`"
          :class="bem.e('gcard')"
        >
          <!-- 有图渲染真实图，无图兜底占位色块 -->
          <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.name" :class="bem.e('img')" />
          <MallPh v-else :ph="phOf(item.id)" :garm="item.garm ?? 'tshirt'">
            <template v-if="item.tag" #tag>{{ item.tag }}</template>
          </MallPh>
          <div :class="bem.e('name')">{{ item.name }}</div>
          <span v-if="showConditionTag(item)" :class="bem.e('condition')">{{ item.conditionGrade }}</span>
          <span v-else-if="item.sellingPoint" :class="bem.e('minitag')">{{ item.sellingPoint }}</span>
          <div :class="bem.e('foot')">
            <span :class="bem.e('price')">
              <b>¥{{ item.price }}</b>
              <s v-if="item.originPrice" :class="bem.e('origin')">¥{{ item.originPrice }}</s>
            </span>
            <span :class="bem.e('sales')">已售{{ item.sales ?? 0 }}</span>
          </div>
        </router-link>
      </div>
    </van-list>
    </template>
  </div>
</template>

<style lang="scss">
// 本文件在 postcss-pxtorem 转换范围内（src/modules/h5-mall/），直接写 828 设计稿 px
@use '../styles/h5-mall-tokens.scss';

.#{$BEM_PREFIX}-mall-list {
  min-height: 100vh;
  min-height: 100dvh;
  padding-bottom: 307px;
  font-family: var(--mall-font-body);
  font-size: 34px;
  color: var(--mall-ink-1);
  background: var(--mall-bg-page);

  &__search {
    background: var(--mall-bg-card);
  }

  &__assist {
    padding: 26px 53px;
    background: var(--mall-bg-card);
  }

  &__assist-block {
    margin-bottom: 35px;
  }

  &__assist-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 18px;
    font-size: 28px;
    font-weight: 600;
    color: var(--mall-ink-1);
  }

  &__assist-clear {
    font: inherit;
    font-size: 26px;
    font-weight: 400;
    color: var(--mall-ink-3);
    background: none;
    border: 0;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 18px;
  }

  &__chip {
    padding: 13px 26px;
    font-size: 27px;
    color: var(--mall-ink-2);
    background: var(--mall-bg-page);
    border: 1px solid var(--mall-line);
    border-radius: 31px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;

    &.is-hot {
      color: var(--mall-brand-deep);
      background: var(--mall-brand-soft);
      border-color: var(--mall-line-strong);
    }
  }

  &__sortbar {
    display: flex;
    gap: 18px;
    padding: 18px 53px;
    background: var(--mall-bg-card);
    border-bottom: 1px solid var(--mall-line);
  }

  &__sortbtn {
    padding: 9px 22px;
    font-size: 26px;
    color: var(--mall-ink-2);
    background: transparent;
    border: 1px solid var(--mall-line);
    border-radius: var(--mall-r-sm);

    &.is-active {
      color: var(--mall-brand-deep);
      background: var(--mall-brand-soft);
      border-color: var(--mall-line-strong);
    }
  }

  &__loading,
  &__error,
  &__empty {
    padding: 106px 53px;
  }

  &__grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 35px 26px;
    padding: 35px 53px;
  }

  &__gcard {
    display: block;
    color: inherit;
    text-decoration: none;
  }

  &__img {
    width: 100%;
    aspect-ratio: 4 / 5;
    object-fit: cover;
    border-radius: var(--mall-r-md);
  }

  &__name {
    display: -webkit-box;
    margin-top: 22px;
    overflow: hidden;
    font-size: 31px;
    line-height: 1.55;
    color: var(--mall-ink-1);
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  &__minitag,
  &__condition {
    display: inline-block;
    margin-top: 13px;
    padding: 2px 13px;
    font-size: 24px;
    color: var(--mall-ink-2);
    background: var(--mall-bg-card);
    border: 1px solid var(--mall-line);
    border-radius: 9px;
  }

  &__condition {
    color: var(--mall-brand-deep);
    background: var(--mall-brand-soft);
    border-color: var(--mall-line-strong);
  }

  &__foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 13px;
  }

  &__price {
    b {
      font-size: 34px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: var(--mall-brand-deep);
    }
  }

  &__origin {
    margin-left: 9px;
    font-size: 24px;
    color: var(--mall-ink-3);
  }

  &__sales {
    font-size: 24px;
    color: var(--mall-ink-3);
  }
}
</style>
