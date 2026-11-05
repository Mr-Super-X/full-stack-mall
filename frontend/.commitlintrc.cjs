// commitlint 配置：基于 @commitlint/config-conventional（Angular 规范）
// type 必须在 types 列表中，subject 不超过 72 字符
module.exports = {
  extends: ['@commitlint/config-conventional'],
  // 跳过包含 "init" 或 "merge" 的 commit
  // - init: 初始化项目、init: 重构脚手架 等
  // - merge: git merge 产生的自动提交（无需校验）
  // 注意：commitlint 21 ignores 必须返回 boolean[]（数组里包函数）
  ignores: [
    (commit) => commit.includes('init'),
    (commit) => commit.includes('merge'),
  ],
  // 自定义中文输出 formatter
  formatter: './scripts/commitlint-formatter.cjs',
  rules: {
    // 关键：不允许空 type（commitlint 默认放过"无 type 前缀"消息，加这条才严格）
    'type-empty': [2, 'never'],
    // subject 长度限制（不含 type 前缀）
    'header-max-length': [2, 'always', 72],
    // 不强制 scope（保持灵活）
    'scope-empty': [0],
    // 关闭 subject-case 规则，允许 subject 中出现大写字母
    'subject-case': [0]
  },
}
