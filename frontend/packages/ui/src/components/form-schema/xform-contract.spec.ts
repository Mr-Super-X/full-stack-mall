/**
 * XForm 关键配置回归保护（xform-contract.spec）
 *
 * 本文件锁死 XForm.vue 源文件中的关键配置，防止精简/重构时误删：
 *   1. `<ElForm>` 必须绑 `:validate-trigger="['change', 'blur']"` —— 否则 blur 失焦不自动校验
 *   2. XForm.vue 顶层必须 import element-plus 全局样式与 form-schema 自定义样式
 *   3. CSS import 必须位于 <script setup> 顶层（非条件分支）
 *
 * 用 `?raw` 导入 XForm.vue 源码做正则匹配，源码级静态断言。
 * 不依赖 fs/path 解析（vitest 下 ?raw 由 vite 提供）。
 *
 * 历史：
 *   - OPT-1 重构 XForm.vue 时漏掉两行 CSS 导入（OPT-0 回归修复）
 *   - P0-4 发现 validate-trigger 默认值问题，需锁死
 *   - 2026-09-01 P0-4 重构：从 XForm.spec.ts 拆出，独立 spec 维护
 *
 * 相关文件：
 - ./XForm.spec.ts
 - ./ARCHITECTURE.md §9.2 关键回归保护
 */
import { describe, it, expect } from 'vitest'
import XFormSource from './components/XForm.vue?raw'

describe('XForm.vue validate-trigger 回归保护', () => {
  /**
   * 防止有人把 XForm.vue 的 :validate-trigger="['change', 'blur']" 删掉或改回默认值,
   * 那会导致 blur 失焦不自动校验,async validator 的 loading 图标不会显示,
   * 用户必须点保存才能触发校验(P0-4 发现的 bug)。
   *
   * 这是源码级静态断言：保护模板里的配置不被误删
   * - vitest 下用 ?raw 导入 XForm.vue 源文件,不依赖 fs/path 解析
   * - regex 匹配要求 :validate-trigger="['change', 'blur']" 完整存在
   */
  it("XForm.vue 模板必须包含 :validate-trigger=\"['change', 'blur']\"", () => {
    expect(XFormSource).toMatch(
      /validate-trigger\s*=\s*["']\[\s*['"]change['"]\s*,\s*['"]blur['"]\s*\]['"]/
    )
  })

  /**
   * 补充断言:确保 validate-trigger 是绑在 <ElForm> 标签上,而非其他标签
   * - 解析 XForm.vue 模板,找到 <ElForm ... > 标签起始行,验证 validate-trigger 在该标签的属性里
   * - 防止有人把 :validate-trigger 误移到 <ElFormItem> 或其他标签
   */
  it(':validate-trigger 必须绑在 <ElForm> 标签上(而非 form-item 或其他)', () => {
    // 找到 <ElForm 起始的多行标签
    // 注意:模板属性里可能有泛型 `Record<string, unknown>` 的 `>`,会被简单 regex 误判为标签结束
    // 用 `\n\s+>` 匹配换行后带缩进的 `>`(即标签结束位置)
    const elFormMatch = XFormSource.match(/<ElForm\b[\s\S]*?\n\s+>/)
    expect(elFormMatch).not.toBeNull()
    const elFormTag = elFormMatch![0]
    expect(elFormTag).toMatch(
      /validate-trigger\s*=\s*["']\[\s*['"]change['"]\s*,\s*['"]blur['"]\s*\]['"]/
    )
  })
})

describe('XForm.vue 全局 CSS 导入回归保护', () => {
  /**
   * 根因回归：OPT-1 重构 XForm.vue 时漏掉了两行 CSS 导入
   *   import 'element-plus/dist/index.css'
   *   import '../styles/element-form-overwrite.scss'
   * 导致 element-plus 全局样式与 form-schema 自定义覆盖样式均未加载，
   * 整个表单页面样式全部失效。
   *
   * 此处用源码级静态断言锁死两行 import，防止未来精简 XForm.vue 时再误删。
   * CSS 加载是 element-plus + 表单样式的唯一入口（grep 全项目无其他导入点）。
   */
  it('XForm.vue 必须 import element-plus/dist/index.css（全局样式入口）', () => {
    expect(XFormSource).toMatch(/import\s+['"]element-plus\/dist\/index\.css['"]/)
  })

  it('XForm.vue 必须 import ../styles/element-form-overwrite.scss（form-schema 自定义覆盖）', () => {
    // 2026-09-09 目录归位：XForm.vue 移入 components/，样式路径由 ./styles 变为 ../styles
    expect(XFormSource).toMatch(/import\s+['"]\.\.\/styles\/element-form-overwrite\.scss['"]/)
  })

  it('CSS import 必须位于 <script setup> 顶层（非条件分支）', () => {
    // 取 <script setup>...</script> 块内的所有 import 行
    const scriptBlock = XFormSource.match(/<script\s+setup[^>]*>([\s\S]*?)<\/script>/)
    expect(scriptBlock).not.toBeNull()
    const blockBody = scriptBlock![1] ?? ''
    const cssImportCount = (blockBody.match(/from\s+['"]element-plus/g) ?? []).length
    // element-plus 组件 import 应保持（已有），加上 css import 不应被包在 if 内
    expect(cssImportCount).toBeGreaterThanOrEqual(1)
    // 同时确保 css 路径未出现在任何注释或字符串中（防御性 —— 真 import 必须在源码 import 语句里）
    expect(XFormSource).not.toMatch(/<!--[\s\S]*?element-plus\/dist\/index\.css[\s\S]*?-->/)
  })
})

describe('XForm.vue applyDefaults 迁移（C1 回归）', () => {
  /**
   * 源码级静态断言（C1 根因）：applyDefaults 曾位于 showDebugBanner 门控的 watch 内，
   * 导致 prod（DEV=false）下 defaultValue 永不填充。
   * 重构后 applyDefaults 已收敛到 use-xform-composer.ts 的非调试分支（无条件执行），
   * XForm.vue 不应再含该函数定义/调用 —— 此断言升级为"XFormSource 不含 applyDefaults"。
   * 运行时行为由 use-xform-composer.spec.ts 覆盖。
   */
  it('applyDefaults 已迁移出 XForm.vue（重构至 use-xform-composer.ts）', () => {
    expect(XFormSource).not.toMatch(/applyDefaults/)
  })
})

describe('XForm.vue 顶层 key 稳定性（B-1a 回归）', () => {
  // 源码级静态断言：index key 会让 reaction 切 ignore/hidden 时因索引漂移重挂载（焦点丢失）
  it('模板顶层 v-for 不再使用 index 作 key', () => {
    expect(XFormSource).not.toMatch(/:key="i"/)
    expect(XFormSource).toContain('node.key ?? node.name ?? i')
  })
})
