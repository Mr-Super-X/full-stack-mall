// useDict composable 单测（契约形态）
//
// 覆盖：
//   - 按 code 解构出 Ref<DictItem[]>（泛型字面量类型）
//   - Ref 是 computed 视图：store 写入后自动同步
//   - 多 code 一次声明
//   - setup 阶段自动触发 lazy fetch
//   - refreshDict 强制刷新
//   - 加载失败不抛出、Ref 降级为空数组

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('../api/modules/dict.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/modules/dict.ts')>()
  return {
    ...actual,
    dictApi: {
      ...actual.dictApi,
      getDict: vi.fn(),
    },
  }
})

import { dictApi } from '../api/modules/dict.ts'
import { useDictStore } from '../store/modules/dict.ts'
import { useDict } from './useDict'

const mockedGetDict = dictApi.getDict as unknown as ReturnType<typeof vi.fn>

/** flush 一轮微任务 + 定时器，让 fire-and-forget 的 fetch catch 落定 */
function flushFetch(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('useDict', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockedGetDict.mockReset()
    // 默认 resolve 空数组：避免「不关心请求」的用例（如 computed 视图同步）里
    // lazy fetch 拿到 vi.fn() 默认返回值 undefined 而在 .then 链上抛错
    mockedGetDict.mockResolvedValue([])
  })

  it('setup 阶段自动触发 lazy fetch', async () => {
    const data = [{ value: 'a', label: 'A' }]
    mockedGetDict.mockResolvedValueOnce(data)
    const store = useDictStore()

    useDict('user_status')
    await flushFetch()

    expect(mockedGetDict).toHaveBeenCalledWith('user_status')
    expect(store.dicts['user_status']).toEqual(data)
  })

  it('按 code 解构出 Ref，请求完成后持有字典数据', async () => {
    const data = [{ value: 'male', label: '男' }]
    mockedGetDict.mockResolvedValueOnce(data)
    const { gender } = useDict('gender')

    expect(gender.value).toEqual([])
    await flushFetch()
    expect(gender.value).toEqual(data)
  })

  it('Ref 是 computed 视图：store 写入后自动同步', () => {
    const store = useDictStore()
    const { user_status } = useDict('user_status')

    expect(user_status.value).toEqual([])

    store.dicts['user_status'] = [{ value: 'active', label: '启用' }]
    expect(user_status.value).toEqual([{ value: 'active', label: '启用' }])
  })

  it('多 code 一次声明，各自独立响应', async () => {
    mockedGetDict
      .mockResolvedValueOnce([{ value: 'male', label: '男' }])
      .mockResolvedValueOnce([{ value: 'active', label: '启用' }])

    const { gender, user_status } = useDict('gender', 'user_status')
    await flushFetch()

    expect(gender.value).toEqual([{ value: 'male', label: '男' }])
    expect(user_status.value).toEqual([{ value: 'active', label: '启用' }])
    expect(mockedGetDict).toHaveBeenCalledTimes(2)
  })

  it('refreshDict 强制刷新（忽略缓存重新拉取）', async () => {
    const data1 = [{ value: 'a', label: 'A' }]
    const data2 = [{ value: 'a', label: 'A-updated' }]
    mockedGetDict.mockResolvedValueOnce(data1).mockResolvedValueOnce(data2)

    const { order_type, refreshDict } = useDict('order_type')
    await flushFetch()
    expect(order_type.value).toEqual(data1)

    await refreshDict('order_type')
    expect(order_type.value).toEqual(data2)
    expect(mockedGetDict).toHaveBeenCalledTimes(2)
  })

  it('加载失败不抛出，Ref 降级为空数组', async () => {
    mockedGetDict.mockRejectedValueOnce(new Error('network'))
    const { user_status } = useDict('user_status')

    await flushFetch()
    expect(user_status.value).toEqual([])
  })

  it('refreshDict 失败不抛出，降级返回空数组', async () => {
    // 两次调用（lazy fetch + refreshDict）都失败 → 用 mockRejectedValue 而非 Once
    //（Once 会被 setup 阶段的 lazy fetch 抢先消费）
    mockedGetDict.mockRejectedValue(new Error('network'))
    const { refreshDict } = useDict('user_status')

    await flushFetch() // lazy fetch 的 rejection 落定（已被 useDict 内部 catch）
    await expect(refreshDict('user_status')).resolves.toEqual([])
  })
})
