import type { MallHomeContent } from '../apis/index'
import { h5MallApi } from '../apis/index'

/**
 * 首页聚合内容 composable：拉取 /mall/home/content（公告/banner/分类/限时甄选/新品/推荐）。
 *
 * 返回三态供视图层显式处理（frontend.md §1.1）：
 * - loading: 骨架屏/占位（区分于空态）
 * - error: 错误提示 + 重试按钮
 * - isEmpty: 非 loading 非 error 且 data===null（空态占位 + 下一步引导）
 *
 * 接口非分页（一次性聚合），不传 usePageAdapter；首页刷新频率低，不加内存缓存。
 */
export function useMallHome() {
  const {
    data: home,
    loading,
    error,
    isEmpty,
    refresh,
  } = useRequest<MallHomeContent>(() => h5MallApi.getHome())

  return { home, loading, error, isEmpty, refresh }
}
