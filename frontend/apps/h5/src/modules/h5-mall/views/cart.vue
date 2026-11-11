<script setup lang="ts">
/**
 * 购物车页（bag tab 落点）：条目列表 + 数量步进 + 本地勾选 + 合计 + 去结算。
 *
 * - 数量增减/删除成功后 reload 对齐真态（useCart 保证），并同步 tabbar 角标
 * - 失效条目（invalid=下架/缺货）禁用勾选且不计合计
 * - 去结算：勾选 cartItemIds 经 router.push 带 query 跳结算页（mode=CART）
 * - 未登录由路由 beforeEnter requireMallLogin 拦截
 */
import MallToast from '../components/MallToast.vue'
import { useCart } from '../composables/useCart'
import { useToast } from '../composables/useToast'
import { useCartBadgeStore } from '../store/cart'

const bem = createNamespace('h5-mall-cart')

const { pushByName, router } = useAppRouter()

const { list, loading, error, isEmpty, load, checkedIds, checkedTotal, toggleCheck, updateQty, remove } =
  useCart()
const { visible, message, show } = useToast()
/** 角标同步：购物车页的任何变更都刷新 tabbar 角标 */
const badge = useCartBadgeStore()

/** 全选开关：所有有效条目已勾选时为 true */
const allChecked = computed(() => {
  const valid = (list.value ?? []).filter((r) => !r.invalid)
  return valid.length > 0 && valid.every((r) => checkedIds.value.has(r.id))
})

function toggleAll(): void {
  const valid = (list.value ?? []).filter((r) => !r.invalid)
  const next = new Set(checkedIds.value)
  if (allChecked.value) {
    valid.forEach((r) => next.delete(r.id))
  } else {
    valid.forEach((r) => next.add(r.id))
  }
  checkedIds.value = next
}

async function onQtyChange(item: { id: number }, quantity: number): Promise<void> {
  try {
    await updateQty(item.id, quantity)
    await badge.refresh()
  } catch (err: unknown) {
    show(err instanceof Error ? err.message : '操作失败，请重试')
  }
}

async function onRemove(id: number): Promise<void> {
  const ok = await useConfirm('删除该商品？', '删除')
  if (!ok) return
  try {
    await remove(id)
    await badge.refresh()
  } catch (err: unknown) {
    show(err instanceof Error ? err.message : '操作失败，请重试')
  }
}

function goList(): void {
  void pushByName('H5MallList')
}

function goCheckout(): void {
  const ids = [...checkedIds.value]
  if (ids.length === 0) {
    show('请先勾选要结算的商品')
    return
  }
  // pushWithTitle 内含 useI18n（仅 setup 顶层可用），事件回调内改用 router 实例直跳
  void router.push({ name: 'H5MallCheckout', query: { mode: 'CART', ids: ids.join(',') } })
}
</script>

<template>
  <div :class="bem.b()">
    <!-- 三态仅首屏：步进器/删除触发的 reload 不再切骨架（整页闪动根因）；
         刷新失败的错误反馈由各操作 catch 里的 toast 承担 -->
    <div v-if="loading && !list" :class="bem.e('state')">
      <van-skeleton title :row="4" />
    </div>
    <div v-else-if="error && !list" :class="bem.e('state')">
      <van-empty description="加载失败，请检查网络">
        <van-button round type="primary" @click="load">重试</van-button>
      </van-empty>
    </div>
    <div v-else-if="isEmpty" :class="bem.e('state')">
      <van-empty description="购物袋是空的">
        <van-button round type="primary" @click="goList">去逛逛</van-button>
      </van-empty>
    </div>
    <template v-else>
      <!-- 粘顶结算栏：全选/合计/去结算常驻视口顶部（sticky top），长列表无需滚回底部（2026-11-11 交互优化） -->
      <footer :class="bem.e('bar')">
        <van-checkbox :model-value="allChecked" @update:model-value="toggleAll">全选</van-checkbox>
        <span :class="bem.e('total')">合计 <b>¥{{ checkedTotal }}</b></span>
        <van-button round type="primary" :disabled="checkedIds.size === 0" @click="goCheckout">
          去结算（{{ checkedIds.size }}）
        </van-button>
      </footer>
      <article
        v-for="item in list ?? []"
        :key="item.id"
        :class="[bem.e('item'), bem.is('invalid', !!item.invalid)]"
      >
        <van-checkbox
          :class="bem.e('check')"
          :model-value="checkedIds.has(item.id)"
          :disabled="!!item.invalid"
          @update:model-value="toggleCheck(item.id)"
        />
        <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.productName" :class="bem.e('thumb')" />
        <div v-else :class="[bem.e('thumb'), bem.m('ph')]" aria-hidden="true" />
        <div :class="bem.e('info')">
          <p :class="bem.e('name')">{{ item.productName }}</p>
          <p v-if="item.invalid" :class="bem.e('invalid-tag')">已失效（下架或缺货）</p>
          <div :class="bem.e('row')">
            <span :class="bem.e('price')">¥{{ item.price }}</span>
            <van-stepper
              :model-value="item.quantity"
              :min="1"
              :max="item.invalid ? item.quantity : 99"
              :disabled="!!item.invalid"
              @update:model-value="onQtyChange(item, $event as number)"
            />
          </div>
        </div>
        <button type="button" :class="bem.e('del')" aria-label="删除" @click="onRemove(item.id)">×</button>
      </article>
    </template>

    <MallToast :visible="visible" :message="message" />
  </div>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-h5-mall-cart {
  padding: 32px;
  font-family: var(--mall-font-body);
  font-size: 30px;
  line-height: 1.6;
  color: var(--mall-ink-1);

  &__state {
    padding: 106px 53px;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 22px;
    margin-bottom: 24px;
    padding: 28px;
    background: var(--mall-bg-card);
    border: 1px solid var(--mall-line);
    border-radius: var(--mall-r-md);

    &.is-invalid {
      opacity: 0.55;
    }
  }

  &__thumb {
    width: 120px;
    height: 120px;
    flex: none;
    object-fit: cover;
    border-radius: var(--mall-r-sm);
    background: var(--mall-bg-field);
  }

  &__info {
    flex: 1;
    min-width: 0;
  }

  &__name {
    margin: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  &__invalid-tag {
    margin: 6px 0 0;
    font-size: 24px;
    color: var(--mall-err);
  }

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 12px;
  }

  &__price {
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--mall-brand-deep);
  }

  &__del {
    flex: none;
    align-self: flex-start;
    padding: 0 12px;
    font-size: 36px;
    color: var(--mall-ink-3);
    background: none;
    border: none;
    cursor: pointer;
  }

  &__bar {
    // 粘顶常驻视口顶部：sticky 相对 body 滚动吸附——结算栏在文档流前部（条目上方），
    // 向下滚动时吸在 top:0 直至容器底部长列表滚完；无需滚回底部即可结算（2026-11-11 交互优化）。
    // 顶部负边距向容器外扩实现全宽（容器有 32px 内边距）
    position: sticky;
    top: 0;
    display: flex;
    align-items: center;
    gap: 24px;
    margin: -32px -32px 32px;
    padding: 24px 32px;
    background: var(--mall-bg-card);
    border-bottom: 1px solid var(--mall-line);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
  }

  &__total {
    flex: 1;
    text-align: right;

    b {
      font-variant-numeric: tabular-nums;
      color: var(--mall-brand-deep);
    }
  }
}
</style>
