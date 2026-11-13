import { h5SearchApi } from '../apis/search'

/**
 * 搜索联想 composable：输入词防抖 300ms 拉 suggest，输入态内不打断主搜索流程。
 *
 * 失败静默（联想是增强体验，非正确性关卡——与 hotWords 失败处理同风格）；
 * 空词/停用（非输入态）立即清空不查库。timer 在重跑/卸载前清理。
 */
export function useSearchSuggest(keyword: Ref<string>, enabled: Ref<boolean>) {
  const suggestions = ref<string[]>([])

  watchEffect((onCleanup) => {
    const kw = keyword.value.trim()
    const active = enabled.value
    if (!active || !kw) {
      suggestions.value = []
      return
    }
    const timer = setTimeout(() => {
      h5SearchApi
        .suggest(kw)
        .then((words) => {
          // 只回写当前仍匹配的词：防抖期间用户已继续输入/退出输入态时丢弃过期响应
          if (enabled.value && keyword.value.trim() === kw) {
            suggestions.value = words
          }
        })
        .catch(() => {
          suggestions.value = []
        })
    }, 300)
    onCleanup(() => clearTimeout(timer))
  })

  return { suggestions }
}
