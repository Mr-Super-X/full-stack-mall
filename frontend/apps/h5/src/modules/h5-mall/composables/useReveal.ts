// ref / onMounted / onScopeDispose 由 unplugin-auto-import 注入 setup 全局作用域（CLAUDE.md §1.6）

/**
 * 入场渐显：观察 root 下所有 `.rv` 元素，进入视口时加 `.in`（配 CSS transition 完成渐显）。
 *
 * 降级策略（与源 HTML 原型一致）：
 * - 用户开启 prefers-reduced-motion → 直接全部可见，不做位移动效
 * - 环境无 IntersectionObserver（如 jsdom / 老 WebView）→ 直接全部可见
 *
 * @param rootRef 模块根元素 ref（挂载后查询其下 `.rv`）
 */
export function useReveal(rootRef: Readonly<Ref<HTMLElement | null>>): void {
  let io: IntersectionObserver | undefined

  onMounted(() => {
    const root = rootRef.value
    if (!root) return
    const targets = Array.from(root.querySelectorAll<HTMLElement>('.rv'))

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
    if (reduced || typeof IntersectionObserver === 'undefined') {
      targets.forEach((el) => el.classList.add('in'))
      return
    }

    io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('in')
            io?.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.08 }
    )
    targets.forEach((el) => io!.observe(el))
  })

  onScopeDispose(() => io?.disconnect())
}
