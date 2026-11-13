/**
 * 封装组件优先提醒（本地 ESLint 规则，warn 级）。
 *
 * 检查对象：apps/<a>/src 的 modules|components 目录下 .vue 模板里的 EP 原始组件标签，
 * 与 JS/TS 里的 ElMessageBox.confirm / alert / prompt 成员调用。
 *
 * 契约（docs/50-页面开发组件选型速查.md §2 决策表的机械提醒层；设计稿见
 * docs/superpowers/specs/2026-11-12-prefer-wrapped-component-design.md）：
 * 1. 模板 <el-table> / <el-form> / <el-dialog>（含 PascalCase 写法）提示对应
 *    @vv/ui 封装（ProTable / XForm / useDialog·ProDialog）
 * 2. ElMessageBox.confirm / alert / prompt 提示 useConfirm（取消语义差异见 CLAUDE.md §1.5）
 * 3. 豁免路径与 docs/50 §3 一一对应：demo 教学目录 / packages/ui 内部 / spec / test-utils
 *
 * 刻意不检测（KISS，设计稿 §2）：el-pagination / el-form-item——前者几乎总伴随裸
 * el-table 出现已被覆盖，后者是前者子件（重复报噪声）。
 *
 * 为什么 warn 而非 error：对齐仓库「治理零人工税」立场——error 会误伤 demo 对照、
 * 封装内部等合理场景；warn 提供漂移可见性 + review 抓手，不制造阻塞税。
 * 存量 admin 视图的原始组件实现会报 warn，属预期（渐进改造另行立项）。
 */
const TEMPLATE_TAG_MAP = {
  'el-table': { prefer: '<ProTable>', doc: 'docs/29' },
  'el-form': { prefer: '<XForm>', doc: 'docs/24' },
  'el-dialog': { prefer: 'useDialog() / <ProDialog>', doc: 'docs/27' },
}

const MSGBOX_METHODS = new Set(['confirm', 'alert', 'prompt'])

/** 豁免路径（docs/50 §3）：教学 demo / 封装内部 / 测试桩 / 测试工具 */
// 注意：正则不得以 [ 开头裸写——数组字面量内词法器会把 [ 当嵌套数组开始，
// 导致外层数组永不闭合（2026-11-12 诊断实证）；前导字符类须用非捕获组包裹
const EXEMPT_PATTERNS = [
  /apps[/\\]docs[/\\]src[/\\]modules[/\\]demo[/\\]/,
  /packages[/\\]ui[/\\]/,
  /\.(spec|test)\.[cm]?[jt]sx?$/,
  /(?:[/\\])test-utils[/\\]/,
]

function isExempt(filename) {
  return EXEMPT_PATTERNS.some((re) => re.test(filename))
}

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: '业务代码优先使用 @vv/ui 封装组件，原始 EP 组件给出提醒',
      url: 'docs/50-页面开发组件选型速查.md',
    },
    messages: {
      preferWrapped:
        '「{{found}}」已有项目封装：优先改用 {{prefer}}（{{doc}}；豁免场景与选型对照见 docs/50 §3/§2）',
    },
  },
  create(context) {
    if (isExempt(context.filename)) return {}

    // vue-eslint-parser@10 起 parseForESLint 不再返回 visitorKeys——模板遍历必须走
    // services.defineTemplateBodyVisitor（eslint-plugin-vue 同款形态）；script 侧
    // visitor 作其第二参 scriptVisitor（无 templateBody 时 parser 直接返回它）
    // Pascal→kebab 不能只 toLowerCase（ElTable→eltable 永不命中）——大写前补连字符
    const kebab = (name) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
    const reportTag = (node) => {
      const hit = TEMPLATE_TAG_MAP[kebab(node.rawName)]
      if (!hit) return
      context.report({
        node,
        messageId: 'preferWrapped',
        data: { found: node.rawName, prefer: hit.prefer, doc: hit.doc },
      })
    }
    const reportMsgBox = (node) => {
      if (node.object?.type !== 'Identifier' || node.object.name !== 'ElMessageBox') return
      if (node.computed || node.property?.type !== 'Identifier') return
      if (!MSGBOX_METHODS.has(node.property.name)) return
      context.report({
        node,
        messageId: 'preferWrapped',
        data: {
          found: `ElMessageBox.${node.property.name}`,
          prefer: 'useConfirm()',
          doc: 'docs/32',
        },
      })
    }

    const services = context.sourceCode.parserServices
    // vue-eslint-parser@10 签名是 (templateBodyVisitor, scriptVisitor, options)——
    // v9 及以前的 context 第一参已移除，多传会把 context 当 visitor 对象注册进 emitter
    if (!services?.defineTemplateBodyVisitor) return { MemberExpression: reportMsgBox }
    return services.defineTemplateBodyVisitor(
      { VElement: reportTag },
      { MemberExpression: reportMsgBox }
    )
  },
}
