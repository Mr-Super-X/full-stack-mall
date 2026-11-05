/**
 * sidebar-groups 单元测试
 * 覆盖：前缀分组归类 / 兜底组 / 中文名组装 / 无映射降级
 */
import { describe, expect, it } from 'vitest'
import { getSidebarGroup, getSidebarLabel } from './sidebar-groups'

describe('sidebar-groups / 分组归类', () => {
  it('XForm 前缀组件归入表单引擎组', () => {
    expect(getSidebarGroup('XFormPersist')).toBe('XForm 表单引擎')
    expect(getSidebarGroup('XForm')).toBe('XForm 表单引擎')
    expect(getSidebarGroup('XFormDirty')).toBe('XForm 表单引擎')
  })

  it('ProDialog 前缀组件归入弹窗组件组', () => {
    expect(getSidebarGroup('ProDialogOverview')).toBe('ProDialog 弹窗组件')
    expect(getSidebarGroup('ProDialogUseDialog')).toBe('ProDialog 弹窗组件')
  })

  it('BaseChart 前缀组件归入图表组件组', () => {
    expect(getSidebarGroup('BaseChartOverview')).toBe('BaseChart 图表组件')
    expect(getSidebarGroup('BaseChartSaleFunnel')).toBe('BaseChart 图表组件')
    expect(getSidebarGroup('BaseChartRealTime')).toBe('BaseChart 图表组件')
    expect(getSidebarGroup('BaseChartInDialog')).toBe('BaseChart 图表组件')
    expect(getSidebarGroup('BaseChartDashboard')).toBe('BaseChart 图表组件')
  })

  it('非任何带前缀组件归入通用组件组', () => {
    expect(getSidebarGroup('AsyncState')).toBe('通用组件')
    expect(getSidebarGroup('ErrorBoundary')).toBe('通用组件')
  })

  it('未知名组件归入最后一个兜底组', () => {
    expect(getSidebarGroup('UnknownThing')).toBe('通用组件')
  })
})

describe('sidebar-groups / 中文名组装', () => {
  it('有映射时返回 组件名 + 空格 + 中文名', () => {
    expect(getSidebarLabel('XFormPersist')).toBe('XFormPersist 草稿持久化')
    expect(getSidebarLabel('AsyncState')).toBe('AsyncState 异步状态容器')
  })

  it('无映射时仅返回组件名', () => {
    expect(getSidebarLabel('FooBar')).toBe('FooBar')
  })
})
