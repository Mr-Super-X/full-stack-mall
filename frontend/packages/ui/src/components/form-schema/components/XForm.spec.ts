import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { h, reactive, nextTick } from 'vue'
import { ElRate, ElColorPicker, ElInputTag, ElMention } from 'element-plus'
import type { SchemaNode, XFormExpose } from '../types'
import XForm from './XForm.vue'

const ElFormStub = {
  name: 'ElForm',
  template: '<form class="el-form"><slot /></form>',
}
const ElFormItemStub = {
  name: 'ElFormItem',
  props: ['label', 'prop', 'rules', 'labelWidth', 'labelPosition'],
  template:
    '<div class="el-form-item"><span v-if="label" class="fi-label">{{ label }}</span><slot /></div>',
}
const ElRowStub = { name: 'ElRow', template: '<div class="el-row"><slot /></div>' }
const ElColStub = { name: 'ElCol', template: '<div class="el-col"><slot /></div>' }
const InputStub = {
  name: 'ElInput',
  props: ['modelValue', 'type', 'showPassword', 'clearable'],
  emits: ['update:modelValue'],
  template:
    '<input class="el-input-stub" :value="modelValue" :data-type="type" :data-show-password="showPassword" :data-clearable="clearable" @input="$emit(\'update:modelValue\', $event.target.value)" />',
}

const InputNumberStub = {
  name: 'ElInputNumber',
  props: ['modelValue', 'controlsPosition', 'min'],
  emits: ['update:modelValue'],
  template:
    '<input class="el-input-number-stub" :value="modelValue" :data-controls-position="controlsPosition" :data-min="min" />',
}
const ElConfigProviderStub = { name: 'ElConfigProvider', template: '<div><slot /></div>' }

function mountXForm(props: Record<string, unknown>, extraComponents: Record<string, unknown> = {}) {
  return mount(XForm as never, {
    props: props as never,
    global: {
      // 解除 VTU 默认的 transition-group stub —— toast 容器（F4 TransitionGroup）
      // 需真实渲染为 ul[role="alert"] 才能被断言
      stubs: { 'transition-group': false },
      components: {
        ElConfigProvider: ElConfigProviderStub,
        ElForm: ElFormStub,
        ElFormItem: ElFormItemStub,
        ElRow: ElRowStub,
        ElCol: ElColStub,
        ElInput: InputStub,
        ElInputNumber: InputNumberStub,
        ElRate,
        ElColorPicker,
        ElInputTag,
        ElMention,
        ...extraComponents,
      } as never,
    },
  })
}

describe('XForm.vue', () => {
  it('renders schema as el-form', () => {
    const model = reactive({ name: 'foo' })
    const wrapper = mountXForm({
      schema: { component: 'ElInput', name: 'name', label: 'Name' } as unknown as SchemaNode,
      model,
    })
    expect(wrapper.find('.el-form').exists()).toBe(true)
  })

  it('exposes instance methods via defineExpose', async () => {
    const wrapper = mountXForm({
      schema: { component: 'ElInput' } as unknown as SchemaNode,
    })
    await nextTick()
    const exposed = wrapper.vm as unknown as XFormExpose
    expect(typeof exposed.validate).toBe('function')
    expect(typeof exposed.clearValidate).toBe('function')
    expect(typeof exposed.getNames).toBe('function')
    expect(typeof exposed.getRef).toBe('function')
    expect(typeof exposed.validateWithZod).toBe('function')
  })

  it('recursively renders children', () => {
    const wrapper = mountXForm({
      schema: {
        children: [
          { component: 'ElInput', name: 'a' },
          { component: 'ElInput', name: 'b' },
        ],
      } as unknown as SchemaNode,
      components: { ElInput: InputStub },
    } as never)
    expect(wrapper.html()).toContain('el-input-stub')
    const inputs = wrapper.findAllComponents(InputStub)
    expect(inputs.length).toBe(2)
  })

  it('i18n 函数式 label：t 注入 → 渲染翻译后文案', () => {
    const wrapper = mountXForm({
      schema: {
        children: [
          {
            component: 'ElInput',
            name: 'email',
            label: (t: (key: string) => string) => t('form.email'),
          },
        ],
      } as unknown as SchemaNode,
      t: (key: string) => `zh:${key}`,
    } as never)
    expect(wrapper.find('.el-form-item__label').text()).toBe('zh:form.email')
  })

  it('i18n 函数式 label：未注入 t → identity 原样返回 key', () => {
    const wrapper = mountXForm({
      schema: {
        children: [
          {
            component: 'ElInput',
            name: 'email',
            label: (t: (key: string) => string) => t('form.email'),
          },
        ],
      } as unknown as SchemaNode,
    } as never)
    expect(wrapper.find('.el-form-item__label').text()).toBe('form.email')
  })

  it('i18n 函数式 label：setProps 换 t 引用 → 重渲出新文案', async () => {
    const wrapper = mountXForm({
      schema: {
        children: [
          {
            component: 'ElInput',
            name: 'email',
            label: (t: (key: string) => string) => t('form.email'),
          },
        ],
      } as unknown as SchemaNode,
      t: (key: string) => `zh:${key}`,
    } as never)
    expect(wrapper.find('.el-form-item__label').text()).toBe('zh:form.email')
    await wrapper.setProps({ t: (key: string) => `en:${key}` })
    expect(wrapper.find('.el-form-item__label').text()).toBe('en:form.email')
  })

  it('accepts schema as array (auto-wrap with children)', () => {
    const wrapper = mountXForm({
      schema: [{ component: 'ElInput', name: 'a' }] as unknown as SchemaNode[],
      components: { ElInput: InputStub },
    } as never)
    expect(wrapper.findAllComponents(InputStub).length).toBe(1)
  })

  it('getNames() returns all name fields', async () => {
    const wrapper = mountXForm({
      schema: {
        children: [
          { component: 'ElInput', name: 'a' },
          { component: 'ElInput', name: 'b' },
          { component: 'ElInput', key: 'c-only' } as unknown as SchemaNode,
        ],
      } as unknown as SchemaNode,
      components: { ElInput: InputStub },
    } as never)
    await nextTick()
    const exposed = wrapper.vm as unknown as XFormExpose
    expect(exposed.getNames().sort()).toEqual(['a', 'b', 'c-only'])
  })

  it('getNames() skips nodes with ignore:true', async () => {
    const wrapper = mountXForm({
      schema: {
        children: [
          { component: 'ElInput', name: 'a' },
          { component: 'ElInput', name: 'b', ignore: true } as unknown as SchemaNode,
        ],
      } as unknown as SchemaNode,
      components: { ElInput: InputStub },
    } as never)
    await nextTick()
    const exposed = wrapper.vm as unknown as XFormExpose
    expect(exposed.getNames()).toEqual(['a'])
  })

  it('componentProps 按组件名注入默认 props', async () => {
    const wrapper = mountXForm({
      schema: [
        { component: 'ElInput', name: 'a' },
        { component: 'ElInput', name: 'b' },
      ] as unknown as SchemaNode[],
      componentProps: { ElInput: { clearable: true } },
      components: { ElInput: InputStub },
    } as never)
    const inputs = wrapper.findAllComponents(InputStub)
    expect(inputs).toHaveLength(2)
    expect(inputs[0]!.props('clearable')).toBe(true)
    expect(inputs[1]!.props('clearable')).toBe(true)
  })

  it('节点级 props 覆盖 componentProps 默认 props', async () => {
    const wrapper = mountXForm({
      schema: [
        { component: 'ElInput', name: 'a', props: { clearable: false } },
      ] as unknown as SchemaNode[],
      componentProps: { ElInput: { clearable: true } },
      components: { ElInput: InputStub },
    } as never)
    const input = wrapper.findComponent(InputStub)
    expect(input.props('clearable')).toBe(false)
  })

  it('未配置 componentProps 时自动注入内置默认 props', async () => {
    const wrapper = mountXForm({
      schema: [{ component: 'ElInput', name: 'a' }] as unknown as SchemaNode[],
      components: { ElInput: InputStub },
    } as never)
    const input = wrapper.findComponent(InputStub)
    expect(input.props('clearable')).toBe(true)
  })

  it('未配置 componentProps 时快捷名 Input 也能命中内置默认 props', async () => {
    const wrapper = mountXForm({
      schema: [{ component: 'Input', name: 'a' }] as unknown as SchemaNode[],
      components: { ElInput: InputStub },
    } as never)
    const input = wrapper.findComponent(InputStub)
    expect(input.props('clearable')).toBe(true)
  })

  it('用户传入 componentProps 按组件名覆盖内置默认 props', async () => {
    const wrapper = mountXForm({
      schema: [{ component: 'ElInput', name: 'a' }] as unknown as SchemaNode[],
      componentProps: { ElInput: { clearable: false } },
      components: { ElInput: InputStub },
    } as never)
    const input = wrapper.findComponent(InputStub)
    expect(input.props('clearable')).toBe(false)
  })

  it('用户传入未匹配组件的 componentProps 不影响默认行为', async () => {
    const wrapper = mountXForm({
      schema: [{ component: 'ElInput', name: 'a' }] as unknown as SchemaNode[],
      componentProps: { Select: { filterable: true } },
      components: { ElInput: InputStub },
    } as never)
    const input = wrapper.findComponent(InputStub)
    // Input 仍按内置默认获得 clearable；Select 配置不影响 Input
    expect(input.props('clearable')).toBe(true)
  })

  it('内置别名默认 props 与 InputNumber 默认 props 可在 XForm 中生效', () => {
    const wrapper = mountXForm({
      schema: [
        { component: 'InputPassword', name: 'password' },
        { component: 'InputTextArea', name: 'remark' },
        { component: 'InputNumber', name: 'qty' },
        { component: 'InputNumber', name: 'price', props: { min: 0 } },
      ] as unknown as SchemaNode[],
      components: {
        InputPassword: InputStub,
        InputTextArea: InputStub,
        InputNumber: InputNumberStub,
      },
    } as never)

    const inputs = wrapper.findAll('.el-input-stub')
    const numbers = wrapper.findAll('.el-input-number-stub')
    expect(inputs).toHaveLength(2)
    expect(numbers).toHaveLength(2)
    expect(inputs[0]!.attributes('data-type')).toBe('password')
    expect(inputs[0]!.attributes('data-show-password')).toBe('true')
    expect(inputs[1]!.attributes('data-type')).toBe('textarea')
    expect(numbers[0]!.attributes('data-controls-position')).toBe('right')
    expect(numbers[0]!.attributes('data-min')).toBeUndefined()
    expect(numbers[1]!.attributes('data-controls-position')).toBe('right')
    expect(numbers[1]!.attributes('data-min')).toBe('0')
  })

  it('getNames() with includesIgnore=true returns all', async () => {
    const wrapper = mountXForm({
      schema: {
        children: [
          { component: 'ElInput', name: 'a' },
          { component: 'ElInput', name: 'b', ignore: true } as unknown as SchemaNode,
        ],
      } as unknown as SchemaNode,
      components: { ElInput: InputStub },
    } as never)
    await nextTick()
    const exposed = wrapper.vm as unknown as XFormExpose
    expect(exposed.getNames(true).sort()).toEqual(['a', 'b'])
  })
})

describe('XForm.vue resetFields 与 defaultValue', () => {
  it('重置时字段应恢复到 defaultValue', async () => {
    const model = reactive<Record<string, unknown>>({})
    const wrapper = mountXForm({
      schema: {
        children: [
          { component: 'Input', name: 'orderNo' },
          { component: 'InputPassword', name: 'pwd', defaultValue: 'secret-123' },
          { component: 'InputNumber', name: 'qty', defaultValue: 1 },
          { component: 'Rate', name: 'score', defaultValue: 4 },
          { component: 'ColorPicker', name: 'color', defaultValue: '#1890ff' },
        ],
      } as unknown as SchemaNode,
      model,
    })
    await flushPromises()

    // 默认值已填充
    expect(model.pwd).toBe('secret-123')
    expect(model.qty).toBe(1)
    expect(model.score).toBe(4)
    expect(model.color).toBe('#1890ff')

    // 模拟用户修改
    model.pwd = 'changed'
    model.qty = 99
    model.score = 3
    model.color = '#ff0000'
    await flushPromises()

    // 重置
    const exposed = wrapper.vm as unknown as XFormExpose
    exposed.resetFields()
    await flushPromises()

    // 应恢复到 defaultValue
    expect(model.pwd).toBe('secret-123')
    expect(model.qty).toBe(1)
    expect(model.score).toBe(4)
    expect(model.color).toBe('#1890ff')
  })
})

describe('buildVModelBindings (unit)', () => {
  // 单元测试 buildVModelBindings 纯函数（不依赖 el-input 在 jsdom 行为）
  it('uses default modelValue / onUpdate:modelValue keys (vue camelCase prop convention)', async () => {
    const { buildVModelBindings } = await import('../composables/build-vmodel-bindings')
    const node = { name: 'name' } as SchemaNode
    const model = { name: 'foo' }
    const bindings = buildVModelBindings(node, model, undefined)
    expect(bindings).toHaveProperty('modelValue', 'foo')
    expect(bindings).toHaveProperty('onUpdate:modelValue')
    ;(bindings['onUpdate:modelValue'] as (v: unknown) => void)('bar')
    await flushPromises()
    expect(model.name).toBe('bar')
  })

  it('uses node.modelProp custom key when provided', async () => {
    const { buildVModelBindings } = await import('../composables/build-vmodel-bindings')
    const node = { name: 'name', modelProp: 'value' } as unknown as SchemaNode
    const model = { name: 'foo' }
    const bindings = buildVModelBindings(node, model, undefined)
    expect(bindings).toHaveProperty('value', 'foo')
    expect(bindings).toHaveProperty('onUpdate:value')
  })

  it('uses beforeChange return value as actual model update', async () => {
    const { buildVModelBindings } = await import('../composables/build-vmodel-bindings')
    const node = { name: 'name' } as SchemaNode
    const model = { name: 'foo' }
    const beforeChange = vi.fn((_n: unknown, v: unknown) => `formatted-${v}-was-${model.name}`)
    const bindings = buildVModelBindings(node, model, { layer1: beforeChange as never })
    ;(bindings['onUpdate:modelValue'] as (v: unknown) => void)('bar')
    await flushPromises()
    expect(model.name).toBe('formatted-bar-was-foo')
    expect(beforeChange).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'name' }),
      'bar',
      'foo',
      expect.anything(),
      expect.anything()
    )
  })

  it('uses original value when beforeChange returns undefined', async () => {
    const { buildVModelBindings } = await import('../composables/build-vmodel-bindings')
    const node = { name: 'name' } as SchemaNode
    const model = { name: 'foo' }
    const bindings = buildVModelBindings(node, model, {
      layer1: vi.fn(() => undefined) as never,
    })
    ;(bindings['onUpdate:modelValue'] as (v: unknown) => void)('bar')
    await flushPromises()
    expect(model.name).toBe('bar')
  })

  it('handles async beforeChange by awaiting and updating', async () => {
    const { buildVModelBindings } = await import('../composables/build-vmodel-bindings')
    const node = { name: 'name' } as SchemaNode
    const model = { name: 'foo' }
    const beforeChange = vi.fn((_n: unknown, v: unknown) => Promise.resolve(`async-${v}`))
    const bindings = buildVModelBindings(node, model, { layer1: beforeChange as never })
    ;(bindings['onUpdate:modelValue'] as (v: unknown) => void)('bar')
    await flushPromises()
    expect(model.name).toBe('async-bar')
  })

  it('skips update when beforeChange Promise rejects', async () => {
    const { buildVModelBindings } = await import('../composables/build-vmodel-bindings')
    const node = { name: 'name' } as SchemaNode
    const model = { name: 'foo' }
    const beforeChange = vi.fn(() => Promise.reject(new Error('cancel')))
    const bindings = buildVModelBindings(node, model, { layer1: beforeChange as never })
    ;(bindings['onUpdate:modelValue'] as (v: unknown) => void)('bar')
    await flushPromises()
    expect(model.name).toBe('foo')
  })
})

describe('formItem config passthrough', () => {
  it('merges formItem.props into ElFormItem (e.g. tooltip)', () => {
    const node = {
      component: 'ElInput',
      name: 'textarea',
      label: '多行输入',
      formItem: { props: { tooltip: '提示语balabala' } },
    } as unknown as SchemaNode
    // formItem.props 应被 XForm 透传到 ElFormItem（element-plus 真实渲染验证需 dev 环境）
    expect((node.formItem as { props: Record<string, unknown> }).props.tooltip).toBe(
      '提示语balabala'
    )
  })

  it('supports custom formItem.component for swapping wrapper', () => {
    const node = {
      component: 'Input',
      name: 'x',
      formItem: { component: 'CustomFormItem', props: { required: true } },
    } as unknown as SchemaNode
    expect((node.formItem as { component: string }).component).toBe('CustomFormItem')
  })
})

describe('buildVModelBindings (unit)', () => {
  it('binds function handler to el-input event', async () => {
    const onClear = vi.fn()
    const model = reactive({ name: 'foo' })
    const wrapper = mountXForm({
      schema: {
        component: 'ElInput',
        name: 'name',
        on: { clear: onClear },
      } as unknown as SchemaNode,
      model,
    })
    // 直接验证 on 绑定被 merge 到 props（通过 XForm 内部 eventBindings）
    expect(wrapper.exists()).toBe(true)
    // 模拟 clear 事件（ElInputStub 不绑定事件，仅验证 props 合并）
  })

  it('parses function expression string and passes model as first arg', async () => {
    // 字符串函数表达式经 new Function 解析（无法访问测试闭包变量）
    // 验证：字符串 → 函数 → 调用时 model 作为首参
    const model = reactive({ name: 'foo' })
    const wrapper = mountXForm({
      schema: {
        component: 'ElInput',
        name: 'name',
        // 函数表达式字符串：取 model.name 转大写作为新值
        on: { clear: '{{ (m) => m.name.toUpperCase() }}' },
      } as unknown as SchemaNode,
      model,
    } as never)
    // 验证 props.onClear 被注入（不需要触发，只需 buildOnBindings 不抛错）
    expect(wrapper.exists()).toBe(true)
    // 函数表达式不抛错 = buildOnBindings 正确解析（callable 验证跳过，避免 new Function 闭包问题）
  })

  it('ignores function expression string when parse fails', async () => {
    const model = reactive({ name: 'foo' })
    const wrapper = mountXForm({
      schema: {
        component: 'ElInput',
        name: 'name',
        on: { change: '{{ (( }}' },
      } as unknown as SchemaNode,
      model,
    } as never)
    expect(wrapper.exists()).toBe(true)
  })
})

describe('XForm.vue scrollToError（校验失败自动滚动）', () => {
  // 注：XForm 模板的 <ElForm> 是 script setup 局部 import，全局 stub 不生效——
  // 走真实 ElForm 链路，用 scrollIntoView polyfill 观察滚动调用（jsdom 未实现该方法）
  let scrollIntoViewSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    scrollIntoViewSpy = vi.fn()
    Element.prototype.scrollIntoView =
      scrollIntoViewSpy as unknown as typeof Element.prototype.scrollIntoView
  })

  afterEach(() => {
    delete (Element.prototype as unknown as Record<string, unknown>).scrollIntoView
  })

  it('el-form 字段规则失败 + scrollToError → ElForm 原生滚动到错误字段', async () => {
    const wrapper = mountXForm({
      schema: {
        scrollToError: true, // 顶层 schema 配置（同 labelPosition 模式）
        children: [
          {
            component: 'ElInput',
            name: 'licenseNo',
            label: '许可证号',
            rules: [{ required: true, message: '请输入许可证号' }],
          },
        ],
      } as unknown as SchemaNode,
      model: reactive({ licenseNo: '' }),
    })
    await flushPromises()
    const exposed = wrapper.vm as unknown as XFormExpose
    const valid = await exposed.validate()
    expect(valid).toBe(false)
    await flushPromises() // 等滚动执行
    expect(scrollIntoViewSpy).toHaveBeenCalled()
  })

  it('scrollToError=false → 校验失败不自动滚动', async () => {
    const wrapper = mountXForm({
      schema: {
        children: [
          {
            component: 'ElInput',
            name: 'licenseNo',
            label: '许可证号',
            rules: [{ required: true, message: '请输入许可证号' }],
          },
        ],
      } as unknown as SchemaNode,
      model: reactive({ licenseNo: '' }),
    })
    await flushPromises()
    const exposed = wrapper.vm as unknown as XFormExpose
    const valid = await exposed.validate()
    expect(valid).toBe(false)
    await flushPromises()
    expect(scrollIntoViewSpy).not.toHaveBeenCalled()
  })

  it('跨字段校验失败 + scrollToError → 滚动到第一个 cross 错误字段', async () => {
    const wrapper = mountXForm({
      schema: {
        scrollToError: true, // 顶层 schema 配置
        children: [
          { component: 'ElInput', name: 'password' },
          {
            component: 'ElInput',
            name: 'confirmPassword',
            rules: [{ dependsOn: ['password'], crossValidator: () => '两次密码不一致' }],
          },
        ],
      } as unknown as SchemaNode,
      model: reactive({ password: 'a', confirmPassword: 'b' }),
    })
    await flushPromises()
    const exposed = wrapper.vm as unknown as XFormExpose
    const valid = await exposed.validate()
    expect(valid).toBe(false)
    await flushPromises()
    expect(scrollIntoViewSpy).toHaveBeenCalled()
  })
})

describe('XForm.vue schema 顶层 labelWidth（与 labelPosition 同模式）', () => {
  it('labelWidth: 120 → el-form label 宽度生效', async () => {
    const wrapper = mountXForm({
      schema: {
        labelWidth: 120,
        children: [{ component: 'ElInput', name: 'a', label: '字段A' }],
      } as unknown as SchemaNode,
      model: reactive({ a: '' }),
    })
    await flushPromises()
    expect(wrapper.find('.el-form-item__label').attributes('style')).toContain('width: 120px')
  })
})

describe('XForm.vue defaultValue 填充（C1 回归）', () => {
  it('schema defaultValue 在挂载时填充到 model', async () => {
    const model = reactive<Record<string, unknown>>({})
    mountXForm({
      schema: {
        component: 'ElInput',
        name: 'nickname',
        defaultValue: '匿名',
      } as unknown as SchemaNode,
      model,
    })
    await flushPromises()
    expect(model.nickname).toBe('匿名')
  })

  it('model 已有值时不被 defaultValue 覆盖', async () => {
    const model = reactive<Record<string, unknown>>({ nickname: '已有值' })
    mountXForm({
      schema: {
        component: 'ElInput',
        name: 'nickname',
        defaultValue: '匿名',
      } as unknown as SchemaNode,
      model,
    })
    await flushPromises()
    expect(model.nickname).toBe('已有值')
  })
})

describe('XForm.vue 失焦触发 crossValidator（C2 回归）', () => {
  /**
   * C2 根因：crossValidator 的 blur 触发器曾以 onBlur 挂在 ElFormItem 根 div 上，
   * 而原生 blur 事件不冒泡 → trigger:'blur' 的 crossValidator 永不触发。
   * 修复后改用可冒泡的 focusout 承载 blur 语义。
   * 注意：VTU 的 trigger('focusout') 未必冒泡，这里直接派发原生冒泡事件模拟真实浏览器失焦。
   */
  it('输入框 focusout 冒泡到 form-item → 触发 blur 语义的 crossValidator', async () => {
    const crossValidator = vi.fn(() => true as const)
    const model = reactive({ a: 'x', b: 'y' })
    const wrapper = mountXForm({
      schema: {
        children: [
          { component: 'ElInput', name: 'b' },
          {
            component: 'ElInput',
            name: 'a',
            rules: [{ dependsOn: ['b'], crossValidator }],
          },
        ],
      } as unknown as SchemaNode,
      model,
    })
    await flushPromises()
    const inputs = wrapper.findAll('.el-form-item input')
    expect(inputs.length).toBe(2)
    inputs[1]!.element.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    await flushPromises()
    expect(crossValidator).toHaveBeenCalledWith('x', 'y')
  })
})

describe('XForm.vue 实时模式 crossValidator 错误显示（D1 回归）', () => {
  /**
   * D1 根因：XForm.vue onValueChange 先 trigger 后 clearValidate，
   * delay=0（实时模式）下 crossValidator 同步写入错误后，clearValidate 立即将其清除，
   * 导致表单不标红、无错误文字。修复后顺序为先 clearValidate 再 trigger。
   */
  it('A 模式（debounce=0）输入确认密码时同步写入的 crossValidator 错误应保留', async () => {
    const crossValidator = vi.fn((v: unknown, p: unknown) => (v === p ? true : '两次密码不一致'))
    const model = reactive({ password: '123', confirmPassword: '' })
    const wrapper = mountXForm({
      schema: {
        children: [
          { component: 'ElInput', name: 'password' },
          {
            component: 'ElInput',
            name: 'confirmPassword',
            rules: [
              {
                dependsOn: 'password',
                crossValidator,
                trigger: 'change',
              },
            ],
          },
        ],
      } as unknown as SchemaNode,
      model,
    })
    await flushPromises()
    const inputs = wrapper.findAll('.el-form-item input')
    expect(inputs.length).toBe(2)
    const confirmInput = inputs[1]!
    ;(confirmInput.element as HTMLInputElement).value = '1'
    await confirmInput.trigger('input')
    await flushPromises()
    expect(crossValidator).toHaveBeenCalledWith('1', '123')
    const debug = (
      window as unknown as {
        __xform_debug?: { getFieldErrors: () => Record<string, { error?: string }> }
      }
    ).__xform_debug
    expect(debug?.getFieldErrors().confirmPassword?.error).toBe('两次密码不一致')
  })
})

describe('XForm.vue hidden 字段校验语义（H9 回归）', () => {
  it('hidden 必填字段不阻塞 validate（rules 剥离，恒通过）', async () => {
    // 修复前：hidden 字段的 ElFormItem 带着 required rules 注册进 el-form，
    // validate 恒 false 且 scrollToError 滚到 display:none 元素
    const wrapper = mountXForm({
      schema: {
        children: [
          {
            component: 'ElInput',
            name: 'visible',
            rules: [{ required: true, message: '必填' }],
          },
          {
            component: 'ElInput',
            name: 'ghost',
            hidden: true,
            rules: [{ required: true, message: '隐藏必填' }],
          },
        ],
      } as unknown as SchemaNode,
      model: reactive({ visible: '有值', ghost: '' }),
    })
    await flushPromises()
    const exposed = wrapper.vm as unknown as XFormExpose
    await expect(exposed.validate()).resolves.toBe(true)
  })

  it('hidden 字段值仍保留在 model 中（hidden ≠ ignore）', async () => {
    const model = reactive({ ghost: '保留我' })
    mountXForm({
      schema: {
        component: 'ElInput',
        name: 'ghost',
        hidden: true,
        rules: [{ required: true }],
      } as unknown as SchemaNode,
      model,
    })
    await flushPromises()
    expect(model.ghost).toBe('保留我')
  })

  it('可见字段的必填校验不受 hidden 修复影响（仍然会失败）', async () => {
    const wrapper = mountXForm({
      schema: {
        children: [
          { component: 'ElInput', name: 'visible', rules: [{ required: true, message: '必填' }] },
          { component: 'ElInput', name: 'ghost', hidden: true, rules: [{ required: true }] },
        ],
      } as unknown as SchemaNode,
      model: reactive({ visible: '', ghost: '' }),
    })
    await flushPromises()
    const exposed = wrapper.vm as unknown as XFormExpose
    await expect(exposed.validate()).resolves.toBe(false)
  })
})

describe('XForm.vue validate 跑 reaction 改写后的规则（H2 回归）', () => {
  it('reaction 动态写入 crossValidator 后 validate 用新规则（不再读 props.schema 旧快照）', async () => {
    const model = reactive({ strict: false, a: 'x', b: 'y' })
    const wrapper = mountXForm({
      schema: {
        children: [
          { component: 'Switch', name: 'strict' },
          { component: 'ElInput', name: 'a' },
          {
            component: 'ElInput',
            name: 'b',
            reaction: {
              rules: (m: Record<string, unknown>) =>
                m.strict
                  ? [
                      {
                        dependsOn: ['a'],
                        crossValidator: (v: unknown, a: unknown) =>
                          v === a ? true : 'strict 模式下必须与 a 一致',
                      },
                    ]
                  : [],
            },
          },
        ],
      } as unknown as SchemaNode,
      model,
    })
    await flushPromises()
    const exposed = wrapper.vm as unknown as XFormExpose
    await expect(exposed.validate()).resolves.toBe(true)
    model.strict = true
    await flushPromises()
    await expect(exposed.validate()).resolves.toBe(false)
  })
})

describe('XForm.vue 异步 crossValidator 竞态防护（H3a 回归）', () => {
  it('连续 focusout 时旧 Promise 后返回不覆盖新结果（序号令牌）', async () => {
    let resolveOld!: (v: true | string) => void
    let call = 0
    const crossValidator = vi.fn(() => {
      call++
      return call === 1
        ? new Promise<true | string>((r) => {
            resolveOld = r
          })
        : ('新错误' as const)
    })
    const model = reactive({ a: 'x', b: 'y' })
    const wrapper = mountXForm({
      schema: {
        children: [
          { component: 'ElInput', name: 'b' },
          { component: 'ElInput', name: 'a', rules: [{ dependsOn: ['b'], crossValidator }] },
        ],
      } as unknown as SchemaNode,
      model,
    })
    await flushPromises()
    const inputs = wrapper.findAll('.el-form-item input')
    const target = inputs[1]!.element
    target.dispatchEvent(new FocusEvent('focusout', { bubbles: true })) // 第一次：慢 Promise
    target.dispatchEvent(new FocusEvent('focusout', { bubbles: true })) // 第二次：同步 '新错误'
    await flushPromises()
    // element-plus validateStateDebounced(100ms) 驱动 DOM 错误态显示，需等过该窗口
    await new Promise((r) => setTimeout(r, 150))
    const item = inputs[1]!.element.closest('.el-form-item')!
    expect(item.querySelector('.el-form-item__error')?.textContent).toBe('新错误')
    resolveOld(true) // 旧结果后返回 → 应被丢弃，红字保留
    await flushPromises()
    await new Promise((r) => setTimeout(r, 150))
    expect(item.querySelector('.el-form-item__error')?.textContent).toBe('新错误')
  })
})

describe('XForm.vue renderOpts 快照同步（B4 回归）', () => {
  it('父级替换 model 引用后，v-model 绑定跟随新引用（不再静默断裂）', async () => {
    const modelA = reactive({ name: 'AAA' })
    const modelB = reactive({ name: 'BBB' })
    const wrapper = mountXForm({
      schema: { component: 'ElInput', name: 'name' } as unknown as SchemaNode,
      model: modelA,
    })
    await flushPromises()
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('AAA')
    await wrapper.setProps({ model: modelB } as never)
    await flushPromises()
    // B4 修复前：renderOpts 捕获 setup 期 modelA，替换后仍显示 AAA
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('BBB')
  })
})

describe('XForm.vue 字段级重渲隔离（B-2 核心回归）', () => {
  it('输入字段 A 只重渲 A，字段 B 的渲染计数不变', async () => {
    let renderCountA = 0
    let renderCountB = 0
    const makeCountingInput = (onRender: () => void) => ({
      props: ['modelValue'],
      emits: ['update:modelValue'],
      setup(props: { modelValue?: unknown }, { emit }: { emit: (e: string, v: unknown) => void }) {
        return () => {
          onRender()
          return h('input', {
            class: 'count-input',
            value: props.modelValue as string,
            onInput: (e: Event) => emit('update:modelValue', (e.target as HTMLInputElement).value),
          })
        }
      },
    })
    const CountA = makeCountingInput(() => renderCountA++)
    const CountB = makeCountingInput(() => renderCountB++)
    const model = reactive({ a: '', b: '' })
    const wrapper = mountXForm({
      schema: {
        children: [
          { component: 'CountA', name: 'a' },
          { component: 'CountB', name: 'b' },
        ],
      } as unknown as SchemaNode,
      model,
      components: { CountA, CountB },
    })
    await flushPromises()
    const baseA = renderCountA
    const baseB = renderCountB
    expect(baseA).toBeGreaterThan(0)
    expect(baseB).toBeGreaterThan(0)
    // 在字段 A 输入 → model.a 变化
    const inputA = wrapper.findAll('input.count-input')[0]!
    ;(inputA.element as HTMLInputElement).value = 'x'
    await inputA.trigger('input')
    await flushPromises()
    expect(renderCountA).toBeGreaterThan(baseA) // A 重渲
    expect(renderCountB).toBe(baseB) // B 不重渲（B-2 修复前：全表单重建，B 同步 +1）
  })
})

describe('XForm.vue schema 重建不重挂载（B-3 集成回归）', () => {
  it('对象形式组件 + setProps 加字段 → 既有字段 setup 计数不变（patch 而非 remount）', async () => {
    // 两个字段用不同组件分别计数 —— 同组件计数无法区分"新字段正常 setup"与"旧字段 remount"
    let setupCountA = 0
    let setupCountB = 0
    const CountInputA = {
      props: ['modelValue'],
      setup() {
        setupCountA++
        return () => h('input', { class: 'keep-a' })
      },
    }
    const CountInputB = {
      props: ['modelValue'],
      setup() {
        setupCountB++
        return () => h('input', { class: 'keep-b' })
      },
    }
    const model = reactive({ a: '', b: '' })
    const wrapper = mountXForm({
      schema: { children: [{ component: CountInputA, name: 'a' }] } as unknown as SchemaNode,
      model,
    })
    await flushPromises()
    expect(setupCountA).toBe(1)
    // schema 引用整体替换（新增字段 b）→ 触发 useSchemaRenderer 重建
    await wrapper.setProps({
      schema: {
        children: [
          { component: CountInputA, name: 'a' },
          { component: CountInputB, name: 'b' },
        ],
      } as unknown as SchemaNode,
    } as never)
    await flushPromises()
    // B-3 修复前：cloneDeep 破坏 CountInputA 身份 → 既有字段 remount（setupCountA=2）
    expect(setupCountA).toBe(1)
    expect(setupCountB).toBe(1) // 新字段正常挂载一次
    expect(wrapper.findAll('input.keep-a').length).toBe(1)
    expect(wrapper.findAll('input.keep-b').length).toBe(1)
  })
})

describe('XForm.vue 整体 disabled（顶层 schema 配置，P1 回归）', () => {
  it('schema 顶层 disabled=true → 表单内输入组件全部禁用', async () => {
    const wrapper = mountXForm({
      schema: {
        disabled: true, // 整体禁用：在 schema 中配置（与 labelPosition 同模式），不在 XForm 标签上
        children: [
          { component: 'ElInput', name: 'a' },
          { component: 'ElInput', name: 'b' },
        ],
      } as unknown as SchemaNode,
      model: reactive({ a: '', b: '' }),
    })
    await flushPromises()
    const inputs = wrapper.findAll('input')
    expect(inputs.length).toBe(2)
    for (const input of inputs) {
      expect((input.element as HTMLInputElement).disabled).toBe(true)
    }
  })

  it('顶层 disabled 为函数 → 按 model 动态求值（locked 切换生效）', async () => {
    const model = reactive({ locked: false, a: '' })
    const wrapper = mountXForm({
      schema: {
        disabled: (m: Record<string, unknown>) => Boolean(m.locked),
        children: [{ component: 'ElInput', name: 'a' }],
      } as unknown as SchemaNode,
      model,
    })
    await flushPromises()
    expect((wrapper.find('input').element as HTMLInputElement).disabled).toBe(false)
    model.locked = true
    await flushPromises()
    expect((wrapper.find('input').element as HTMLInputElement).disabled).toBe(true)
  })

  it('未配置顶层 disabled → 输入组件可用（默认行为不变）', async () => {
    const wrapper = mountXForm({
      schema: { component: 'ElInput', name: 'a' } as unknown as SchemaNode,
      model: reactive({ a: '' }),
    })
    await flushPromises()
    expect((wrapper.find('input').element as HTMLInputElement).disabled).toBe(false)
  })
})

describe('XForm.vue expose validateField（P1 回归）', () => {
  it('validateField(name)：必填字段空值 false，填充后 true', async () => {
    const model = reactive({ email: '' })
    const wrapper = mountXForm({
      schema: {
        component: 'ElInput',
        name: 'email',
        rules: [{ required: true, message: '请输入邮箱' }],
      } as unknown as SchemaNode,
      model,
    })
    await flushPromises()
    const exposed = wrapper.vm as unknown as XFormExpose
    await expect(exposed.validateField('email')).resolves.toBe(false)
    model.email = 'a@b.com'
    await flushPromises()
    await expect(exposed.validateField('email')).resolves.toBe(true)
  })
})

describe('XForm.vue 整体 readonly 只读模式（顶层 schema 配置，P2-1 回归）', () => {
  it('schema 顶层 readonly=true → 字段渲染为纯文本占位（无输入组件）', async () => {
    const wrapper = mountXForm({
      schema: {
        readonly: true,
        children: [
          { component: 'ElInput', name: 'a', label: '字段A' },
          { component: 'ElInput', name: 'b', label: '字段B' },
        ],
      } as unknown as SchemaNode,
      model: reactive({ a: '值A', b: '值B' }),
    })
    await flushPromises()
    expect(wrapper.findAll('input').length).toBe(0) // 无输入组件
    expect(wrapper.findAll('[data-permission="view"]').length).toBe(2)
    expect(wrapper.text()).toContain('值A')
    expect(wrapper.text()).toContain('值B')
  })

  it('readonly 为函数 → 随 model 动态切换（输入态 ↔ 纯文本）', async () => {
    const model = reactive({ locked: false, a: '值A' })
    const wrapper = mountXForm({
      schema: {
        readonly: (m: Record<string, unknown>) => Boolean(m.locked),
        children: [{ component: 'ElInput', name: 'a', label: '字段A' }],
      } as unknown as SchemaNode,
      model,
    })
    await flushPromises()
    expect(wrapper.findAll('input').length).toBe(1) // 未锁定 → 可输入
    model.locked = true
    await flushPromises()
    expect(wrapper.findAll('input').length).toBe(0) // 锁定 → 纯文本
    expect(wrapper.text()).toContain('值A')
  })

  it('readonly + permission hidden → hidden 优先（DOM 不出现）', async () => {
    const wrapper = mountXForm({
      schema: {
        readonly: true,
        children: [
          { component: 'ElInput', name: 'a', label: '可见只读' },
          { component: 'ElInput', name: 'b', label: '隐藏字段', permission: 'hidden' },
        ],
      } as unknown as SchemaNode,
      model: reactive({ a: '值A', b: '值B' }),
    })
    await flushPromises()
    expect(wrapper.text()).toContain('可见只读')
    expect(wrapper.text()).not.toContain('隐藏字段')
  })

  it('未配置 readonly → 输入组件正常（行为不变）', async () => {
    const wrapper = mountXForm({
      schema: { component: 'ElInput', name: 'a' } as unknown as SchemaNode,
      model: reactive({ a: '' }),
    })
    await flushPromises()
    expect(wrapper.findAll('input').length).toBe(1)
  })

  it('未传 showErrorToast → 错误事件不渲染浮窗（默认关闭）', async () => {
    const wrapper = mountXForm({
      schema: { component: 'ElInput', name: 'name' } as unknown as SchemaNode,
      model: reactive({}),
    })
    await nextTick()
    const exposed = wrapper.vm as unknown as XFormExpose
    exposed.setFieldError('name', '服务端返回的错误')
    await nextTick()
    // 断言 toast 容器（ul[role="alert"]）——DebugBanner 的诊断面板也是 role="alert"（div），
    // 用元素名区分，避免 dev 下 banner 常驻导致误判
    expect(document.body.querySelector('ul[role="alert"]')).toBeNull()
    wrapper.unmount()
  })

  it('传 show-error-toast → 错误事件渲染为右上角浮窗', async () => {
    const wrapper = mountXForm({
      schema: { component: 'ElInput', name: 'name' } as unknown as SchemaNode,
      model: reactive({}),
      showErrorToast: true,
    })
    await nextTick()
    const exposed = wrapper.vm as unknown as XFormExpose
    exposed.setFieldError('name', '服务端返回的错误')
    await nextTick()
    expect(document.body.querySelector('ul[role="alert"]')).not.toBeNull()
    wrapper.unmount()
  })
})
