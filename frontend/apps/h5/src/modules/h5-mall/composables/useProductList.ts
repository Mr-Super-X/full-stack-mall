import type { MallGoodsItem, MallListParams } from '../apis/index'
import { h5MallApi } from '../apis/index'

/**
 * 商品分页列表 composable：拉取 /mall/product/list。
 *
 * 三态显式处理（frontend.md §1.1）；关键词/筛选变化时自动重置到第一页重新拉取。
 * 分页走 http.ts 的 usePageAdapter（自动抽 page/pageSize 注入后端查询参数）。
 * 页码内部管理：筛选变化时重置为 1，避免 loadMore 用旧页码跳页丢数据。
 */
export function useProductList(params: {
  keyword?: Ref<string>
  categoryId?: Ref<number | undefined>
  sort?: Ref<MallListParams['sort']>
  discountOnly?: Ref<boolean | undefined>
}) {
  const list = ref<MallGoodsItem[]>([])
  const total = ref(0)
  const loading = ref(false)
  const error = ref<Error | null>(null)
  const isEmpty = computed(() => !loading.value && !error.value && list.value.length === 0)
  /** 当前页码（内部管理：筛选变化时重置为 1，避免 loadMore 用旧页码跳页丢数据） */
  const page = ref(1)

  async function load(targetPage: number): Promise<void> {
    return loadWithParams(
      targetPage,
      params.keyword?.value,
      params.categoryId?.value,
      params.sort?.value
    )
  }

  async function loadWithParams(
    targetPage: number,
    keyword?: string,
    categoryId?: number,
    sort?: MallListParams['sort']
  ): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const result = await h5MallApi.getList({
        page: targetPage,
        pageSize: 10,
        keyword,
        categoryId,
        sort,
        discountOnly: params.discountOnly?.value,
      })
      if (targetPage === 1) {
        list.value = result.list
        page.value = 1
      } else {
        // 分页追加（loadMore 场景）
        list.value = [...list.value, ...result.list]
        page.value = targetPage
      }
      total.value = result.total
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err))
    } finally {
      loading.value = false
    }
  }

  // 关键词/筛选变化：重置到第一页重新拉取（page 同步重置，避免 loadMore 用旧页码）
  // 用 watchEffect 自动追踪依赖（替代 watch：setup 同步上下文中 watch 数组 source 会初始触发一次，
  // watchEffect 的语义更贴合"依赖变化即重拉"）
  watchEffect(() => {
    // 读取依赖（触发追踪）
    const keyword = params.keyword?.value
    const categoryId = params.categoryId?.value
    const sort = params.sort?.value
    // 重置页码并拉取（初始执行 + 依赖变化时都会触发）
    page.value = 1
    void loadWithParams(1, keyword, categoryId, sort)
  })

  return { list, total, loading, error, isEmpty, load, loadMore: (page: number) => load(page), page }
}
