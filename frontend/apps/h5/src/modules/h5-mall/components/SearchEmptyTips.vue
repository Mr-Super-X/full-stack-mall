<script setup lang="ts">
// ref/computed 由 unplugin-auto-import 注入（CLAUDE.md §1.6）
import type { MallGoodsItem } from '../apis/index'
import { h5MallApi } from '../apis/index'
import MallPh from './MallPh.vue'

/**
 * 搜索空结果引导：换词重试（取关键词前 2 字，CJK bigram 命中率高）+ 热销商品兜底。
 * 自包含数据（热销 sales_desc Top4 仅本组件用）；换词/点商品经 emits 上报父级处理。
 */
const bem = createNamespace('search-empty-tips')

const props = defineProps<{
  /** 已提交的搜索词（用于生成换词建议与隐藏无意义建议） */
  keyword: string
}>()

const emit = defineEmits<{
  /** 换词重试：父级以建议词重新搜索 */
  retry: [word: string]
  /** 点热销商品：父级跳详情 */
  open: [item: MallGoodsItem]
}>()

/** 换词建议：前 2 字（与关键词相同则不显示，防无意义重试） */
const suggestedWord = computed(() => props.keyword.trim().slice(0, 2))

/** 热销兜底（sales_desc Top4）；仅空结果时渲染本组件才发起请求 */
const fallback = ref<MallGoodsItem[]>([])
onMounted(() => {
  h5MallApi
    .getList({ page: 1, pageSize: 4, sort: 'sales_desc' })
    .then((res) => {
      fallback.value = res.list
    })
    .catch(() => {
      // 兜底失败不阻塞换词引导（兜底是加分项，非正确性关卡）
    })
})

/** 色块档位按 id 派生（后端无此字段，前端占位图用） */
function phOf(id: number): 'a' | 'b' | 'c' {
  return id % 3 === 0 ? 'a' : id % 3 === 1 ? 'b' : 'c'
}
</script>

<template>
  <div :class="bem.b()">
    <van-empty description="没有找到相关商品" />
    <!-- 换词建议：CJK 场景取前 2 字重试（ngram bigram 命中率高），与关键词相同时隐藏 -->
    <div v-if="suggestedWord && suggestedWord !== keyword.trim()" :class="bem.e('retry')">
      <span :class="bem.e('retry-label')">试试更短的关键词</span>
      <button type="button" :class="bem.e('retry-btn')" @click="emit('retry', suggestedWord)">
        搜索「{{ suggestedWord }}」
      </button>
    </div>
    <!-- 热销兜底：无结果时的下一步引导（区别于纯空态） -->
    <div v-if="fallback.length > 0" :class="bem.e('hot')">
      <div :class="bem.e('hot-title')">大家都在买</div>
      <div :class="bem.e('hot-grid')">
        <button
          v-for="item in fallback"
          :key="item.id"
          type="button"
          :class="bem.e('hot-card')"
          @click="emit('open', item)"
        >
          <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.name" :class="bem.e('hot-img')" />
          <MallPh v-else :ph="phOf(item.id)" :garm="item.garm ?? 'tshirt'" />
          <div :class="bem.e('hot-name')">{{ item.name }}</div>
          <div :class="bem.e('hot-price')">¥{{ item.price }}</div>
        </button>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
// 本文件在 postcss-pxtorem 转换范围内（src/modules/h5-mall/），直接写 828 设计稿 px
.#{$BEM_PREFIX}-search-empty-tips {
  padding: 26px 53px 70px;

  &__retry {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-top: 9px;
  }

  &__retry-label {
    font-size: 26px;
    color: var(--mall-ink-3);
  }

  &__retry-btn {
    margin-top: 22px;
    padding: 17px 44px;
    font-size: 29px;
    color: var(--mall-brand-deep);
    background: var(--mall-brand-soft);
    border: 1px solid var(--mall-line-strong);
    border-radius: var(--mall-r-lg);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  &__hot {
    margin-top: 53px;
  }

  &__hot-title {
    margin-bottom: 26px;
    font-size: 31px;
    font-weight: 600;
    color: var(--mall-ink-1);
  }

  &__hot-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 26px;
  }

  &__hot-card {
    padding: 0;
    text-align: left;
    background: none;
    border: 0;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  &__hot-img {
    width: 100%;
    aspect-ratio: 4 / 5;
    object-fit: cover;
    border-radius: var(--mall-r-md);
  }

  &__hot-name {
    display: -webkit-box;
    margin-top: 18px;
    overflow: hidden;
    font-size: 28px;
    line-height: 1.5;
    color: var(--mall-ink-1);
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  &__hot-price {
    margin-top: 9px;
    font-size: 31px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--mall-brand-deep);
  }
}
</style>
