import { describe, it, expect } from 'vitest'
import { COMPONENT_REGISTRY } from './auto-register'

describe('COMPONENT_REGISTRY（从 autoRegisteredRoutes 派生）', () => {
  it('含 routes/index.ts 中声明的所有业务路由 name', () => {
    // P3-1 起 Home 迁 apps/portal；P4 起 Login 迁 apps/auth——均不在 admin 注册表
    expect(COMPONENT_REGISTRY.Workbench).toBeDefined()
    expect(COMPONENT_REGISTRY.UserList).toBeDefined()
  })

  it('不含 error 模块的 name（2026-10-27 错误页拍平：改在 router/index.ts 根级内联注册）', () => {
    // 错误页注册点已从 modules/error/routes（本表数据源）移到 router/index.ts 内联，
    // 本注册表不应再含；其存在性由 check:routes 的 requiredRoutes 校验覆盖（router/index.ts 正则提取）
    expect(COMPONENT_REGISTRY.Forbidden).toBeUndefined()
    expect(COMPONENT_REGISTRY.NotFound).toBeUndefined()
    expect(COMPONENT_REGISTRY.ServerError).toBeUndefined()
  })

  it('component 是懒加载函数（不会立即执行）', () => {
    expect(typeof COMPONENT_REGISTRY.UserList).toBe('function')
  })

  it('不包含未在 routes 中声明的 name', () => {
    expect(COMPONENT_REGISTRY.NonExistentRoute).toBeUndefined()
  })
})
