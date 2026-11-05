/**
 * 生产 mock 挂接守卫（@vv/shared）。
 *
 * 文件角色：main.ts「PROD && VITE_USE_MOCK 时阻塞式挂接浏览器端 mock」
 * 高危不变量的单源实现。6 个 app 的 main.ts 曾逐字重复该条件分支，
 * 任一份漂移都会击穿「守卫首屏请求必须先于 mockjs 劫持激活」的时序防线
 * （router install 即触发初始导航，挂接晚于 app.use(router) 则请求穿透
 * 到静态服务器，SPA fallback 返回 HTML → 资源不存在 toast）。
 *
 * 为什么用回调注入而非包内直接 import：@mock 别名是 app 级 vite alias
 * （经 @vv/config 的 createAppAliases 注册），shared 包独立 type-check 时
 * 解析不到该别名；改由各 app 传 `() => import('@mock/mockProdServer')`，
 * 别名在 app 编译上下文解析，shared 仅以结构类型约束模块契约——
 * 不新增包间依赖，符合 §2.1 依赖方向铁律。
 *
 * @group 应用入口：mock 挂接
 */

/** prod mock 模块的最小结构契约（与 @vv/mock 的 mockProdServer 导出结构兼容）。 */
export interface ProdMockServerModule {
  setupProdMockServer: () => Promise<void>
}

/**
 * 生产构建且 `VITE_USE_MOCK==='true'` 时加载并激活浏览器端 mock。
 *
 * 调用位置强约束：必须在 `app.use(router)` 之前 await 本函数——
 * Vue Router install 会立即触发初始导航，守卫的 fetchProfile 与
 * main.ts 后续语句并行执行；若挂接晚于 use(router)，守卫请求会先于
 * mockjs 激活发出，穿透到静态服务器。
 *
 * PROD 守卫防 dev 双重劫持（dev 下 node 中间件与本分支同时命中，
 * auth rawResponse 被 client 侧解构为 undefined → dev 登录必挂）；
 * 常规生产构建（VITE_USE_MOCK 非 'true'）整分支被 tree-shake。
 *
 * @param loadModule 加载 @mock/mockProdServer 的回调——app 侧固定传
 *   `() => import('@mock/mockProdServer')`（别名仅 app 编译上下文可解析）
 * @see 各 app src/main.ts 调用点（createApp 后、app.use(router) 前顶层 await）
 */
export async function setupProdMockIfNeeded(
  loadModule: () => Promise<ProdMockServerModule>
): Promise<void> {
  if (import.meta.env.PROD && import.meta.env.VITE_USE_MOCK === 'true') {
    const { setupProdMockServer } = await loadModule()
    await setupProdMockServer()
  }
}
