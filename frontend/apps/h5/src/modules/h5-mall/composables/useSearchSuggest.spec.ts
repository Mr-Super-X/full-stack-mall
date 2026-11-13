import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

// mock 说明符与 useSearchSuggest 的 import 路径一致（§1.6.2 语义路径同步）
vi.mock('../apis/search', () => ({
  h5SearchApi: {
    suggest: vi.fn(),
  },
}))

import { h5SearchApi } from '../apis/search'
import { useSearchSuggest } from './useSearchSuggest'

describe('useSearchSuggest', () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('输入词防抖 300ms 后拉联想并回写', async () => {
    vi.useFakeTimers()
    vi.mocked(h5SearchApi.suggest).mockResolvedValue(['法式连衣裙'])

    const keyword = ref('')
    const enabled = ref(true)
    const { suggestions } = useSearchSuggest(keyword, enabled)

    keyword.value = '连衣裙'
    await vi.advanceTimersByTimeAsync(300)
    await vi.waitFor(() => expect(suggestions.value).toEqual(['法式连衣裙']))
    expect(h5SearchApi.suggest).toHaveBeenCalledWith('连衣裙')
  })

  it('防抖窗内连续输入：只以末值发起一次请求', async () => {
    vi.useFakeTimers()
    vi.mocked(h5SearchApi.suggest).mockResolvedValue([])

    const keyword = ref('')
    const enabled = ref(true)
    useSearchSuggest(keyword, enabled)

    keyword.value = '连'
    await vi.advanceTimersByTimeAsync(100)
    keyword.value = '连衣'
    await vi.advanceTimersByTimeAsync(100)
    keyword.value = '连衣裙'
    await vi.advanceTimersByTimeAsync(300)

    expect(h5SearchApi.suggest).toHaveBeenCalledTimes(1)
    expect(h5SearchApi.suggest).toHaveBeenCalledWith('连衣裙')
  })

  it('空词/退出输入态：清空联想且不查库', async () => {
    vi.useFakeTimers()
    const keyword = ref('')
    const enabled = ref(true)
    const { suggestions } = useSearchSuggest(keyword, enabled)

    // 初始空词：不查库
    await vi.advanceTimersByTimeAsync(300)
    expect(h5SearchApi.suggest).not.toHaveBeenCalled()

    // 有词：防抖后查一次
    keyword.value = '连衣裙'
    await vi.advanceTimersByTimeAsync(300)
    expect(h5SearchApi.suggest).toHaveBeenCalledTimes(1)

    // 清空：联想立即清空，且不再产生新请求
    keyword.value = ''
    expect(suggestions.value).toEqual([])
    await vi.advanceTimersByTimeAsync(300)
    expect(h5SearchApi.suggest).toHaveBeenCalledTimes(1)

    // 退出输入态：联想清空
    keyword.value = '风衣'
    enabled.value = false
    expect(suggestions.value).toEqual([])
  })

  it('过期响应不回写：防抖期间输入已变化时丢弃旧结果', async () => {
    vi.useFakeTimers()
    let resolveFirst: (words: string[]) => void = () => {}
    vi.mocked(h5SearchApi.suggest).mockImplementationOnce(
      () => new Promise<string[]>((r) => (resolveFirst = r)),
    ).mockResolvedValue(['真丝连衣裙'])

    const keyword = ref('连衣')
    const enabled = ref(true)
    const { suggestions } = useSearchSuggest(keyword, enabled)

    await vi.advanceTimersByTimeAsync(300) // 发出第 1 次请求（未 resolve）
    keyword.value = '连衣裙'
    await vi.advanceTimersByTimeAsync(300) // 第 2 次请求 resolve
    await vi.waitFor(() => expect(suggestions.value).toEqual(['真丝连衣裙']))

    // 第 1 次请求此刻才 resolve：不得覆盖当前联想
    resolveFirst(['过期词'])
    await vi.advanceTimersByTimeAsync(0)
    expect(suggestions.value).toEqual(['真丝连衣裙'])
  })

  it('请求失败静默：联想清空不抛错', async () => {
    vi.useFakeTimers()
    vi.mocked(h5SearchApi.suggest).mockRejectedValue(new Error('network'))

    const keyword = ref('连衣裙')
    const enabled = ref(true)
    const { suggestions } = useSearchSuggest(keyword, enabled)

    await vi.advanceTimersByTimeAsync(300)
    await vi.advanceTimersByTimeAsync(0)
    expect(suggestions.value).toEqual([])
  })
})
