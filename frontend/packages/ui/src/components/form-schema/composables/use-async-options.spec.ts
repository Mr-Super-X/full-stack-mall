import { describe, it, expect, vi } from 'vitest'
import { ref, nextTick } from 'vue'
import { useAsyncOptions, buildAutocompleteFetcher } from './use-async-options'
import type { SchemaNode } from '../types'

describe('useAsyncOptions', () => {
  it('calls source immediately by default and stores transformed data', async () => {
    const node: SchemaNode = {
      component: 'Select',
      asyncOptions: {
        source: async () => [
          { id: 1, name: 'A' },
          { id: 2, name: 'B' },
        ],
        transform: (raw) =>
          (raw as Array<{ id: number; name: string }>).map((item) => ({
            label: item.name,
            value: item.id,
          })),
      },
    }
    const model = ref({})
    const state = useAsyncOptions(node, model)
    expect(state.loading.value).toBe(true)
    await nextTick()
    await new Promise((r) => setTimeout(r, 0))
    expect(state.loading.value).toBe(false)
    expect(state.data.value).toEqual([
      { label: 'A', value: 1 },
      { label: 'B', value: 2 },
    ])
  })

  it('does not call source when immediate is false', () => {
    const source = vi.fn().mockResolvedValue([])
    const node: SchemaNode = {
      component: 'Select',
      asyncOptions: { source, immediate: false },
    }
    const model = ref({})
    useAsyncOptions(node, model)
    expect(source).not.toHaveBeenCalled()
  })

  it('re-fetches when deps change', async () => {
    const source = vi.fn().mockImplementation(() => Promise.resolve([{ label: 'x', value: 1 }]))
    const node: SchemaNode = {
      component: 'Select',
      asyncOptions: { source, deps: 'category' },
    }
    const model = ref({ category: 'a' })
    useAsyncOptions(node, model)
    await nextTick()
    await new Promise((r) => setTimeout(r, 0))
    expect(source).toHaveBeenCalledTimes(1)
    model.value.category = 'b'
    await nextTick()
    await new Promise((r) => setTimeout(r, 0))
    expect(source).toHaveBeenCalledTimes(2)
  })

  it('calls onError when source rejects', async () => {
    const onError = vi.fn()
    const node: SchemaNode = {
      component: 'Select',
      asyncOptions: {
        source: async () => {
          throw new Error('network')
        },
        onError,
      },
    }
    const model = ref({})
    const state = useAsyncOptions(node, model)
    await nextTick()
    await new Promise((r) => setTimeout(r, 0))
    expect(state.error.value).toBeInstanceOf(Error)
    expect(onError).toHaveBeenCalledWith(expect.any(Error))
  })
})

describe('useAsyncOptions / 竞态防护（② 回归）', () => {
  it('乱序返回时旧响应被丢弃（序号令牌）', async () => {
    // 第一次请求慢、第二次快 —— 旧响应后返回也不得覆盖新数据
    let resolveFirst!: (v: string[]) => void
    const first = new Promise<string[]>((r) => {
      resolveFirst = r
    })
    let call = 0
    const node: SchemaNode = {
      component: 'Select',
      asyncOptions: {
        deps: 'city',
        source: () => {
          call++
          return call === 1 ? first : Promise.resolve(['new'])
        },
      },
    }
    const model = ref({ city: 'a' })
    const state = useAsyncOptions(node, model)
    // 改 deps 触发第二次请求（快，立即 resolve）
    model.value.city = 'b'
    await nextTick()
    await new Promise((r) => setTimeout(r, 0))
    expect(call).toBe(2)
    expect(state.data.value).toEqual(['new'])
    // 第一次（旧）后返回 —— 应被丢弃
    resolveFirst(['old'])
    await new Promise((r) => setTimeout(r, 0))
    expect(state.data.value).toEqual(['new'])
  })

  it('stop() 后在途响应不再写入 state', async () => {
    let resolveReq!: (v: string[]) => void
    const pending = new Promise<string[]>((r) => {
      resolveReq = r
    })
    const node: SchemaNode = { component: 'Select', asyncOptions: { source: () => pending } }
    const state = useAsyncOptions(node, ref({}))
    state.stop()
    resolveReq(['x'])
    await new Promise((r) => setTimeout(r, 0))
    expect(state.data.value).toEqual([])
  })
})

describe('buildAutocompleteFetcher / B2 竞态令牌（docs/audit/2026-10-15 xform#8）', () => {
  function deferredSource() {
    const resolvers: Array<{ resolve: (v: unknown) => void; reject: (e: unknown) => void }> = []
    const source = vi.fn(
      () =>
        new Promise((resolve, reject) => {
          resolvers.push({ resolve, reject })
        })
    )
    return { source, resolvers }
  }

  it('快速连续查询：旧查询慢响应后返回不得覆盖新结果（过期 cb 不触发）', async () => {
    const { source, resolvers } = deferredSource()
    const fetcher = buildAutocompleteFetcher({ source })
    const cbA = vi.fn()
    const cbAB = vi.fn()

    fetcher('a', cbA) // 第 1 次查询（慢）
    fetcher('ab', cbAB) // 第 2 次查询（新）

    // 新查询先返回 → 新结果落地
    resolvers[1]!.resolve([{ value: 'new-result' }])
    await new Promise((r) => setTimeout(r, 0))
    expect(cbAB).toHaveBeenCalledWith([{ value: 'new-result' }])

    // 旧查询后返回（过期）→ 不得调 cb（修复前会把旧结果刷进下拉）
    resolvers[0]!.resolve([{ value: 'stale-result' }])
    await new Promise((r) => setTimeout(r, 0))
    expect(cbA).not.toHaveBeenCalled()
  })

  it('最新查询 reject → onError + cb([])；过期 reject 静默（不 onError 不 cb）', async () => {
    const { source, resolvers } = deferredSource()
    const onError = vi.fn()
    const fetcher = buildAutocompleteFetcher({ source, onError })
    const cbA = vi.fn()
    const cbAB = vi.fn()

    fetcher('a', cbA)
    fetcher('ab', cbAB)

    // 旧查询后 reject（过期）→ 静默
    resolvers[0]!.reject(new Error('stale boom'))
    await new Promise((r) => setTimeout(r, 0))
    expect(onError).not.toHaveBeenCalled()
    expect(cbA).not.toHaveBeenCalled()

    // 新查询 reject → onError + cb([]) 正常落地
    resolvers[1]!.reject(new Error('latest boom'))
    await new Promise((r) => setTimeout(r, 0))
    expect(onError).toHaveBeenCalledTimes(1)
    expect(cbAB).toHaveBeenCalledWith([])
  })
})
