import process from 'node:process'

/**
 * SCSS additionalData 注入 + silenceDeprecations 配置（工厂函数形态，R-B）
 *
 * bem mixin 通过 $BEM_PREFIX 拼前缀，与 src/utils/bem.ts 的 import.meta.env.VITE_BEM_PREFIX 共享来源
 *
 * silenceDeprecations 白名单：
 *   - 'new-global': bem mixin 的 b() 内 $B: $block !global，Dart Sass 1.78+ 警告
 *   - 'if-function': bem mixin 的 b() 内 if() 拼接前缀，Dart Sass 1.78+ 标记 deprecation
 * 两个 deprecation 在 sass 2.0 升级前必须静默，否则 CI 红。
 *
 * silenceDeprecations 显式标注为字面量联合数组，匹配 vite 的 DeprecationOrId 期望，
 * 同时保持可变（与 vite 的 `SassModernPreprocessBaseOptions` 完全兼容）
 *
 * bemPath 说明（R7 回退已触发，2026-10-22 实测）：
 *   - 绝对路径直接写进 @use 被 sass 拒绝：盘符冒号（'D:/...'）被解析为 URL scheme，
 *     报 "Can't find stylesheet to import"（vite 8 + sass 1.101 实测）
 *   - 回退方案 = loadPaths：把 bemPath 拆为「目录进 loadPaths + 裸模块名进 @use」，
 *     由 sass 的模块搜索路径机制解析，等价于别名解析且对包化后任意 appRoot 成立
 *   - P1-4 起工厂传入 @vv/ui 包内路径（bem.scss 随 assets 迁包，见 create-vite-config.ts）；
 *     2026-11-03 起为 src/styles/tools/_bem.scss（styles/ 自 assets/ 上移）
 */
export interface ScssPreprocessorOptions {
  silenceDeprecations: Array<'new-global' | 'if-function'>
  additionalData: string
  /** sass 模块搜索路径——@use 的裸模块名（'bem'）沿此解析到目标文件 */
  loadPaths: string[]
}

export function createScssPreprocessorOptions(options: {
  /** bem mixin 文件路径（无扩展名，可含盘符）；拆分为 loadPaths 目录 + 模块名。
   *  必须含至少一个路径分隔符（'dir/bem' 形态）——裸模块名（'bem'）会丢失 loadPaths 锚点，
   *  sass 只能沿默认 cwd 解析，包化后行为不确定，故直接抛错 fail-fast */
  bemPath: string
}): ScssPreprocessorOptions {
  // 反斜杠归一为正斜杠：Windows 路径在 sass @use / loadPaths 字符串里会被当转义符
  const normalized = options.bemPath.replace(/\\/g, '/')
  const sepIndex = normalized.lastIndexOf('/')
  if (sepIndex === -1) {
    throw new Error(
      `[createScssPreprocessorOptions] bemPath 必须含目录段（如 'src/styles/tools/bem'），收到裸模块名: '${options.bemPath}'`
    )
  }
  const loadPath = normalized.slice(0, sepIndex)
  const moduleName = normalized.slice(sepIndex + 1)
  return {
    silenceDeprecations: ['new-global', 'if-function'],
    additionalData: `@use '${moduleName}' as * with ($BEM_PREFIX: '${process.env.VITE_BEM_PREFIX ?? 'vv'}');\n`,
    loadPaths: [loadPath],
  }
}
