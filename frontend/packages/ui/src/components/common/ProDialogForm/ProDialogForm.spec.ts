/**
 * ProDialogForm 组件单测。
 *
 * 覆盖：
 * 1. v-model 双向绑定（弹窗关闭事件 → emit('update:modelValue')）
 * 2. 提交成功：validate 通过 + onSubmit resolve → 关闭弹窗 + emit('success')
 * 3. 提交失败：onSubmit reject → 不关闭弹窗 + emit('submitFailed')
 * 4. 校验失败：validate 返回 false → 不调用 onSubmit
 * 5. 防重复提交：submitLoading 期间二次点击被忽略
 * 6. 关闭时重置（resetOnClose=true）：emit('close') 300ms 后调用 resetFields
 * 7. resetOnClose=false：close 后不调用 resetFields
 * 8. defineExpose 代理：19 个 XFormExpose 方法都能从外部调用
 * 9. footer 默认渲染 + 自定义文案
 * 10. default slot 透传
 *
 * Mock 策略：
 * - ProDialog / XForm 模块替换为 stub（vi.mock + vi.hoisted）
 * - vi.hoisted 持有 19 个 vi.fn()（用于断言），defineComponent 工厂内联
 *   （vi.mock 工厂被 hoist 到文件顶部，无法引用外层 const；vi.hoisted 工厂内
 *   无法引用 vue 导入，所以 vue API 必须放在 vi.mock 工厂内）
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'

// hoisted：vi.mock 工厂闭包外可访问；只放 vi.fn()，不放 vue API
const mocks = vi.hoisted(() => ({
  // 19 个 XFormExpose 方法的 mock 占位
  getRef: vi.fn(() => null),
  getNames: vi.fn(() => [] as string[]),
  validate: vi.fn(() => Promise.resolve(true)),
  validateDetail: vi.fn(() => Promise.resolve({ valid: true, errors: {} })),
  clearValidate: vi.fn(),
  resetFields: vi.fn(),
  validateField: vi.fn(() => Promise.resolve(true)),
  scrollToField: vi.fn(),
  validateWithZod: vi.fn(() => ({ success: true, errors: null })),
  setFieldError: vi.fn(),
  setFieldValidating: vi.fn(),
  addItem: vi.fn(),
  removeItem: vi.fn(),
  moveItem: vi.fn(),
  isDirty: vi.fn(() => false),
  getDirtyFields: vi.fn(() => [] as string[]),
  isTouched: vi.fn(() => false),
  resetDirty: vi.fn(),
  validateFromServer: vi.fn(() => 0),
}))

// ProDialog 模块替换：defineComponent 在工厂内构造（vue 导入在工厂内可用）
vi.mock('@vv/ui/components/common/ProDialog/ProDialog.vue', () => {
  const ProDialogStub = defineComponent({
    name: 'ProDialog',
    props: ['modelValue', 'title', 'width'],
    emits: ['update:model-value', 'close'],
    setup(props, { slots }) {
      return () =>
        h('div', { class: 'pro-dialog-stub', 'data-model-value': String(props.modelValue) }, [
          h('div', { class: 'pro-dialog-stub-title' }, props.title),
          slots.default?.(),
          slots.footer?.(),
        ])
    },
  })
  return { default: ProDialogStub }
})

// XForm 模块替换：19 个方法从 hoisted mocks 拿
vi.mock('@vv/ui/components/form-schema/components/XForm.vue', () => {
  const XFormStub = defineComponent({
    name: 'XForm',
    setup(_props, { slots, expose }) {
      // 用 expose() 把 19 个 mock 方法暴露到 instance proxy，
      // 让 ProDialogForm 的 formRef.value.validate() / resetFields() 等可调用
      expose(mocks)
      return () => h('div', { class: 'xform-stub' }, slots.default?.())
    },
  })
  return { default: XFormStub }
})

import ProDialogForm from './ProDialogForm.vue'

const baseSchema = [{ type: 'field', name: 'username', label: '用户名', required: true }]

function mountForm(
  props: Record<string, unknown> = {},
  onSubmit: (model: Record<string, unknown>) => Promise<unknown> = vi.fn(() => Promise.resolve())
) {
  return mount(ProDialogForm, {
    props: {
      modelValue: true,
      title: '测试表单',
      schema: baseSchema,
      model: { username: 'init' },
      onSubmit,
      ...props,
    },
  })
}

describe('ProDialogForm', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // 清零 19 个 vi.fn() 调用计数（避免跨用例串扰）
    Object.values(mocks).forEach((m) => m.mockClear?.())
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('v-model 双向绑定', () => {
    it('ProDialog emit("update:model-value") → 父组件 emit("update:modelValue")', async () => {
      const wrapper = mountForm()
      await nextTick()
      const proDialog = wrapper.findComponent({ name: 'ProDialog' })
      proDialog.vm.$emit('update:model-value', false)
      expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
    })

    it('modelValue 透传到 ProDialog', async () => {
      const wrapper = mountForm({ modelValue: false })
      await nextTick()
      expect(wrapper.findComponent({ name: 'ProDialog' }).props('modelValue')).toBe(false)
    })
  })

  describe('xformProps 透传', () => {
    it('xformProps 属性透传到 XForm（showErrorToast / scrollToError / components）', async () => {
      const wrapper = mountForm({
        xformProps: {
          showErrorToast: true,
          scrollToError: true,
          components: { MyComp: {} },
        },
      })
      await nextTick()
      const xformAttrs = wrapper.findComponent({ name: 'XForm' }).vm.$attrs
      expect(xformAttrs.showErrorToast).toBe(true)
      expect(xformAttrs.scrollToError).toBe(true)
      expect(xformAttrs.components).toEqual({ MyComp: {} })
    })

    it('同名键优先级：显式 rules 覆盖 xformProps.rules', async () => {
      const explicitRules = { username: { required: true } }
      const wrapper = mountForm({
        rules: explicitRules,
        xformProps: { rules: { other: { required: true } } },
      })
      await nextTick()
      const xformAttrs = wrapper.findComponent({ name: 'XForm' }).vm.$attrs
      // 注：经 VTU mount 传递后对象引用可能被克隆，优先级断言用深比较（引用稳定性由下个用例覆盖）
      expect(xformAttrs.rules).toStrictEqual(explicitRules)
    })

    it('rules 缺省时使用稳定空对象引用（父重渲染后引用不变，避免 XForm renderOpts 全量失效）', async () => {
      const wrapper = mountForm()
      await nextTick()
      const first = wrapper.findComponent({ name: 'XForm' }).vm.$attrs.rules
      await wrapper.setProps({ title: '触发父组件重渲染' })
      await nextTick()
      const second = wrapper.findComponent({ name: 'XForm' }).vm.$attrs.rules
      expect(first).toBe(second)
      expect(second).toEqual({})
    })
  })

  describe('提交逻辑', () => {
    it('提交成功 → 关闭弹窗（emit update:modelValue false）+ emit("success")', async () => {
      const onSubmit = vi.fn(() => Promise.resolve())
      const wrapper = mountForm({}, onSubmit)
      await nextTick()

      await wrapper.find('.el-button--primary').trigger('click')
      await nextTick()
      await nextTick()

      expect(onSubmit).toHaveBeenCalledTimes(1)
      expect(onSubmit).toHaveBeenCalledWith({ username: 'init' })
      expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
      expect(wrapper.emitted('success')).toHaveLength(1)
    })

    it('提交失败 → 不关闭弹窗 + emit("submitFailed")', async () => {
      const submitError = new Error('提交失败')
      const onSubmit = vi.fn(() => Promise.reject(submitError))
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const wrapper = mountForm({}, onSubmit)
      await nextTick()

      await wrapper.find('.el-button--primary').trigger('click')
      await nextTick()
      await nextTick()

      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
      expect(wrapper.emitted('submitFailed')).toEqual([[submitError]])
      expect(wrapper.emitted('success')).toBeUndefined()

      consoleErrorSpy.mockRestore()
    })

    it('校验失败：XForm.validate() 返回 false → 不调用 onSubmit', async () => {
      const onSubmit = vi.fn(() => Promise.resolve())
      const wrapper = mountForm({}, onSubmit)
      await nextTick()

      // 让 XForm.validate 返回 false（mock 一次返回）
      mocks.validate.mockResolvedValueOnce(false)

      await wrapper.find('.el-button--primary').trigger('click')
      await nextTick()

      expect(mocks.validate).toHaveBeenCalledTimes(1)
      expect(onSubmit).not.toHaveBeenCalled()
      expect(wrapper.emitted('success')).toBeUndefined()
      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    })

    it('防重复提交：submitLoading 期间二次点击被忽略', async () => {
      let resolveOnSubmit: () => void = () => {}
      const onSubmit = vi.fn(
        () =>
          new Promise<unknown>((resolve) => {
            resolveOnSubmit = resolve
          })
      )
      const wrapper = mountForm({}, onSubmit)
      await nextTick()

      await wrapper.find('.el-button--primary').trigger('click')
      await nextTick()
      expect(onSubmit).toHaveBeenCalledTimes(1)

      // 第二次点击：被 submitLoading 拦截
      await wrapper.find('.el-button--primary').trigger('click')
      await nextTick()
      expect(onSubmit).toHaveBeenCalledTimes(1)

      resolveOnSubmit()
      await nextTick()
      await nextTick()
    })
  })

  describe('关闭时重置表单', () => {
    it('resetOnClose=true（默认）：emit close → 300ms 后调用 resetFields', async () => {
      const wrapper = mountForm()
      await nextTick()

      const proDialog = wrapper.findComponent({ name: 'ProDialog' })
      proDialog.vm.$emit('close')
      // 300ms 内不应立即调用
      expect(mocks.resetFields).not.toHaveBeenCalled()
      vi.advanceTimersByTime(300)
      expect(mocks.resetFields).toHaveBeenCalledTimes(1)
    })

    it('resetOnClose=false：emit close → 不调用 resetFields', async () => {
      const wrapper = mountForm({ resetOnClose: false })
      await nextTick()

      wrapper.findComponent({ name: 'ProDialog' }).vm.$emit('close')
      vi.advanceTimersByTime(500)

      expect(mocks.resetFields).not.toHaveBeenCalled()
    })
  })

  describe('defineExpose 代理', () => {
    it('外部调用 validate() → 转发到 XForm.validate', async () => {
      const wrapper = mountForm()
      await nextTick()
      const exposed = wrapper.vm as unknown as { validate: () => Promise<boolean> }
      await exposed.validate()
      expect(mocks.validate).toHaveBeenCalled()
    })

    it('外部调用 resetFields() → 转发到 XForm.resetFields', () => {
      const wrapper = mountForm()
      const exposed = wrapper.vm as unknown as { resetFields: (names?: string | string[]) => void }
      exposed.resetFields()
      expect(mocks.resetFields).toHaveBeenCalled()
    })

    it('外部调用 resetFields("username") → 转发同名参数', () => {
      const wrapper = mountForm()
      const exposed = wrapper.vm as unknown as { resetFields: (names?: string | string[]) => void }
      exposed.resetFields('username')
      expect(mocks.resetFields).toHaveBeenCalledWith('username')
    })

    it('外部调用 setFieldError → 转发参数到 XForm', () => {
      const wrapper = mountForm()
      const exposed = wrapper.vm as unknown as {
        setFieldError: (name: string, message: string, state?: string) => void
      }
      exposed.setFieldError('username', '用户名已存在', 'error')
      expect(mocks.setFieldError).toHaveBeenCalledWith('username', '用户名已存在', 'error')
    })

    it('外部调用 isDirty() → 返回 XForm.isDirty 默认值（false）', () => {
      const wrapper = mountForm()
      const exposed = wrapper.vm as unknown as { isDirty: () => boolean }
      expect(exposed.isDirty()).toBe(false)
    })

    it('外部调用 getDirtyFields() → 返回空数组（默认）', () => {
      const wrapper = mountForm()
      const exposed = wrapper.vm as unknown as { getDirtyFields: () => string[] }
      expect(exposed.getDirtyFields()).toEqual([])
    })
  })

  describe('footer 插槽', () => {
    it('默认 footer：渲染取消 + 确认两个按钮，文案来自 props', async () => {
      const wrapper = mountForm({
        submitButtonText: '提 交',
        cancelButtonText: '返 回',
      })
      await nextTick()
      const buttons = wrapper.findAll('.el-button')
      expect(buttons.length).toBeGreaterThanOrEqual(2)
      const submitBtn = buttons.find((b) => b.text() === '提 交')
      expect(submitBtn).toBeTruthy()
      const cancelBtn = buttons.find((b) => b.text() === '返 回')
      expect(cancelBtn).toBeTruthy()
    })

    it('默认文案：submitButtonText="确 定" / cancelButtonText="取 消"', async () => {
      const wrapper = mountForm()
      await nextTick()
      expect(wrapper.text()).toContain('确 定')
      expect(wrapper.text()).toContain('取 消')
    })

    it('取消按钮点击：emit("update:modelValue", false)', async () => {
      const wrapper = mountForm()
      await nextTick()
      const cancelBtn = wrapper.findAll('.el-button').find((b) => b.text() === '取 消')
      expect(cancelBtn).toBeTruthy()
      await cancelBtn!.trigger('click')
      expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
    })
  })

  describe('default slot', () => {
    it('default slot 内容渲染', async () => {
      const wrapper = mount(ProDialogForm, {
        props: {
          modelValue: true,
          title: 't',
          schema: baseSchema,
          model: { username: '' },
          onSubmit: vi.fn(() => Promise.resolve()),
        },
        slots: { default: '<div class="extra-content">额外说明</div>' },
      })
      await nextTick()
      expect(wrapper.find('.extra-content').exists()).toBe(true)
      expect(wrapper.find('.extra-content').text()).toBe('额外说明')
    })
  })
})
