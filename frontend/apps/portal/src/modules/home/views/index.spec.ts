import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import HomeIndex from './index.vue'

describe('home 官网首页（smoke）', () => {
  it('渲染 4 个锚点区块 + 页脚，且品牌名可见', () => {
    const w = mount(HomeIndex)
    for (const id of ['hero', 'features', 'stats', 'about']) {
      expect(w.find(`#${id}`).exists()).toBe(true)
    }
    expect(w.find('footer').exists()).toBe(true)
    expect(w.text()).toContain('企业门户')
  })
})
