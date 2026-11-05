import { describe, expect, it } from 'vitest'
import postcss from 'postcss'
import {
  H5_DESIGN_WIDTH,
  H5_REM_ROOT_VALUE,
  createH5ExcludeRegex,
  createPostcssPlugins,
} from './postcss'

// 测试用 app 根（正则不涉及真实文件系统，纯字符串匹配）
const APP_ROOT = 'D:/proj/apps/admin'
// win 反斜杠形态 appRoot（vite fileURLToPath 在 win 的产出）
const APP_ROOT_WIN = 'D:\\proj\\apps\\admin'

describe('packages/config postcss — h5 rem 转换配置（函数形态）', () => {
  it('rootValue = 设计稿宽度 / 10（828 稿 → 82.8）', () => {
    expect(H5_DESIGN_WIDTH).toBe(828)
    expect(H5_REM_ROOT_VALUE).toBe(82.8)
  })

  it('enableRem=false 返回空数组（无 h5 版面的 app 零插件）', () => {
    expect(createPostcssPlugins({ appRoot: APP_ROOT, enableRem: false })).toEqual([])
  })

  it('enableRem=true 含且仅含 postcss-pxtorem 插件对象', () => {
    const plugins = createPostcssPlugins({ appRoot: APP_ROOT, enableRem: true })
    expect(plugins).toHaveLength(1)
    expect(plugins[0]).toMatchObject({ postcssPlugin: 'postcss-pxtorem' })
  })

  // exclude 正则语义：命中 = 排除不转换。
  // 用例覆盖 vite 8 真实 file 形态（正斜杠 + ?vue query 后缀），防止函数形态缺陷复发
  // （postcss-pxtorem v6.1.0 exclude 函数返回 false 时 filePath.match(fn) 抛 SyntaxError）
  it.each([
    [
      'h5 layout（正斜杠+query）不排除',
      'D:/proj/apps/admin/src/layouts/h5/index.vue?vue&type=style&index=0&lang.scss',
      false,
    ],
    [
      'h5-demo 模块（正斜杠+query）不排除',
      'D:/proj/apps/admin/src/modules/h5-demo/views/index.vue?vue&type=style&index=0&lang.scss',
      false,
    ],
    [
      'h5 layout（win 反斜杠文件路径）不排除',
      'D:\\proj\\apps\\admin\\src\\layouts\\h5\\index.vue',
      false,
    ],
    [
      'h5-mall 前缀模块（未来扩展）不排除',
      'D:/proj/apps/admin/src/modules/h5-mall/views/index.vue',
      false,
    ],
    [
      'default layout 排除',
      'D:/proj/apps/admin/src/layouts/default/index.vue?vue&type=style&index=0&lang.scss',
      true,
    ],
    [
      'portal layout 排除',
      'D:/proj/apps/admin/src/layouts/portal/index.vue?vue&type=style&index=0&lang.scss',
      true,
    ],
    [
      '普通模块排除',
      'D:/proj/apps/admin/src/modules/user/views/List.vue?vue&type=style&index=0&lang.scss',
      true,
    ],
    [
      'node_modules 排除',
      'D:/proj/apps/admin/node_modules/.pnpm/element-plus/theme-chalk/el-button.css',
      true,
    ],
    ['uno 虚拟 css 排除', 'D:/proj/apps/admin/src/__uno.css', true],
    [
      '其它 app 的 h5 路径排除（锚定 appRoot，不跨 app 误伤）',
      'D:/proj/apps/h5/src/layouts/h5/index.vue',
      true,
    ],
    ['空字符串排除', '', true],
  ])('createH5ExcludeRegex: %s', (_label, filePath, shouldExclude) => {
    expect(createH5ExcludeRegex(APP_ROOT).test(filePath)).toBe(shouldExclude)
  })

  it('appRoot 为 win 反斜杠形态时同样命中（fileURLToPath 在 win 的产出）', () => {
    const exclude = createH5ExcludeRegex(APP_ROOT_WIN)
    expect(exclude.test('D:/proj/apps/admin/src/layouts/h5/index.vue')).toBe(false)
    expect(exclude.test('D:\\proj\\apps\\admin\\src\\modules\\h5-demo\\views\\index.vue')).toBe(
      false
    )
    expect(exclude.test('D:/proj/apps/admin/src/layouts/default/index.vue')).toBe(true)
  })
})

/**
 * 真实转换集成（防"配置回归全绿"）：
 * 上面的用例只断言插件对象存在与正则形态——rootValue / minPixelValue / mediaQuery
 * 被误改时单测依然全绿。这里经 postcss 核心真实跑转换，输出值即防线。
 */
describe('packages/config postcss — createPostcssPlugins 真实转换集成', () => {
  const plugins = createPostcssPlugins({ appRoot: APP_ROOT, enableRem: true })

  it('h5 目标路径：200px → 2.41546rem、28px → 0.33816rem（828 稿 / unitPrecision 默认 5 位）', async () => {
    const result = await postcss(plugins).process('.card { width: 200px; font-size: 28px; }', {
      from: 'D:/proj/apps/admin/src/modules/h5-demo/views/index.vue',
    })
    expect(result.css).toContain('width: 2.41546rem')
    expect(result.css).toContain('font-size: 0.33816rem')
  })

  it('minPixelValue=2：1px 边框不转换（保持物理 1px 细线）', async () => {
    const result = await postcss(plugins).process('.a { border: 1px solid #eee; }', {
      from: 'D:/proj/apps/admin/src/layouts/h5/index.vue',
    })
    expect(result.css).toContain('border: 1px solid #eee')
  })

  it('mediaQuery=false：@media 参数不转换，块内声明仍转换', async () => {
    const result = await postcss(plugins).process(
      '@media (min-width: 600px) { .a { width: 200px } }',
      { from: 'D:/proj/apps/admin/src/layouts/h5/index.vue' }
    )
    expect(result.css).toContain('@media (min-width: 600px)') // 参数原样（mediaQuery: false）
    expect(result.css).toContain('width: 2.41546rem') // 块内声明照常 rem 化
  })

  it('exclude 正则集成：非 h5 路径样式原样输出（default/EP 零污染契约）', async () => {
    const result = await postcss(plugins).process('.a { width: 200px }', {
      from: 'D:/proj/apps/admin/src/layouts/default/index.vue',
    })
    expect(result.css).toContain('width: 200px')
  })
})
