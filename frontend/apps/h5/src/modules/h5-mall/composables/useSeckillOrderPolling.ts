import { h5SeckillApi } from '../apis/seckill'

/**
 * 秒杀异步出单轮询（4b）：提交受理（paymentNo=null）后轮询出单状态到终态。
 * 终态：CREATED（携 paymentNo 跳收银台）/ FAILED（死信登记，库存已回补）/ TIMEOUT（本地超时兜底，
 * 受理单可能仍在消费，引导订单页查看不丢单）。单次请求失败静默下轮，卸载自动清理定时器。
 */

/** 轮询状态机：POLLING（进行中）/ 后端三态 / TIMEOUT（本地兜底） */
export type SeckillOrderPollState = 'POLLING' | 'ACCEPTED' | 'CREATED' | 'FAILED' | 'TIMEOUT'

export interface SeckillOrderPollResult {
  status: SeckillOrderPollState
  paymentNo: string | null
}

export function useSeckillOrderPolling(
  orderNo: string,
  opts?: { intervalMs?: number; timeoutMs?: number },
) {
  const intervalMs = opts?.intervalMs ?? 1000
  const timeoutMs = opts?.timeoutMs ?? 15000
  const status = ref<SeckillOrderPollState>('POLLING')
  const paymentNo = ref<string | null>(null)
  let timer: ReturnType<typeof setInterval> | undefined
  /** 挂起的 start Promise resolve（stop 时须以终态收尾，否则页面卸载后 Promise 泄漏——终审 Important-4） */
  let pendingResolve: ((r: SeckillOrderPollResult) => void) | undefined

  const stop = (): void => {
    if (timer) {
      clearInterval(timer)
      timer = undefined
    }
    if (pendingResolve) {
      const r = pendingResolve
      pendingResolve = undefined
      r({ status: 'TIMEOUT', paymentNo: null })
    }
  }

  /** 轮询到终态；Promise 终态快照与 ref 状态同步更新 */
  const start = (): Promise<SeckillOrderPollResult> =>
    new Promise<SeckillOrderPollResult>((resolve) => {
      pendingResolve = resolve
      const deadline = Date.now() + timeoutMs
      const finish = (result: SeckillOrderPollResult): void => {
        pendingResolve = undefined
        status.value = result.status
        paymentNo.value = result.paymentNo
        if (timer) {
          clearInterval(timer)
          timer = undefined
        }
        resolve(result)
      }
      const tick = async (): Promise<void> => {
        if (Date.now() >= deadline) {
          finish({ status: 'TIMEOUT', paymentNo: null })
          return
        }
        try {
          const res = await h5SeckillApi.orderStatus(orderNo)
          if (res.status === 'CREATED') {
            finish({ status: 'CREATED', paymentNo: res.paymentNo })
          } else if (res.status === 'FAILED') {
            finish({ status: 'FAILED', paymentNo: null })
          }
          // ACCEPTED：继续下一轮
        } catch {
          // 单次轮询失败（网络抖动）静默，下一轮继续
        }
      }
      void tick()
      timer = setInterval(() => {
        void tick()
      }, intervalMs)
    })

  onUnmounted(stop)

  return { status, paymentNo, start, stop }
}
