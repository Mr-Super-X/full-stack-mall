// commitlint 自定义 formatter：中文输出
// 用法：在 .commitlintrc.cjs 设置 formatter: './scripts/commitlint-formatter.cjs'

let pc
try {
  pc = require('picocolors')
} catch {
  // picocolors 不可用时降级为纯文本
  pc = new Proxy(
    {},
    {
      get: () => (s) => s,
    }
  )
}

// commitlint 规则名 → 中文标签
const RULE_LABELS = {
  'type-empty': 'type 不能为空',
  'type-enum': 'type 不在允许列表',
  'subject-empty': 'subject 不能为空',
  'header-max-length': '标题超长',
  'header-max-length': '标题过长',
  'scope-empty': 'scope 不能为空',
  'body-leading-blank': 'body 前需要空行',
  'footer-leading-blank': 'footer 前需要空行',
  'subject-case': 'subject 大小写问题',
  'subject-full-stop': 'subject 不能以句号结尾',
  'subject-exclamation-mark': 'subject 不能以感叹号结尾',
  'body-max-line-length': 'body 单行过长',
  'body-max-length': 'body 总长过长',
  'footer-max-length': 'footer 总长过长',
  'references-empty': '引用不能为空',
}

// commit type → 中文名
const TYPE_NAMES = {
  feat: '新增功能',
  fix: '修复缺陷',
  docs: '文档变更',
  style: '代码格式',
  refactor: '代码重构',
  perf: '性能优化',
  test: '测试用例',
  build: '构建相关',
  ci: '持续集成',
  chore: '其他杂项',
  revert: '回滚提交',
}

const RULE_MESSAGES = {
  'type-empty': 'type 不能为空',
  'subject-empty': 'subject 不能为空',
  'scope-empty': 'scope 不能为空',
  'body-leading-blank': 'body 前需要空行',
  'footer-leading-blank': 'footer 前需要空行',
  'subject-full-stop': 'subject 不能以句号结尾',
  'subject-exclamation-mark': 'subject 不能以感叹号结尾',
}

// 把英文消息翻译为中文
function translateMessage(msg, ruleName) {
  if (RULE_MESSAGES[ruleName]) return RULE_MESSAGES[ruleName]

  let result = msg

  // type-enum：把 type 列表中的英文替换为"英文(中文)"
  if (ruleName === 'type-enum') {
    result = result.replace(
      /\b(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)\b/g,
      (m) => `${m}(${TYPE_NAMES[m] || m})`
    )
  }

  // header-max-length：完整翻译为中文
  if (ruleName === 'header-max-length') {
    result = result
      .replace(
        /header must not be longer than (\d+) characters/,
        (_, n) => `标题不能超过 ${n} 字符`
      )
      .replace(/current length is (\d+)/, (_, n) => `当前长度 ${n} 字符`)
  }

  return result
}

function format(report = {}, options = {}) {
  const { results = [] } = report
  const lines = []

  for (const result of results) {
    const { errors = [], warnings = [], input = '' } = result
    if (errors.length === 0 && warnings.length === 0) continue

    lines.push(pc.gray('⧗ 输入的 commit 信息：'))
    lines.push(pc.bold(`  ${input}`))
    lines.push('')

    if (errors.length > 0) {
      lines.push(pc.red(`✖ 找到 ${errors.length} 个错误：`))
      lines.push('')
      for (const err of errors) {
        const label = RULE_LABELS[err.name] || err.name
        const msg = translateMessage(err.message, err.name)
        lines.push(pc.red(`  ✖ ${label}`))
        if (msg && msg !== label) lines.push(pc.gray(`    ${msg}`))
      }
    }

    if (warnings.length > 0) {
      if (errors.length > 0) lines.push('')
      lines.push(pc.yellow(`⚠ ${warnings.length} 个警告：`))
      lines.push('')
      for (const w of warnings) {
        const label = RULE_LABELS[w.name] || w.name
        const msg = translateMessage(w.message, w.name)
        lines.push(pc.yellow(`  ⚠ ${label}`))
        if (msg && msg !== label) lines.push(pc.gray(`    ${msg}`))
      }
    }
  }

  if (lines.length === 0) {
    return pc.green('✓ commit 信息符合 Angular 规范')
  }

  return lines.join('\n')
}

// commitlint 21 同时支持默认导出和 module.exports
module.exports = format
module.exports.format = format
module.exports.default = format
