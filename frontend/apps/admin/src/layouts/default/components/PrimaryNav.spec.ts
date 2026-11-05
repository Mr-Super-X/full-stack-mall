// PrimaryNav 主导航单测
//
// 覆盖（2026-09-10 双栏/混合布局空项修复回归）：
//   - 单子项提升：顶层包装路由（无 title/icon）显示子项标题与图标
//   - 多子项分组显示自身标题
//   - 激活态按 raw 顶层 path 匹配（提升后子项 path 不同，不能用 display 匹配）
//   - select 事件载荷为 raw 节点（父组件 selectPrimary 依赖顶层节点取首个叶子）

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PrimaryNav from './PrimaryNav.vue'
import type { MenuNode } from '../config/types'

/** /user 形态：顶层包装路由自身无 meta（title/icon 为空），单子项提升显示子项 */
const singleChildGroup: MenuNode = {
  path: '/user',
  title: '',
  children: [{ path: '/user/list', title: '用户管理', icon: 'user' }],
}

/** /workbench 形态：多子项分组，显示自身标题/图标 */
const multiGroup: MenuNode = {
  path: '/workbench',
  title: '工作台',
  icon: 'odometer',
  children: [
    { path: '/workbench/home', title: '首页' },
    { path: '/workbench/analysis', title: '分析页' },
  ],
}

function mountNav(
  props: Partial<{ nodes: MenuNode[]; activePath: string; mode: 'top' | 'rail' }> = {}
) {
  return mount(PrimaryNav, { props: { nodes: [singleChildGroup, multiGroup], ...props } })
}

describe('PrimaryNav', () => {
  it('单子项提升：无 title/icon 的包装层显示子项标题与图标', () => {
    const wrapper = mountNav()
    const labels = wrapper.findAll('.vv-primary-nav__label').map((el) => el.text())
    expect(labels).toEqual(['用户管理', '工作台'])
    // 子项 icon 'user' 渲染为 svg（kebab→PascalCase 解析成功）
    expect(wrapper.findAll('button')[0]?.find('svg').exists()).toBe(true)
  })

  it('激活态按 raw 顶层 path 匹配（activePath=/user 命中提升项）', () => {
    const wrapper = mountNav({ activePath: '/user' })
    const buttons = wrapper.findAll('button')
    expect(buttons[0]?.classes()).toContain('is-active')
    expect(buttons[1]?.classes()).not.toContain('is-active')
  })

  it('select 事件载荷为 raw 节点（父组件按顶层节点取首个叶子跳转）', async () => {
    const wrapper = mountNav()
    await wrapper.findAll('button')[0]?.trigger('click')
    const emitted = wrapper.emitted('select')
    expect(emitted).toHaveLength(1)
    // 载荷是 /user 包装节点而非提升后的 /user/list
    expect((emitted?.[0]?.[0] as MenuNode).path).toBe('/user')
  })

  it('rail 模式同样渲染提升后的子项标题', () => {
    const wrapper = mountNav({ mode: 'rail' })
    expect(wrapper.find('.vv-primary-nav--rail').exists()).toBe(true)
    expect(wrapper.findAll('.vv-primary-nav__label').map((el) => el.text())).toEqual([
      '用户管理',
      '工作台',
    ])
  })
})
