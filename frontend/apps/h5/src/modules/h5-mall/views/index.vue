<script setup lang="ts">
// ref 由 unplugin-auto-import 注入（CLAUDE.md §1.6）
import type { MallGoodsItem } from '../apis/index'
import { useMallHome } from '../composables/useMallHome'
import { useReveal } from '../composables/useReveal'
import { useToast } from '../composables/useToast'
import MallCats from '../components/MallCats.vue'
import MallFlash from '../components/MallFlash.vue'
import MallGoods from '../components/MallGoods.vue'
import MallHero from '../components/MallHero.vue'
import MallNew from '../components/MallNew.vue'
import MallNotice from '../components/MallNotice.vue'
import MallServeFooter from '../components/MallServeFooter.vue'
import MallToast from '../components/MallToast.vue'
import MallTopbar from '../components/MallTopbar.vue'
import MallTopic from '../components/MallTopic.vue'

/**
 * 拙衣商城 H5 首页（陶土 · 莫兰迪）：公告 + 吸顶栏 + Banner + 金刚区 +
 * 限时甄选 + 新品横滑 + 编辑专题 + 为你推荐 + 服务页脚 + Toast。
 *
 * 容器职责：持有跨区块交互态（收藏集合 / Toast），区块组件经 props 下传、
 * emits 上报；入场渐显由 useReveal 统一驱动。数据来源：useMallHome() 拉取
 * /mall/home/content，替代 mall.ts 硬编码。
 *
 * Tabbar 说明：常驻 tabbar 已上移至 ../shell.vue（切 tab 不消失），本页不再渲染；
 * 底部留白（padding-bottom）随之迁至外壳，见 shell.vue 样式。
 */
const bem = createNamespace('h5-mall')

const rootRef = ref<HTMLElement | null>(null)
useReveal(rootRef)

const { visible: toastVisible, message: toastMessage, show } = useToast()

/** 首页聚合内容（走后端 API） */
const { home, loading, error, isEmpty, refresh } = useMallHome()

/** 已收藏商品 id 集合 */
const favs = ref<number[]>([])

/** 金刚区品类（后端 categories 映射到原型 MALL_CATS 形状；icon 字段直接透传） */
const mallCats = computed(() => {
  return (home.value?.categories ?? []).map((c) => ({ label: c.name, icon: c.icon ?? 'spark' }))
})

/** 限时甄选（后端 flash.items） */
const mallFlash = computed(() => home.value?.flash.items ?? [])

/** 新品横滑（后端 news） */
const mallNews = computed(() => home.value?.news ?? [])

/** 为你推荐（后端 recommend） */
const mallGoods = computed(() => home.value?.recommend ?? [])

/** 为你推荐筛选 chips（原型静态，阶段 1 不接后端分类筛选） */
const MALL_CHIPS: readonly string[] = ['推荐', '上衣', '裙装', '裤装', '外套', '配饰']

/** 编辑专题（原型静态，阶段 1 不接后端） */
const MALL_TOPIC = {
  kicker: "EDITORS' PICK",
  title: '棉麻 Capsule · 第 12 期',
  desc: '一件穿十年的基础衣柜：从 7 个单品开始。',
  meta: '每周四更新 · 已更新 12 期',
  artText: '拾贰',
} as const

function onAdd(): void {
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
    <!-- sprite 定义源已上移至常驻外壳 shell.vue（tabbar 常驻后切走首页 symbol 会丢） -->
    <MallNotice :text="home?.notice ?? ''" />
    <MallTopbar />
    <main>
      <!-- Loading 态：骨架屏（区分于空态） -->
      <div v-if="loading" :class="bem.e('loading')">
        <van-skeleton title avatar :row="3" />
      </div>
      <!-- Error 态：错误提示 + 重试按钮 -->
      <div v-else-if="error" :class="bem.e('error')">
        <van-empty description="加载失败，请检查网络">
          <van-button round type="primary" @click="refresh">重试</van-button>
        </van-empty>
      </div>
      <!-- Empty 态：空数据占位（区分于 Loading） -->
      <div v-else-if="isEmpty" :class="bem.e('empty')">
        <van-empty description="暂无商品" />
      </div>
      <!-- 正常态 -->
      <template v-else-if="home">
        <MallHero class="rv" />
        <MallCats class="rv" :cats="mallCats" />
        <MallFlash class="rv" :items="mallFlash" />
        <MallNew class="rv" :items="mallNews" />
        <MallTopic class="rv" :topic="MALL_TOPIC" />
        <MallGoods
          class="rv"
          :goods="mallGoods"
          :chips="MALL_CHIPS"
          :favs="favs"
          @add="onAdd"
          @toggle-fav="onToggleFav"
        />
      </template>
    </main>
    <MallServeFooter class="rv" />
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

  &__loading,
  &__error,
  &__empty {
    padding: 106px 53px;
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
