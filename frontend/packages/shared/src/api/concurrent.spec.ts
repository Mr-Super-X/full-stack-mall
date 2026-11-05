/**
 * 并发请求调度器测试：覆盖方案确认的边界清单——
 * 空数组短路 / limit 归一 / 并发峰值 / 结果保序 / 失败不中断 / 同步抛错 /
 * retry 集成 / onProgress 语义 / 预取消与运行中取消。
 */
import { describe, it, expect, vi } from 'vitest'
import { runConcurrent } from './concurrent'
import type { ConcurrentTaskResult } from './concurrent'

/** 断言指定结果为 rejected 并返回 reason（集中断言语义 + 顺带完成可辨识联合 narrow） */
function expectRejected<R>(result: ConcurrentTaskResult<R> | undefined): unknown {
  expect(result?.status).toBe('rejected')
  if (result?.status !== 'rejected') throw new Error('unreachable: expected rejected')
  return result.reason
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 手动门闩：控制异步任务的放行时机 */
function deferred<T = void>() {
  let resolve!: (value: T) => void
  let reject!: (err: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('runConcurrent：输入边界', () => {
  it('空数组：立即 resolve []，不调用 task / onProgress', async () => {
    const task = vi.fn()
    const onProgress = vi.fn()
    await expect(runConcurrent([], task, { onProgress })).resolves.toEqual([])
    expect(task).not.toHaveBeenCalled()
    expect(onProgress).not.toHaveBeenCalled()
  })

  it.each([[0], [-1], [NaN], [Infinity]])(
    '非法 limit=%s 归一为 1（串行执行）',
    async (badLimit) => {
      let running = 0
      let peak = 0
      await runConcurrent(
        [1, 2, 3],
        async () => {
          running += 1
          peak = Math.max(peak, running)
          await sleep(3)
          running -= 1
        },
        { limit: badLimit }
      )
      expect(peak).toBe(1)
    }
  )

  it('limit 小数向下取整（2.9 → 并发 2）', async () => {
    let running = 0
    let peak = 0
    await runConcurrent(
      [1, 2, 3],
      async () => {
        running += 1
        peak = Math.max(peak, running)
        await sleep(3)
        running -= 1
      },
      { limit: 2.9 }
    )
    expect(peak).toBe(2)
  })

  it('默认 limit=3：8 任务峰值并发恰为 3', async () => {
    let running = 0
    let peak = 0
    const items = Array.from({ length: 8 }, (_, i) => i)
    await runConcurrent(items, async () => {
      running += 1
      peak = Math.max(peak, running)
      await sleep(3)
      running -= 1
    })
    expect(peak).toBe(3)
  })

  it('任务数小于 limit：全部同时启动', async () => {
    let running = 0
    let peak = 0
    await runConcurrent(
      [1, 2],
      async () => {
        running += 1
        peak = Math.max(peak, running)
        await sleep(3)
        running -= 1
      },
      { limit: 10 }
    )
    expect(peak).toBe(2)
  })
})

describe('runConcurrent：结果语义', () => {
  it('结果保序：完成乱序时仍按输入索引对齐', async () => {
    const items = ['a', 'b', 'c', 'd', 'e']
    const results = await runConcurrent(
      items,
      async (_item, index) => {
        // 索引越小延迟越大 → 完成顺序 e,d,c,b,a
        await sleep((5 - index) * 8)
        return index * 100
      },
      { limit: 5 }
    )

    expect(results.map((r) => r.index)).toEqual([0, 1, 2, 3, 4])
    const values = results.map((r) => (r.status === 'fulfilled' ? r.value : undefined))
    expect(values).toEqual([0, 100, 200, 300, 400])
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true)
  })

  it('单任务失败不中断：rejected 保因，其余任务继续执行', async () => {
    const boom = new Error('shard-2-fail')
    const results = await runConcurrent(
      [10, 20, 30],
      async (item) => {
        if (item === 20) throw boom
        return item * 2
      },
      { limit: 2 }
    )

    expect(results[0]).toEqual({ status: 'fulfilled', value: 20, index: 0 })
    expect(expectRejected(results[1])).toBe(boom)
    expect(results[2]).toEqual({ status: 'fulfilled', value: 60, index: 2 })
  })

  it('全部失败 → 全部 rejected，队列跑完', async () => {
    const task = vi.fn().mockRejectedValue(new Error('always-fail'))
    const results = await runConcurrent([1, 2, 3], task, { limit: 2 })
    expect(results.every((r) => r.status === 'rejected')).toBe(true)
    expect(task).toHaveBeenCalledTimes(3)
  })

  it('task 同步抛错按 rejected 捕获（不中断队列）', async () => {
    const results = await runConcurrent([1, 2], (item) => {
      if (item === 1) throw new Error('sync-boom')
      return Promise.resolve('ok')
    })

    expect((expectRejected(results[0]) as Error).message).toBe('sync-boom')
    expect(results[1]).toEqual({ status: 'fulfilled', value: 'ok', index: 1 })
  })
})

describe('runConcurrent：retry 集成', () => {
  it('retry>0 时失败 N 次后成功 → fulfilled', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('net-flap')).mockResolvedValueOnce('ok')
    const results = await runConcurrent(['a'], fn, { retry: 2, retryDelay: 1 })
    expect(results[0]).toEqual({ status: 'fulfilled', value: 'ok', index: 0 })
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('retry 耗尽 → rejected，调用次数 = 1 + retry', async () => {
    const err = new Error('always-fail')
    const fn = vi.fn().mockRejectedValue(err)
    const results = await runConcurrent(['a'], fn, { retry: 1, retryDelay: 1 })
    expect(expectRejected(results[0])).toBe(err)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('retry 默认 0：失败一次即 rejected，不重试', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('once'))
    const results = await runConcurrent(['a'], fn)
    expect(results[0]?.status).toBe('rejected')
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

describe('runConcurrent：onProgress', () => {
  it('每个任务 settle 后累计回调 1..total', async () => {
    const calls: Array<[number, number]> = []
    await runConcurrent([1, 2, 3], async () => 'ok', {
      onProgress: (done, total) => calls.push([done, total]),
    })
    expect(calls).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ])
  })

  it('回调异常响亮传播并中断队列（未启动任务不再执行）', async () => {
    const task = vi.fn().mockResolvedValue('ok')
    const onProgress = vi.fn(() => {
      throw new Error('callback-bug')
    })
    await expect(runConcurrent([1, 2, 3], task, { limit: 1, onProgress })).rejects.toThrow(
      'callback-bug'
    )
    expect(task).toHaveBeenCalledTimes(1)
  })
})

describe('runConcurrent：异构任务组合（非分片场景）', () => {
  it('闭包数组自由组合不同请求：结果按索引保序取回', async () => {
    // 模拟三个形态各异的上游调用（不同返回类型、不同完成时序）
    // 显式标注联合类型：异构返回的公共超类型（TS 数组字面量推断以首个元素为准）
    const thunks: ReadonlyArray<() => Promise<{ kind: 'profile' } | string[] | number>> = [
      async () => {
        await sleep(15)
        return { kind: 'profile' as const }
      },
      async () => {
        await sleep(1)
        return ['order-1'] as string[]
      },
      async () => {
        await sleep(8)
        return 42
      },
    ]
    const results = await runConcurrent(thunks, (t) => t(), { limit: 3 })

    // 完成时序乱（延迟不同），但结果按输入索引对齐
    const values = results.map((r) => (r.status === 'fulfilled' ? r.value : undefined))
    expect(values[0]).toEqual({ kind: 'profile' })
    expect(values[1]).toEqual(['order-1'])
    expect(values[2]).toBe(42)
    expect(results.map((r) => r.index)).toEqual([0, 1, 2])
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true)
  })

  it('异构任务中单个失败不拖垮其余（rejected 保因）', async () => {
    const boom = new Error('order-api-down')
    // 显式标注 thunk 联合类型：TS 数组字面量推断以首个元素为准，异构返回需手动收窄公共超类型
    const thunks: ReadonlyArray<() => Promise<string | number>> = [
      () => Promise.resolve('profile-ok'),
      () => Promise.reject(boom),
      () => Promise.resolve(42),
    ]
    const results = await runConcurrent(thunks, (t) => t(), { limit: 2 })

    expect(results[0]).toEqual({ status: 'fulfilled', value: 'profile-ok', index: 0 })
    expect(expectRejected(results[1])).toBe(boom)
    expect(results[2]).toEqual({ status: 'fulfilled', value: 42, index: 2 })
  })
})

describe('runConcurrent：取消', () => {
  it('预取消：零启动即 reject，task 一次都不调用', async () => {
    const ctrl = new AbortController()
    ctrl.abort('用户取消')
    const task = vi.fn()
    await expect(runConcurrent([1, 2], task, { signal: ctrl.signal })).rejects.toThrow('用户取消')
    expect(task).not.toHaveBeenCalled()
  })

  it('运行中取消：关闭闸门，未启动任务不再执行，整体 reject', async () => {
    const ctrl = new AbortController()
    const started: number[] = []
    const gate = deferred()
    const task = vi.fn(async (_item: number, index: number) => {
      started.push(index)
      if (started.length === 1) {
        // 第一个任务启动后立即取消，并挂住自己模拟长任务
        ctrl.abort()
        await gate.promise
      }
      return index
    })

    // limit=2 双 worker：取消时两个 worker 都会被闸门拒绝（各自抛 AbortError），
    // 实现若用 Promise.all 替代 allSettled，后置 worker 的 rejection 将成为
    // unhandled rejection 被 vitest 判失败——本用例兼作该回归防护
    const promise = runConcurrent([10, 20, 30, 40], task, { limit: 2, signal: ctrl.signal })
    await vi.waitFor(() => expect(started).toHaveLength(1))
    gate.resolve()
    await expect(promise).rejects.toThrow()
    // 闸门语义：索引 0/1 已被领取（时序不定），2/3 绝不允许启动
    expect(started).not.toContain(2)
    expect(started).not.toContain(3)
    expect(task.mock.calls.length).toBeLessThanOrEqual(2)
  })

  it('取消发生在末任务运行期间：任务跑完后整体仍 reject（末道闸门回归）', async () => {
    const ctrl = new AbortController()
    const task = vi.fn(async (_item: number, index: number) => {
      if (index === 0) ctrl.abort() // 唯一任务运行中取消；task 不响应 signal，会正常跑完
      await sleep(5)
      return index
    })
    // limit=1 单任务：worker 在任务完成后由 while 条件退出、不再经过循环顶部闸门——
    // 修复前此处会正常 resolve（取消被静默吞掉），修复后必须 reject
    await expect(runConcurrent([1], task, { limit: 1, signal: ctrl.signal })).rejects.toThrow()
    expect(task).toHaveBeenCalledTimes(1)
  })
})
