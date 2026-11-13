/**
 * prefer-wrapped-component 规则单测（node:test + ESLint RuleTester）。
 *
 * 运行：node --test scripts/eslint-rules/prefer-wrapped-component.spec.mjs
 * （根 test:eslint-rules 当前仅含 package-contract.spec.mjs——是否扩为目录模式
 * 待与用户确认，见设计稿 §3）。
 *
 * vue 模板用例需要 vue-eslint-parser：pnpm 严格模式下它不在根 node_modules 顶层，
 * 按版本无关前缀在 .pnpm 存储定位真实目录后按绝对路径加载（对齐
 * package-contract.spec.mjs 的 TS parser 加载模式）。
 */
import { createRequire } from 'node:module'
import { readdirSync, readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { RuleTester } from 'eslint'
import rule from './prefer-wrapped-component.mjs'

RuleTester.describe = describe
RuleTester.it = it

const requireFromRoot = createRequire(new URL('../../package.json', import.meta.url))
const pnpmStore = new URL('../../node_modules/.pnpm/', import.meta.url)
const vueParserStoreDir = readdirSync(pnpmStore).find((d) => d.startsWith('vue-eslint-parser@'))
if (!vueParserStoreDir) {
  throw new Error('未找到 vue-eslint-parser（.pnpm 存储），请先 pnpm install')
}
const vueParserPkgDir = fileURLToPath(
  new URL(`${vueParserStoreDir}/node_modules/vue-eslint-parser`, pnpmStore)
)
const vueParserPkg = JSON.parse(readFileSync(`${vueParserPkgDir}/package.json`, 'utf8'))
const vueParserEntry = vueParserPkg.main ?? vueParserPkg.exports?.['.']?.default
if (!vueParserEntry) throw new Error('vue-eslint-parser package.json 缺少可用入口')
const vueParser = requireFromRoot(`${vueParserPkgDir}/${vueParserEntry}`)

const ADMIN_VIEW = 'apps/admin/src/modules/user/views/List.vue'
const ADMIN_COMPONENT = 'apps/admin/src/components/X.vue'
const DEMO_VIEW = 'apps/docs/src/modules/demo/examples/X.vue'
const UI_INTERNAL = 'packages/ui/src/components/common/X.vue'
const SPEC_FILE = 'apps/admin/src/modules/user/views/List.spec.ts'

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
})

ruleTester.run('prefer-wrapped-component', rule, {
  valid: [
    // 合法写法：封装组件与 useConfirm 不提示
    {
      filename: ADMIN_VIEW,
      code: '<template><ProTable :columns="[]" /></template>',
      languageOptions: { parser: vueParser },
    },
    {
      filename: ADMIN_VIEW,
      code: 'const ok = await useConfirm()({ title: "删除" })',
    },
    // 非检测面成员：ElMessageBox 其他方法（如 close）不提示
    { filename: ADMIN_VIEW, code: 'ElMessageBox.close()' },
    { filename: ADMIN_VIEW, code: "ElMessageBox({ title: 'x' })" },
    // 计算属性成员访问不提示（静态判定边界，同 package-contract 的零误报取舍）
    { filename: ADMIN_VIEW, code: 'ElMessageBox[method]()' },
    // 路径豁免优先：demo 教学 / 封装内部 / 测试桩里的原始写法全部放行
    {
      filename: DEMO_VIEW,
      code: '<template><el-table /><el-form /><el-dialog /></template>',
      languageOptions: { parser: vueParser },
    },
    {
      filename: UI_INTERNAL,
      code: '<template><el-form /></template>',
      languageOptions: { parser: vueParser },
    },
    {
      filename: SPEC_FILE,
      code: '<template><el-table /></template>',
      languageOptions: { parser: vueParser },
    },
    {
      filename: 'packages/shared/src/test-utils/X.ts',
      code: 'ElMessageBox.confirm("桩")',
    },
  ],
  invalid: [
    // 模板：kebab / Pascal 双形态 × 3 类标签
    {
      filename: ADMIN_VIEW,
      code: '<template><el-table :data="[]" /></template>',
      languageOptions: { parser: vueParser },
      errors: [
        {
          messageId: 'preferWrapped',
          data: { found: 'el-table', prefer: '<ProTable>', doc: 'docs/29' },
        },
      ],
    },
    {
      filename: ADMIN_COMPONENT,
      code: '<template><ElTable :data="[]" /></template>',
      languageOptions: { parser: vueParser },
      errors: [
        {
          messageId: 'preferWrapped',
          data: { found: 'ElTable', prefer: '<ProTable>', doc: 'docs/29' },
        },
      ],
    },
    {
      filename: ADMIN_VIEW,
      code: '<template><el-form :model="{}" /></template>',
      languageOptions: { parser: vueParser },
      errors: [
        {
          messageId: 'preferWrapped',
          data: { found: 'el-form', prefer: '<XForm>', doc: 'docs/24' },
        },
      ],
    },
    {
      filename: ADMIN_VIEW,
      code: '<template><el-dialog v-model="visible" /></template>',
      languageOptions: { parser: vueParser },
      errors: [
        {
          messageId: 'preferWrapped',
          data: { found: 'el-dialog', prefer: 'useDialog() / <ProDialog>', doc: 'docs/27' },
        },
      ],
    },
    // JS/TS：ElMessageBox 三个方法名
    {
      filename: ADMIN_VIEW,
      code: "ElMessageBox.confirm('确定删除？')",
      errors: [
        {
          messageId: 'preferWrapped',
          data: { found: 'ElMessageBox.confirm', prefer: 'useConfirm()', doc: 'docs/32' },
        },
      ],
    },
    {
      filename: ADMIN_COMPONENT,
      code: "ElMessageBox.alert('提示')",
      errors: [
        {
          messageId: 'preferWrapped',
          data: { found: 'ElMessageBox.alert', prefer: 'useConfirm()', doc: 'docs/32' },
        },
      ],
    },
    {
      filename: ADMIN_VIEW,
      code: "ElMessageBox.prompt('请输入')",
      errors: [
        {
          messageId: 'preferWrapped',
          data: { found: 'ElMessageBox.prompt', prefer: 'useConfirm()', doc: 'docs/32' },
        },
      ],
    },
  ],
})
