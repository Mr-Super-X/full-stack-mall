/**
 * 大小写命名转换工具（**纯字符串处理**，不含语言学判断）。
 *
 * 角色：utils 工具模块，提供两个互逆转换函数，无副作用、无依赖。
 *
 * 命名约定：
 * - PascalCase：每个单词首字母大写，**不加分隔符**（如 `AsyncState`）
 * - kebab-case：全小写，**单词间用 - 分隔**（如 `async-state`）
 *
 * 适用场景：
 * - 文件名 ↔ 路由 path 转换（如 `MyButton.vue` → `/demo/my-button`）
 * - 组件名 ↔ 标签名转换
 * - API 返回字段名 → Vue ref 名转换
 *
 * @group 命名转换
 */

/**
 * kebab-case / snake_case → PascalCase
 *
 * 转换规则：单词首字符（由 `-`/`_` 或字符串起始位置界定）转大写，其余保持原样。
 *
 * @example
 * ```ts
 * pascalCase('async-state')    // 'AsyncState'
 * pascalCase('error_boundary') // 'ErrorBoundary'
 * pascalCase('my-button')      // 'MyButton'
 * ```
 *
 * @group 命名转换
 */
export function pascalCase(s: string): string {
  return s.replace(/(^|[-_])(\w)/g, (_, _p, c: string) => c.toUpperCase())
}

/**
 * PascalCase / camelCase → kebab-case
 *
 * 转换规则：小写字母后接大写字母的位置插入 `-`，结果全小写。
 * **不处理连续大写**（如 `XMLParser` → `x-m-l-parser`），简单规则避免误判。
 *
 * @example
 * ```ts
 * kebabCase('AsyncState')    // 'async-state'
 * kebabCase('ErrorBoundary') // 'error-boundary'
 * kebabCase('myButton')      // 'my-button'
 * ```
 *
 * @group 命名转换
 */
export function kebabCase(s: string): string {
  return s.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
}
