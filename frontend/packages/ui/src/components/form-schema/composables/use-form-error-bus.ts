/**
 * use-form-error-bus —— XForm 错误事件总线
 *
 * 替代散落 27 处 console.error/warn：调用方 report({ severity, code, message, ... })，
 * 消费方通过 events ref 订阅（dev 通过 XFormErrorToast 浮窗展示，prod 静默）。
 *
 * 不引入第三方 toast 库（ElMessageBus 与业务层耦合过深）；prod 预留 hook 供业务埋点上报。
 * 同 code + message 固定窗口去重（5 秒内不重复弹窗，命中不刷新窗口起点）；
 * force:true 跳过去重用于主动 validate 场景。
 *
 * @group 表单编排：错误总线
 */

import { computed, onScopeDispose, shallowRef, type ComputedRef, type ShallowRef } from 'vue'

/** 错误严重程度 */
export type FormErrorSeverity = 'info' | 'warn' | 'error'

/** 错误码 —— 业务可扩展 */
export type FormErrorCode =
  /** schema 静态校验失败（validate 函数返回 isValid=false） */
  | 'SCHEMA_VALIDATE_FAILED'
  /** 表达式含 FORBIDDEN 关键字（window/eval/document 等） */
  | 'FORBIDDEN_IDENTIFIER'
  /** {{ fn }} 表达式解析失败（new Function 抛错） */
  | 'EXPRESSION_PARSE_FAILED'
  /** 跨字段 crossValidator 失败（实时触发或 validateForm 批量） */
  | 'CROSS_VALIDATION_FAILED'
  /** 跨字段 crossValidator 内部抛错（try/catch 捕获） */
  | 'CROSS_VALIDATOR_THREW'
  /** el-form.validate() 返回 false（字段内规则失败：required/pattern/validator callback） */
  | 'EL_FORM_VALIDATION_FAILED'
  /** 单字段错误（setFieldError 通用入口，不区分来源：realtime cross / 服务端 422） */
  | 'FIELD_ERROR'
  /** reaction watchEffect 内求值抛错 */
  | 'REACTION_EVAL_FAILED'
  /** XForm 挂载时 model prop 缺失 */
  | 'FORM_INSTANCE_NOT_READY'
  /** 节点引用了未在 components / EL_COMPONENT_MAP 中注册的组件名 */
  | 'UNKNOWN_COMPONENT'
  /** 节点 props 包含组件未声明的键（dev mode 拼写错误检测） */
  | 'UNKNOWN_COMPONENT_PROP'
  /** asyncOptions 位于 registerAsyncOptions 不可达位置（formItem.slots / array.itemSchema 内），请求不会发起 */
  | 'ASYNC_OPTIONS_UNSUPPORTED_POSITION'
  | (string & {}) // 业务自定义 code

/** 单条错误事件 */
export interface FormErrorEvent {
  /** 唯一 ID —— 用于列表渲染 key */
  id: string
  /** 严重程度 */
  severity: FormErrorSeverity
  /** 错误码（建议大写蛇形） */
  code: FormErrorCode
  /** 用户可读消息 */
  message: string
  /**
   * 面向终端用户的改写消息 —— toast 展示优先级高于 message
   * 调用方在 dev 语义 message（含 code/字段路径/调试细节）之外提供一句人话，
   * 未提供时 toast 退回 message
   */
  userMessage?: string
  /** 涉及的字段路径（用于聚焦定位） */
  fields?: string[]
  /**
   * 字段错误详情（async-validator 风格）—— toast 渲染 + console 按字段分组输出
   * 每条含 field 路径、message 错误信息、可选 field value 当前值
   */
  details?: Array<{ field: string; message: string; value?: unknown }>
  /** 错误来源模块名（debug 友好） */
  source?: string
  /** 触发时间戳 */
  timestamp: number
  /** 已读/已忽略标记（toast 关闭时设置） */
  dismissed?: boolean
}

/**
 * useFormErrorBus 返回值 —— 错误事件总线对外契约
 *
 * - events: 响应式事件列表（XFormErrorToast 消费）
 * - report: 上报入口（5s 内同 code+message 去重，force:true 跳过去重）
 * - dismiss / dismissAll / unreadCount: toast 关闭与未读数
 */
export interface UseFormErrorBusReturn {
  /** 错误事件列表（响应式） */
  events: ShallowRef<FormErrorEvent[]>
  /**
   * 上报一条错误
   * - 默认行为：**固定窗口**去重 —— 同 code + message 距「上一次入列」不足 5s 时丢弃，
   *   去重命中不刷新窗口起点（节流语义：每 5s 最多展示一次同码错误）
   * - 去重粒度 = code + message：message 变化的错误视为新错误立即入列，因此调用方
   *   须保证 message 承载区分信息（如含字段名/失败数量），否则不同错误的重复会被合并
   * - `force: true`：跳过去重，用于用户主动 validate() / validateField() 调用场景
   *   （主动操作期望每次都收到反馈，不应被去重）
   */
  report(event: Omit<FormErrorEvent, 'id' | 'timestamp' | 'dismissed'> & { force?: boolean }): void
  /** 关闭单条 toast */
  dismiss(id: string): void
  /** 关闭全部 */
  dismissAll(): void
  /** 未读数（驱动右上角红点徽标） */
  unreadCount: ComputedRef<number>
}

/**
 * report 入参类型（含可选 force 标志）
 * @see UseFormErrorBusReturn.report
 */
export type ReportErrorEventInput = Omit<FormErrorEvent, 'id' | 'timestamp' | 'dismissed'> & {
  force?: boolean
}

const MAX_EVENTS = 5
const DEDUPE_WINDOW_MS = 5_000
/**
 * dedupeCache 容量上限 —— 每条「code|message」组合占一个条目，
 * 历史不同 message 组合无限累积会导致 Map 无界增长；
 * 超限后先清理过期条目，仍超限则整体清空（最坏后果 = 去重短暂失效多弹几条 toast，无正确性影响）
 */
const MAX_DEDUPE_CACHE = 100
/** dismiss 清理时长 —— 用户点 × 后 30s 物理移除（防列表无限增长） */
const DISMISS_CLEANUP_MS = 30_000

/**
 * 生成唯一 ID —— crypto.randomUUID 在所有现代浏览器（Chrome 92+/Firefox 95+/Safari 15.4+）可用
 * 旧浏览器回退到 Math.random —— 实际碰撞概率已 < 2^-16
 */
function generateId(code: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${code}-${crypto.randomUUID()}`
  }
  return `${code}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** 创建一份 error bus（XForm 顶层调用一次） */
export function useFormErrorBus(): UseFormErrorBusReturn {
  // shallowRef：toast 列表 ≤5 条且事件对象扁平，深响应式无意义
  // 整体替换（.value = [...]）保持响应式但避免逐字段 Proxy 化
  const events = shallowRef<FormErrorEvent[]>([])
  const dedupeCache = new Map<string, number>()
  // 跟踪所有未触发的 dismiss cleanup timer —— XForm 卸载时一次性清理，
  // 避免回调在组件销毁后写入已 unmount 的 ref
  const dismissTimers = new Map<string, ReturnType<typeof setTimeout>>()

  // 组件卸载 / composable 所在 effectScope 终止时统一清理
  onScopeDispose(() => {
    for (const t of dismissTimers.values()) clearTimeout(t)
    dismissTimers.clear()
    dedupeCache.clear()
  })

  /**
   * dedupeCache 容量防护：清理窗口起点已过期的条目；仍超限则整体清空
   * 惰性调用 —— 仅在上报路径且 size 触顶时执行，避免每次 report 都 O(n) 扫描
   */
  function evictDedupeCacheIfNeeded(now: number): void {
    if (dedupeCache.size < MAX_DEDUPE_CACHE) return
    for (const [key, ts] of dedupeCache) {
      if (now - ts >= DEDUPE_WINDOW_MS) dedupeCache.delete(key)
    }
    if (dedupeCache.size >= MAX_DEDUPE_CACHE) dedupeCache.clear()
  }

  function report(event: ReportErrorEventInput): void {
    const { force = false, ...eventData } = event
    // 单次取时间戳（2026-09-16 review 优化）：去重窗口判定与入列 timestamp 必须用同一读数，
    // 避免时钟跳变/低精度计时器下「判定未命中去重、入列时间戳却落在窗口内」的自相矛盾
    const now = Date.now()
    // 同 code + message 在 5s 内去重 —— 用户连续输入反复弹窗是噪音
    // 固定窗口语义（L1 修复）：窗口起点 = 上一次入列时刻，去重命中不刷新 ——
    // 若为滑动窗口，高频同码错误每键刷新起点，窗口被无限顺延导致首次之后永不重弹
    // 去重粒度 = code + message：message 变化的错误是新 key 立即入列（可见最新），
    // 调用方须保证 message 承载区分信息；主动 validate 场景传 force: true
    if (!force) {
      evictDedupeCacheIfNeeded(now)
      const dedupeKey = `${event.code}|${event.message}`
      const lastTs = dedupeCache.get(dedupeKey)
      if (lastTs && now - lastTs < DEDUPE_WINDOW_MS) {
        return
      }
      dedupeCache.set(dedupeKey, now)
    }

    const newEvent: FormErrorEvent = {
      ...eventData,
      id: generateId(event.code),
      timestamp: now,
    }
    // 保留最近 MAX_EVENTS 条
    events.value = [newEvent, ...events.value].slice(0, MAX_EVENTS)
    // 始终 console 留痕（开发期排错需要）
    const logFn =
      event.severity === 'error'
        ? console.error
        : event.severity === 'warn'
          ? console.warn
          : console.info
    // 有 details 时按 async-validator 风格输出 errorsMap 对象 —— 便于复用 element-plus 排查工具
    if (eventData.details && eventData.details.length > 0) {
      const errorsMap: Record<
        string,
        Array<{ message: string; fieldValue: unknown; field: string }>
      > = {}
      for (const d of eventData.details) {
        ;(errorsMap[d.field] ??= []).push({
          message: d.message,
          fieldValue: d.value,
          field: d.field,
        })
      }
      logFn(`[XForm][${event.code}]`, event.message, event.source ?? '', errorsMap)
    } else {
      logFn(`[XForm][${event.code}]`, event.message, event.source ?? '')
    }
  }

  function dismiss(id: string): void {
    // 取消已存在的清理 timer（用户连续点 × 不应叠加计时）
    const existing = dismissTimers.get(id)
    if (existing) clearTimeout(existing)

    events.value = events.value.map((e) => (e.id === id ? { ...e, dismissed: true } : e))
    // 句柄存入 Map，组件卸载时由 onScopeDispose 统一清理
    const handle = setTimeout(() => {
      events.value = events.value.filter((e) => e.id !== id)
      dismissTimers.delete(id)
    }, DISMISS_CLEANUP_MS)
    dismissTimers.set(id, handle)
  }

  function dismissAll(): void {
    // 同步清理所有 pending timer —— 立即释放事件 + 句柄
    for (const t of dismissTimers.values()) clearTimeout(t)
    dismissTimers.clear()
    events.value = []
    dedupeCache.clear()
  }

  const unreadCount = computed(() => events.value.filter((e) => !e.dismissed).length)

  return { events, report, dismiss, dismissAll, unreadCount }
}
