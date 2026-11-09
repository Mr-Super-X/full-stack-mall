<script setup lang="ts">
/**
 * 我的订单（买家视角）：订单卡片列表 + 确认收货。
 *
 * 三态（frontend.md §1.1）：Loading 骨架 / Error 提示+重试 / Empty 空态占位。
 * 确认收货（Review Focus 2：不留幻觉成功）：
 * - SHIPPED 订单显示「确认收货」，useConfirm 二次确认 + confirmingId 防重复提交
 * - 成功/失败均 reload 对齐真态（composable finally 保证）；失败 toast 后端错误消息
 *
 * 页面级登录守卫在 ../routes/index.ts（beforeEnter requireMallLogin → H5MallLogin
 * 带 redirect 回跳）——h5 全局无登录守卫（router/index.ts 头注「全站公开」），
 * 订单/工作台的登录拦截落在路由级（ledger Task 1 Ruling 5）。
 */
import { formatDate } from '@vv/shared'
import MallToast from '../components/MallToast.vue'
import { ORDER_STATUS_TEXT } from '../apis/index'
import type { MallOrder } from '../apis/index'
import { useMyOrders } from '../composables/useMyOrders'
import { useToast } from '../composables/useToast'

const bem = createNamespace('h5-mall-orders')

const { list, loading, error, isEmpty, load, confirmReceipt } = useMyOrders()
const { visible, message, show } = useToast()

/** 确认收货进行中订单 id（按钮禁用防重；null 表示无进行中操作） */
const confirmingId = ref<number | null>(null)

function statusText(status: string): string {
  return ORDER_STATUS_TEXT[status] ?? status
}

function formatTime(iso: string): string {
  // 后端 LocalDateTime 序列化为 ISO 无时区串（如 2026-11-09T10:00:00），dayjs 按本地时区解析展示
  return formatDate(iso, 'YYYY-MM-DD HH:mm', 'zh-CN')
}

async function onConfirmReceipt(order: MallOrder): Promise<void> {
  const ok = await useConfirm('确认已收到货物？确认后订单完成，货款将结算给卖家。', '确认收货')
  if (!ok) return
  confirmingId.value = order.id
  try {
    await confirmReceipt(order.id)
    show('已确认收货')
  } catch (err: unknown) {
    show(err instanceof Error ? err.message : '操作失败，请重试')
  } finally {
    confirmingId.value = null
  }
}
</script>

<template>
  <div :class="bem.b()">
    <!-- Loading 态：骨架屏（区分于空态） -->
    <div v-if="loading" :class="bem.e('loading')">
      <van-skeleton title :row="4" />
    </div>
    <!-- Error 态：错误提示 + 重试按钮 -->
    <div v-else-if="error" :class="bem.e('error')">
      <van-empty description="加载失败，请检查网络">
        <van-button round type="primary" @click="load">重试</van-button>
      </van-empty>
    </div>
    <!-- Empty 态：空数据占位（区分于 Loading） -->
    <div v-else-if="isEmpty" :class="bem.e('empty')">
      <van-empty description="暂无订单">
        <van-button round type="primary" @click="load">刷新</van-button>
      </van-empty>
    </div>
    <!-- 正常态：订单卡片列表 -->
    <template v-else>
      <article v-for="order in list ?? []" :key="order.id" :class="bem.e('card')">
        <header :class="bem.e('head')">
          <span :class="bem.e('no')">订单号 {{ order.orderNo }}</span>
          <span :class="bem.e('status')">{{ statusText(order.status) }}</span>
        </header>
        <div v-for="(item, idx) in order.items" :key="idx" :class="bem.e('item')">
          <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.title" :class="bem.e('thumb')" />
          <div v-else :class="[bem.e('thumb'), bem.m('ph')]" aria-hidden="true" />
          <div :class="bem.e('info')">
            <p :class="bem.e('title')">{{ item.title }}</p>
            <p :class="bem.e('meta')">
              <template v-if="item.brand">{{ item.brand }} · </template>
              <template v-if="item.size">{{ item.size }}码</template>
              <template v-if="item.color"> · {{ item.color }}</template>
              ×{{ item.quantity }}
            </p>
          </div>
          <span :class="bem.e('price')">¥{{ item.price }}</span>
        </div>
        <footer :class="bem.e('foot')">
          <span :class="bem.e('time')">{{ formatTime(order.createTime) }}</span>
          <span :class="bem.e('amount')">实付 ¥{{ order.payAmount }}</span>
          <van-button
            v-if="order.status === 'SHIPPED'"
            round
            size="small"
            type="primary"
            :loading="confirmingId === order.id"
            :disabled="confirmingId !== null"
            @click="onConfirmReceipt(order)"
          >
            确认收货
          </van-button>
        </footer>
      </article>
    </template>
    <MallToast :visible="visible" :message="message" />
  </div>
</template>

<style lang="scss">
// 本文件在 postcss-pxtorem 转换范围内（src/modules/h5-mall/），直接写 828 设计稿 px。
// 视觉 token 由外壳 views/shell.vue 的 .vv-h5-mall 根提供（--mall-* 继承）
.#{$BEM_PREFIX}-h5-mall-orders {
  padding: 32px 32px 0;
  font-family: var(--mall-font-body);
  font-size: 30px;
  line-height: 1.6;
  color: var(--mall-ink-1);

  &__loading,
  &__error,
  &__empty {
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

  &__price {
    flex: none;
    font-variant-numeric: tabular-nums;
    color: var(--mall-ink-1);
  }

  &__foot {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 24px;
    padding-top: 24px;
    border-top: 1px solid var(--mall-line);
  }

  &__time {
    margin-right: auto;
    font-size: 24px;
    color: var(--mall-ink-3);
  }

  &__amount {
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
}
</style>
