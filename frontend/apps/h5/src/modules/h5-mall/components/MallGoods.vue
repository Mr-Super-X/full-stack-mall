<script setup lang="ts">
// ref 由 unplugin-auto-import 注入（CLAUDE.md §1.6）
import type { MallGoodsItem } from '../config/mall'
import MallPh from './MallPh.vue'

/**
 * 为你推荐：筛选 chips（本地选中态，原型不联动列表）+ 双列商品卡。
 * 收藏态由父级持有（favs），加购 / 收藏经 emits 上报，由父级统一弹 toast 与计数。
 */
const bem = createNamespace('mall-goods')

const props = defineProps<{
  goods: readonly MallGoodsItem[]
  chips: readonly string[]
  /** 已收藏商品 id 列表 */
  favs: readonly number[]
}>()

const emit = defineEmits<{
  add: [item: MallGoodsItem]
  toggleFav: [item: MallGoodsItem]
}>()

const activeChip = ref(props.chips[0] ?? '推荐')

function isFav(id: number): boolean {
  return props.favs.includes(id)
}
</script>

<template>
  <section :class="bem.b()">
    <div :class="bem.e('head')">
      <h2 :class="bem.e('title')">为你推荐</h2>
      <span :class="bem.e('en')">FOR YOU</span>
    </div>
    <div :class="bem.e('chips')" role="tablist" aria-label="推荐筛选">
      <button
        v-for="chip in chips"
        :key="chip"
        type="button"
        :class="bem.e('chip')"
        :aria-pressed="chip === activeChip"
        @click="activeChip = chip"
      >
        {{ chip }}
      </button>
    </div>
    <div :class="bem.e('grid')">
      <div v-for="item in goods" :key="item.id" :class="bem.e('gcard')">
        <MallPh :ph="item.ph" :garm="item.garm">
          <template #action>
            <button
              type="button"
              :class="[bem.e('fav'), bem.is('on', isFav(item.id))]"
              :aria-label="`${isFav(item.id) ? '取消收藏' : '收藏'} ${item.name}`"
              :aria-pressed="isFav(item.id)"
              @click="emit('toggleFav', item)"
            >
              <svg :class="bem.e('favic')" aria-hidden="true"><use href="#mall-i-heart" /></svg>
            </button>
          </template>
        </MallPh>
        <div :class="bem.e('name')">{{ item.name }}</div>
        <span :class="bem.e('minitag')">{{ item.minitag }}</span>
        <div :class="bem.e('foot')">
          <span :class="bem.e('price')">
            <b>¥{{ item.price }}</b>
          </span>
          <button type="button" :class="bem.e('addbtn')" @click="emit('add', item)">
            加入购物袋
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style lang="scss">
// 本文件在 postcss-pxtorem 转换范围内（src/modules/h5-mall/），直接写 828 设计稿 px
.#{$BEM_PREFIX}-mall-goods {
  margin-top: 159px;
  padding: 0 53px;

  &__head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 53px;
  }

  &__title {
    margin: 0;
    font-family: var(--mall-font-head);
    font-size: 49px;
    font-weight: 600;
    letter-spacing: 2px;
    color: var(--mall-ink-1);
  }

  &__en {
    margin-left: 18px;
    font-size: 24px;
    letter-spacing: 7px;
    color: var(--mall-ink-3);
  }

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 18px;
    margin-bottom: 35px;
  }

  &__chip {
    height: 71px;
    padding: 0 35px;
    font-size: 29px;
    color: var(--mall-ink-2);
    background: var(--mall-bg-card);
    border: 1px solid var(--mall-line);
    border-radius: var(--mall-r-lg);
    transition:
      color var(--mall-dur) var(--mall-ease),
      background var(--mall-dur) var(--mall-ease),
      border-color var(--mall-dur) var(--mall-ease);

    &[aria-pressed='true'] {
      color: var(--mall-brand-deep);
      background: var(--mall-brand-soft);
      border-color: var(--mall-line-strong);
    }
  }

  &__grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 35px 26px;
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

  &__minitag {
    display: inline-block;
    margin-top: 13px;
    padding: 2px 13px;
    font-size: 24px;
    color: var(--mall-ink-2);
    background: var(--mall-bg-card);
    border: 1px solid var(--mall-line);
    border-radius: 9px;
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

  &__addbtn {
    display: inline-flex;
    align-items: center;
    height: 62px;
    padding: 0 26px;
    font-size: 26px;
    letter-spacing: 2px;
    color: var(--mall-brand-deep);
    background: var(--mall-brand-soft);
    border-radius: var(--mall-r-lg);
    transition: transform var(--mall-dur) var(--mall-ease);

    &:active {
      transform: scale(0.94);
    }
  }

  &__fav {
    position: absolute;
    top: 18px;
    right: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 66px;
    height: 66px;
    color: var(--mall-ink-3);
    background: var(--mall-bg-card);
    border: 1px solid var(--mall-line);
    border-radius: 50%;
    transition:
      color var(--mall-dur) var(--mall-ease),
      transform var(--mall-dur) var(--mall-ease);

    &.is-on {
      color: var(--mall-brand-deep);

      svg path {
        fill: var(--mall-brand-deep);
        stroke: var(--mall-brand-deep);
      }
    }

    &:active {
      transform: scale(0.9);
    }
  }

  &__favic {
    width: 35px;
    height: 35px;
  }
}
</style>
