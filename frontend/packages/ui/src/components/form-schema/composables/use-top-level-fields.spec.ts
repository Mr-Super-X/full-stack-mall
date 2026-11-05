/**
 * useTopLevelFields 单测 —— 覆盖 11 个 computed
 *
 * 目标：锁定 Phase 2 抽取后的行为契约（与原 XForm.vue 内联实现 100% 等价）
 *
 * 测试策略：
 * - 用 reactive schema / model 直接传 computed 值，验证每个分支
 * - readTopLevelNode 把 schema narrow 到顶层节点形态（数组/string → undefined）
 * - 函数 / {{ }} 表达式求值路径需 mock resolveFunctionExpression
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { useTopLevelFields, type UseTopLevelFieldsDeps } from './use-top-level-fields'
import type { SchemaNode, RowConfig } from '../types'

// mock element-plus 间接依赖
vi.mock('element-plus', () => ({}))

function makeDeps(overrides: Partial<UseTopLevelFieldsDeps> = {}) {
  const reactiveSchema = ref<SchemaNode | SchemaNode[] | string | undefined>({})
  const model = ref<Record<string, unknown> | undefined>({})
  const currentBreakpoint = ref('md')

  // 默认 mergeRowResponsive：直接返回 row（原实现细节由其自身 spec 覆盖）
  const mergeRowResponsive = vi.fn((row: RowConfig | undefined) => row)

  // 默认 resolveFunctionExpression：解析 {{ (m) => true }} / {{ (m) => false }} 简单表达式
  const resolveFunctionExpression: UseTopLevelFieldsDeps['resolveFunctionExpression'] = ((
    expr: string
  ) => {
    const m = expr.match(/^\{\{\s*\(m\)\s*=>\s*(.+?)\s*\}\}$/)
    if (m) {
      const body = m[1]?.trim() ?? ''
      if (body === 'true') return ((): true => true) as unknown as never
      if (body === 'false') return ((): false => false) as unknown as never
    }
    return null
  }) as UseTopLevelFieldsDeps['resolveFunctionExpression']

  const deps: UseTopLevelFieldsDeps = {
    reactiveSchema: reactiveSchema as { value: SchemaNode | SchemaNode[] | string | undefined },
    model: model as { value: Record<string, unknown> | undefined },
    currentBreakpoint: currentBreakpoint as { value: string },
    resolveFunctionExpression,
    mergeRowResponsive,
    ...overrides,
  }
  return {
    deps,
    reactiveSchema,
    model,
    currentBreakpoint,
    mergeRowResponsive,
    resolveFunctionExpression,
  }
}

describe('useTopLevelFields', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================
  // nodes —— 顶层节点列表（仅依赖 reactiveSchema；错误态渲染由
  // XForm.vue :data-field-errors 绑定与 render-form-item 读键兜底，见架构审查 #4）
  // ============================================================
  describe('nodes', () => {
    it('数组形态 → 返回 schema 数组', () => {
      const { deps, reactiveSchema } = makeDeps()
      reactiveSchema.value = [
        { component: 'Input', name: 'a' },
        { component: 'Input', name: 'b' },
      ]
      const api = useTopLevelFields(deps)
      expect(api.nodes.value).toEqual([
        { component: 'Input', name: 'a' },
        { component: 'Input', name: 'b' },
      ])
    })

    it('单节点 + children 数组 → 返回 children', () => {
      const { deps, reactiveSchema } = makeDeps()
      reactiveSchema.value = {
        column: 2,
        children: [{ component: 'Input', name: 'a' }],
      }
      const api = useTopLevelFields(deps)
      expect(api.nodes.value).toEqual([{ component: 'Input', name: 'a' }])
    })

    it('单节点 + children 单节点 → 返回 [children]', () => {
      const { deps, reactiveSchema } = makeDeps()
      reactiveSchema.value = {
        children: { component: 'Input', name: 'a' },
      }
      const api = useTopLevelFields(deps)
      expect(api.nodes.value).toEqual([{ component: 'Input', name: 'a' }])
    })

    it('单节点无 children → 返回 [s]', () => {
      const { deps, reactiveSchema } = makeDeps()
      reactiveSchema.value = { component: 'Input', name: 'solo' }
      const api = useTopLevelFields(deps)
      expect(api.nodes.value).toEqual([{ component: 'Input', name: 'solo' }])
    })

    it('string schema → 返回 []（修复原代码 [string] 类型不安全）', () => {
      const { deps, reactiveSchema } = makeDeps()
      reactiveSchema.value = 'schema-as-string'
      const api = useTopLevelFields(deps)
      expect(api.nodes.value).toEqual([])
    })

    it('undefined schema → 返回 []', () => {
      const { deps, reactiveSchema } = makeDeps()
      reactiveSchema.value = undefined
      const api = useTopLevelFields(deps)
      expect(api.nodes.value).toEqual([])
    })
  })

  // ============================================================
  // row —— 拍平当前断点
  // ============================================================
  describe('row', () => {
    it('数组形态 → undefined', () => {
      const { deps, reactiveSchema } = makeDeps()
      reactiveSchema.value = [{ component: 'Input' }]
      const api = useTopLevelFields(deps)
      expect(api.row.value).toBeUndefined()
    })

    it('string schema → undefined', () => {
      const { deps, reactiveSchema } = makeDeps()
      reactiveSchema.value = 'foo'
      const api = useTopLevelFields(deps)
      expect(api.row.value).toBeUndefined()
    })

    it('无 children → undefined', () => {
      const { deps, reactiveSchema } = makeDeps()
      reactiveSchema.value = { component: 'Input' }
      const api = useTopLevelFields(deps)
      expect(api.row.value).toBeUndefined()
    })

    it('无 row 配置 → mergeRowResponsive(undefined, currentBreakpoint)', () => {
      const { deps, reactiveSchema, currentBreakpoint, mergeRowResponsive } = makeDeps()
      reactiveSchema.value = { children: [] }
      currentBreakpoint.value = 'lg'
      const api = useTopLevelFields(deps)
      void api.row.value
      expect(mergeRowResponsive).toHaveBeenCalledWith(undefined, 'lg')
    })

    it('有 row 配置 → mergeRowResponsive(row, currentBreakpoint)', () => {
      const { deps, reactiveSchema } = makeDeps()
      const row = { gutter: 24 }
      reactiveSchema.value = { children: [], row }
      const api = useTopLevelFields(deps)
      void api.row.value
      expect(deps.mergeRowResponsive).toHaveBeenCalledWith(row, 'md')
    })
  })

  // ============================================================
  // column / colSpan
  // ============================================================
  describe('column', () => {
    it('数组 → undefined', () => {
      const { deps, reactiveSchema } = makeDeps()
      reactiveSchema.value = [{ component: 'Input' }]
      const api = useTopLevelFields(deps)
      expect(api.column.value).toBeUndefined()
    })

    it('有 children 但无 column → undefined', () => {
      const { deps, reactiveSchema } = makeDeps()
      reactiveSchema.value = { children: [] }
      const api = useTopLevelFields(deps)
      expect(api.column.value).toBeUndefined()
    })

    it('有 column → 返回 s.column', () => {
      const { deps, reactiveSchema } = makeDeps()
      reactiveSchema.value = { children: [], column: 3 }
      const api = useTopLevelFields(deps)
      expect(api.column.value).toBe(3)
    })
  })

  describe('colSpan', () => {
    it('无 column → 24（整行）', () => {
      const { deps, reactiveSchema } = makeDeps()
      reactiveSchema.value = { children: [] }
      const api = useTopLevelFields(deps)
      expect(api.colSpan.value).toBe(24)
    })

    it('column=2 → 12', () => {
      const { deps, reactiveSchema } = makeDeps()
      reactiveSchema.value = { children: [], column: 2 }
      const api = useTopLevelFields(deps)
      expect(api.colSpan.value).toBe(12)
    })

    it('column=3 → 8（floor 24/3）', () => {
      const { deps, reactiveSchema } = makeDeps()
      reactiveSchema.value = { children: [], column: 3 }
      const api = useTopLevelFields(deps)
      expect(api.colSpan.value).toBe(8)
    })

    it('column=5 → 4', () => {
      const { deps, reactiveSchema } = makeDeps()
      reactiveSchema.value = { children: [], column: 5 }
      const api = useTopLevelFields(deps)
      expect(api.colSpan.value).toBe(4)
    })
  })

  // ============================================================
  // disabled
  // ============================================================
  describe('disabled', () => {
    it('数组 → false（无顶层字段）', () => {
      const { deps, reactiveSchema } = makeDeps()
      reactiveSchema.value = [{ component: 'Input' }]
      const api = useTopLevelFields(deps)
      expect(api.disabled.value).toBe(false)
    })

    it('undefined → false', () => {
      const { deps, reactiveSchema } = makeDeps()
      reactiveSchema.value = undefined
      const api = useTopLevelFields(deps)
      expect(api.disabled.value).toBe(false)
    })

    it('disabled=true → true', () => {
      const { deps, reactiveSchema } = makeDeps()
      reactiveSchema.value = { children: [], disabled: true }
      const api = useTopLevelFields(deps)
      expect(api.disabled.value).toBe(true)
    })

    it('disabled=false → false', () => {
      const { deps, reactiveSchema } = makeDeps()
      reactiveSchema.value = { children: [], disabled: false }
      const api = useTopLevelFields(deps)
      expect(api.disabled.value).toBe(false)
    })

    it('disabled=null → false', () => {
      const { deps, reactiveSchema } = makeDeps()
      reactiveSchema.value = { children: [], disabled: null as unknown as boolean }
      const api = useTopLevelFields(deps)
      expect(api.disabled.value).toBe(false)
    })

    it('disabled=函数 → 调用 (model) => boolean', () => {
      const { deps, reactiveSchema, model } = makeDeps()
      const fn = vi.fn(() => true)
      reactiveSchema.value = { children: [], disabled: fn }
      model.value = { lockAll: true }
      const api = useTopLevelFields(deps)
      expect(api.disabled.value).toBe(true)
      expect(fn).toHaveBeenCalledWith({ lockAll: true })
    })

    it('disabled=字符串表达式 → resolveFunctionExpression 结果', () => {
      const { deps, reactiveSchema } = makeDeps()
      reactiveSchema.value = { children: [], disabled: '{{ (m) => true }}' as unknown as boolean }
      const api = useTopLevelFields(deps)
      expect(api.disabled.value).toBe(true)
    })

    it('disabled=无法识别的类型（number）→ false', () => {
      const { deps, reactiveSchema } = makeDeps()
      reactiveSchema.value = { children: [], disabled: 42 as unknown as never }
      const api = useTopLevelFields(deps)
      expect(api.disabled.value).toBe(false)
    })
  })

  // ============================================================
  // readonly（与 disabled 同结构）
  // ============================================================
  describe('readonly', () => {
    it('readonly=true → true', () => {
      const { deps, reactiveSchema } = makeDeps()
      reactiveSchema.value = { children: [], readonly: true }
      const api = useTopLevelFields(deps)
      expect(api.readonly.value).toBe(true)
    })

    it('readonly=函数 → 调用结果', () => {
      const { deps, reactiveSchema } = makeDeps()
      const fn = vi.fn(() => false)
      reactiveSchema.value = { children: [], readonly: fn }
      const api = useTopLevelFields(deps)
      expect(api.readonly.value).toBe(false)
      expect(fn).toHaveBeenCalled()
    })

    it('数组 → false', () => {
      const { deps, reactiveSchema } = makeDeps()
      reactiveSchema.value = [{ component: 'Input' }]
      const api = useTopLevelFields(deps)
      expect(api.readonly.value).toBe(false)
    })
  })

  // ============================================================
  // labelWidth / labelPosition
  // ============================================================
  describe('labelWidth', () => {
    it('数组 → ""（无顶层字段）', () => {
      const { deps, reactiveSchema } = makeDeps()
      reactiveSchema.value = [{ component: 'Input' }]
      const api = useTopLevelFields(deps)
      expect(api.labelWidth.value).toBe('')
    })

    it('未设置 labelWidth → ""', () => {
      const { deps, reactiveSchema } = makeDeps()
      reactiveSchema.value = { children: [] }
      const api = useTopLevelFields(deps)
      expect(api.labelWidth.value).toBe('')
    })

    it('labelWidth="120px" → "120px"', () => {
      const { deps, reactiveSchema } = makeDeps()
      reactiveSchema.value = { children: [], labelWidth: '120px' }
      const api = useTopLevelFields(deps)
      expect(api.labelWidth.value).toBe('120px')
    })

    it('labelWidth=120（数字） → 120', () => {
      const { deps, reactiveSchema } = makeDeps()
      reactiveSchema.value = { children: [], labelWidth: 120 }
      const api = useTopLevelFields(deps)
      expect(api.labelWidth.value).toBe(120)
    })
  })

  describe('labelPosition', () => {
    it('数组 → "left"（默认）', () => {
      const { deps, reactiveSchema } = makeDeps()
      reactiveSchema.value = [{ component: 'Input' }]
      const api = useTopLevelFields(deps)
      expect(api.labelPosition.value).toBe('left')
    })

    it('无 children → "left"', () => {
      const { deps, reactiveSchema } = makeDeps()
      reactiveSchema.value = { component: 'Input' }
      const api = useTopLevelFields(deps)
      expect(api.labelPosition.value).toBe('left')
    })

    it('有 children 未设置 → "left"', () => {
      const { deps, reactiveSchema } = makeDeps()
      reactiveSchema.value = { children: [] }
      const api = useTopLevelFields(deps)
      expect(api.labelPosition.value).toBe('left')
    })

    it('labelPosition="top" → "top"', () => {
      const { deps, reactiveSchema } = makeDeps()
      reactiveSchema.value = { children: [], labelPosition: 'top' }
      const api = useTopLevelFields(deps)
      expect(api.labelPosition.value).toBe('top')
    })

    it('labelPosition="right" → "right"', () => {
      const { deps, reactiveSchema } = makeDeps()
      reactiveSchema.value = { children: [], labelPosition: 'right' }
      const api = useTopLevelFields(deps)
      expect(api.labelPosition.value).toBe('right')
    })
  })

  // ============================================================
  // scrollToError / scrollIntoViewOptions
  // ============================================================
  describe('scrollToError', () => {
    it('数组 → false（默认）', () => {
      const { deps, reactiveSchema } = makeDeps()
      reactiveSchema.value = [{ component: 'Input' }]
      const api = useTopLevelFields(deps)
      expect(api.scrollToError.value).toBe(false)
    })

    it('未设置 → false', () => {
      const { deps, reactiveSchema } = makeDeps()
      reactiveSchema.value = { children: [] }
      const api = useTopLevelFields(deps)
      expect(api.scrollToError.value).toBe(false)
    })

    it('scrollToError=true → true', () => {
      const { deps, reactiveSchema } = makeDeps()
      reactiveSchema.value = { children: [], scrollToError: true }
      const api = useTopLevelFields(deps)
      expect(api.scrollToError.value).toBe(true)
    })

    // props 兜底契约（死 prop 修复）：schema 缺省时读取 XForm props
    it('schema 未设置 + props.scrollToError=true → true（props 兜底）', () => {
      const { deps, reactiveSchema } = makeDeps({
        props: { scrollToError: true } as UseTopLevelFieldsDeps['props'],
      })
      reactiveSchema.value = { children: [] }
      const api = useTopLevelFields(deps)
      expect(api.scrollToError.value).toBe(true)
    })

    it('schema 显式 false 优先于 props true', () => {
      const { deps, reactiveSchema } = makeDeps({
        props: { scrollToError: true } as UseTopLevelFieldsDeps['props'],
      })
      reactiveSchema.value = { children: [], scrollToError: false }
      const api = useTopLevelFields(deps)
      expect(api.scrollToError.value).toBe(false)
    })

    it('schema 与 props 均未设置 → false', () => {
      const { deps, reactiveSchema } = makeDeps({
        props: {} as UseTopLevelFieldsDeps['props'],
      })
      reactiveSchema.value = { children: [] }
      const api = useTopLevelFields(deps)
      expect(api.scrollToError.value).toBe(false)
    })
  })

  describe('scrollIntoViewOptions', () => {
    it('数组 → true（默认）', () => {
      const { deps, reactiveSchema } = makeDeps()
      reactiveSchema.value = [{ component: 'Input' }]
      const api = useTopLevelFields(deps)
      expect(api.scrollIntoViewOptions.value).toBe(true)
    })

    it('未设置 → true', () => {
      const { deps, reactiveSchema } = makeDeps()
      reactiveSchema.value = { children: [] }
      const api = useTopLevelFields(deps)
      expect(api.scrollIntoViewOptions.value).toBe(true)
    })

    it('scrollIntoViewOptions={behavior:"smooth"} → 透传', () => {
      const { deps, reactiveSchema } = makeDeps()
      const opts = {
        behavior: 'smooth' as ScrollBehavior,
        block: 'center' as ScrollLogicalPosition,
      }
      reactiveSchema.value = { children: [], scrollIntoViewOptions: opts }
      const api = useTopLevelFields(deps)
      expect(api.scrollIntoViewOptions.value).toEqual(opts)
    })

    it('scrollIntoViewOptions=false → false', () => {
      const { deps, reactiveSchema } = makeDeps()
      reactiveSchema.value = { children: [], scrollIntoViewOptions: false }
      const api = useTopLevelFields(deps)
      expect(api.scrollIntoViewOptions.value).toBe(false)
    })

    // props 兜底契约（死 prop 修复）：schema 缺省时读取 XForm props
    it('schema 未设置 + props.scrollIntoViewOptions={behavior:"smooth"} → 透传 props 值', () => {
      const { deps, reactiveSchema } = makeDeps({
        props: {
          scrollIntoViewOptions: { behavior: 'smooth' },
        } as UseTopLevelFieldsDeps['props'],
      })
      reactiveSchema.value = { children: [] }
      const api = useTopLevelFields(deps)
      expect(api.scrollIntoViewOptions.value).toEqual({ behavior: 'smooth' })
    })

    it('schema 显式值优先于 props', () => {
      const { deps, reactiveSchema } = makeDeps({
        props: { scrollIntoViewOptions: { behavior: 'smooth' } } as UseTopLevelFieldsDeps['props'],
      })
      reactiveSchema.value = { children: [], scrollIntoViewOptions: false }
      const api = useTopLevelFields(deps)
      expect(api.scrollIntoViewOptions.value).toBe(false)
    })
  })

  // ============================================================
  // debounceValidation
  // ============================================================
  describe('debounceValidation', () => {
    it('数组 → 0（默认）', () => {
      const { deps, reactiveSchema } = makeDeps()
      reactiveSchema.value = [{ component: 'Input' }]
      const api = useTopLevelFields(deps)
      expect(api.debounceValidation.value).toBe(0)
    })

    it('未设置 → 0', () => {
      const { deps, reactiveSchema } = makeDeps()
      reactiveSchema.value = { children: [] }
      const api = useTopLevelFields(deps)
      expect(api.debounceValidation.value).toBe(0)
    })

    it('debounceValidation=400 → 400', () => {
      const { deps, reactiveSchema } = makeDeps()
      reactiveSchema.value = { children: [], debounceValidation: 400 }
      const api = useTopLevelFields(deps)
      expect(api.debounceValidation.value).toBe(400)
    })

    it('debounceValidation=-1 → 0（拒绝负数）', () => {
      const { deps, reactiveSchema } = makeDeps()
      reactiveSchema.value = { children: [], debounceValidation: -1 }
      const api = useTopLevelFields(deps)
      expect(api.debounceValidation.value).toBe(0)
    })

    it('debounceValidation="300"（string）→ 0（非 number 类型拒绝）', () => {
      const { deps, reactiveSchema } = makeDeps()
      reactiveSchema.value = { children: [], debounceValidation: '300' as unknown as number }
      const api = useTopLevelFields(deps)
      expect(api.debounceValidation.value).toBe(0)
    })
  })

  // ============================================================
  // 跨字段联动（验证 model 变化触发 computed 重算）
  // ============================================================
  describe('响应式联动', () => {
    it('disabled 函数读取 model → model 变化后 disabled 重算', () => {
      const { deps, reactiveSchema, model } = makeDeps()
      const fn = (m: Record<string, unknown>) => Boolean(m.lockAll)
      reactiveSchema.value = { children: [], disabled: fn }
      const api = useTopLevelFields(deps)

      model.value = {}
      expect(api.disabled.value).toBe(false)

      model.value = { lockAll: true }
      expect(api.disabled.value).toBe(true)
    })

    it('column 变化触发 colSpan 重算', () => {
      const { deps, reactiveSchema } = makeDeps()
      reactiveSchema.value = { children: [], column: 2 }
      const api = useTopLevelFields(deps)
      expect(api.colSpan.value).toBe(12)
      reactiveSchema.value = { children: [], column: 3 }
      expect(api.colSpan.value).toBe(8)
    })
  })
})
