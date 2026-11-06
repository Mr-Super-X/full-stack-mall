// ref / onMounted / onScopeDispose 由 unplugin-auto-import 注入 setup 全局作用域（CLAUDE.md §1.6）

/**
 * 入场渐显：观察 root 下所有 `.rv` 元素，进入视口时加 `.in`（配 CSS transition 完成渐显）。
 *
 * 降级策略（与源 HTML 原型一致）：
 * - 用户开启 prefers-reduced-motion → 直接全部可见，不做位移动效
 * - 环境无 IntersectionObserver（如 jsdom / 老 WebView）→ 直接全部可见
 *
 * 异步内容支持：组件挂载时数据未到（v-if 分支下 .rv 不在 DOM），
 * MutationObserver 监听子树，后插入的 .rv 元素动态加入观察——否则异步区块永远 opacity:0。
 *
 * @param rootRef 模块根元素 ref（挂载后查询其下 `.rv`）
 */
export function useReveal(rootRef: Readonly<Ref<HTMLElement | null>>): void {
  let io: IntersectionObserver | undefined
  let mo: MutationObserver | undefined

  onMounted(() => {
    const root = rootRef.value
    if (!root) return

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
    const noIO = typeof IntersectionObserver === 'undefined'

    /** 已接管的元素（防 MutationObserver 重复 observe） */
    const seen = new WeakSet<HTMLElement>()

    function reveal(el: HTMLElement): void {
      el.classList.add('in')
    }

    function observeEl(el: HTMLElement): void {
      if (seen.has(el)) return
      seen.add(el)
      if (reduced || noIO) {
        reveal(el)
        return
      }
      io!.observe(el)
    }

    if (!reduced && !noIO) {
      io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              reveal(entry.target as HTMLElement)
              io?.unobserve(entry.target)
            }
          }
        },
        { threshold: 0.08 }
      )
    }

    // 挂载时已存在的 .rv（同步渲染区块）
    root.querySelectorAll<HTMLElement>('.rv').forEach(observeEl)

    // 挂载后动态插入的 .rv（异步数据驱动渲染，如 useMallHome 返回后的 v-else 分支）
    mo = new MutationObserver(() => {
      root.querySelectorAll<HTMLElement>('.rv:not(.in)').forEach(observeEl)
    })
    mo.observe(root, { childList: true, subtree: true })
  })

  onScopeDispose(() => {
    io?.disconnect()
    mo?.disconnect()
  })
}
