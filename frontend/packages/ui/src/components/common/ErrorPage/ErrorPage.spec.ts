import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { registerAppRouter } from '@vv/shared'
import ErrorPage from './ErrorPage.vue'

/** 构造内存路由实例并注册进 DI（ErrorPage 经 getAppRouter 读取；重复注册以最后一次为准） */
function setupRouter(): Router {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/home', name: 'Home', component: { template: '<div />' } }],
  })
  registerAppRouter(router)
  return router
}

const baseProps = {
  title: '页面不存在',
  returnTo: '/home',
  returnLabel: '返回首页',
} as const

describe('ErrorPage', () => {
  let router: Router

  beforeEach(() => {
    router = setupRouter()
  })

  it('按 status 渲染状态码与说明文案', () => {
    const wrapper = mount(ErrorPage, { props: { ...baseProps, status: 404 } })
    expect(wrapper.find('.el-result').exists()).toBe(true)
    expect(wrapper.text()).toContain('404')
    expect(wrapper.text()).toContain('页面不存在')
  })

  it('icon 区域随 403 / 404 / 500 三种 status 均渲染', () => {
    for (const status of [403, 404, 500] as const) {
      const wrapper = mount(ErrorPage, { props: { ...baseProps, status } })
      expect(wrapper.find('.el-result__icon').exists()).toBe(true)
    }
  })

  it('返回按钮渲染 returnLabel，点击后 router.push 到 returnTo', async () => {
    const pushSpy = vi.spyOn(router, 'push')
    const wrapper = mount(ErrorPage, { props: { ...baseProps, status: 500 } })
    const button = wrapper.find('button')
    expect(button.exists()).toBe(true)
    expect(button.text()).toContain('返回首页')
    await button.trigger('click')
    expect(pushSpy).toHaveBeenCalledWith('/home')
  })
})
