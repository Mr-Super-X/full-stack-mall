import type { MallGoodsItem, MallListParams } from '../apis/index'
import { h5MallApi } from '../apis/index'
import { h5SearchApi } from '../apis/search'

/**
 * 商品分页列表 composable：拉取 /mall/product/list。
 *
 * 三态显式处理（frontend.md §1.1）；筛选参数变化防抖 300ms 后重置第一页重拉（首次立即执行，
 * 防抖期间旧数据保留不闪骨架——P0-2：输入/切筛选逐字符/逐次点击不再逐请求）。
 * 分页走 http.ts 的 usePageAdapter（自动抽 page/pageSize 注入后端查询参数）。
 * 页码内部管理：筛选变化时重置为 1，避免 loadMore 用旧页码跳页丢数据。
 * 搜索埋点：keyword 查询成功即上报 resultCount（失败/空词不上报）；失败静默不阻塞列表。
 */
export function useProductList(params: {
  keyword?: Ref<string>
  categoryId?: Ref<number | undefined>
  sort?: Ref<MallListParams['sort']>
  discountOnly?: Ref<boolean | undefined>
  conditionGrade?: Ref<MallListParams['conditionGrade']>
  priceMin?: Ref<number | undefined>
  priceMax?: Ref<number | undefined>
}) {
  const list = ref<MallGoodsItem[]>([])
  const total = ref(0)
  const loading = ref(false)
  const error = ref<Error | null>(null)
  const isEmpty = computed(() => !loading.value && !error.value && list.value.length === 0)
  /** 当前页码（内部管理：筛选变化时重置为 1，避免 loadMore 用旧页码跳数据） */
  const page = ref(1)

  async function load(targetPage: number): Promise<void> {
    return loadWithParams(
      targetPage,
      params.keyword?.value,
      params.categoryId?.value,
      params.sort?.value,
      params.conditionGrade?.value,
      params.priceMin?.value,
      params.priceMax?.value
    )
  }

  async function loadWithParams(
    targetPage: number,
    keyword?: string,
    categoryId?: number,
    sort?: MallListParams['sort'],
    conditionGrade?: MallListParams['conditionGrade'],
    priceMin?: number,
    priceMax?: number
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
        conditionGrade,
        priceMin,
        priceMax,
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
      // 搜索埋点：仅关键词查询成功上报（带结果数）；埋点失败静默（日志型接口）
      if (targetPage === 1 && keyword?.trim()) {
        void h5SearchApi.track({ keyword: keyword.trim(), resultCount: result.total }).catch(() => {})
      }
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err))
    } finally {
      loading.value = false
    }
  }

  // 筛选参数变化 → 防抖 300ms 重置第一页重拉（首次立即执行）。
  // watchEffect 自动追踪依赖；onCleanup 在重跑/卸载前清掉未触发的防抖 timer，防卸载后 setState。
  const DEBOUNCE_MS = 300
  let firstRun = true
  watchEffect((onCleanup) => {
    // 读取依赖（触发追踪）
    const keyword = params.keyword?.value
    const categoryId = params.categoryId?.value
    const sort = params.sort?.value
    const conditionGrade = params.conditionGrade?.value
    const priceMin = params.priceMin?.value
    const priceMax = params.priceMax?.value

    const run = (): void => {
      page.value = 1
      void loadWithParams(1, keyword, categoryId, sort, conditionGrade, priceMin, priceMax)
    }
    if (firstRun) {
      firstRun = false
      run()
      return
    }
    const timer = setTimeout(run, DEBOUNCE_MS)
    onCleanup(() => clearTimeout(timer))
  })

  return { list, total, loading, error, isEmpty, load, loadMore: (page: number) => load(page), page }
}
