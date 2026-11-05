import type { ProxyOptions } from 'vite'

/**
 * dev server proxy 配置（当前空壳）
 *
 * 启用时机：联调真实后端时，按需补充 _env 字段解析逻辑
 * 用法（在 vite.config.ts）：
 *   server: { ...SERVER_DEFAULTS, proxy: createProxyConfig(process.env) }
 */
export function createProxyConfig(_env: NodeJS.ProcessEnv): Record<string, string | ProxyOptions> {
  return {}
}
