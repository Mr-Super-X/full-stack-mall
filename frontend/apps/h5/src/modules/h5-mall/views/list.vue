<script setup lang="ts">
// ref/computed/watchEffect 由 unplugin-auto-import 注入（CLAUDE.md §1.6）
import type { MallGoodsItem, MallListParams } from '../apis/index'
import { h5SearchApi } from '../apis/search'
import { useAppRouter } from '@vv/shared'
import { useProductList } from '../composables/useProductList'
import { useSearchHistory } from '../composables/useSearchHistory'
import { useSearchSuggest } from '../composables/useSearchSuggest'
import MallPh from '../components/MallPh.vue'
import SearchEmptyTips from '../components/SearchEmptyTips.vue'

/**
 * 商品列表页：搜索 + 联想 + 筛选 + 分页加载。
 * 三态：搜索框聚焦（输入态）→ 联想/历史/热搜辅助面板；失焦 + submitted 空 → 全量列表
 * （tabbar「分类」入口进本页 submitted 恒为空，输入态必须按 focus 判定，否则商品列表不可见）；
 * 失焦 + submitted 非空 → 搜索结果。数据来源：useProductList() 拉取 /mall/product/list。
 *
 * 输入词与提交词分离（P0-2）：输入过程不发列表请求（防抖内置于 useProductList），
 * 回车/选联想词/点历史/点热搜才提交 submitted 触发查询；首页顶栏经 ?focus=1 进入自动聚焦。
 */
const bem = createNamespace('mall-list')

const { router } = useAppRouter()
// route 经 router.currentRoute 派生（useAppRouter 契约：不直接返回 route）
const route = router.currentRoute

/** 搜索框输入词（受控，仅输入态使用） */
const keyword = ref(typeof route.value.query.keyword === 'string' ? route.value.query.keyword : '')
/** 已提交查询词（useProductList 消费；输入过程不影响它） */
const submitted = ref(keyword.value)
/** 排序（newest 默认 / price_asc / price_desc / sales_desc） */
const sort = ref<MallListParams['sort']>('newest')
/** 成色筛选（undefined = 全部） */
const conditionGrade = ref<MallListParams['conditionGrade']>(undefined)
/** 价格区间档位（value 为 [min,max]，undefined 端 = 不限） */
const priceRanges = [
  { key: 'all', label: '全部', min: undefined, max: undefined },
  { key: 'p0', label: '¥100以下', min: 0, max: 100 },
  { key: 'p1', label: '¥100-300', min: 100, max: 300 },
  { key: 'p2', label: '¥300-600', min: 300, max: 600 },
  { key: 'p3', label: '¥600以上', min: 600, max: undefined },
] as const
const priceRange = ref<(typeof priceRanges)[number]['key']>('all')
/** 搜索框聚焦态（输入态判定；focus/blur 不冒泡，focusin/focusout 冒泡，容器上监听即可捕获内部 input） */
const searchFocused = ref(false)

const priceMin = computed(() => priceRanges.find((p) => p.key === priceRange.value)?.min)
const priceMax = computed(() => priceRanges.find((p) => p.key === priceRange.value)?.max)

const { list, total, loading, error, isEmpty, loadMore, page } = useProductList({
  keyword: submitted,
  sort,
  conditionGrade,
  priceMin,
  priceMax,
})

/** 搜索联想（输入态 + 输入词非空时防抖拉取） */
const { suggestions } = useSearchSuggest(keyword, searchFocused)
/** 搜索历史（去重置顶/上限 10/隐私降级） */
const { list: history, add: addHistory, clear: clearHistory } = useSearchHistory()
/** 热搜词（后端 search_log 动态聚合 + 常量回退；失败不阻塞搜索，仅热搜区留空） */
const { data: hotWords } = useRequest(() => h5SearchApi.hotWords())

/** 首页顶栏 ?focus=1 进入：自动聚焦搜索框进入输入态 */
onMounted(() => {
  if (route.value.query.focus !== '1') return
  nextTick(() => {
    const input = document.querySelector<HTMLInputElement>('.van-search input')
    input?.focus()
  })
})

function onSearch(): void {
  // 提交查询：submitted 变化经 useProductList 防抖触发重拉；此处记历史 + 收起键盘
  submitted.value = keyword.value.trim()
  addHistory(submitted.value)
  // 回车后退出输入态显示结果（桌面端回车不触发 blur，需手动失焦；移动端键盘收起自然失焦）
  const active = document.activeElement
  if (active instanceof HTMLElement) active.blur()
}

/** 点击联想/历史/热搜词：记录并提交查询，同时收起面板展示结果态 */
function onPickWord(word: string): void {
  addHistory(word)
  keyword.value = word
  submitted.value = word
  searchFocused.value = false
}

/** 取消：清空输入词与提交词并退出输入态（回浏览态全量列表） */
function onCancel(): void {
  keyword.value = ''
  submitted.value = ''
  searchFocused.value = false
}

/**
 * 容器焦点出界才退出输入态。focusout 冒泡先于 click：点击目标是容器内元素
 * （联想/历史/热搜 chip、清空、取消）时 relatedTarget 仍在容器内，若此时卸载面板，
 * mousedown 与 click 之间的元素已消失，click 被吃掉（2026-11-11 实测回归）。
 */
function onContainerFocusOut(e: FocusEvent): void {
  const next = e.relatedTarget as HTMLElement | null
  if (next && (e.currentTarget as HTMLElement).contains(next)) return
  searchFocused.value = false
}

/**
 * 仅搜索框聚焦进入输入态。容器上 focusin 会冒泡自任何可聚焦元素——浏览态点
 * 排序/筛选按钮/商品链接（a/button 聚焦）若置 true，v-if 面板插入 + v-else 列表卸载，
 * 会把 mousedown 后未触发的 click 吃掉（商品点击无响应的根因，2026-11-11 实测）。
 */
function onContainerFocusIn(e: FocusEvent): void {
  const target = e.target as HTMLElement
  if (target.closest('.van-search')) searchFocused.value = true
}

function onLoadMore(): void {
  void loadMore(page.value + 1)
}

/** 搜索结果点击埋点（日志型，失败静默） */
function onClickItem(item: MallGoodsItem): void {
  if (!submitted.value.trim()) return
  void h5SearchApi
    .track({ keyword: submitted.value.trim(), clickProductId: item.id })
    .catch(() => {})
}

/** 空结果换词重试：以建议词重新搜索 */
function onRetryWord(word: string): void {
  onPickWord(word)
}

/** 联想词高亮：按输入词切片（联想命中片段与输入词一致） */
function highlightSuggest(word: string): Array<{ text: string; hit: boolean }> {
  return splitHighlight(word, keyword.value.trim())
}

/** 结果高亮：商品名按提交词切片，命中片段由 <mark> 渲染 */
function highlight(name: string): Array<{ text: string; hit: boolean }> {
  return splitHighlight(name, submitted.value.trim())
}

/** 按关键词切片：命中片段（大小写不敏感）前后分段，未命中返回单段 */
function splitHighlight(text: string, kw: string): Array<{ text: string; hit: boolean }> {
  if (!kw) return [{ text, hit: false }]
  const idx = text.toLowerCase().indexOf(kw.toLowerCase())
  if (idx < 0) return [{ text, hit: false }]
  return [
    { text: text.slice(0, idx), hit: false },
    { text: text.slice(idx, idx + kw.length), hit: true },
    { text: text.slice(idx + kw.length), hit: false },
  ].filter((s) => s.text.length > 0)
}

/** 色块档位按 id 派生（后端无此字段，前端占位图用） */
function phOf(id: number): 'a' | 'b' | 'c' {
  return id % 3 === 0 ? 'a' : id % 3 === 1 ? 'b' : 'c'
}

/** 寄卖商品（非 NEW 成色）显示成色角标 */
function showConditionTag(item: MallGoodsItem): boolean {
  return item.ownerType === 'CONSIGNMENT' && item.conditionGrade !== 'NEW'
}

/** 成色筛选档位（与后端 ConditionGrade 对齐） */
const conditionOptions: Array<{ key: NonNullable<MallListParams['conditionGrade']>; label: string }> = [
  { key: 'NEW', label: '全新' },
  { key: 'LIKE_NEW', label: '95新' },
  { key: 'GOOD', label: '良好' },
  { key: 'FAIR', label: '有痕迹' },
]
</script>

<template>
  <!-- focusin 仅在搜索框聚焦时进入输入态（见 onContainerFocusIn）；focusout 需
       relatedTarget 判断（见 onContainerFocusOut），否则点击面板内元素时面板先于
       click 卸载，chip/清空/取消全部失灵 -->
  <div :class="bem.b()" @focusin="onContainerFocusIn" @focusout="onContainerFocusOut">
    <!-- 搜索栏 -->
    <van-search
      v-model="keyword"
      placeholder="搜索商品"
      show-action
      :class="bem.e('search')"
      @search="onSearch"
      @cancel="onCancel"
    />

    <!-- 输入态：联想（优先）/ 历史 + 热搜（搜索框聚焦时显示；失焦回列表态） -->
    <div v-if="searchFocused" :class="bem.e('assist')">
      <!-- 联想词：输入词非空且有联想结果时置顶展示，命中片段高亮 -->
      <div v-if="keyword.trim() && suggestions.length > 0" :class="bem.e('suggest')">
        <button
          v-for="w in suggestions"
          :key="w"
          type="button"
          :class="bem.e('suggest-item')"
          @click="onPickWord(w)"
        >
          <template v-for="(seg, i) in highlightSuggest(w)" :key="i">
            <mark v-if="seg.hit" :class="bem.e('hit')">{{ seg.text }}</mark>
            <template v-else>{{ seg.text }}</template>
          </template>
        </button>
      </div>
      <template v-else>
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
      </template>
    </div>

    <!-- 列表态：排序/筛选 + 列表（失焦后展示；submitted 空 = 全量，非空 = 搜索结果） -->
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

      <!-- 筛选栏：成色 + 价格区间 -->
      <div :class="bem.e('filterbar')">
        <button
          type="button"
          :class="[bem.e('sortbtn'), bem.is('active', conditionGrade === undefined)]"
          @click="conditionGrade = undefined"
        >
          全部成色
        </button>
        <button
          v-for="c in conditionOptions"
          :key="c.key"
          type="button"
          :class="[bem.e('sortbtn'), bem.is('active', conditionGrade === c.key)]"
          @click="conditionGrade = conditionGrade === c.key ? undefined : c.key"
        >
          {{ c.label }}
        </button>
        <span :class="bem.e('filter-divider')" />
        <button
          v-for="p in priceRanges"
          :key="p.key"
          type="button"
          :class="[bem.e('sortbtn'), bem.is('active', priceRange === p.key)]"
          @click="priceRange = p.key"
        >
          {{ p.label }}
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

      <!-- Empty 态：有搜索词 → 换词建议 + 热销兜底引导；无词 → 纯空态 -->
      <div v-else-if="isEmpty" :class="bem.e('empty')">
        <SearchEmptyTips
          v-if="submitted.trim()"
          :keyword="submitted"
          @retry="onRetryWord"
          @open="(item) => router.push(`/h5-mall/detail/${item.id}`)"
        />
        <van-empty v-else description="暂无商品" />
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
            @click="onClickItem(item)"
          >
            <!-- 有图渲染真实图，无图兜底占位色块 -->
            <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.name" :class="bem.e('img')" />
            <MallPh v-else :ph="phOf(item.id)" :garm="item.garm ?? 'tshirt'">
              <template v-if="item.tag" #tag>{{ item.tag }}</template>
            </MallPh>
            <div :class="bem.e('name')">
              <template v-for="(seg, i) in highlight(item.name)" :key="i">
                <mark v-if="seg.hit" :class="bem.e('hit')">{{ seg.text }}</mark>
                <template v-else>{{ seg.text }}</template>
              </template>
            </div>
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

  &__suggest {
    display: flex;
    flex-direction: column;
  }

  &__suggest-item {
    padding: 22px 0;
    font-size: 30px;
    text-align: left;
    color: var(--mall-ink-1);
    background: none;
    border: 0;
    border-bottom: 1px solid var(--mall-line);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;

    &:last-child {
      border-bottom: 0;
    }
  }

  &__hit {
    padding: 0;
    color: var(--mall-brand-deep);
    background: transparent;
  }

  &__sortbar,
  &__filterbar {
    display: flex;
    flex-wrap: wrap;
    gap: 18px;
    padding: 18px 53px;
    background: var(--mall-bg-card);
    border-bottom: 1px solid var(--mall-line);
  }

  &__filter-divider {
    width: 1px;
    margin: 6px 4px;
    background: var(--mall-line-strong);
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
