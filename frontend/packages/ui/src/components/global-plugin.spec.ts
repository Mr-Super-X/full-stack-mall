import { describe, it, expect } from 'vitest'
import type { App, Component } from 'vue'
import { createGlobalComponents } from '../global-components.ts'

/**
 * 构造一个最小可用的 fakeApp 来验证 app.component() 调用
 */
function makeFakeApp() {
  const components: Record<string, Component> = {}
  const fakeApp = {
    components,
    component(name: string, c: Component) {
      components[name] = c
    },
  } as unknown as App
  return { fakeApp, components }
}

describe('GlobalComponents 插件', () => {
  it('install 后 AsyncState 与 ErrorBoundary 都在注册表里', () => {
    const { fakeApp, components } = makeFakeApp()
    createGlobalComponents().install(fakeApp)
    expect(components.AsyncState).toBeDefined()
    expect(components.ErrorBoundary).toBeDefined()
  })

  it('至少注册 2 个组件（防御性检查，避免空目录或静默失败）', () => {
    const { fakeApp, components } = makeFakeApp()
    createGlobalComponents().install(fakeApp)
    expect(Object.keys(components).length).toBeGreaterThanOrEqual(2)
  })

  it('工厂每次返回带 install 的独立插件实例', () => {
    const a = createGlobalComponents()
    const b = createGlobalComponents()
    expect(typeof a.install).toBe('function')
    expect(a).not.toBe(b)
  })
})
