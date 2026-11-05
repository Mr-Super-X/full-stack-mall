/**
 * 判断该 SFC 文件路径是否应该被排除（不注册到全局）。
 * 以 `_` 或 `.` 开头的 basename 视为内部组件，例如内部工具、下划线前缀文件。
 */
export function isExcluded(filepath: string): boolean {
  const basename = filepath.split('/').pop() ?? ''
  return /^[_.]/.test(basename)
}

/**
 * 解析注册名：优先使用 SFC 显式声明的 name，缺失则用文件 basename（PascalCase）。
 * 文件名约定为 PascalCase（与 SFC export name 一致），保证 fallback 即正确。
 */
export function resolveComponentName(filepath: string, explicitName?: string): string {
  if (explicitName) return explicitName
  const base = filepath
    .split('/')
    .pop()!
    .replace(/\.vue$/i, '')
  return base
}
