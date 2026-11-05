import { describe, it, expect } from 'vitest'
import {
  ArrayBuilder,
  xArray,
  xInput,
  xTimePicker,
  xTimeSelect,
  xUpload,
  xTransfer,
  xTreeSelect,
  xCascader,
  xAutocomplete,
  xColorPicker,
  xInputPassword,
  xInputTag,
  xInputTextArea,
  xMention,
  xRate,
} from './builders'
import type { SchemaNode } from './types'

describe('扩展内置组件 builder', () => {
  it('返回正确的快捷名并支持通用 props 链式调用', () => {
    expect(xInputPassword('password').label('密码').prop('clearable', true).build()).toMatchObject({
      name: 'password',
      component: 'InputPassword',
      props: { clearable: true },
    })
    expect(
      xInputTextArea('remark').label('备注').prop('autosize', { minRows: 2, maxRows: 6 }).build()
    ).toMatchObject({
      name: 'remark',
      component: 'InputTextArea',
      props: { autosize: { minRows: 2, maxRows: 6 } },
    })
    expect(xInputTag('skills').prop('max', 5).build()).toMatchObject({
      name: 'skills',
      component: 'InputTag',
      props: { max: 5 },
    })
    expect(xColorPicker('theme').prop('showAlpha', true).build()).toMatchObject({
      name: 'theme',
      component: 'ColorPicker',
      props: { showAlpha: true },
    })
    expect(
      xMention('owner')
        .prop('options', [{ value: 'alice', label: 'Alice' }])
        .build()
    ).toMatchObject({
      name: 'owner',
      component: 'Mention',
      props: { options: [{ value: 'alice', label: 'Alice' }] },
    })
    expect(xRate('score').prop('allowHalf', true).build()).toMatchObject({
      name: 'score',
      component: 'Rate',
      props: { allowHalf: true },
    })
  })
})

describe('xArray(name) / ArrayBuilder', () => {
  it('returns ArrayBuilder instance with name and kind set', () => {
    const node = xArray('items').build()
    expect(node.name).toBe('items')
    expect(node.kind).toBe('array')
  })

  it('.item(s) sets itemSchema (single SchemaNode)', () => {
    const itemSchema: SchemaNode = { component: 'Input', name: 'qty' }
    const node = xArray('items').item(itemSchema).build()
    expect(node.array?.itemSchema).toEqual(itemSchema)
  })

  it('.item(s) accepts an array of SchemaNode as itemSchema', () => {
    const itemSchema: SchemaNode[] = [
      { component: 'Input', name: 'a' },
      { component: 'Input', name: 'b' },
    ]
    const node = xArray('items').item(itemSchema).build()
    expect(node.array?.itemSchema).toEqual(itemSchema)
  })

  it('.initialLength / .minItems / .maxItems all set on array config', () => {
    const node = xArray('items').initialLength(2).minItems(1).maxItems(5).build()
    expect(node.array?.initialLength).toBe(2)
    expect(node.array?.minItems).toBe(1)
    expect(node.array?.maxItems).toBe(5)
  })

  it('.showActions accepts boolean or object', () => {
    expect(xArray('a').showActions(false).build().array?.showActions).toBe(false)
    expect(
      xArray('b').showActions({ add: true, remove: false }).build().array?.showActions
    ).toEqual({
      add: true,
      remove: false,
    })
  })

  it('.labels overrides default button texts', () => {
    const node = xArray('a').labels({ add: '新增', remove: '移除' }).build()
    expect(node.array?.labels).toEqual({ add: '新增', remove: '移除' })
  })

  it('.title sets array container title', () => {
    const node = xArray('a').title('订单明细').build()
    expect(node.array?.title).toBe('订单明细')
  })

  it('.draggable defaults to true (enables row drag sorting)', () => {
    const node = xArray('a').draggable().build()
    expect(node.array?.draggable).toBe(true)
  })

  it('.draggable(false) explicitly disables row drag sorting', () => {
    const node = xArray('a').draggable(false).build()
    expect(node.array?.draggable).toBe(false)
  })

  it('.label sets node.label (form field label)', () => {
    const node = xArray('a').label('订单明细').build()
    expect(node.label).toBe('订单明细')
  })

  it('.reaction sets node.reaction for reactive linkage', () => {
    const reaction = { hidden: (m: Record<string, unknown>) => Boolean(m.hide) }
    const node = xArray('a').reaction(reaction).build()
    expect(node.reaction).toBe(reaction)
  })

  it('all setter methods return this for chaining', () => {
    const b = xArray('items')
    expect(b.item({ component: 'Input' })).toBe(b)
    expect(b.initialLength(1)).toBe(b)
    expect(b.minItems(0)).toBe(b)
    expect(b.maxItems(10)).toBe(b)
    expect(b.showActions(true)).toBe(b)
    expect(b.labels({})).toBe(b)
    expect(b.title('t')).toBe(b)
    expect(b.draggable(true)).toBe(b)
    expect(b.label('l')).toBe(b)
    expect(b.reaction({})).toBe(b)
    expect(b.build()).toBeTypeOf('object')
  })

  it('build() returns SchemaNode with required shape', () => {
    const node = xArray('items')
      .item({ component: 'Input', name: 'sku' })
      .initialLength(3)
      .minItems(1)
      .maxItems(10)
      .title('订单明细')
      .draggable()
      .build()
    expect(node.name).toBe('items')
    expect(node.kind).toBe('array')
    expect(node.array).toBeDefined()
    expect(node.array?.itemSchema).toEqual({ component: 'Input', name: 'sku' })
    expect(node.array?.initialLength).toBe(3)
    expect(node.array?.minItems).toBe(1)
    expect(node.array?.maxItems).toBe(10)
    expect(node.array?.title).toBe('订单明细')
    expect(node.array?.draggable).toBe(true)
  })

  it('ArrayBuilder can be instantiated directly (not via xArray)', () => {
    const b = new ArrayBuilder('foo')
    expect(b.node.name).toBe('foo')
    expect(b.build().kind).toBe('array')
  })

  it('subsequent .item() calls overwrite earlier itemSchema (last wins)', () => {
    const node = xArray('a')
      .item({ component: 'Input', name: 'first' })
      .item({ component: 'Select', name: 'second' })
      .build()
    expect((node.array?.itemSchema as SchemaNode).component).toBe('Select')
  })
})

describe('xInput() .disabled() 链式', () => {
  it('.disabled(true) 静态禁用', () => {
    const node = xInput('email').disabled(true).build()
    expect(node.disabled).toBe(true)
  })

  it('.disabled(false) 显式启用', () => {
    const node = xInput('email').disabled(false).build()
    expect(node.disabled).toBe(false)
  })

  it('.disabled 函数(运行时计算)', () => {
    const fn = (m: Record<string, unknown>) => !m.agree
    const node = xInput('reason').disabled(fn).build()
    expect(typeof node.disabled).toBe('function')
    // 模拟 model 计算结果
    expect((node.disabled as (m: Record<string, unknown>) => boolean)({ agree: false })).toBe(true)
    expect((node.disabled as (m: Record<string, unknown>) => boolean)({ agree: true })).toBe(false)
  })

  it('.disabled 函数表达式字符串', () => {
    const node = xInput('reason').disabled('{{ (m) => !m.agree }}').build()
    expect(node.disabled).toBe('{{ (m) => !m.agree }}')
  })

  it('链式调用与其他方法混合', () => {
    const node = xInput('email').label('邮箱').disabled(true).placeholder('a@b.com').build()
    expect(node.disabled).toBe(true)
    expect(node.label).toBe('邮箱')
    expect(node.props?.placeholder).toBe('a@b.com')
  })

  it('未设置时 disabled 字段为 undefined', () => {
    const node = xInput('email').build()
    expect(node.disabled).toBeUndefined()
  })
})

describe('xInput() .validator() / .asyncValidator() 链式', () => {
  it('.validator(fn) 添加 callback 风格 validator', () => {
    const fn = (_rule: unknown, _value: unknown, _cb: (err?: Error) => void) => {}
    const node = xInput('email').validator(fn).build()
    const rules = node.rules as Array<{ validator: unknown; trigger: string }>
    expect(rules).toHaveLength(1)
    expect(rules[0]?.validator).toBe(fn)
    expect(rules[0]?.trigger).toBe('blur')
  })

  it('.validator(fn, trigger) 自定义 trigger', () => {
    const fn = (_rule: unknown, _value: unknown, _cb: (err?: Error) => void) => {}
    const node = xInput('email').validator(fn, 'change').build()
    const rules = node.rules as Array<{ trigger: string }>
    expect(rules[0]?.trigger).toBe('change')
  })

  it('.validator 多次调用 push 多条 rule', () => {
    const fn1 = (_rule: unknown, _value: unknown, _cb: (err?: Error) => void) => {}
    const fn2 = (_rule: unknown, _value: unknown, _cb: (err?: Error) => void) => {}
    const node = xInput('email').validator(fn1).validator(fn2).build()
    const rules = node.rules as Array<{ validator: unknown }>
    expect(rules).toHaveLength(2)
  })

  it('.asyncValidator(fn) 把 Promise 返回值包成 cb 风格', async () => {
    const asyncFn = async (_rule: unknown, value: unknown, cb: (err?: Error) => void) => {
      await new Promise((r) => setTimeout(r, 5))
      cb(value === 'admin' ? new Error('用户名已被占用') : undefined)
    }
    const node = xInput('username').asyncValidator(asyncFn).build()
    const rules = node.rules as Array<{
      validator: (rule: unknown, value: unknown, cb: (err?: Error) => void) => void
    }>
    expect(rules).toHaveLength(1)

    // 测试通过路径
    await new Promise<void>((resolve) => {
      rules[0]!.validator({}, 'foo', (err) => {
        expect(err).toBeUndefined()
        resolve()
      })
    })

    // 测试失败路径
    await new Promise<void>((resolve) => {
      rules[0]!.validator({}, 'admin', (err) => {
        expect(err).toBeInstanceOf(Error)
        expect((err as Error).message).toBe('用户名已被占用')
        resolve()
      })
    })
  })

  it('.asyncValidator 拒绝(rejected Promise) 转成 Error 传给 cb', async () => {
    const asyncFn = async (_rule: unknown, _value: unknown, cb: (err?: Error) => void) => {
      throw new Error('network down')
      // // unreachable
      cb()
    }
    const node = xInput('username').asyncValidator(asyncFn).build()
    const rules = node.rules as Array<{
      validator: (rule: unknown, value: unknown, cb: (err?: Error) => void) => void
    }>
    await new Promise<void>((resolve) => {
      rules[0]!.validator({}, 'foo', (err) => {
        expect(err).toBeInstanceOf(Error)
        expect((err as Error).message).toBe('network down')
        resolve()
      })
    })
  })

  it('.asyncValidator 和 .required 等其他链式方法可组合', () => {
    const fn = async (_r: unknown, _v: unknown, _cb: (err?: Error) => void) => {}
    const node = xInput('email').required().asyncValidator(fn, 'change').build()
    const rules = node.rules as Array<Record<string, unknown>>
    expect(rules.length).toBeGreaterThanOrEqual(2)
    expect(rules.some((r) => r.required)).toBe(true)
    expect(rules.some((r) => r.trigger === 'change')).toBe(true)
  })
})

describe('xTimePicker / xTimeSelect 链式', () => {
  it('xTimePicker.format / valueFormat / range 写入 props', () => {
    const node = xTimePicker('start').format('HH:mm:ss').valueFormat('HH:mm:ss').range().build()
    expect(node.component).toBe('TimePicker')
    expect(node.props?.format).toBe('HH:mm:ss')
    expect(node.props?.valueFormat).toBe('HH:mm:ss')
    expect(node.props?.isRange).toBe(true)
  })

  it('xTimeSelect.start / end / step / format 写入 props', () => {
    const node = xTimeSelect('shift')
      .start('08:00')
      .end('18:00')
      .step('00:30')
      .format('HH:mm')
      .build()
    expect(node.component).toBe('TimeSelect')
    expect(node.props?.start).toBe('08:00')
    expect(node.props?.end).toBe('18:00')
    expect(node.props?.step).toBe('00:30')
    expect(node.props?.format).toBe('HH:mm')
  })
})

describe('xUpload 链式', () => {
  it('.action / .accept / .multiple / .drag / .listType 写入 props', () => {
    const node = xUpload('avatar')
      .action('/api/upload')
      .accept('image/*')
      .multiple()
      .drag()
      .listType('picture-card')
      .build()
    expect(node.component).toBe('Upload')
    expect(node.props?.action).toBe('/api/upload')
    expect(node.props?.accept).toBe('image/*')
    expect(node.props?.multiple).toBe(true)
    expect(node.props?.drag).toBe(true)
    expect(node.props?.listType).toBe('picture-card')
  })
})

describe('xTransfer 链式', () => {
  it('.data / .titles / .filterable / .buttonTexts 写入 props', () => {
    const data = [
      { key: 1, label: '选项1' },
      { key: 2, label: '选项2' },
    ]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node = (xTransfer('perms') as any)
      .data(data)
      .titles('未分配', '已分配')
      .filterable()
      .buttonTexts('向左', '向右')
      .build() as SchemaNode
    expect(node.component).toBe('Transfer')
    expect(node.props?.data).toBe(data)
    expect(node.props?.titles).toEqual(['未分配', '已分配'])
    expect(node.props?.filterable).toBe(true)
    expect(node.props?.buttonTexts).toEqual(['向左', '向右'])
  })
})

describe('xTreeSelect 链式', () => {
  it('.data / .multiple / .checkStrictly / .nodeKey / .props 写入 props', () => {
    const tree = [{ id: 1, label: '根', children: [{ id: 2, label: '子' }] }]
    const node = xTreeSelect('dept').data(tree).multiple().checkStrictly().nodeKey('id').build()
    expect(node.component).toBe('TreeSelect')
    expect(node.props?.data).toBe(tree)
    expect(node.props?.multiple).toBe(true)
    expect(node.props?.checkStrictly).toBe(true)
    expect(node.props?.nodeKey).toBe('id')
  })
})

describe('xCascader 链式', () => {
  it('.options / .showAllLevels / .separator 写入 props', () => {
    const options = [{ value: 1, label: '北京', children: [{ value: 11, label: '海淀' }] }]
    const node = xCascader('city').options(options).showAllLevels().separator(' / ').build()
    expect(node.component).toBe('Cascader')
    expect(node.props?.options).toBe(options)
    expect(node.props?.showAllLevels).toBe(true)
    expect(node.props?.separator).toBe(' / ')
  })
})

describe('xAutocomplete 链式', () => {
  it('.fetchSuggestions / .triggerOnFocus / .placement 写入 props', () => {
    const fn = (qs: string, cb: (s: Array<{ value: string }>) => void) =>
      cb([{ value: `${qs}-1` }, { value: `${qs}-2` }])
    // 类型推断:makeBuilder cast 链路 + [k: string]: unknown 让后续链式类型推断成 never
    // 运行时方法真实存在(原型链继承),用 as any 绕过 TS 类型检查
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ac = xAutocomplete('search') as any
    const built = ac
      .fetchSuggestions(fn as never)
      .triggerOnFocus()
      .placement('bottom-start')
      .build()
    const node: SchemaNode = built
    expect(node.component).toBe('Autocomplete')
    expect(typeof node.props?.fetchSuggestions).toBe('function')
    expect(node.props?.triggerOnFocus).toBe(true)
    expect(node.props?.placement).toBe('bottom-start')
  })
})

describe('builder required() 追加语义（H10 回归）', () => {
  it(".rules('emailRule').required() → 命名引用保留 + required 追加（不再整体覆盖）", () => {
    const node = xInput('email')
      .rules('emailRule' as never)
      .required('邮箱必填')
      .build()
    expect(node.rules).toEqual([
      'emailRule',
      { required: true, message: '邮箱必填', trigger: 'blur' },
    ])
  })

  it('.required() 无既有 rules → 单条 required（行为不变）', () => {
    const node = xInput('email').required('必填').build()
    expect(node.rules).toEqual([{ required: true, message: '必填', trigger: 'blur' }])
  })

  it('.required() 连续调用 → 数组 push 追加（行为不变）', () => {
    const node = xInput('email').required('第一条').required('第二条').build()
    expect(node.rules).toEqual([
      { required: true, message: '第一条', trigger: 'blur' },
      { required: true, message: '第二条', trigger: 'blur' },
    ])
  })
})
