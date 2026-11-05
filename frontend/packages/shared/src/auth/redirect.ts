/**
 * 跨应用统一登录协议（P4，Monorepo 多 app 收官）。
 *
 * 业务背景：auth 独立为 apps/auth 后，admin / portal 等 app 内不再有 /login 路由；
 * 跨 app 无共享 router 实例，登录跳转必须整页 `location.href`（非同源 SPA 内 push）。
 *
 * 消费点：
 * - `@vv/shared/router-guards/login.ts` checkLoginState（未登录 → 跳 auth 登录页）
 * - `@vv/shared/api/http.ts` performLogout（refresh 失败 → 跳 auth 登录页）
 * - `@vv/ui/composables/useLogout`（主动登出 → 跳 auth 登录页）
 * - apps/portal 顶栏 / Hero CTA（公开站登录入口）
 * - apps/auth 登录页成功回调（回跳原 app）
 *
 * `VITE_AUTH_ORIGIN` 由各 app env 注入（本包不硬编码 app 名/部署形态）：
 * dev 缺省 '/auth'（同源子路径语义）；生产按部署形态覆盖（history 形态
 * '/vue3-vite-project/auth' 或独立域名；gh-pages 演示形态由 build-pages 注入
 * '/vue3-vite-project/auth/#'——尾巴 '#' 承载 auth 的 hash 路由形态，
 * origin + '/login' 拼出 /#/login，Pages 静态托管才能接住，见 scripts/build-pages.ts）。
 *
 * @group 跨应用登录协议
 */

/** 解析统一登录应用 origin（缺省 '/auth' 同源子路径语义）——
 *  单源在此（redirectToAuthLogin 与 @vv/ui useLogout 共用，避免两处缺省值拷贝漂移）。
 *  调用方一律拼 `${origin}/login`——gh-pages 演示形态注入值带 '#' 尾巴（见文件头注），
 *  拼出 /#/login 的 hash 路由形态；history 形态注入值无 '#'，拼出常规 /login。 */
export function resolveAuthOrigin(): string {
  return import.meta.env.VITE_AUTH_ORIGIN ?? '/auth'
}

/** 跨应用整页跳转（跨 app 无共享 router 实例，必须整页 location.href） */
export function redirectToAuthLogin(redirect: string): never {
  const authOrigin = resolveAuthOrigin()
  const safe = redirect.startsWith('/') ? redirect : '/'
  window.location.href = `${authOrigin}/login?redirect=${encodeURIComponent(safe)}`
  throw new Error('AUTH_REDIRECTING') // 中断当前守卫链（整页已发起）
}

/** auth 登录成功后回跳（校验同源，防开放重定向 CWE-601）。
 *
 * 校验策略（2026-10-28 /autoplan E2 修复 + Round 2 注释实证修正，两道独立防线）：
 * 1. 显式拒绝协议相对（//host）与含反斜杠的 redirect——纵深防御：WHATWG 实测
 *    `/\evil.com` 按当前 origin 解析为同源 path（不跳出），但反斜杠在部分解析器
 *    /历史浏览器中行为不一，防线 1 提前拒绝此类畸形形态；
 * 2. origin 白名单比对：new URL 按当前 origin 解析后二次确认同源——真正的承重墙：
 *    前导空格协议相对（`  //evil.com`，空格被剥离后跳出）、tab-scheme
 *    （`java\tscript:`，tab 被剥离后成 javascript: 协议）等畸形形态均由本层拦截，
 *    解析失败一律落 fallback。
 *
 * fallback 由调用方显式传入（登录后默认落地页）——本包不硬编码 app 名/部署形态
 * （见文件头注），默认值曾因写死 '/admin/' 致 app 特性泄漏进纯库包（架构审查项）。 */
export function resolvePostLoginRedirect(fallback: string): string {
  // hash 模式（gh-pages 演示形态）下 redirect 位于 location.hash 的 query 段
  // （/#/login?redirect=...），location.search 为空——两形态都要能读到
  const hash: string = window.location.hash ?? ''
  const search =
    window.location.search || (hash.includes('?') ? `?${hash.split('?').slice(1).join('?')}` : '')
  const raw = new URLSearchParams(search).get('redirect')
  if (!raw) return fallback
  if (raw.startsWith('//') || raw.includes('\\')) return fallback
  try {
    if (new URL(raw, window.location.origin).origin === window.location.origin) return raw
  } catch {
    // 畸形 URL 形态解析失败 → 落 fallback
  }
  return fallback
}
