<script setup lang="ts">
// ref 由 unplugin-auto-import 注入（CLAUDE.md §1.6）
import type { MallGoodsItem } from '../config/mall'
import {
  MALL_CATS,
  MALL_CHIPS,
  MALL_FLASH,
  MALL_GOODS,
  MALL_NEWS,
  MALL_NOTICE,
  MALL_TOPIC,
} from '../config/mall'
import { useReveal } from '../composables/useReveal'
import { useToast } from '../composables/useToast'
import MallCats from '../components/MallCats.vue'
import MallFlash from '../components/MallFlash.vue'
import MallGoods from '../components/MallGoods.vue'
import MallHero from '../components/MallHero.vue'
import MallNew from '../components/MallNew.vue'
import MallNotice from '../components/MallNotice.vue'
import MallServeFooter from '../components/MallServeFooter.vue'
import MallSprite from '../components/MallSprite.vue'
import MallTabbar from '../components/MallTabbar.vue'
import MallToast from '../components/MallToast.vue'
import MallTopbar from '../components/MallTopbar.vue'
import MallTopic from '../components/MallTopic.vue'

/**
 * 拙衣商城 H5 首页（陶土 · 莫兰迪）：公告 + 吸顶栏 + Banner + 金刚区 +
 * 限时甄选 + 新品横滑 + 编辑专题 + 为你推荐 + 服务页脚 + Tabbar + Toast。
 *
 * 容器职责：持有跨区块交互态（购物袋计数 / 收藏集合 / Toast），
 * 区块组件经 props 下传、emits 上报；入场渐显由 useReveal 统一驱动。
 */
const bem = createNamespace('h5-mall')

const rootRef = ref<HTMLElement | null>(null)
useReveal(rootRef)

const { visible: toastVisible, message: toastMessage, show } = useToast()

/** 购物袋计数（Tabbar 角标，>99 显示 99+） */
const cartCount = ref(0)
/** 已收藏商品 id 集合 */
const favs = ref<number[]>([])
/** Tabbar 选中 key（v-model 受控；切 tab 联动点见 MallTabbar emit 语义） */
const activeTab = ref('home')

function onAdd(): void {
  cartCount.value += 1
  show('已加入购物袋')
}

function onToggleFav(item: MallGoodsItem): void {
  const idx = favs.value.indexOf(item.id)
  if (idx >= 0) {
    favs.value.splice(idx, 1)
    show('已取消收藏')
  } else {
    favs.value.push(item.id)
    show('已加入心愿单')
  }
}
</script>

<template>
  <div ref="rootRef" :class="bem.b()">
    <MallSprite />
    <MallNotice :text="MALL_NOTICE" />
    <MallTopbar />
    <main>
      <MallHero class="rv" />
      <MallCats class="rv" :cats="MALL_CATS" />
      <MallFlash class="rv" :items="MALL_FLASH" />
      <MallNew class="rv" :items="MALL_NEWS" />
      <MallTopic class="rv" :topic="MALL_TOPIC" />
      <MallGoods
        class="rv"
        :goods="MALL_GOODS"
        :chips="MALL_CHIPS"
        :favs="favs"
        @add="onAdd"
        @toggle-fav="onToggleFav"
      />
    </main>
    <MallServeFooter class="rv" />
    <MallTabbar v-model="activeTab" :cart-count="cartCount" />
    <MallToast :visible="toastVisible" :message="toastMessage" />
  </div>
</template>

<style lang="scss">
// 本文件在 postcss-pxtorem 转换范围内（src/modules/h5-mall/），直接写 828 设计稿 px
// 视觉 token 单源在 ../styles/h5-mall-tokens.scss（挂 .vv-h5-mall 根选择器，仅模块子树生效）
@use '../styles/h5-mall-tokens.scss';

.#{$BEM_PREFIX}-h5-mall {
  min-height: 100vh;
  // 100dvh 渐进增强：规避 iOS Safari 地址栏收缩溢出（与 layouts/h5 同策略）
  min-height: 100dvh;
  // 为 fixed tabbar 留出底部空间：容器高 TB_H(134)@362 稿 × (828/362) ≈ 307 稿 px；
  // safe-area 由 tabbar 容器自身 padding 承担，此处不再叠加
  padding-bottom: 307px;
  font-family: var(--mall-font-body);
  font-size: 34px;
  line-height: 1.7;
  color: var(--mall-ink-1);
  background: var(--mall-bg-page);

  a {
    color: inherit;
    text-decoration: none;
  }

  // 入场渐显：useReveal 观察 .rv，进入视口加 .in（prefers-reduced-motion 见下方媒体查询）
  .rv {
    opacity: 0;
    transform: translateY(22px);
    transition:
      opacity var(--mall-dur) var(--mall-ease),
      transform var(--mall-dur) var(--mall-ease);
  }

  .rv.in {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .#{$BEM_PREFIX}-h5-mall .rv {
    opacity: 1;
    transform: none;
    transition: none;
  }
}
</style>
