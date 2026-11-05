import { beforeEach, describe, expect, it } from 'vitest'
import { createApp, h } from 'vue'
import type { App } from 'vue'
import { defineStore } from 'pinia'
import type { Pinia } from 'pinia'
import { createAppPinia } from './createAppPinia.ts'

/**
 * 经真实 Vue app 激活 pinia：Pinia 3 的 use() 在 install(app) 之前只入
 * toBeInstalled 队列（pinia._p 仍为空），插件必须经 app.use(pinia) 才生效——
 * 与 main.ts 的真实装配序列同构（app.use 先于任何 store 创建）。
 */
function activatePinia(pinia: Pinia): App {
  const app = createApp({ render: () => h('div') })
  app.use(pinia)
  return app
}

beforeEach(() => {
  localStorage.clear()
})

describe('createAppPinia（Pinia 装配单源工厂）', () => {
  it('返回可用 Pinia 实例（app.use 激活后 store 可注册并读写 state）', () => {
    const pinia = createAppPinia()
    activatePinia(pinia)
    const useDemoStore = defineStore('pinia-factory-demo', {
      state: () => ({ count: 0 }),
    })
    const store = useDemoStore(pinia)
    store.count = 7
    expect(store.count).toBe(7)
  })

  it('挂载 persistedstate：persist store 显式 $persist 写 localStorage', () => {
    const pinia = createAppPinia()
    activatePinia(pinia)
    const usePersistStore = defineStore('pinia-factory-persist', {
      state: () => ({ count: 0 }),
      persist: true,
    })
    const store = usePersistStore(pinia)
    store.count = 42
    store.$persist()
    expect(localStorage.getItem('pinia-factory-persist')).toContain('42')
  })
})
