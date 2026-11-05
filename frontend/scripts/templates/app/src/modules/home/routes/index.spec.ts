/**
 * home 路由骨架 spec —— 新 app 生成即有的最小单测。
 *
 * 存在理由：`vitest run` 在零 spec 时以 "No test files found" 非零退出，
 * 会让新 app 的 `pnpm -C apps/<name> test` 与 turbo 拓扑 test 直接红；
 * 本 spec 同时锁死脚手架的两个路由契约（/home 路径 + routeNames 含 Home），
 * 后者是白名单（whitelist.ts）全量吸收的数据源。
 */
import { describe, it, expect } from 'vitest'
import routes, { routeNames } from './index'

describe('home 路由骨架', () => {
  it('注册 /home 路由且 routeNames 含 Home', () => {
    expect(routes[0]?.path).toBe('/home')
    expect(routeNames).toContain('Home')
  })
})
