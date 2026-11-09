<script setup lang="ts">
/**
 * 卖家工作台：我的寄卖（接受平台定价）+ 售出订单（发货）。
 *
 * 顶部子 tab 切换两个列表（van-tabs）。关键交互语义：
 * - 接受定价（Review Focus 4）：PRICED 状态显示，接受即铸造商品上架（不可撤销）——
 *   useConfirm 二次确认（文案明示不可撤销）+ acceptingId 防重复提交
 * - 发货：售出订单 PAID 状态显示，useConfirm 二次确认 + shippingId 防重
 * - 两操作成功/400 均由 composable finally reload 对齐真态，失败 toast 后端消息
 *   （Review Focus 2：不留幻觉成功）
 *
 * 页面级登录守卫在 ../routes/index.ts（beforeEnter requireMallLogin）。
 */
import { formatDate } from '@vv/shared'
import MallToast from '../components/MallToast.vue'
import { CONSIGNMENT_STATUS_TEXT, ORDER_STATUS_TEXT } from '../apis/index'
import type { MallConsignment, MallOrder } from '../apis/index'
import { useSellerWorkbench, sellerGross } from '../composables/useSellerWorkbench'
import { useToast } from '../composables/useToast'

const bem = createNamespace('h5-mall-seller')

const {
  consignments,
  soldOrders,
  loadingConsignments,
  loadingOrders,
  errorConsignments,
  errorOrders,
  isEmptyConsignments,
  isEmptyOrders,
  loadConsignments,
  loadSoldOrders,
  acceptPricing,
  shipOrder,
} = useSellerWorkbench()
const { visible, message, show } = useToast()

/** 顶部子 tab 选中（0=我的寄卖 1=售出订单） */
const activeTab = ref(0)

/** 接受定价进行中寄卖 id（防重；null 表示无进行中操作） */
const acceptingId = ref<number | null>(null)
/** 发货进行中订单 id（防重） */
const shippingId = ref<number | null>(null)

function consignmentStatusText(status: string): string {
  return CONSIGNMENT_STATUS_TEXT[status] ?? status
}

function orderStatusText(status: string): string {
  return ORDER_STATUS_TEXT[status] ?? status
}

function formatTime(iso: string): string {
  return formatDate(iso, 'YYYY-MM-DD HH:mm', 'zh-CN')
}

/** 佣金率（后端 0.15 形式）转百分比文案 */
function commissionText(rate: number | null): string {
  return rate === null ? '-' : `${Math.round(rate * 100)}%`
}

async function onAcceptPricing(consignment: MallConsignment): Promise<void> {
  const ok = await useConfirm(
    `接受平台定价 ¥${consignment.platformPrice ?? '-'}？接受后商品将立即上架，此操作不可撤销。`,
    '接受定价',
  )
  if (!ok) return
  acceptingId.value = consignment.id
  try {
    await acceptPricing(consignment.id)
    show('已接受定价，商品上架')
  } catch (err: unknown) {
    show(err instanceof Error ? err.message : '操作失败，请重试')
  } finally {
    acceptingId.value = null
  }
}

async function onShip(order: MallOrder): Promise<void> {
  const ok = await useConfirm(`确认订单 ${order.orderNo} 已发货？`, '确认发货')
  if (!ok) return
  shippingId.value = order.id
  try {
    await shipOrder(order.id)
    show('已发货')
  } catch (err: unknown) {
    show(err instanceof Error ? err.message : '操作失败，请重试')
  } finally {
    shippingId.value = null
  }
}
</script>

<template>
  <div :class="bem.b()">
    <van-tabs v-model:active="activeTab" :class="bem.e('tabs')" line-width="32px">
      <!-- ── 子 tab 1：我的寄卖 ── -->
      <van-tab title="我的寄卖">
        <div v-if="loadingConsignments" :class="bem.e('state')">
          <van-skeleton title :row="4" />
        </div>
        <div v-else-if="errorConsignments" :class="bem.e('state')">
          <van-empty description="加载失败，请检查网络">
            <van-button round type="primary" @click="loadConsignments">重试</van-button>
          </van-empty>
        </div>
        <div v-else-if="isEmptyConsignments" :class="bem.e('state')">
          <van-empty description="暂无寄卖记录" />
        </div>
        <template v-else>
          <article v-for="c in consignments ?? []" :key="c.id" :class="bem.e('card')">
            <div :class="bem.e('item')">
              <img
                v-if="c.images[0]"
                :src="c.images[0]"
                :alt="c.title"
                :class="bem.e('thumb')"
              />
              <div v-else :class="[bem.e('thumb'), bem.m('ph')]" aria-hidden="true" />
              <div :class="bem.e('info')">
                <p :class="bem.e('title')">
                  <template v-if="c.brand">{{ c.brand }} · </template>{{ c.title }}
                </p>
                <p v-if="c.size" :class="bem.e('meta')">{{ c.size }}码 · {{ c.conditionGrade }}</p>
                <p :class="bem.e('time')">{{ formatTime(c.createTime) }}</p>
              </div>
              <span :class="bem.e('status')">{{ consignmentStatusText(c.status) }}</span>
            </div>
            <div :class="bem.e('pricing')">
              <span>期望价 ¥{{ c.expectedPrice ?? '-' }}</span>
              <span :class="bem.e('platform')">平台定价 ¥{{ c.platformPrice ?? '-' }}</span>
              <span>佣金率 {{ commissionText(c.commissionRate) }}</span>
            </div>
            <p v-if="c.status === 'REJECTED' && c.rejectReason" :class="bem.e('reject')">
              驳回原因：{{ c.rejectReason }}
            </p>
            <footer v-if="c.status === 'PRICED'" :class="bem.e('foot')">
              <van-button
                round
                size="small"
                type="primary"
                :loading="acceptingId === c.id"
                :disabled="acceptingId !== null"
                @click="onAcceptPricing(c)"
              >
                接受定价
              </van-button>
            </footer>
          </article>
        </template>
      </van-tab>

      <!-- ── 子 tab 2：售出订单 ── -->
      <van-tab title="售出订单">
        <div v-if="loadingOrders" :class="bem.e('state')">
          <van-skeleton title :row="4" />
        </div>
        <div v-else-if="errorOrders" :class="bem.e('state')">
          <van-empty description="加载失败，请检查网络">
            <van-button round type="primary" @click="loadSoldOrders">重试</van-button>
          </van-empty>
        </div>
        <div v-else-if="isEmptyOrders" :class="bem.e('state')">
          <van-empty description="暂无售出订单" />
        </div>
        <template v-else>
          <article v-for="order in soldOrders ?? []" :key="order.id" :class="bem.e('card')">
            <header :class="bem.e('head')">
              <span :class="bem.e('no')">订单号 {{ order.orderNo }}</span>
              <span :class="bem.e('status')">{{ orderStatusText(order.status) }}</span>
            </header>
            <div v-for="(item, idx) in order.items" :key="idx" :class="bem.e('item')">
              <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.title" :class="bem.e('thumb')" />
              <div v-else :class="[bem.e('thumb'), bem.m('ph')]" aria-hidden="true" />
              <div :class="bem.e('info')">
                <p :class="bem.e('title')">{{ item.title }}</p>
                <p :class="bem.e('meta')">×{{ item.quantity }}</p>
              </div>
              <span :class="bem.e('price')">¥{{ item.price }}</span>
            </div>
            <footer :class="bem.e('foot')">
              <span :class="bem.e('time')">{{ formatTime(order.createTime) }}</span>
              <span :class="bem.e('amount')">实收 ¥{{ sellerGross(order) }}</span>
              <van-button
                v-if="order.status === 'PAID'"
                round
                size="small"
                type="primary"
                :loading="shippingId === order.id"
                :disabled="shippingId !== null"
                @click="onShip(order)"
              >
                发货
              </van-button>
            </footer>
          </article>
        </template>
      </van-tab>
    </van-tabs>
    <MallToast :visible="visible" :message="message" />
  </div>
</template>

<style lang="scss">
// 本文件在 postcss-pxtorem 转换范围内（src/modules/h5-mall/），直接写 828 设计稿 px。
// 视觉 token 由外壳 views/shell.vue 的 .vv-h5-mall 根提供（--mall-* 继承）
.#{$BEM_PREFIX}-h5-mall-seller {
  font-family: var(--mall-font-body);
  font-size: 30px;
  line-height: 1.6;
  color: var(--mall-ink-1);

  &__tabs {
    // van-tabs 内容区左右内边距（卡片与屏幕边的呼吸间距）
    .van-tabs__content {
      padding: 32px;
    }
  }

  &__state {
    padding: 106px 53px;
  }

  &__card {
    margin-bottom: 32px;
    padding: 32px;
    background: var(--mall-bg-card);
    border: 1px solid var(--mall-line);
    border-radius: var(--mall-r-md);
  }

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 24px;
    border-bottom: 1px solid var(--mall-line);
  }

  &__no {
    font-size: 26px;
    color: var(--mall-ink-2);
  }

  &__status {
    font-size: 26px;
    font-weight: 600;
    color: var(--mall-brand-deep);
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 24px;
    padding: 24px 0;
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

  &__title {
    margin: 0;
    overflow: hidden;
    font-size: 30px;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  &__meta {
    margin: 8px 0 0;
    font-size: 24px;
    color: var(--mall-ink-3);
  }

  &__time {
    margin: 8px 0 0;
    font-size: 24px;
    color: var(--mall-ink-3);
  }

  &__price {
    flex: none;
    font-variant-numeric: tabular-nums;
  }

  &__pricing {
    display: flex;
    gap: 32px;
    padding: 16px 0;
    font-size: 26px;
    color: var(--mall-ink-2);
    border-top: 1px solid var(--mall-line);
  }

  &__platform {
    font-weight: 600;
    color: var(--mall-brand-deep);
  }

  &__reject {
    margin: 16px 0 0;
    font-size: 26px;
    color: var(--mall-err);
  }

  &__foot {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 24px;
    padding-top: 24px;
    border-top: 1px solid var(--mall-line);
  }

  &__amount {
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
}
</style>
