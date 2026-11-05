<script setup lang="ts" generic="T extends object = Record<string, unknown>">
/**
 * SearchForm —— 自动生成的搜索区（v3.2 重大 UX 升级）
 *
 * 核心职责（v3.2 升级）：
 * 1) 响应式栅格：el-col 加 xs/sm/md 断点
 * 2) 默认折叠 + 展开/收起按钮（文字+图标，平滑过渡动画）
 * 3) 高级筛选 Drawer：level: 'advanced' 字段进 ElDrawer（不挤压表格）
 * 4) searchDisplay 联动显隐
 * 5) 字段级防抖 / searchTrigger 触发时机
 * 6) onChange 钩子（值清空联动：状态改值时清空关联字段）
 * 7) lazyEnum 懒加载标记
 * 8) 展开状态 localStorage 记忆（expandedStatePersist prop）
 *
 * v3.5 PR3：补 generic<T> 透传——原声明落为默认 Record 泛型，
 * ProTable → SearchForm 链上消费方传 `ProColumn<T>` 时 IDE 提示丢失 T。
 *
 * @see [`../composables/useSearch`](../composables/useSearch.ts) 数据源
 * @group ProTable 子组件
 */
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue' // vue（生命周期/底层 API）
import './../styles/element-protable-overwrite.scss' // Element Plus 样式覆盖
import {
  ElForm,
  ElFormItem,
  ElRow,
  ElCol,
  ElOption,
  ElButton,
  ElDrawer,
  ElBadge,
  ElTooltip,
} from 'element-plus' // v3.2 升级：ElDialog → ElDrawer（不挤压表格）
import { Search, Refresh, ArrowUp, ArrowDown, Filter } from '@element-plus/icons-vue'
import type { ProColumn, SearchLayoutMode } from '../types'
import { SearchLevel } from '../types' // v3.2：层级枚举常量
import { SEARCH_CONTROL_MAP } from '../composables/_utils/searchControlRegistry'
import { debounceFn } from '../composables/_utils/debounce'

interface Props {
  columns: ProColumn<T>[]
  searchParams: Record<string, unknown>
  searchRows: number
  /**
   * v3.2 字段联动显隐
   */
  searchDisplay?: (params: Record<string, unknown>) => Record<string, boolean>
  /**
   * v3.2 升级：展开状态 localStorage 持久化（需配合 tableKey）
   * - false（默认）：不持久化
   * - true：刷新 / 跨页操作后保持展开状态
   */
  expandedStatePersist?: boolean
  /** v3.2 升级：localStorage 命名空间（与 useColumns 列设置同一约定） */
  tableKey?: string
  /**
   * v3.4 新增：布局档位 —— 缺省 'auto' 按字段数自动判定；
   * 显式档位跳过自动判定（应对字段数与页面空间不匹配 / searchDisplay 联动
   * 导致字段数动态变化引起档位抖动的真实业务场景）。
   * 存在 advanced 字段时仍强制 drawer（advanced 字段必须可达）。
   */
  searchLayout?: SearchLayoutMode
}
const props = defineProps<Props>()
const emit = defineEmits<{
  search: []
  reset: []
  /** v-model:searchParams 双向绑定（v3.2.2 重构：emit 完整快照而非 Proxy mutate） */
  'update:searchParams': [Record<string, unknown>]
  /**
   * v3.2 升级：清除单个条件事件（用于 SelectedTags 删除某个 tag 时联动）
   * SearchForm 收到此事件后只清该字段 + 触发搜索，不影响其他条件
   */
  clearCondition: [string] // 被清除的字段 prop
  /**
   * v3.2 升级：清除全部条件事件
   */
  clearAllConditions: []
}>()

/**
 * v3.2.2 重构：去掉 Proxy 包装（之前是 `new Proxy(props.searchParams, { set })`）
 *
 * 原 Proxy 模式的问题：
 * 1. Proxy 持有的是「旧 props.searchParams 对象」引用
 * 2. useSearch.updateParams 改为 re-assign 后，searchParams.value 指向「新对象」
 * 3. 但 SearchForm 的 Proxy 仍指向旧对象（Vue setup 只跑一次）
 * 4. 结果：用户输入写入旧对象（被 GC），新对象没有这些值
 * 5. 下游 SelectedTags 读新对象的 props.searchParams（响应式触发），但值是空的
 *
 * 修复：直接 emit 一个新的 searchParams 快照，让父组件统一 re-assign。
 * 局部缓存：localParams 作为 emit 的来源（避免反复 spread props.searchParams）
 */
const localParams = ref<Record<string, unknown>>({ ...props.searchParams })
watch(
  () => props.searchParams,
  (newVal) => {
    // 父组件 re-assign 后同步本地副本（避免 emit 引用旧值）
    localParams.value = { ...newVal }
  }
  // 不加 { deep: true }：useSearch 是唯一生产者，其 API 契约就是 re-assign 新对象引用
  // （见 useSearch.ts updateParams/reset 注释），浅 watch 引用变化已足够捕获全部更新；
  // deep watch 会对整个参数树做递归 traverse，对嵌套值（日期范围数组等）是 O(n) 浪费。
)

const bem = createNamespace('pro-table-search')

/* ─────────── v3.3 升级：4 档自适应布局策略 ─────────── */

/**
 * v3.3 布局策略（基于 basic 字段数 + advanced 字段数动态选档）。
 *
 * 需求文档：
 * - searchConfig.collapsed 默认 true（per-column 字段级折叠控制，类型层已定义）
 * - basic > 3 且 <= 8 → 默认走「内联展开/收起」
 * - columns 中存在 search.level === 'advanced' 字段 → 自动渲染「高级筛选抽屉」
 * - 「展开/收起」与「高级筛选」互斥（动态自适应）
 *
 * 档位矩阵（v3.4 起 searchLayout 可强制指定，缺省 auto 按本矩阵自动判定；
 * advanced 字段存在时永远 drawer，优先级高于强制档位）：
 * | 档位        | basic 范围 | advanced | toggle 按钮 | adv 按钮 | inline form         |
 * |-------------|------------|----------|-------------|----------|---------------------|
 * | flat        | ≤ 3        | 0        | 隐藏        | 隐藏     | 全部 basic 平铺     |
 * | collapse    | 4 ~ 8      | 0        | 显示        | 隐藏     | basic 折叠（前 3）  |
 * | flat-large  | > 8        | 0        | 隐藏        | 隐藏     | 全部 basic 平铺     |
 * | drawer      | 任意       | > 0      | 隐藏        | 显示     | basic 平铺 + 抽屉   |
 *
 * drawer 档位下，basic 字段保持 inline flat（不在抽屉里），
 * 抽屉只承载 advanced 字段（用户确认：basic 仍然走「全平铺无折叠」）。
 */

const COLLAPSED_INLINE_LIMIT = 3 // collapse 档：折叠时主表单只显示前 3 个字段（用户要求：超过 3 个折叠按钮才出现）

/* ─────────── v3.2 升级：展开/收起状态（含 localStorage 持久化） ─────────── */

/**
 * v3.2 升级：localStorage 展开状态读写
 * key = `${tableKey}:search-expanded`
 * tableKey 缺失时不持久化（每次刷新回到默认）
 */
const EXPANDED_STORAGE_KEY = props.tableKey ? `${props.tableKey}:search-expanded` : ''

function readExpandedFromStorage(): boolean | null {
  if (!props.expandedStatePersist || !EXPANDED_STORAGE_KEY) return null
  try {
    const raw = window.localStorage.getItem(EXPANDED_STORAGE_KEY)
    if (raw === '1') return true
    if (raw === '0') return false
    return null
  } catch {
    return null // 隐私模式或存储不可用
  }
}

function writeExpandedToStorage(value: boolean): void {
  if (!props.expandedStatePersist || !EXPANDED_STORAGE_KEY) return
  try {
    window.localStorage.setItem(EXPANDED_STORAGE_KEY, value ? '1' : '0')
  } catch {
    /* 存储不可用时静默降级 */
  }
}

const collapsed = ref<boolean>(readExpandedFromStorage() ?? true) // 默认折叠

function toggleCollapsed(): void {
  collapsed.value = !collapsed.value
  writeExpandedToStorage(collapsed.value)
}

/* ─────────── v3.2 升级：lazyEnum 懒加载（select 首次展开时触发） ─────────── */

const lazyEnumLoaded = new Set<string>() // 已加载过 lazy enum 的 prop

function handleColVisibleChange(col: ProColumn<T>, visible: boolean): void {
  // 仅 select 类 + lazyEnum=true + 首次展开时触发
  if (!visible) return
  if (col.search?.el !== 'select') return
  if (!col.search?.lazyEnum) return
  if (lazyEnumLoaded.has(col.prop)) return
  lazyEnumLoaded.add(col.prop)
  // 业务方可在 onChange 钩子中实现具体加载（demo 中演示）
  col.search?.onChange?.(
    localParams.value[col.prop],
    localParams.value[col.prop],
    localParams.value
  )
}

/** 监听 expandedStatePersist 变化：动态切换持久化策略（业务方运行时改 prop） */
watch(
  () => props.expandedStatePersist,
  () => {
    if (!props.expandedStatePersist) return
    // 重新持久化当前状态
    writeExpandedToStorage(collapsed.value)
  }
)

/**
 * v3.2 高级筛选 Drawer 可见性
 */
const advancedVisible = ref(false)

/* ─────────── v3.2 升级：核心 computed ─────────── */

/**
 * v3.2 字段联动显隐过滤 + 过滤无 search 配置的列
 */
const allBasicColumns = computed<ProColumn<T>[]>(() => {
  const display = props.searchDisplay?.(localParams.value) ?? {}
  return props.columns.filter((col) => {
    if (!col.search) return false
    if (col.search.level === SearchLevel.Advanced) return false
    if (display[col.prop] === false) return false
    return true
  })
})

/**
 * v3.3 升级：当前布局档位（4 档自适应 + v3.4 业务方强制档位）
 *
 * 决策顺序：drawer（任何 advanced 字段，保证 advanced 字段可达） >
 *          业务方强制档位（searchLayout 非 auto） > 字段数自动判定
 *          （basic > 8 flat-large / 4-8 collapse / ≤3 flat）
 *
 * 该值驱动 showToggle / showAdvancedBtn / mainFormColumns 三处行为。
 */
const layoutMode = computed<'flat' | 'collapse' | 'flat-large' | 'drawer'>(() => {
  // advanced 字段存在性永远优先 —— advanced 字段必须经抽屉可达，
  // 防止业务方强制 flat/collapse 时 advanced 字段静默丢失（无入口渲染）
  if (advancedColumns.value.length > 0) return 'drawer'
  // v3.4：业务方强制档位跳过字段数自动判定。下放动机：字段数与页面空间
  // 不一定匹配（宽屏想平铺 6 字段），且 searchDisplay 联动使字段数动态变化时
  // 自动判定会让档位在 flat/collapse 间跳变（按钮时有时无、布局抖动），
  // 锁定档位可消除抖动
  if (props.searchLayout && props.searchLayout !== 'auto') return props.searchLayout
  const basicCount = allBasicColumns.value.length
  if (basicCount > 8) return 'flat-large'
  if (basicCount > 3) return 'collapse'
  return 'flat'
})

/**
 * v3.3 升级：主表单可见列 —— 按 layoutMode 自适应
 *
 * - collapse 档：折叠时只显示前 4 个，展开后显示全部
 * - flat / flat-large / drawer 档：全部平铺（不受 collapsed 控制）
 */
const mainFormColumns = computed<ProColumn<T>[]>(() => {
  if (layoutMode.value === 'collapse' && collapsed.value) {
    return allBasicColumns.value.slice(0, COLLAPSED_INLINE_LIMIT)
  }
  return allBasicColumns.value
})

/** 是否显示「展开/收起」按钮（仅 collapse 档） */
const showToggle = computed(() => layoutMode.value === 'collapse')

/** 是否显示「高级筛选」按钮（仅 drawer 档） */
const showAdvancedBtn = computed(() => layoutMode.value === 'drawer')

/**
 * v3.2 高级筛选字段集合
 */
const advancedColumns = computed<ProColumn<T>[]>(() => {
  const display = props.searchDisplay?.(localParams.value) ?? {}
  return props.columns.filter((col) => {
    if (!col.search) return false
    if (col.search.level !== SearchLevel.Advanced) return false
    if (display[col.prop] === false) return false
    return true
  })
})

/** 高级筛选已选数量（仅非空值计入） */
const advancedSelectedCount = computed(() => {
  return advancedColumns.value.filter((col) => {
    const v = localParams.value[col.prop]
    if (v === undefined || v === null || v === '') return false
    if (Array.isArray(v) && v.length === 0) return false
    return true
  }).length
})

/**
 * v3.2.2 重构：统一写入函数（替代 Proxy 自动 emit）
 *
 * 写入 → emit('update:searchParams', 新快照) → useSearch.updateParams re-assign
 * → 父组件 re-render → props.searchParams 变 → localParams 同步（watch）
 * 这样整个链路无 Proxy 引用泄漏，所有消费者读到一致的新对象。
 */
function setLocal(key: string, value: unknown): void {
  const next = { ...localParams.value, [key]: value }
  localParams.value = next
  emit('update:searchParams', next)
}
function setLocalBulk(patch: Record<string, unknown>): void {
  const next = { ...localParams.value, ...patch }
  localParams.value = next
  emit('update:searchParams', next)
}

/**
 * emit 当前 localParams 完整快照（空 patch 的语义化封装）——
 * 用于 onChange 钩子已原地修改 localParams 后，把「业务方改过的现状」一次性同步给父组件。
 */
function emitCurrentSnapshot(): void {
  const next = { ...localParams.value }
  localParams.value = next
  emit('update:searchParams', next)
}

/* ─────────── v3.2 升级：字段级防抖 + searchTrigger ─────────── */

const debounceHandlers = new Map<string, ReturnType<typeof debounceFn>>()

function getOrCreateDebounceSearch(col: ProColumn<T>): ReturnType<typeof debounceFn> {
  let handler = debounceHandlers.get(col.prop)
  if (!handler) {
    const delay = col.search?.debounce ?? 0
    handler = debounceFn(() => handleSearch(), delay)
    debounceHandlers.set(col.prop, handler)
  }
  return handler
}

/* ─────────── v3.2 升级：值清空联动（onChange 钩子） ─────────── */

const previousValues = new Map<string, unknown>()

/**
 * 字段值变化统一处理
 * - onChange 钩子：值变化时调用，支持业务方清空联动
 * - searchTrigger 触发：'change' 立即搜索 / 'enter' 等回车 / debounce > 0 防抖搜索
 */
function handleColUpdate(col: ProColumn<T>, v: unknown): void {
  const oldVal = previousValues.get(col.prop) ?? localParams.value[col.prop]
  // onChange 钩子：业务方可在钩子里改写 params（清空联动）
  if (col.search?.onChange) {
    col.search.onChange(v, oldVal, localParams.value)
    // 业务方在 onChange 里已原地修改 localParams.value（如 params.paymentTime = undefined），
    // 需要把当前快照 emit 出去让 useSearch re-assign —— emitCurrentSnapshot() 即
    // 「emit 当前完整快照」的语义（等价 setLocalBulk({})，但意图自解释，不靠空对象旁注）
    emitCurrentSnapshot()
  } else {
    // 默认行为：单字段更新
    setLocal(col.prop, v)
  }
  previousValues.set(col.prop, v)

  // 触发时机判定
  const trigger = col.search?.searchTrigger
  if (trigger === 'change') {
    // 任何控件 change 即搜索（select/date-picker 推荐）
    handleSearch()
  } else if (col.search?.el === 'input') {
    // input 类控件
    if (trigger === 'enter') {
      // 仅回车触发（不防抖，不 change 触发）—— 由 native form submit 拦截器处理
    } else if ((col.search?.debounce ?? 0) > 0) {
      // 旧 API：debounce > 0 触发防抖
      getOrCreateDebounceSearch(col).invoke()
    }
    // 都不配：保持 H2 默认（输入与请求解耦，仅回车/按钮触发）
  } else {
    // 非 input 控件（select/date-picker 等）：默认 change 即搜索
    handleSearch()
  }
}

/* ─────────── v3.2 升级：清除单个条件（SelectedTags 用） ─────────── */

// 注：clearCondition / clearAllConditions 在 defineEmits 中声明但本组件不主动 emit，
// 由 SelectedTags → ProTable → SearchForm 的事件链路上游处理（见 ProTable.vue）。
// 原 handleClearOneCondition / handleClearAllConditions 内部函数已在 v3.3 重构中移除
// （死代码 —— 模板无 @clear-condition 监听且未调用 emit）。

/* ─────────── 基础 handlers ─────────── */

function handleSearch(): void {
  emit('search')
}

function handleReset(): void {
  emit('reset')
}

function openAdvanced(): void {
  advancedVisible.value = true
}

function closeAdvanced(): void {
  advancedVisible.value = false
}

function handleAdvancedApply(): void {
  advancedVisible.value = false
  handleSearch()
}

function handleAdvancedReset(): void {
  const snapshot: Record<string, unknown> = {}
  for (const col of advancedColumns.value) {
    snapshot[col.prop] = col.search?.defaultValue ?? null
  }
  setLocalBulk(snapshot)
  handleSearch()
}

/* ─────────── v3.1.4 review：阻止 native form implicit submit ─────────── */

const elFormRef = ref<InstanceType<typeof ElForm> | null>(null)
let detachSubmitListener: (() => void) | null = null

onMounted(() => {
  const formEl = (elFormRef.value as unknown as { $el?: HTMLFormElement } | null)?.$el
  if (!formEl || formEl.tagName !== 'FORM') return
  const onNativeSubmit = (e: Event): void => {
    e.preventDefault()
    handleSearch()
  }
  formEl.addEventListener('submit', onNativeSubmit)
  detachSubmitListener = () => formEl.removeEventListener('submit', onNativeSubmit)
})

onBeforeUnmount(() => {
  detachSubmitListener?.()
  detachSubmitListener = null
  for (const handler of debounceHandlers.values()) {
    handler.cancel()
  }
  debounceHandlers.clear()
  previousValues.clear()
})

/** input placeholder —— 根据控件 prefix 动态生成 */
function buildPlaceholder(col: ProColumn<T>, prefix: '请输入' | '请选择' | undefined): string {
  return prefix ? `${prefix}${col.label}` : ''
}
</script>

<template>
  <div :class="bem.b()" role="search" aria-label="表格筛选">
    <ElForm ref="elFormRef" :model="localParams" inline label-position="left">
      <!--
        v3.2 重大升级：左右结构（用户要求）
        - 字段在左：flex: 1，自然换行（多行时）
        - 按钮在右：flex: 0 white-space: nowrap（绝不换行）
        - 整体行布局：align-items: flex-start 顶部对齐
        - 展开/收起：fields 区域 height 0→auto 平滑过渡
      -->
      <div :class="bem.e('inline')">
        <div :class="bem.e('fields')">
          <!--
            review R4：原 <Transition> + 6 个 JS 钩子已删除 —— 挂载点原为 v-show 恒 true，
            钩子永不触发（死代码）；折叠展开由 mainFormColumns（slice 前 N 个）直接驱动，
            行为与删除前完全一致（均无动画）。
          -->
          <div :class="bem.e('field-list')">
            <ElFormItem
              v-for="col in mainFormColumns"
              :key="col.prop"
              :label="col.label"
              :class="bem.e('field')"
            >
              <slot :name="`search-${col.prop}`" :column="col">
                <component
                  :is="SEARCH_CONTROL_MAP[col.search!.el].component"
                  v-bind="{
                    modelValue: localParams[col.prop] as unknown as never,
                    ...(SEARCH_CONTROL_MAP[col.search!.el].clearable ? { clearable: true } : {}),
                    ...(SEARCH_CONTROL_MAP[col.search!.el].placeholderPrefix
                      ? {
                          placeholder: buildPlaceholder(
                            col,
                            SEARCH_CONTROL_MAP[col.search!.el].placeholderPrefix
                          ) as unknown as never,
                        }
                      : {}),
                    ...col.search!.props,
                  }"
                  @update:model-value="(v: unknown) => handleColUpdate(col, v)"
                  @visible-change="(v: boolean) => handleColVisibleChange(col, v)"
                  @clear="handleSearch"
                >
                  <template v-if="SEARCH_CONTROL_MAP[col.search!.el].hasOptions" #default>
                    <ElOption
                      v-for="opt in col.enum ?? []"
                      :key="String(opt.value)"
                      :label="opt.label as unknown as never"
                      :value="opt.value as unknown as never"
                      :disabled="opt.disabled as unknown as never"
                    />
                  </template>
                </component>
              </slot>
            </ElFormItem>
          </div>
        </div>
        <div :class="bem.e('actions')">
          <!--
            按钮顺序约定（用户要求 v3.3.1）：高级筛选在最左侧（条件分流的主入口），
            然后是搜索 / 重置（主操作），最后是展开/收起（折叠档）。
            次级操作（条件分流）放最前是因为它的过滤会直接影响下面的表格数据。
          -->
          <ElTooltip v-if="showAdvancedBtn" content="高级筛选" placement="top">
            <ElButton
              circle
              :class="bem.e('advanced-btn')"
              data-test="advanced-btn"
              aria-label="打开高级筛选"
              @click="openAdvanced"
            >
              <el-icon><Filter /></el-icon>
              <ElBadge
                :value="advancedSelectedCount"
                :max="99"
                :hidden="advancedSelectedCount === 0"
                :class="bem.e('badge')"
                data-test="advanced-badge"
              />
            </ElButton>
          </ElTooltip>
          <ElButton
            type="primary"
            :icon="Search"
            data-test="search-btn"
            aria-label="搜索"
            @click="handleSearch"
          >
            搜索
          </ElButton>
          <ElButton
            :icon="Refresh"
            data-test="reset-btn"
            aria-label="重置筛选"
            @click="handleReset"
          >
            重置
          </ElButton>
          <!--
            v3.3 升级：展开/收起改为圆形图标按钮（与 TableHeader 列设置按钮同款 `circle`），
            减少按钮文字对搜索区横向空间的占用；图标方向天然表达可点击切换的语义。
            ElTooltip 包裹补充 hover 提示（圆形按钮无文字必须有 tooltip 兜底）。

            v3.3.1 修复：v-if 必须同时控制 ElTooltip 与 ElButton。
            原代码 `v-if="showToggle"` 只在 button 上，但 ElTooltip 没条件渲染，
            档位不渲染 toggle 时（flat / flat-large / drawer）ElTooltip 的 OnlyChild
            会找不到合法子节点，触发 `[ElOnlyChild] no valid child node found` 警告 ×N。
            修复：v-if 上提到 ElTooltip，button 与 tooltip 同生同灭。
          -->
          <ElTooltip v-if="showToggle" :content="collapsed ? '展开' : '收起'" placement="top">
            <ElButton
              :icon="collapsed ? ArrowDown : ArrowUp"
              circle
              data-test="toggle-btn"
              :aria-label="collapsed ? '展开搜索条件' : '收起搜索条件'"
              :aria-expanded="!collapsed"
              @click="toggleCollapsed"
            />
          </ElTooltip>
        </div>
      </div>
    </ElForm>

    <!--
      v3.3 升级：高级筛选改用 ElDrawer（从右侧滑出）
      - 不挤压表格：Drawer 是覆盖层，表格高度不受影响
      - 适合数据量极大 / 需要持续查看表格的场景
      - 宽度 35%：足够承载复杂表单结构
      - close-on-click-modal 默认 true（用户要求）：点击遮罩区即可关闭抽屉，
        不必强制走「取消」按钮。点「确定」按钮保留显式提交语义。
    -->
    <ElDrawer
      v-model="advancedVisible"
      title="高级筛选"
      direction="rtl"
      size="35%"
      data-test="advanced-drawer"
    >
      <ElForm :model="localParams" label-position="top">
        <ElRow :gutter="16">
          <ElCol v-for="col in advancedColumns" :key="col.prop" :xs="24" :sm="12">
            <ElFormItem :label="col.label">
              <slot :name="`search-${col.prop}`" :column="col">
                <component
                  :is="SEARCH_CONTROL_MAP[col.search!.el].component"
                  v-bind="{
                    modelValue: localParams[col.prop] as unknown as never,
                    ...(SEARCH_CONTROL_MAP[col.search!.el].clearable ? { clearable: true } : {}),
                    ...(SEARCH_CONTROL_MAP[col.search!.el].placeholderPrefix
                      ? {
                          placeholder: buildPlaceholder(
                            col,
                            SEARCH_CONTROL_MAP[col.search!.el].placeholderPrefix
                          ) as unknown as never,
                        }
                      : {}),
                    ...col.search!.props,
                  }"
                  @update:model-value="(v: unknown) => handleColUpdate(col, v)"
                  @visible-change="(v: boolean) => handleColVisibleChange(col, v)"
                  @clear="handleSearch"
                >
                  <template v-if="SEARCH_CONTROL_MAP[col.search!.el].hasOptions" #default>
                    <ElOption
                      v-for="opt in col.enum ?? []"
                      :key="String(opt.value)"
                      :label="opt.label as unknown as never"
                      :value="opt.value as unknown as never"
                      :disabled="opt.disabled as unknown as never"
                    />
                  </template>
                </component>
              </slot>
            </ElFormItem>
          </ElCol>
        </ElRow>
      </ElForm>
      <template #footer>
        <div :class="bem.e('drawer-footer')">
          <ElButton data-test="advanced-reset" @click="handleAdvancedReset">清空</ElButton>
          <ElButton @click="closeAdvanced">取消</ElButton>
          <ElButton type="primary" data-test="advanced-apply" @click="handleAdvancedApply">
            确定
          </ElButton>
        </div>
      </template>
    </ElDrawer>
  </div>
</template>

<style lang="scss">
/*
 * v3.2 重大升级：左右结构（用户要求）
 * - 字段在左：flex: 1 自然换行
 * - 按钮在右：flex: 0 + white-space: nowrap（绝换行）
 * - 整体：align-items: flex-start
 * - 展开/收起动画由 JS 钩子驱动 max-height 过渡
 */
.#{$BEM_PREFIX}-pro-table-search {
  &__inline {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    flex-wrap: wrap; /* 字段在窄屏自动换行到按钮下面 */
  }
  &__fields {
    flex: 1 1 auto;
    min-width: 0; /* 防止 flex item 内容溢出 */
  }
  &__field-list {
    display: grid;
    /* 默认 4 列自适应网格（lg+），小屏降为 2/1 列 */
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px 16px;
  }
  &__field {
    /*
     * 覆写 el-form-item 默认 margin-bottom: 22px。
     * 选择器特异性：.#{$BEM_PREFIX}-pro-table-search__field (0,1,0) = .el-form-item (0,1,0)，
     * 靠源码顺序决胜（组件样式晚于 element-plus CSS 注入），
     * 故不需要 !important（项目规范 §4 #13）。
     */
    margin-bottom: 0;
  }
  &__actions {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 0px;
    white-space: nowrap; /* 按钮绝换行（用户要求） */
    .el-button + .el-button {
      margin-left: 8px;
    }
  }
  /*
   * v3.3 用户要求：ElBadge 绝对定位到按钮右上角，彻底脱离 inline-block 布局。
   * 即使 badge 内容（数字 / 圆点）有宽度，也不会挤压图标。
   * 定位基准：&__advanced-btn（已显式 position: relative）——
   * 不依赖 ElButton 内部是否 position: relative，避免 EP 升级时静默失效。
   *
   * v3.3.1 关键样式修正：
   * 1) &__advanced-btn 加 overflow: hidden —— EP 默认 `.el-badge__content` 使用
   *    `translate(50%, -50%)` 把 sup 角标移出 wrapper 一半（设计意图是让角标
   *    半悬挂在边界外），对文字按钮 OK；但对 32x32 circle 按钮会让红圈溢出
   *    半个直径到按钮外（视觉上像「按钮旁边挂了个红色大气球」）。
   *    overflow: hidden 把溢出部分裁掉，角标限制在按钮内。
   * 2) &__badge 改用 top: 0; right: 0 —— 与 overflow:hidden 配合，让 sup
   *    正好出现在按钮内的右上角（translate 后位置约 top: 9px right: 9px，
   *    是按钮圆周的合理位置）。
   *
   * 圆形图标按钮内的图标居中（用户要求 v3.3）：
   * element-plus 的 `.el-button [class*=el-icon]+span { margin-left: 6px }` 是为
   * 「图标+文字」按钮预留的间距，会命中我们的 ElBadge wrapper，让图标视觉左偏。
   * 重置 trailing span 的 margin-left 为 0（防 EP 默认规则的左偏）。
   * 靠源码顺序决胜（晚于 EP CSS 注入），项目规范 §4 #13：不用 !important。
   */
  &__advanced-btn {
    /* 给按钮加显式定位基准 + overflow 裁切，让 badge 角标限制在按钮内 */
    position: relative;
    &.el-button [class*='el-icon'] + span {
      margin-left: 0;
    }
  }
  &__badge {
    position: absolute;
    top: -2px;
    right: -5px;
  }
  &__drawer-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
}
</style>
