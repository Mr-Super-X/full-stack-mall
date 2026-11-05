/**
 * useZodValidator —— zod 顶层校验编排（与 el-form.validate 并行入口）
 *
 * 未配置 zodSchema 时返回 { success: true, errors: null }。
 *
 * @see ./use-validate.ts validateWithZod 底层实现
 * @see ./use-form-instance.ts 装配方
 *
 * @group 表单编排：校验
 */
import type { ZodError, ZodType } from 'zod'
import { validateWithZod } from './use-validate'

/**
 * useZodValidator 返回值 —— 顶层 zod 校验入口
 *
 * validateFormWithZod(): 与 el-form.validate 并行入口，未配置 zodSchema 时静默成功
 */
export interface UseZodValidatorReturn {
  /**
   * 顶层 zod 校验 —— 与 el-form.validate 并行入口
   * - 未配置 zodSchema 时静默成功（与原行为一致）
   * - 配置后跑 zod.safeParse；失败时 errors 含完整 ZodError
   */
  validateFormWithZod: () => { success: boolean; errors: ZodError | null }
}

/** 构造 zod 顶层校验器 */
export function useZodValidator(
  model: () => Record<string, unknown> | undefined,
  zodSchema: () => ZodType | undefined
): UseZodValidatorReturn {
  function validateFormWithZod(): { success: boolean; errors: ZodError | null } {
    const zs = zodSchema()
    if (!zs) return { success: true, errors: null }
    return validateWithZod(zs, model() ?? {})
  }

  return { validateFormWithZod }
}
