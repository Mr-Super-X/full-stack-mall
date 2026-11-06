<script setup lang="ts">
// ref 由 unplugin-auto-import 注入（CLAUDE.md §1.6）
import { useProductDetail } from '../composables/useProductDetail'
import MallPh from '../components/MallPh.vue'

/**
 * 商品详情页：图片轮播 + 规格选择 + 成色报告（寄卖）+ 卖家卡片（寄卖）+ 详情富文本。
 * 数据来源：useProductDetail() 拉取 /mall/product/{id}（走后端 API）。
 * 404（商品不存在/已下架）由 error 态触发跳转 not-found（Task 5）。
 */
const bem = createNamespace('mall-detail')

const route = useRoute()
// 项目 composable @vv/shared（vite 自动注入）
const { replaceByName } = useAppRouter()
const productId = computed(() => Number(route.params.id))

const { detail, loading, error, isEmpty, refresh } = useProductDetail(productId)

// 404（商品不存在/已下架）跳转 not-found 页（区分于网络错误等可重试错误）
watch(error, (err) => {
  if (err && (err as { code?: number }).code === 404) {
    void replaceByName('H5MallNotFound')
  }
})

/** 当前选中规格（默认第一个/最低价） */
const selectedItemId = ref<number | null>(null)

/** 选中规格详情 */
const selectedItem = computed(() => {
  return detail.value?.items.find((i) => i.id === selectedItemId.value) ?? detail.value?.items[0]
})

/** 是否寄卖商品 */
const isConsignment = computed(() => detail.value?.ownerType === 'CONSIGNMENT')

/** 成色报告文案（寄卖商品） */
const conditionText = computed(() => {
  const grade = selectedItem.value?.conditionGrade
  const map: Record<string, string> = {
    NEW: '全新',
    LIKE_NEW: '95新·几乎无使用痕迹',
    GOOD: '良好·正常使用痕迹',
    FAIR: '有明显使用痕迹',
  }
  return grade ? map[grade] ?? grade : null
})

/** 色块档位按 id 派生 */
function phOf(id: number): 'a' | 'b' | 'c' {
  return id % 3 === 0 ? 'a' : id % 3 === 1 ? 'b' : 'c'
}

/** 加入购物袋（阶段 2 接真实购物车，阶段 1 仅 toast） */
function onAdd(): void {
  // TODO: 阶段 2 接购物车 API
}
</script>

<template>
  <div :class="bem.b()">
    <!-- Loading 态 -->
    <div v-if="loading" :class="bem.e('loading')">
      <van-skeleton title avatar :row="4" />
    </div>

    <!-- Error 态（含 404） -->
    <div v-else-if="error" :class="bem.e('error')">
      <van-empty :description="error.message || '商品不存在或已下架'">
        <van-button round type="primary" @click="refresh">重试</van-button>
      </van-empty>
    </div>

    <!-- Empty 态（理论不可达，兜底） -->
    <div v-else-if="isEmpty" :class="bem.e('empty')">
      <van-empty description="暂无商品信息" />
    </div>

    <!-- 正常态 -->
    <template v-else-if="detail">
      <!-- 图片轮播 -->
      <van-swipe :class="bem.e('swipe')" :autoplay="3000" indicator-color="white">
        <van-swipe-item v-for="(img, idx) in detail.images" :key="idx">
          <img :src="img" :alt="detail.name" :class="bem.e('img')" />
        </van-swipe-item>
        <!-- 无图时兜底占位块 -->
        <van-swipe-item v-if="detail.images.length === 0">
          <MallPh :ph="phOf(detail.id)" :garm="detail.garm ?? 'tshirt'" />
        </van-swipe-item>
      </van-swipe>

      <!-- 价格与标题 -->
      <div :class="bem.e('head')">
        <div :class="bem.e('price')">
          <b>¥{{ selectedItem?.price ?? detail.price }}</b>
          <s v-if="selectedItem?.originPrice" :class="bem.e('origin')">
            ¥{{ selectedItem.originPrice }}
          </s>
        </div>
        <h1 :class="bem.e('title')">{{ detail.name }}</h1>
        <div :class="bem.e('meta')">
          <span v-if="detail.tag" :class="bem.e('tag')">{{ detail.tag }}</span>
          <span v-if="detail.sellingPoint" :class="bem.e('point')">{{ detail.sellingPoint }}</span>
          <span :class="bem.e('sales')">已售{{ detail.sales ?? 0 }}</span>
        </div>
      </div>

      <!-- 成色报告（寄卖商品） -->
      <div v-if="isConsignment && conditionText" :class="bem.e('condition')">
        <h2 :class="bem.e('subtitle')">成色报告</h2>
        <p :class="bem.e('condition-text')">{{ conditionText }}</p>
      </div>

      <!-- 卖家卡片（寄卖商品） -->
      <div v-if="isConsignment && detail.sellerId" :class="bem.e('seller')">
        <h2 :class="bem.e('subtitle')">卖家信息</h2>
        <p :class="bem.e('seller-text')">卖家 ID：{{ detail.sellerId }}（卖家主页为阶段 2 功能）</p>
      </div>

      <!-- 规格选择 -->
      <div v-if="detail.items.length > 1" :class="bem.e('sku')">
        <h2 :class="bem.e('subtitle')">选择规格</h2>
        <div :class="bem.e('sku-list')">
          <button
            v-for="item in detail.items"
            :key="item.id"
            type="button"
            :class="[bem.e('sku-item'), bem.is('active', selectedItemId === item.id)]"
            @click="selectedItemId = item.id"
          >
            {{ [item.size, item.color].filter(Boolean).join(' / ') || '默认' }}
            <span :class="bem.e('sku-price')">¥{{ item.price }}</span>
          </button>
        </div>
      </div>

      <!-- 详情富文本 -->
      <div v-if="detail.detailHtml" :class="bem.e('detail')">
        <h2 :class="bem.e('subtitle')">商品详情</h2>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div :class="bem.e('html')" v-html="detail.detailHtml" />
      </div>

      <!-- 底部操作栏 -->
      <div :class="bem.e('actionbar')">
        <van-button round type="primary" block :class="bem.e('addbtn')" @click="onAdd">
          加入购物袋
        </van-button>
      </div>
    </template>
  </div>
</template>

<style lang="scss">
// 本文件在 postcss-pxtorem 转换范围内（src/modules/h5-mall/），直接写 828 设计稿 px
@use '../styles/h5-mall-tokens.scss';

.#{$BEM_PREFIX}-mall-detail {
  min-height: 100vh;
  min-height: 100dvh;
  padding-bottom: 159px;
  font-family: var(--mall-font-body);
  font-size: 34px;
  color: var(--mall-ink-1);
  background: var(--mall-bg-page);

  &__loading,
  &__error,
  &__empty {
    padding: 106px 53px;
  }

  &__swipe {
    height: 750px;
    background: var(--mall-bg-field);
  }

  &__img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &__head {
    padding: 53px;
    background: var(--mall-bg-card);
  }

  &__price {
    b {
      font-size: 53px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: var(--mall-brand-deep);
    }
  }

  &__origin {
    margin-left: 18px;
    font-size: 31px;
    color: var(--mall-ink-3);
  }

  &__title {
    margin: 18px 0 0;
    font-size: 38px;
    font-weight: 500;
    line-height: 1.5;
    color: var(--mall-ink-1);
  }

  &__meta {
    display: flex;
    gap: 18px;
    margin-top: 22px;
    font-size: 26px;
    color: var(--mall-ink-3);
  }

  &__tag,
  &__point {
    padding: 4px 13px;
    background: var(--mall-brand-soft);
    border-radius: var(--mall-r-sm);
  }

  &__sales {
    margin-left: auto;
  }

  &__condition,
  &__seller,
  &__sku,
  &__detail {
    margin-top: 18px;
    padding: 53px;
    background: var(--mall-bg-card);
  }

  &__subtitle {
    margin: 0 0 22px;
    font-family: var(--mall-font-head);
    font-size: 34px;
    font-weight: 600;
    color: var(--mall-ink-1);
  }

  &__condition-text {
    margin: 0;
    font-size: 31px;
    color: var(--mall-brand-deep);
  }

  &__seller-text {
    margin: 0;
    font-size: 28px;
    color: var(--mall-ink-2);
  }

  &__sku-list {
    display: flex;
    flex-wrap: wrap;
    gap: 18px;
  }

  &__sku-item {
    padding: 13px 26px;
    font-size: 28px;
    color: var(--mall-ink-2);
    background: var(--mall-bg-page);
    border: 1px solid var(--mall-line);
    border-radius: var(--mall-r-sm);

    &.is-active {
      color: var(--mall-brand-deep);
      background: var(--mall-brand-soft);
      border-color: var(--mall-line-strong);
    }
  }

  &__sku-price {
    margin-left: 9px;
    font-variant-numeric: tabular-nums;
  }

  &__html {
    font-size: 31px;
    line-height: 1.8;
    color: var(--mall-ink-2);
  }

  // v-html 富文本段落样式（非 scoped 下 :deep 不编译，直接后代选择器）
  .#{$BEM_PREFIX}-mall-detail__html p {
    margin: 0 0 18px;
  }

  &__actionbar {
    position: fixed;
    right: 0;
    bottom: 0;
    left: 0;
    padding: 26px 53px;
    background: var(--mall-bg-card);
    border-top: 1px solid var(--mall-line);
  }

  &__addbtn {
    height: 97px;
    font-size: 31px;
  }
}
</style>
