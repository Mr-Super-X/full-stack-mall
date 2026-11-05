import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AsyncState from './AsyncState.vue'

describe('AsyncState', () => {
  it('shows loading slot when loading is true', () => {
    const wrapper = mount(AsyncState, {
      props: { loading: true, error: null, isEmpty: false },
      slots: { loading: '<div class="custom-loading">Loading...</div>' },
    })
    expect(wrapper.find('.custom-loading').exists()).toBe(true)
  })

  it('shows error slot with retry when error exists', () => {
    const wrapper = mount(AsyncState, {
      props: { loading: false, error: new Error('boom'), isEmpty: false },
      slots: { error: '<button class="retry-btn">重试</button>' },
    })
    expect(wrapper.find('.retry-btn').exists()).toBe(true)
  })

  it('shows empty slot when isEmpty is true', () => {
    const wrapper = mount(AsyncState, {
      props: { loading: false, error: null, isEmpty: true },
      slots: { empty: '<div class="empty-tip">无数据</div>' },
    })
    expect(wrapper.find('.empty-tip').exists()).toBe(true)
  })

  it('shows default slot when all states are normal', () => {
    const wrapper = mount(AsyncState, {
      props: { loading: false, error: null, isEmpty: false },
      slots: { default: '<div class="content">Main</div>' },
    })
    expect(wrapper.find('.content').exists()).toBe(true)
  })
})
