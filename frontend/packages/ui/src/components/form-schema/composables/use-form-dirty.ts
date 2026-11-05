/**
 * 表单 dirty 状态追踪 —— 父组件在路由切换/关闭弹窗时判断用户是否修改过表单（用于未保存提示）
 *
 * API：
 * - isDirty(): boolean —— 任一字段与初始 snapshot 不同则 true
 * - getDirtyFields(): string[] —— 返回 dirty 字段路径列表（lodash 路径，如 'items[0].qty'）
 * - isTouched(name: string): boolean —— 指定字段是否被修改过
 * - resetDirty(): void —— 把当前状态标记为新基线（用于"加载后初始化"或"提交后归零"）
 *
 * 设计要点：
 * - 浅字段比较（lodash isEqual 处理嵌套对象/数组）—— 不深递归整 model，性能可控
 * - snapshot 由调用方负责初始化：XForm.vue 在 setup 末尾立即调一次 resetDirty() 拍基线
 *   避免 setup 时 model 为空导致"全字段 dirty"假象
 * - watch model deep 触发 dirty 重算（响应式）
 *
 * @group 表单编排：dirty
 */
import { watch, ref, type Ref } from 'vue'
import { isEqual, get, cloneDeep } from 'lodash-es'

/**
 * useFormDirty 入参 —— 父组件注入 reactive model getter + 字段路径列表
 */
export interface UseFormDirtyOptions {
  model: () => Record<string, unknown> | undefined
  /** 字段路径列表（lodash path，如 'items[0].qty'） */
  fieldNames: () => readonly string[]
}

/**
 * useFormDirty 返回值 —— dirty 状态查询 + 基线管理
 *
 * - isDirty / getDirtyFields / isTouched: 状态查询
 * - resetDirty: 把当前状态标记为新基线（提交后归零 / 加载后初始化）
 * - stop: 内部清理（组件 unmount 时由 useXFormComposer 调用）
 */
export interface UseFormDirtyReturn {
  isDirty: () => boolean
  getDirtyFields: () => string[]
  isTouched: (name: string) => boolean
  resetDirty: () => void
  /** 内部清理（组件 unmount 时调用） */
  stop: () => void
  /**
   * 响应式 dirty 字段集合（设计师审查 F13）
   * recompute 时整体替换新 Set 触发响应式依赖（render-form-item 的 is-dirty class 绑定订阅它）
   */
  dirtyFieldsRef: Readonly<Ref<ReadonlySet<string>>>
}

/** useFormDirty —— dirty 状态追踪 + 基线管理 */
export function useFormDirty(opts: UseFormDirtyOptions): UseFormDirtyReturn {
  /** 各字段的初始值快照（lodash path → 初始值） */
  const initialSnapshot = new Map<string, unknown>()
  /** 当前 dirty 字段集合（每次 recompute 整体替换新 Set，触发响应式） */
  const dirtyFieldsRef = ref<ReadonlySet<string>>(new Set<string>())

  function captureSnapshot(): void {
    const model = opts.model()
    if (!model) return
    initialSnapshot.clear()
    for (const name of opts.fieldNames()) {
      // 必须深拷贝：直接存 get() 结果会拿到嵌套对象/数组的活 reactive 引用，
      // 用户原位修改（model.addr.city = x）时快照同步变化，isEqual 恒 true → dirty 漏检
      initialSnapshot.set(name, cloneDeep(get(model, name)))
    }
    dirtyFieldsRef.value = new Set<string>()
  }

  function recompute(): void {
    const model = opts.model()
    if (!model) return
    // 仅比较已拍 snapshot 的字段（避免未拍基线时误判全字段 dirty）
    const next = new Set<string>()
    for (const [name, initialValue] of initialSnapshot) {
      const currentValue = get(model, name)
      if (!isEqual(currentValue, initialValue)) next.add(name)
    }
    dirtyFieldsRef.value = next
  }

  function resetDirty(): void {
    captureSnapshot()
  }

  function isDirty(): boolean {
    // snapshot 为空（未初始化）→ 视为未 dirty
    if (initialSnapshot.size === 0) return false
    recompute()
    return dirtyFieldsRef.value.size > 0
  }

  function getDirtyFields(): string[] {
    if (initialSnapshot.size === 0) return []
    recompute()
    return [...dirtyFieldsRef.value]
  }

  function isTouched(name: string): boolean {
    if (initialSnapshot.size === 0) return false
    const model = opts.model()
    if (!model) return false
    return !isEqual(get(model, name), initialSnapshot.get(name))
  }

  // 任一字段变化 → 触发 dirty 重算
  const stopWatch = watch(() => opts.model(), recompute, { deep: true })

  return {
    isDirty,
    getDirtyFields,
    isTouched,
    resetDirty,
    stop: () => stopWatch(),
    dirtyFieldsRef,
  }
}
