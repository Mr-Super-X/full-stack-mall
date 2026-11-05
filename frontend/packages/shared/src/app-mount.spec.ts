/**
 * bootstrapApp 装配编排契约测试。
 *
 * 验证目标不是「每个插件 install 了什么」（归属各插件自身 spec），而是
 * 本工厂固化的「顺序契约」：prod-mock 先于 use(router)、use 序列按
 * pinia→router→i18n→globalComponents→directives→plugins、setup 收尾在
 * 全部 use 之后、mount 在最后。顺序漂移即契约破坏，必须被本 spec 拦截。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import type { App, Plugin } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { bootstrapApp } from './app-mount.ts'
import type { BootstrapOptions } from './app-mount.ts'
import type { ProdMockServerModule } from './prod-mock.ts'

const { setupProdMockServer } = vi.hoisted(() => ({
  setupProdMockServer: vi.fn(() => Promise.resolve()),
}))

/** 记录 install 调用序的占位插件（真实插件行为不在本 spec 范围） */
function recordingPlugin(label: string, events: string[]): Plugin {
  return {
    install: () => {
      events.push(`use:${label}`)
    },
  }
}

/** 最小根组件：仅用于验证 mount 落点 */
const Root = defineComponent({
  name: 'SpecRoot',
  setup: () => () => h('div', { class: 'spec-root' }, 'mounted'),
})

/**
 * 组装一份完整 BootstrapOptions；events 数组由调用方持有，
 * 用于断言装配顺序（mock-load / use:* / setup 事件序）。
 * pinia / router / i18n 是真实实例——对其 install 打记录补丁
 * （仅本 spec 运行时包装，不断言插件内部行为）。
 */
function createOptions(
  events: string[],
  overrides: Partial<BootstrapOptions> = {}
): BootstrapOptions {
  const loadMockServer = vi.fn((): Promise<ProdMockServerModule> => {
    events.push('mock-load')
    return Promise.resolve({ setupProdMockServer })
  })
  const pinia = createPinia()
  recordInstall(pinia, 'pinia', events)
  const router = createRouter({ history: createMemoryHistory(), routes: [] })
  recordInstall(router, 'router', events)
  const i18n = createI18n({ legacy: false, locale: 'zh-CN', messages: {} })
  recordInstall(i18n, 'i18n', events)
  return {
    rootComponent: Root,
    router,
    pinia,
    i18n,
    title: 'SpecApp',
    globalComponents: recordingPlugin('globalComponents', events),
    directives: recordingPlugin('directives', events),
    loadMockServer,
    ...overrides,
  }
}

/** 给真实可安装实例（Pinia/Router/I18n 运行期均有 install）的 install 打记录补丁 */
function recordInstall(target: unknown, label: string, events: string[]): void {
  const installable = target as { install: (app: App, ...options: unknown[]) => unknown }
  const rawInstall = installable.install
  installable.install = (app: App, ...options: unknown[]) => {
    events.push(`use:${label}`)
    return rawInstall(app, ...options)
  }
}

beforeEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
  document.body.innerHTML = '<div id="app"></div>'
  document.title = ''
  document.documentElement.style.removeProperty('--color-primary')
})

describe('bootstrapApp', () => {
  it('use 序列按 pinia→router→i18n→globalComponents→directives→plugins 固化，setup 收尾', async () => {
    // stub PROD + VITE_USE_MOCK 让 prod-mock 挂载点真实执行（事件可观测）；
    // 「挂接先于 use(router)」的位置契约只在分支命中时有行为意义
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_USE_MOCK', 'true')
    const events: string[] = []

    await bootstrapApp(
      createOptions(events, {
        plugins: recordingPlugin('plugins', events),
        setup: () => {
          events.push('setup')
        },
      })
    )

    expect(events).toEqual([
      'mock-load',
      'use:pinia',
      'use:router',
      'use:i18n',
      'use:globalComponents',
      'use:directives',
      'use:plugins',
      'setup',
    ])
  })

  it('plugins 传数组 → 按序逐个 install；省略 plugins（big 形态）→ 无插件 use', async () => {
    const arrayEvents: string[] = []
    await bootstrapApp(
      createOptions(arrayEvents, {
        plugins: [recordingPlugin('p1', arrayEvents), recordingPlugin('p2', arrayEvents)],
      })
    )
    expect(arrayEvents.filter((e) => e.startsWith('use:'))).toEqual([
      'use:pinia',
      'use:router',
      'use:i18n',
      'use:globalComponents',
      'use:directives',
      'use:p1',
      'use:p2',
    ])

    const omittedEvents: string[] = []
    await bootstrapApp(createOptions(omittedEvents))
    expect(omittedEvents.filter((e) => e.startsWith('use:'))).toEqual([
      'use:pinia',
      'use:router',
      'use:i18n',
      'use:globalComponents',
      'use:directives',
    ])
  })

  it('dev（非 PROD）→ prod-mock 不加载（分支不命中，挂载点无行为）', async () => {
    vi.stubEnv('PROD', false)
    vi.stubEnv('VITE_USE_MOCK', 'true')
    const events: string[] = []

    const options = createOptions(events)
    await bootstrapApp(options)

    expect(options.loadMockServer).not.toHaveBeenCalled()
    expect(setupProdMockServer).not.toHaveBeenCalled()
    expect(events).not.toContain('mock-load')
  })

  it('PROD && VITE_USE_MOCK=true → 加载并激活 prod mock，mock-load 先于 use:router', async () => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_USE_MOCK', 'true')
    const events: string[] = []

    const options = createOptions(events)
    await bootstrapApp(options)

    expect(options.loadMockServer).toHaveBeenCalledTimes(1)
    expect(setupProdMockServer).toHaveBeenCalledTimes(1)
    expect(events.indexOf('mock-load')).toBeLessThan(events.indexOf('use:router'))
  })

  it('首屏前置两步生效：注入品牌色 + document.title 占位（createApp 之前段）', async () => {
    vi.stubEnv('VITE_BRAND_COLOR', '#123456')
    const events: string[] = []

    await bootstrapApp(createOptions(events))

    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('#123456')
    expect(document.title).toBe('SpecApp')
  })

  it('setup 在 mount 之前执行；bootstrapApp 完成后 #app 渲染根组件', async () => {
    const events: string[] = []
    let appHtmlAtSetup = '__unset__'

    await bootstrapApp(
      createOptions(events, {
        setup: () => {
          events.push('setup')
          appHtmlAtSetup = document.querySelector('#app')!.innerHTML
        },
      })
    )

    // setup 执行时 #app 尚未挂载（mount 固化为最后一步）
    expect(appHtmlAtSetup).toBe('')
    expect(events[events.length - 1]).toBe('setup')
    // bootstrapApp 完成后 #app 已有根组件渲染产物
    expect(document.querySelector('#app .spec-root')?.textContent).toBe('mounted')
  })
})
