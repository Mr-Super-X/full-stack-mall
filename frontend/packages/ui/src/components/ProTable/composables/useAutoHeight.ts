/**
 * useAutoHeight —— 表格区自动撑满视口剩余高度（v3.1 新增；v3.1.1 review 优化）。
 *
 * 目标体验（中后台列表页标配）：搜索区 / 工具栏 / 表格 / 分页器整体不超出视口，
 * 表头与分页器固定，中间表体随窗口伸缩滚动。
 *
 * 算法（与 vben-admin useTableHeight 同思路，实测 DOM 而非配置估算）：
 *   maxHeight = 视口高 - 根容器顶部到视口顶距离 - 搜索区高 - 工具栏高 - 分页器高
 *               - 固定间距（36px） - 用户 offset 余量
 *
 * 重算时机：mounted 首测 + window resize + ResizeObserver 监听根容器
 * （侧栏折叠等宽度变化会联动子区域换行高度）。测量不到（jsdom / SSR）时
 * maxHeight 保持 null，ElTable 退回默认全量渲染行为，不影响功能。
 *
 * v3.1.1 review 优化：
 * - 缓存 selector → element 映射（Map），避免每次 measure 重复 querySelector
 * - rAF 同帧去重：ResizeObserver + window resize 在同一帧可能多次触发，
 *   requestAnimationFrame 调度保证只在下一帧重测 1 次
 *
 * @see [`../ProTable.vue`](../ProTable.vue) 编排层 —— 唯一调用方
 * @group ProTable composables
 */
import { ref, watch, nextTick, onScopeDispose, type Ref } from 'vue'

export interface UseAutoHeightOptions {
  /** 是否启用（编排层综合 props.autoHeight 与 virtualized 冲突后传入） */
  enabled: boolean
  /** ProTable 根容器 DOM ref */
  rootEl: Ref<HTMLElement | null>
  /** 附加余量（像素，默认 0）—— AutoHeightConfig.offset，正值让表格更矮 */
  offset?: number
  /**
   * 子区域 BEM 选择器（v3.1.4 review：由编排层注入，替代原硬编码）
   * - search / header 必填：编排层用对应子组件的 `bem.b()` 产出（如 `'.vv-pro-table-search'`）
   * - pagination 选填：element-plus 稳定 class，非 BEM，保留默认 `.el-pagination`
   * 必填而非默认：避免 $BEM_PREFIX 改了 / 子组件块名改了 → 静默失效
   */
  selectors?: {
    /** SearchForm 根 BEM 类（编排层 searchFormBem.b()） */
    search?: string
    /** TableHeader 根 BEM 类（编排层 tableHeaderBem.b()） */
    header?: string
    /** SelectedTags 根 BEM 类（编排层 selectedTagsBem.b()，v3.2 已选条件回显区）——
     * 可选：showSelectedTags 开启时才渲染；2026-09-18 review 修复高度漏算 */
    selectedTags?: string
    /** ElPagination 选择器（element-plus 稳定 class） */
    pagination?: string
    /**
     * SelectionBar 根 BEM 类（编排层 selectionBarBem.b()，2026-09-18 toolbar 设计 D8）——
     * 可选：批量条 v-if 条件挂载，出现时由 ResizeObserver 监听根容器联动重测
     */
    selectionBar?: string
  }
}

export interface UseAutoHeightReturn {
  /** 计算出的表格 max-height；null = 未启用或测量失败（不绑定 prop） */
  maxHeight: Ref<number | null>
}

/** 兄弟区域间距单位 —— ProTable.scss `& > * + * { margin-top: 12px }`。
 * 2026-09-18 review：原 FIXED_MARGIN_TOTAL=36 硬编码「4 区域 3 间距」，v3.2 后兄弟区域
 * 最多 6 个（SearchForm/SelectedTags/TableHeader/SelectionBar/AsyncState/ElPagination），
 * 静态常量导致与 SelectedTags/SelectionBar 同开时 maxHeight 系统性高估、表格溢出视口。
 * 间距总数改为 measure 时按 root 实际渲染子元素数动态计算。 */
const SIBLING_MARGIN = 12
/** 极端窄视口下的高度下限 —— 避免 maxHeight 算出负数/个位数导致表体不可见 */
const MIN_TABLE_HEIGHT = 100

/** 子区域选择器 —— 全部由编排层注入，避免 composable 隐式依赖 $BEM_PREFIX 默认值。
 *
 * v3.1.4 review 重构：
 * - 原 `SEARCH_SELECTOR` / `HEADER_SELECTOR` 硬编码 `.vv-pro-table-search` / `.vv-pro-table-header`，
 *   与 CLAUDE.md §3.2 规则 3「禁止硬编码前缀字符串」冲突。若 $BEM_PREFIX 改了
 *   （如多 theme 打包），选择器会静默失效，maxHeight 测量全错。
 * - 改为编排层通过 `bem.b()` 生成 BEM 字符串后经 options 注入。
 * - element-plus 稳定 class（`.el-pagination`）非 BEM，保留默认值。
 */
/** element-plus 分页器选择器（非 BEM，外部库稳定 class，保留默认值） */
const DEFAULT_PAGINATION_SELECTOR = '.el-pagination'

export function useAutoHeight(options: UseAutoHeightOptions): UseAutoHeightReturn {
  const maxHeight = ref<number | null>(null)
  let resizeObserver: ResizeObserver | null = null
  /** v3.1.1 review：selector → element 缓存 —— measure 高频触发场景避免重复 querySelector */
  const elementCache = new Map<string, HTMLElement>()
  /** v3.1.1 review：rAF 同帧去重句柄 —— ResizeObserver + resize 在同帧可能多次触发 */
  let rafHandle: number | null = null

  /**
   * v3.1.1 review：缓存读取 —— selector → element，未命中或元素已 disconnected 时重查并写入。
   * isConnected 守卫：DOM 树重构（如 v-if 切换）后旧 element 失效，重新 querySelector。
   *
   * 注意：用 truthy 检查替代 `instanceof HTMLElement` —— vitest mockRoot 测试夹具用
   * `as unknown as HTMLElement` cast 但运行时原型链无 HTMLElement.prototype，
   * instanceof 会误判为 false 跳过缓存写入。
   */
  function getCachedElement(root: HTMLElement, selector: string): HTMLElement | undefined {
    const cached = elementCache.get(selector)
    if (cached && cached.isConnected) return cached
    const found = root.querySelector(selector)
    if (found) {
      const el = found as HTMLElement
      elementCache.set(selector, el)
      return el
    }
    return undefined
  }

  /** 实际测量 —— 读缓存 selector → element，累加各子区域高度 */
  function measure(): void {
    const root = options.rootEl.value
    if (!root) return
    const top = root.getBoundingClientRect().top
    // offsetHeight 不含 margin；margin-top 已由 FIXED_MARGIN_TOTAL 统一扣除
    // v3.1.4 review：选择器从 options.selectors 读取，无默认值（避免 BEM 静默失效）
    const searchSel = options.selectors?.search
    const headerSel = options.selectors?.header
    const selectedTagsSel = options.selectors?.selectedTags
    const paginationSel = options.selectors?.pagination ?? DEFAULT_PAGINATION_SELECTOR
    const selectionBarSel = options.selectors?.selectionBar
    const searchH = searchSel
      ? (getCachedElement(root, searchSel)?.getBoundingClientRect().height ?? 0)
      : 0
    const headerH = headerSel
      ? (getCachedElement(root, headerSel)?.getBoundingClientRect().height ?? 0)
      : 0
    // 2026-09-18 review：原实现漏算 SelectedTags（v3.2 起默认开启，约 32px+），
    // autoHeight 与已选条件回显同开时表格底部溢出视口
    const selectedTagsH = selectedTagsSel
      ? (getCachedElement(root, selectedTagsSel)?.getBoundingClientRect().height ?? 0)
      : 0
    const paginationH = getCachedElement(root, paginationSel)?.getBoundingClientRect().height ?? 0
    // SelectionBar 高度：批量条 v-if 挂载/卸载时经 ResizeObserver 联动重测（设计 D8）
    const selectionBarH = selectionBarSel
      ? (getCachedElement(root, selectionBarSel)?.getBoundingClientRect().height ?? 0)
      : 0
    // 间距按 root 实际渲染的子元素数动态算（ColSetting 为 teleport dialog，root 内无元素残留）。
    // `?? 0` 防御与 getCachedElement 同因：vitest mockRoot 夹具运行时无 childElementCount
    const marginTotal = Math.max((root.childElementCount ?? 0) - 1, 0) * SIBLING_MARGIN
    const available =
      window.innerHeight -
      top -
      searchH -
      headerH -
      selectedTagsH -
      paginationH -
      selectionBarH -
      marginTotal -
      (options.offset ?? 0)
    maxHeight.value = Math.max(available, MIN_TABLE_HEIGHT)
  }

  /**
   * v3.1.1 review：rAF 同帧去重 —— 仅在 ResizeObserver 回调中使用。
   * ResizeObserver 在观察循环中可能高频触发（同一帧多次），rAF 调度保证只在下一帧重测 1 次。
   * window.resize 事件本身低频（用户拖窗口），保持直接 measure；首测也保持直接调用以兼容
   * vitest jsdom 环境（rAF 在 jsdom 不会自动 flush，会破坏测试时序）。
   */
  function scheduleMeasure(): void {
    if (typeof requestAnimationFrame === 'undefined') {
      measure()
      return
    }
    if (rafHandle !== null) return
    rafHandle = requestAnimationFrame(() => {
      rafHandle = null
      measure()
    })
  }

  if (options.enabled) {
    // 首测：等子区域渲染完成（SearchForm / TableHeader v-if 会影响 DOM 结构）
    // 保持直接 measure 调用以兼容 vitest jsdom 环境（rAF 在 jsdom 不会自动 flush）
    void nextTick(measure)
    // window.resize 低频（用户拖窗口），直接 measure 即可
    window.addEventListener('resize', measure)
    // typeof 守卫：vitest jsdom 与 SSR 环境不提供 ResizeObserver
    // ResizeObserver 高频（观察循环中可能同帧多次），走 rAF 去重
    if (typeof ResizeObserver !== 'undefined' && options.rootEl.value) {
      resizeObserver = new ResizeObserver(scheduleMeasure)
      resizeObserver.observe(options.rootEl.value)
    }
    // rootEl 是 ref，setup 时可能还未挂载（模板 ref 填充晚于 setup）——watch 兜底
    const stopWatch = watch(
      options.rootEl,
      (el) => {
        if (el && typeof ResizeObserver !== 'undefined') {
          // 根容器变更时清缓存（旧 element 已 disconnected）
          elementCache.clear()
          resizeObserver?.disconnect()
          resizeObserver = new ResizeObserver(scheduleMeasure)
          resizeObserver.observe(el)
        }
      },
      { flush: 'post' }
    )
    onScopeDispose(() => {
      stopWatch()
      window.removeEventListener('resize', measure)
      resizeObserver?.disconnect()
      resizeObserver = null
      elementCache.clear()
      if (rafHandle !== null) {
        cancelAnimationFrame(rafHandle)
        rafHandle = null
      }
    })
  }

  return { maxHeight }
}
