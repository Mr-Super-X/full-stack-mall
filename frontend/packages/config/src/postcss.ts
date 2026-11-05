/**
 * PostCSS 配置（工厂函数形态，R-B）—— 当前唯一插件是 h5 rem 适配（postcss-pxtorem）。
 *
 * 换算约定（所见即所得）：设计稿标注多少 px，样式就写多少 px。
 *   编译时：X px → X / 82.8 rem（rootValue = 设计稿宽 / 10）
 *   运行时：1rem = min(视口宽, 540) / 10 px（见 src/layouts/h5/config/rem.ts）
 *   渲染值 = X × min(视口宽,540) / 828 px —— 任意屏宽下等比缩放
 *
 * 作用域隔离（关键）：
 *   只有 <appRoot>/src/layouts/h5/ 与 <appRoot>/src/modules/h5-xxx/（h5- 前缀模块）内的
 *   样式被转换，后台（default）/ 门户（portal）/ element-plus 零污染；多 app 下转换范围
 *   锚定到各自 appRoot，不跨 app 误伤。
 *
 *   交叉引用（P1-4 结转备注）：h5 布局样式（layouts/h5/styles）随 app 走、不进 @vv/ui 包；
 *   若未来迁入 ui 包，本文件的 include 锚定（appRoot/src）须同步重设计——包内样式不走
 *   任何单一 appRoot，负向先行正则需改为锚定 UI_SRC_DIR（见 app-aliases.ts）。
 *
 * 实现选型备注（postcss-pxtorem v6.1.0 源码实测，README 过时）：
 *   - 无 include 选项；exclude 默认为 null（不配则全量转换）
 *   - exclude 的函数形态行为不确定：函数返回 false（不排除）时会 fall through 到
 *     `filePath.match(exclude)`（index.js:135）——函数被强制转为正则，视函数字符串化
 *     结果可能抛 SyntaxError（本仓实测）或静默产生错误匹配 —— 故只能用 RegExp 形态
 *   - 负向先行 `^(?!.*目标段).*$` 实现 include 语义：路径不含 h5 目标段即排除
 *   - 正则兼容 vite 在 win 下的 input.file 形态（D:/... 正斜杠 + ?vue query 后缀）
 *
 * @group 工程配置：PostCSS
 */
import pxtorem from 'postcss-pxtorem'
import type { AcceptedPlugin } from 'postcss'

/** h5 设计稿宽度（828 稿 → rootValue 82.8；将来换 750 稿只改这一行） */
export const H5_DESIGN_WIDTH = 828
export const H5_REM_ROOT_VALUE = H5_DESIGN_WIDTH / 10

/** 转义正则元字符（appRoot 可能含 '.'、'(' 等） */
function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 绝对路径 → 正则源码：按路径分隔符切分（win `\` 与 posix `/` 通吃，连续分隔符折叠），
 * 逐段转义后用 `[\\/]` 重新连接——兼容 vite 在 win 下 input.file 的正斜杠形态。
 */
function pathToRegexSource(absPath: string): string {
  return absPath
    .split(/[\\/]+/)
    .filter(Boolean)
    .map(escapeRegExp)
    .join('[\\\\/]')
}

/**
 * h5 转换目标正则（锚定到 appRoot/src 下）：layouts/h5/ 与 h5- 前缀模块。
 * 约定：h5 业务模块以 `h5-` 前缀命名（如 h5-demo / h5-mall），新增模块零配置接入。
 */
export function createH5TargetRegex(appRoot: string): RegExp {
  const root = pathToRegexSource(appRoot)
  return new RegExp(
    `${root}[\\\\/]src[\\\\/](?:layouts[\\\\/]h5[\\\\/]|modules[\\\\/]h5-[^\\\\/]+[\\\\/])`
  )
}

/**
 * postcss-pxtorem 的 exclude 正则（负向先行 = include 语义）。
 * 路径不含 h5 目标段 → match 命中 → 该文件跳过转换；h5 路径 → 先行断言失败 → 正常转换。
 */
export function createH5ExcludeRegex(appRoot: string): RegExp {
  return new RegExp(`^(?!.*(?:${createH5TargetRegex(appRoot).source})).*$`)
}

export interface CreatePostcssPluginsOptions {
  /** app 根目录（绝对路径）——h5 转换范围锚定到 `${appRoot}/src` 下 */
  appRoot: string
  /** 是否启用 h5 rem 适配；仅含 h5 布局/模块的 app 开启，其余 app 返回空数组（零插件） */
  enableRem: boolean
}

export function createPostcssPlugins(options: CreatePostcssPluginsOptions): AcceptedPlugin[] {
  if (!options.enableRem) return []
  return [
    pxtorem({
      rootValue: H5_REM_ROOT_VALUE,
      propList: ['*'], // 源码默认只转 font 系 4 属性，必须显式全开
      minPixelValue: 2, // 小于 2px 不转 → 1px 边框保持物理 1px 细线
      mediaQuery: false,
      exclude: createH5ExcludeRegex(options.appRoot),
    }),
  ]
}
