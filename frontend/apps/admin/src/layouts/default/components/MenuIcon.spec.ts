/**
 * MenuIcon 组件单元测试。
 *
 * 核心回归场景（2026-09-10 实测发现并修复）：
 * 路由 meta.icon 存 kebab-case（'magic-stick'），而 @element-plus/icons-vue
 * 导出键是 PascalCase（'MagicStick'）——若不经 pascalCase 转换直接取键，
 * 解析恒为 undefined，折叠态菜单"看不见图标"。
 *
 * @group 布局：Default 测试
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { Odometer, MagicStick } from '@element-plus/icons-vue'
import MenuIcon from './MenuIcon.vue'

// el-icon 在 jsdom 下只做透传包装，stub 后可直接断言内部解析出的图标组件
const ElIconStub = {
  template: '<span class="el-icon-stub"><slot /></span>',
}

describe('MenuIcon', () => {
  it('kebab-case 图标名（magic-stick）解析为 PascalCase 导出组件', () => {
    const wrapper = mount(MenuIcon, {
      props: { name: 'magic-stick' },
      global: { stubs: { ElIcon: ElIconStub } },
    })
    expect(wrapper.findComponent(MagicStick).exists()).toBe(true)
  })

  it('单词图标名（odometer）正常解析', () => {
    const wrapper = mount(MenuIcon, {
      props: { name: 'odometer' },
      global: { stubs: { ElIcon: ElIconStub } },
    })
    expect(wrapper.findComponent(Odometer).exists()).toBe(true)
  })

  it('未命中的图标名不渲染（防御未知 meta.icon）', () => {
    const wrapper = mount(MenuIcon, {
      props: { name: 'not-exist-icon' },
      global: { stubs: { ElIcon: ElIconStub } },
    })
    // v-if 不命中时 Vue 渲染 v-if 注释锚点（<!--v-if-->），断言"无真实内容"即可
    expect(wrapper.find('.el-icon-stub').exists()).toBe(false)
    expect(wrapper.text()).toBe('')
  })

  it('name 为空/undefined 时不渲染', () => {
    const wrapper = mount(MenuIcon, {
      props: { name: undefined },
      global: { stubs: { ElIcon: ElIconStub } },
    })
    expect(wrapper.find('.el-icon-stub').exists()).toBe(false)
    expect(wrapper.text()).toBe('')
  })
})
