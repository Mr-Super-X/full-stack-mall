import format from './commitlint-formatter.cjs'
import { describe, expect, it } from 'vitest'

describe('commitlint 中文 formatter', () => {
  it('将常见规则的英文错误信息完整翻译为中文', () => {
    const output = format({
      results: [
        {
          input: '错误提交信息',
          errors: [
            { name: 'type-empty', message: 'type may not be empty' },
            { name: 'subject-empty', message: 'subject may not be empty' },
          ],
          warnings: [],
        },
      ],
    })

    expect(output).toContain('type 不能为空')
    expect(output).toContain('subject 不能为空')
    expect(output).not.toContain('may not be empty')
  })
})
