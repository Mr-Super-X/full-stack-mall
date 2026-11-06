import type { MallProductDetail } from '../apis/index'
import { h5MallApi } from '../apis/index'

/**
 * 商品详情 composable：拉取 /mall/product/{id}。
 *
 * 三态显式处理；id 变化时自动重新拉取（路由参数变化场景）。
 * 404（商品不存在/已下架）走 error 态，由视图层跳转 not-found 页——不是空态。
 */
export function useProductDetail(id: Ref<number>) {
  const detail = ref<MallProductDetail | null>(null)
  const loading = ref(false)
  const error = ref<Error | null>(null)
  const isEmpty = computed(() => !loading.value && !error.value && detail.value === null)

  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      detail.value = await h5MallApi.getDetail(id.value)
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err))
      detail.value = null
    } finally {
      loading.value = false
    }
  }

  // id 变化重新拉取
  watch(id, () => {
    void load()
  })

  // 初始加载（不依赖 onMounted，测试环境友好）
  void load()

  return { detail, loading, error, isEmpty, refresh: load }
}
