/**
 * utils 统一 barrel re-export：单点暴露所有 utils/* 模块。
 *
 * 设计要点：
 * - 业务侧统一从 `@/utils` 导入，避免散落 `@/utils/xxx`
 * - 新增工具时：在本文件追加一行 `export * from './新模块'`，并在下方加一行引导注释即可
 * - 不在此处做二次封装或重命名（保持 barrel "透明"，避免双层抽象）
 *
 * 各模块文件位于 `src/utils/<name>.ts`，具体函数 JSDoc 见对应源文件。
 *
 * @group utils barrel
 */

export * from './autoImport'
export * from './bem'
export * from './caseConvert'
export * from './dayjs'
export * from './format'
export * from './safeAsync'
export * from './storage'
export * from './validate'
export * from './consoleBadge'
