/**
 * useXFormDemo 单测 —— 验证样板行为与原 demo 内联实现等价
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref, nextTick } from 'vue'
import { useXFormDemo } from './useXFormDemo'
import type { XFormExpose, SchemaNode } from '@vv/ui/components/form-schema/types'

// mock element-plus ElMessage（避免 toast 真弹）
vi.mock('element-plus', () => ({
  ElMessage: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}))

// mock navigator.clipboard
const mockWriteText = vi.fn()
Object.assign(navigator, { clipboard: { writeText: mockWriteText } })

import { ElMessage } from 'element-plus'

const sampleSchema: SchemaNode = {
  component: 'Input',
  name: 'email',
  label: '邮箱',
}

const sampleModel = { email: 'a@b.com' }

function makeMockExpose(overrides: Partial<XFormExpose> = {}): XFormExpose {
  return {
    getRef: vi.fn(),
    getNames: vi.fn(() => []),
    validate: vi.fn(async () => true),
    validateDetail: vi.fn(async () => ({ isValid: true, errors: [] })),
    clearValidate: vi.fn(),
    resetFields: vi.fn(),
    validateField: vi.fn(async () => true),
    scrollToField: vi.fn(),
    validateWithZod: vi.fn(() => ({ success: true, errors: null })),
    setFieldError: vi.fn(),
    setFieldValidating: vi.fn(),
    addItem: vi.fn(),
    removeItem: vi.fn(),
    moveItem: vi.fn(),
    isDirty: vi.fn(() => false),
    getDirtyFields: vi.fn(() => []),
    isTouched: vi.fn(() => false),
    resetDirty: vi.fn(),
    validateFromServer: vi.fn(() => 0),
    ...overrides,
  }
}

describe('useXFormDemo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('formRef 初始为 null', () => {
    const { formRef } = useXFormDemo({ name: 'base', schema: sampleSchema })
    expect(formRef.value).toBeNull()
  })

  it('bem 命名空间为 demo-x-form-{name}', () => {
    const { bem } = useXFormDemo({ name: 'base', schema: sampleSchema })
    expect(bem.b()).toBe('vv-demo-x-form-base')
    expect(bem.e('action')).toBe('vv-demo-x-form-base__action')
  })

  it('onReset 调 formRef.resetFields', () => {
    const { formRef, onReset } = useXFormDemo({ name: 'base', schema: sampleSchema })
    const expose = makeMockExpose()
    formRef.value = expose
    onReset()
    expect(expose.resetFields).toHaveBeenCalledOnce()
  })

  it('onSave 校验通过：返回 true + success toast', async () => {
    const { formRef, onSave } = useXFormDemo({ name: 'base', schema: sampleSchema })
    formRef.value = makeMockExpose({ validate: vi.fn(async () => true) })
    const ok = await onSave()
    expect(ok).toBe(true)
    expect(ElMessage.success).toHaveBeenCalledWith('保存成功')
    expect(ElMessage.error).not.toHaveBeenCalled()
  })

  it('onSave 校验失败：返回 false + failMessage toast', async () => {
    const { formRef, onSave } = useXFormDemo({
      name: 'base',
      schema: sampleSchema,
      failMessage: '自定义失败',
    })
    formRef.value = makeMockExpose({ validate: vi.fn(async () => false) })
    const ok = await onSave()
    expect(ok).toBe(false)
    expect(ElMessage.error).toHaveBeenCalledWith('自定义失败')
    expect(ElMessage.success).not.toHaveBeenCalled()
  })

  it('onSave 自定义 successMessage', async () => {
    const { formRef, onSave } = useXFormDemo({
      name: 'base',
      schema: sampleSchema,
      successMessage: '提交完成',
    })
    formRef.value = makeMockExpose()
    await onSave()
    expect(ElMessage.success).toHaveBeenCalledWith('提交完成')
  })

  it('onSave successMessage=false 时关闭成功 toast', async () => {
    const { formRef, onSave } = useXFormDemo({
      name: 'base',
      schema: sampleSchema,
      successMessage: false,
    })
    formRef.value = makeMockExpose()
    await onSave()
    expect(ElMessage.success).not.toHaveBeenCalled()
  })

  it('onSave formRef 未绑定时返回 false', async () => {
    const { onSave } = useXFormDemo({ name: 'base', schema: sampleSchema })
    const ok = await onSave()
    expect(ok).toBe(false)
  })

  it('copySchema 把 schema JSON 写入剪贴板（值形式）', async () => {
    const { copySchema } = useXFormDemo({ name: 'base', schema: sampleSchema })
    mockWriteText.mockResolvedValueOnce(undefined)
    await copySchema()
    expect(mockWriteText).toHaveBeenCalledWith(JSON.stringify(sampleSchema, null, 2))
    expect(ElMessage.success).toHaveBeenCalledWith('schema 已复制到剪贴板')
  })

  it('copySchema 把 schema JSON 写入剪贴板（getter 形式）', async () => {
    const dynamicSchema = ref<SchemaNode>(sampleSchema)
    const { copySchema } = useXFormDemo({
      name: 'base',
      schema: () => dynamicSchema.value,
    })
    mockWriteText.mockResolvedValueOnce(undefined)
    await copySchema()
    expect(mockWriteText).toHaveBeenCalledWith(JSON.stringify(sampleSchema, null, 2))
    // 改变 schema 后应反映
    dynamicSchema.value = { component: 'Select', name: 'role' } as SchemaNode
    await nextTick()
    mockWriteText.mockResolvedValueOnce(undefined)
    await copySchema()
    expect(mockWriteText).toHaveBeenLastCalledWith(
      JSON.stringify({ component: 'Select', name: 'role' }, null, 2)
    )
  })

  it('copySchema 剪贴板失败时弹错误 toast', async () => {
    const { copySchema } = useXFormDemo({ name: 'base', schema: sampleSchema })
    mockWriteText.mockRejectedValueOnce(new Error('denied'))
    await copySchema()
    expect(ElMessage.error).toHaveBeenCalledWith('复制失败，请手动选择')
  })

  it('copyModel 写入 model JSON', async () => {
    const { copyModel } = useXFormDemo({ name: 'base', schema: sampleSchema, model: sampleModel })
    mockWriteText.mockResolvedValueOnce(undefined)
    await copyModel()
    expect(mockWriteText).toHaveBeenCalledWith(JSON.stringify(sampleModel, null, 2))
  })

  it('copyModel 未传 model 时弹 warning', async () => {
    const { copyModel } = useXFormDemo({ name: 'base', schema: sampleSchema })
    await copyModel()
    expect(ElMessage.warning).toHaveBeenCalledWith('model 未传入，无法复制')
    expect(mockWriteText).not.toHaveBeenCalled()
  })

  it('返回的 formRef 可被外部 ref<XFormExpose> 替换使用', () => {
    const { formRef } = useXFormDemo({ name: 'base', schema: sampleSchema })
    // 模拟 XForm ref 绑定
    formRef.value = makeMockExpose()
    expect(formRef.value).not.toBeNull()
    expect(typeof formRef.value?.validate).toBe('function')
  })
})
