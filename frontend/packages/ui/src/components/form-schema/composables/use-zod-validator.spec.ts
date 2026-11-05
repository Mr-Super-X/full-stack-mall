/**
 * useZodValidator 单元测试
 *
 * 覆盖：
 * - 未配置 zodSchema → 静默成功 { success: true, errors: null }
 * - 配置 zodSchema + 通过校验 → success: true
 * - 配置 zodSchema + 失败 → success: false + ZodError 含 issues
 * - model 为 undefined → 安全降级（使用 {}）
 */
import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { useZodValidator } from './use-zod-validator'

describe('useZodValidator', () => {
  it('未配置 zodSchema → 返回静默成功', () => {
    const { validateFormWithZod } = useZodValidator(
      () => ({ a: 1 }),
      () => undefined
    )
    expect(validateFormWithZod()).toEqual({ success: true, errors: null })
  })

  it('zod 校验通过 → success: true, errors: null', () => {
    const schema = z.object({ name: z.string() })
    const { validateFormWithZod } = useZodValidator(
      () => ({ name: 'alice' }),
      () => schema
    )
    const result = validateFormWithZod()
    expect(result.success).toBe(true)
    expect(result.errors).toBeNull()
  })

  it('zod 校验失败 → success: false + ZodError 含 issues', () => {
    const schema = z.object({ name: z.string().min(3) })
    const { validateFormWithZod } = useZodValidator(
      () => ({ name: 'a' }),
      () => schema
    )
    const result = validateFormWithZod()
    expect(result.success).toBe(false)
    expect(result.errors).not.toBeNull()
    expect(result.errors!.issues).toHaveLength(1)
    expect(result.errors!.issues[0]?.path).toEqual(['name'])
  })

  it('model 为 undefined → 安全降级使用空对象', () => {
    const schema = z.object({ name: z.string() })
    const { validateFormWithZod } = useZodValidator(
      () => undefined,
      () => schema
    )
    const result = validateFormWithZod()
    expect(result.success).toBe(false)
    expect(result.errors!.issues[0]?.path).toEqual(['name'])
  })

  it('getter 形式：model/zodSchema 改变时下次调用取新值', () => {
    let model: Record<string, unknown> = { name: 'alice' }
    let schema: z.ZodType | undefined = z.object({ name: z.string() })
    const { validateFormWithZod } = useZodValidator(
      () => model,
      () => schema
    )
    expect(validateFormWithZod().success).toBe(true)

    // 切换到失败数据
    model = { name: 123 }
    expect(validateFormWithZod().success).toBe(false)

    // 切换到 undefined schema
    schema = undefined
    expect(validateFormWithZod()).toEqual({ success: true, errors: null })
  })
})
