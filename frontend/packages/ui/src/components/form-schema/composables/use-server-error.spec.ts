/**
 * useServerError 单元测试
 * 覆盖：
 * - 422 响应（数组格式）→ 写入字段错误
 * - 422 响应（对象格式）→ 写入字段错误
 * - 已知字段过滤（未注册的字段静默跳过）
 * - success=true → 清空所有服务端错误
 * - success=true 与 errors 同时存在：清空旧错误 + 写入新错误
 */
import { describe, it, expect, vi } from 'vitest'
import { useServerError } from './use-server-error'

describe('useServerError / validateFromServer', () => {
  it('422 响应（数组格式）写入字段错误', () => {
    const setFieldError = vi.fn()
    const clearValidate = vi.fn()
    const { validateFromServer } = useServerError({
      setFieldError,
      clearValidate,
      knownFields: () => ['username', 'email'],
    })

    const count = validateFromServer({
      success: false,
      errors: [
        { field: 'username', message: '用户名已存在' },
        { field: 'email', message: '该邮箱已被注册' },
      ],
    })

    expect(count).toBe(2)
    expect(clearValidate).toHaveBeenCalledWith(['username', 'email'])
    expect(setFieldError).toHaveBeenCalledWith('username', '用户名已存在')
    expect(setFieldError).toHaveBeenCalledWith('email', '该邮箱已被注册')
  })

  it('422 响应（对象格式 path 字段）写入字段错误', () => {
    const setFieldError = vi.fn()
    const clearValidate = vi.fn()
    const { validateFromServer } = useServerError({
      setFieldError,
      clearValidate,
      knownFields: () => ['username'],
    })

    const count = validateFromServer({
      success: false,
      errors: { username: '用户名已存在' },
    })

    expect(count).toBe(1)
    expect(setFieldError).toHaveBeenCalledWith('username', '用户名已存在')
  })

  it('已知字段过滤：未注册的字段静默跳过', () => {
    const setFieldError = vi.fn()
    const clearValidate = vi.fn()
    const { validateFromServer } = useServerError({
      setFieldError,
      clearValidate,
      knownFields: () => ['username'],
    })

    const count = validateFromServer({
      success: false,
      errors: [
        { field: 'username', message: 'err1' },
        { field: 'unknownField', message: 'err2' },
      ],
    })

    expect(count).toBe(1)
    expect(setFieldError).toHaveBeenCalledTimes(1)
    expect(setFieldError).toHaveBeenCalledWith('username', 'err1')
  })

  it('已知字段过滤：空响应返回 0', () => {
    const setFieldError = vi.fn()
    const clearValidate = vi.fn()
    const { validateFromServer } = useServerError({
      setFieldError,
      clearValidate,
      knownFields: () => ['username'],
    })

    const count = validateFromServer({ success: false, errors: [] })
    expect(count).toBe(0)
    expect(setFieldError).not.toHaveBeenCalled()
    expect(clearValidate).not.toHaveBeenCalled()
  })

  it('success=true 清空所有字段错误（修复 bug）', () => {
    const setFieldError = vi.fn()
    const clearValidate = vi.fn()
    const { validateFromServer } = useServerError({
      setFieldError,
      clearValidate,
      knownFields: () => ['username', 'email'],
    })

    const count = validateFromServer({ success: true })

    expect(count).toBe(0)
    expect(setFieldError).not.toHaveBeenCalled()
    // 关键：clearValidate 必须被以 undefined 调用（清空所有字段）
    expect(clearValidate).toHaveBeenCalledWith(undefined)
  })

  it('success=true 不带 errors 也清空', () => {
    const setFieldError = vi.fn()
    const clearValidate = vi.fn()
    const { validateFromServer } = useServerError({
      setFieldError,
      clearValidate,
      knownFields: () => ['username'],
    })

    // 即使没有 errors 字段，只要 success=true 也清空
    validateFromServer({ success: true })
    expect(clearValidate).toHaveBeenCalledWith(undefined)
  })

  it('success=true + errors 共存：清空旧 + 写入新（语义明确）', () => {
    const setFieldError = vi.fn()
    const clearValidate = vi.fn()
    const { validateFromServer } = useServerError({
      setFieldError,
      clearValidate,
      knownFields: () => ['username', 'email'],
    })

    const count = validateFromServer({
      success: true,
      errors: [{ field: 'email', message: '新错误' }],
    })

    // 即使标记 success=true，依然以 errors 为准（实际后端不会这么做，但防御性处理）
    expect(count).toBe(1)
    expect(clearValidate).toHaveBeenCalledWith(['email'])
    expect(setFieldError).toHaveBeenCalledWith('email', '新错误')
  })

  it('不传 knownFields：不过滤，写入所有', () => {
    const setFieldError = vi.fn()
    const clearValidate = vi.fn()
    const { validateFromServer } = useServerError({
      setFieldError,
      clearValidate,
    })

    const count = validateFromServer({
      success: false,
      errors: [{ field: 'any', message: 'err' }],
    })
    expect(count).toBe(1)
    expect(setFieldError).toHaveBeenCalledWith('any', 'err')
  })
})
