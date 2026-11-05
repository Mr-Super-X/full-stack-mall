import { describe, it, expect } from 'vitest'
import { createScssPreprocessorOptions } from './scss'

describe('createScssPreprocessorOptions', () => {
  it('silenceDeprecations 包含 new-global 与 if-function', () => {
    const options = createScssPreprocessorOptions({ bemPath: '/proj/src/assets/styles/mixins/bem' })
    expect(options.silenceDeprecations).toContain('new-global')
    expect(options.silenceDeprecations).toContain('if-function')
  })

  it('additionalData 用裸模块名 @use（R7：绝对路径 @use 被 sass 拒绝，盘符冒号被当 URL scheme）', () => {
    const options = createScssPreprocessorOptions({ bemPath: '/proj/src/assets/styles/mixins/bem' })
    expect(options.additionalData).toContain("@use 'bem' as *")
  })

  it('bemPath 目录部分进入 loadPaths（sass 模块搜索路径）', () => {
    const options = createScssPreprocessorOptions({ bemPath: '/proj/src/assets/styles/mixins/bem' })
    expect(options.loadPaths).toEqual(['/proj/src/assets/styles/mixins'])
  })

  it('默认 $BEM_PREFIX 为 vv', () => {
    const options = createScssPreprocessorOptions({ bemPath: '/x/bem' })
    expect(options.additionalData).toContain("$BEM_PREFIX: 'vv'")
    expect(options.loadPaths).toEqual(['/x'])
  })

  it('Windows 反斜杠路径归一为正斜杠（反斜杠在 sass 字符串里是转义符）', () => {
    const options = createScssPreprocessorOptions({
      bemPath: 'D:\\proj\\apps\\admin\\src\\assets\\styles\\mixins\\bem',
    })
    expect(options.loadPaths).toEqual(['D:/proj/apps/admin/src/assets/styles/mixins'])
    expect(options.additionalData).not.toContain('\\\\')
  })
})
