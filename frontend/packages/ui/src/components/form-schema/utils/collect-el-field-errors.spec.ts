import { describe, it, expect } from 'vitest'
import { collectElFieldErrors } from './collect-el-field-errors'

/** 构造一个模拟的 element-plus ElFormItemContext field */
function mockField(name: string, state: string, message: string, value?: unknown) {
  return {
    propString: { value: name },
    validateState: { value: state },
    validateMessage: { value: message },
    ...(value !== undefined ? { fieldValue: { value } } : {}),
  }
}

describe('collectElFieldErrors', () => {
  it('只收集 validateState=error 且有 message 的字段', () => {
    const ef = {
      fields: [
        mockField('email', 'error', '邮箱格式错误', 'abc'),
        mockField('name', 'success', ''),
        mockField('age', 'error', ''), // 无 message → 跳过
        mockField('city', 'error', '必填', 42),
      ],
    }
    const details = collectElFieldErrors(ef, { includeValue: true })
    expect(details).toEqual([
      { field: 'email', message: '邮箱格式错误', value: 'abc' },
      { field: 'city', message: '必填', value: 42 },
    ])
  })

  it('filterNames 只保留命中字段', () => {
    const ef = {
      fields: [mockField('email', 'error', '邮箱错误'), mockField('name', 'error', '姓名错误')],
    }
    const details = collectElFieldErrors(ef, { filterNames: new Set(['email']) })
    expect(details.map((d) => d.field)).toEqual(['email'])
  })

  it('不传 includeValue 时 value 字段缺省', () => {
    const ef = { fields: [mockField('email', 'error', '邮箱错误', 'abc')] }
    const details = collectElFieldErrors(ef)
    expect(details).toEqual([{ field: 'email', message: '邮箱错误' }])
  })

  it('fields 缺失 / 为空时返回空数组', () => {
    expect(collectElFieldErrors({})).toEqual([])
    expect(collectElFieldErrors({ fields: [] })).toEqual([])
  })
})
