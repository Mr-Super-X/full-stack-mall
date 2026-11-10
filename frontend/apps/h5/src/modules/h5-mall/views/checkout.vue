<script setup lang="ts">
/**
 * 结算页：地址选择/新建 + 商品清单确认 + 提交订单 + FakeProvider 收银台支付闭环。
 *
 * 入口两种（query 驱动，经 router.push 带参——pushWithTitle 因 useI18n 仅限 setup 顶层）：
 * - mode=CART&ids=1,2    购物车结算（清单从 cart list 过滤，金额合计）
 * - mode=DIRECT&itemId&title&price  寄卖直购（清单从 query 展示，quantity 恒 1）
 *
 * 支付闭环：createOrder（后端已建 CREATED 支付单）→ startPay 换收银台 payUrl →
 * window.open 收银台（新窗口，用户在收银台点「完成支付」）→ 本页轮询 payStatus
 * 至 SUCCESS/FAILED → SUCCESS 跳订单页。轮询定时器在组件卸载时清理。
 */
import MallToast from '../components/MallToast.vue'
import { useCart } from '../composables/useCart'
import { useCheckout } from '../composables/useCheckout'
import { useToast } from '../composables/useToast'
import { useCartBadgeStore } from '../store/cart'
import { h5AddressApi } from '../apis/address'
import { h5SeckillApi } from '../apis/seckill'
import { useSeckillOrderPolling } from '../composables/useSeckillOrderPolling'

const bem = createNamespace('h5-mall-checkout')

const route = useRoute()
const { replaceByName } = useAppRouter()

/** 结算模式与入参（route.query 读取，props:true 不适配 query 场景） */
const mode = computed(() => (route.query.mode === 'DIRECT' ? 'DIRECT' : 'CART'))
const cartIds = computed(() => String(route.query.ids ?? '').split(',').map(Number).filter(Boolean))
const directItem = computed(() => ({
  productItemId: Number(route.query.itemId ?? 0),
  title: String(route.query.title ?? '寄卖商品'),
  price: Number(route.query.price ?? 0),
}))
/** 秒杀模式：detail 携 seckillActivityId 进入，提交改调秒杀下单接口（后端七步事务） */
const seckillActivityId = computed(() =>
  route.query.seckillActivityId ? Number(route.query.seckillActivityId) : null
)

const { addresses, loading, defaultAddress, loadAddresses, createOrder, startPay, pollPayStatus } =
  useCheckout()
const { list: cartList, load: loadCart } = useCart()
const { visible, message, show } = useToast()
const badge = useCartBadgeStore()

/** CART 模式清单与金额 */
const cartItems = computed(() => (cartList.value ?? []).filter((r) => cartIds.value.includes(r.id)))
const total = computed(() =>
  mode.value === 'CART'
    ? cartItems.value.reduce((s, r) => s + r.price * r.quantity, 0)
    : directItem.value.price,
)

/** 地址选择弹层 */
const showAddressSheet = ref(false)
const selectedAddressId = ref<number | null>(null)
const selectedAddress = computed(
  () => addresses.value?.find((a) => a.id === selectedAddressId.value) ?? defaultAddress.value,
)

/** 新建地址内联表单 */
const showAddressForm = ref(false)
const addressForm = ref({ receiverName: '', phone: '', province: '', city: '', district: '', detail: '' })
const savingAddress = ref(false)

/** 提交/支付状态 */
const submitting = ref(false)
/** 等待支付结果中（已跳收银台） */
const paying = ref(false)

let pollTimer: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  if (mode.value === 'CART') await loadCart()
  // 地址可能为空数组——loadAddresses 已由 useCheckout immediate 触发，这里兜底重拉
  if (!addresses.value) await loadAddresses()
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})

async function saveAddress(): Promise<void> {
  if (savingAddress.value) return
  savingAddress.value = true
  try {
    const created = await h5AddressApi.create({ ...addressForm.value, isDefault: (addresses.value?.length ?? 0) === 0 })
    showAddressForm.value = false
    addressForm.value = { receiverName: '', phone: '', province: '', city: '', district: '', detail: '' }
    await loadAddresses()
    selectedAddressId.value = created.id
  } catch (err: unknown) {
    show(err instanceof Error ? err.message : '保存失败，请重试')
  } finally {
    savingAddress.value = false
  }
}

async function submit(): Promise<void> {
  const addr = selectedAddress.value
  if (!addr) {
    show('请先选择收货地址')
    return
  }
  if (submitting.value) return
  submitting.value = true
  try {
    // 秒杀走独立下单接口（独立池扣减 + 四错误码）；其余走统一 createOrder
    const order = seckillActivityId.value
      ? await h5SeckillApi.placeOrder(seckillActivityId.value, {
          addressId: addr.id,
          productItemId: directItem.value.productItemId,
        })
      : await createOrder(
          mode.value === 'CART'
            ? { addressId: addr.id, source: 'CART', cartItemIds: cartIds.value }
            : { addressId: addr.id, source: 'DIRECT', productItemId: directItem.value.productItemId },
        )
    // 4b：秒杀异步受理（paymentNo 为 null=受理态）→ 轮询出单拿到 paymentNo 再走下方收银台闭环
    if (seckillActivityId.value && !order.paymentNo) {
      show('排队出单中…')
      const polled = await useSeckillOrderPolling(order.orderNo).start()
      if (polled.status === 'CREATED' && polled.paymentNo) {
        order.paymentNo = polled.paymentNo
      } else {
        show(polled.status === 'FAILED' ? '抢购失败，库存已回补' : '出单超时，请至订单页查看')
        return
      }
    }
    if (!order.paymentNo) {
      show('下单成功，但未生成支付单')
      return
    }
    const payUrl = await startPay(order.paymentNo)
    if (!payUrl) {
      show('支付单创建失败')
      return
    }
    // 收银台新窗口打开；本页进入轮询等待
    window.open(payUrl, '_blank')
    paying.value = true
    let ticks = 0
    pollTimer = setInterval(async () => {
      ticks += 1
      try {
        const status = await pollPayStatus(order.paymentNo!)
        if (status === 'SUCCESS') {
          stopPoll()
          show('支付成功')
          await badge.refresh()
          void replaceByName('H5MallOrders')
        } else if (status === 'FAILED' || ticks >= 30) {
          stopPoll()
          show(status === 'FAILED' ? '支付失败，请重试' : '支付超时，请在我的订单继续支付')
        }
      } catch {
        // 单次轮询失败忽略，下一轮继续
      }
    }, 2000)
  } catch (err: unknown) {
    // 4b：40005/40006 走 HTTP 503/429（shared 层状态文案不含业务语义，此处局部特判）
    const code = (err as { code?: number }).code
    if (code === 503) {
      show('秒杀服务暂不可用，请稍后重试')
    } else if (code === 429) {
      show('操作太频繁，请稍后重试')
    } else {
      show(err instanceof Error ? err.message : '下单失败，请重试')
    }
  } finally {
    submitting.value = false
  }
}

function stopPoll(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  paying.value = false
}
</script>

<template>
  <div :class="bem.b()">
    <h2 :class="bem.e('title')">确认订单</h2>

    <!-- 地址区 -->
    <section :class="bem.e('addr')">
      <template v-if="selectedAddress">
        <button type="button" :class="bem.e('addr-card')" @click="showAddressSheet = true">
          <b>{{ selectedAddress.receiverName }} {{ selectedAddress.phone }}</b>
          <p>
            {{ selectedAddress.province }}{{ selectedAddress.city }}{{ selectedAddress.district
            }}{{ selectedAddress.detail }}
          </p>
        </button>
      </template>
      <template v-else-if="!loading">
        <button type="button" :class="bem.e('addr-add')" @click="showAddressForm = true">
          + 添加收货地址
        </button>
      </template>
    </section>

    <!-- 商品清单 -->
    <section :class="bem.e('goods')">
      <template v-if="mode === 'CART'">
        <div v-for="item in cartItems" :key="item.id" :class="bem.e('goods-row')">
          <span :class="bem.e('goods-name')">{{ item.productName }} ×{{ item.quantity }}</span>
          <span>¥{{ item.price * item.quantity }}</span>
        </div>
      </template>
      <div v-else :class="bem.e('goods-row')">
        <span :class="bem.e('goods-name')">{{ directItem.title }} ×1</span>
        <span>¥{{ directItem.price }}</span>
      </div>
    </section>

    <!-- 金额与提交 -->
    <section :class="bem.e('foot')">
      <span :class="bem.e('total')">应付 <b>¥{{ total }}</b></span>
      <van-button round type="primary" :loading="submitting" :disabled="paying" @click="submit">
        {{ paying ? '等待支付结果…' : '提交订单并支付' }}
      </van-button>
    </section>

    <!-- 地址选择弹层 -->
    <van-action-sheet v-model:show="showAddressSheet" title="选择收货地址">
      <div :class="bem.e('sheet')">
        <div
          v-for="addr in addresses ?? []"
          :key="addr.id"
          :class="[bem.e('addr-option'), bem.is('active', addr.id === selectedAddress?.id)]"
          @click=";(selectedAddressId = addr.id), (showAddressSheet = false)"
        >
          <b>{{ addr.receiverName }} {{ addr.phone }}</b>
          <p>{{ addr.province }}{{ addr.city }}{{ addr.district }}{{ addr.detail }}</p>
        </div>
        <van-button block round type="primary" @click="showAddressForm = true">新建地址</van-button>
      </div>
    </van-action-sheet>

    <!-- 新建地址表单弹层 -->
    <van-popup v-model:show="showAddressForm" position="bottom" round>
      <div :class="bem.e('sheet')">
        <h3>新建收货地址</h3>
        <van-field v-model="addressForm.receiverName" label="收货人" placeholder="必填" />
        <van-field v-model="addressForm.phone" label="手机号" placeholder="11 位手机号" />
        <van-field v-model="addressForm.province" label="省份" placeholder="必填" />
        <van-field v-model="addressForm.city" label="城市" placeholder="必填" />
        <van-field v-model="addressForm.district" label="区县" placeholder="必填" />
        <van-field v-model="addressForm.detail" label="详细地址" placeholder="街道门牌号" />
        <van-button
          block
          round
          type="primary"
          :loading="savingAddress"
          :disabled="!addressForm.receiverName || !addressForm.phone || !addressForm.detail"
          @click="saveAddress"
        >
          保存
        </van-button>
      </div>
    </van-popup>

    <MallToast :visible="visible" :message="message" />
  </div>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-h5-mall-checkout {
  padding: 32px;
  font-family: var(--mall-font-body);
  font-size: 30px;
  line-height: 1.6;
  color: var(--mall-ink-1);

  &__title {
    margin: 0 0 24px;
    font-family: var(--mall-font-head);
    font-size: 38px;
  }

  &__addr-card,
  &__addr-add {
    display: block;
    width: 100%;
    margin-bottom: 24px;
    padding: 28px;
    font: inherit;
    text-align: left;
    background: var(--mall-bg-card);
    border: 1px solid var(--mall-line);
    border-radius: var(--mall-r-md);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;

    p {
      margin: 8px 0 0;
      color: var(--mall-ink-2);
    }
  }

  &__goods {
    margin-bottom: 24px;
    padding: 28px;
    background: var(--mall-bg-card);
    border: 1px solid var(--mall-line);
    border-radius: var(--mall-r-md);
  }

  &__goods-row {
    display: flex;
    justify-content: space-between;
    gap: 24px;
    padding: 12px 0;
    font-variant-numeric: tabular-nums;
  }

  &__goods-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  &__foot {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 24px;
    padding: 24px 0 calc(24px + env(safe-area-inset-bottom));
  }

  &__total {
    b {
      font-size: 36px;
      font-variant-numeric: tabular-nums;
      color: var(--mall-brand-deep);
    }
  }

  &__sheet {
    max-height: 70vh;
    overflow-y: auto;
    padding: 32px;
  }

  &__addr-option {
    padding: 24px;
    margin-bottom: 16px;
    border: 1px solid var(--mall-line);
    border-radius: var(--mall-r-sm);
    cursor: pointer;

    &.is-active {
      border-color: var(--mall-brand);
      background: var(--mall-brand-soft);
    }

    p {
      margin: 8px 0 0;
      color: var(--mall-ink-2);
    }
  }
}
</style>
