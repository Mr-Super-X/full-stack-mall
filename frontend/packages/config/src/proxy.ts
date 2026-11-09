import type { ProxyOptions } from 'vite'

/**
 * dev server proxy 配置（联调真实后端）。
 *
 * 单一 `/api` 代理：网关 /api/ → 本 app dev server → 18080 后端（context-path 同为 /api，
 * 路径原样透传，无需 rewrite）。HttpOnly Cookie path=/api 同源匹配，统一登录会话漫游。
 *
 * 原空壳占位（2026-11-09 计划 07 v2 Task 4 补实）：此前所有 app 走 mock（VITE_API_BASE_URL=/mock）
 * 或绝对直连（h5 阶段1 的 http://localhost:18080/api），无经网关 /api/ 反代的场景；
 * admin 统一登录接入（apps/admin/.env.development VITE_API_BASE_URL=/api）后，请求经
 * dev:gateway 8080 /api/ 前缀反代到 admin:5174，本 proxy 把它转给后端，cookie path 语义贯通。
 *
 * 改动经用户批准（AskUserQuestion「补 proxy.ts /api 代理」，§2 架构锁定例外条款）。
 */
export function createProxyConfig(_env: NodeJS.ProcessEnv): Record<string, string | ProxyOptions> {
  return {
    '/api': {
      target: 'http://localhost:18080',
      changeOrigin: true,
    },
  }
}
