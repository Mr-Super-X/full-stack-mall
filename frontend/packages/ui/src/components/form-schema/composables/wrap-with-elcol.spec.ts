/**
 * wrap-with-elcol 单元测试
 *
 * 覆盖：
 * - node.col=false → 原样返回 inner（不包 ElCol）
 * - node.col=undefined → 原样返回 inner
 * - node.col=object 无 span → fallback 24
 * - node.col=object 有 span → span=col.span
 * - pickBreakpointConfig: 移动优先（从大断点往小断点找）
 * - mergeColResponsive: 删除 responsive 字段
 * - mergeRowResponsive: 合并 + 删除 responsive
 */
import { describe, expect, it } from 'vitest'
import { h, type VNode } from 'vue'
import {
  mergeColResponsive,
  mergeRowResponsive,
  pickBreakpointConfig,
  wrapWithElCol,
} from './wrap-with-elcol'
import type { ColConfig, RowConfig } from '../types'

describe('wrapWithElCol', () => {
  const inner = h('div', { 'data-test': 'inner' }) as VNode

  it('col=false → 原样返回 inner', () => {
    const node = { col: false } as never
    const out = wrapWithElCol(node, inner)
    expect(out).toBe(inner)
  })

  it('col=undefined → 原样返回 inner', () => {
    const node = {} as never
    const out = wrapWithElCol(node, inner)
    expect(out).toBe(inner)
  })

  it('col=object 有 span → 包 ElCol span=col.span', () => {
    const node = { col: { span: 12 } } as never
    const out = wrapWithElCol(node, inner)
    const props = (out as unknown as { props: { span?: number } }).props
    expect(props.span).toBe(12)
  })

  it('col=object 无 span → fallback 24', () => {
    const node = { col: { offset: 2 } as never } as never
    const out = wrapWithElCol(node, inner)
    const props = (out as unknown as { props: { span?: number } }).props
    expect(props.span).toBe(24)
  })

  it('col=object 有 offset → 透传', () => {
    const node = { col: { span: 12, offset: 4 } } as never
    const out = wrapWithElCol(node, inner)
    const props = (out as unknown as { props: { span?: number; offset?: number } }).props
    expect(props.span).toBe(12)
    expect(props.offset).toBe(4)
  })

  it('col 有 responsive → 透传整个 responsive 给 ElCol', () => {
    const colObj = { responsive: { sm: { span: 6 } } }
    const node = { col: colObj } as never
    const out = wrapWithElCol(node, inner)
    const props = (out as unknown as { props: { responsive?: unknown } }).props
    expect(props.responsive).toBe(colObj.responsive)
  })

  it('响应式断点匹配：currentBreakpoint=md → 取 sm/md/xl 中的最近配置', () => {
    const node = {
      col: {
        responsive: {
          sm: { span: 12 },
          md: { span: 8 },
          xl: { span: 4 },
        },
      },
    } as never
    const out = wrapWithElCol(node, inner, 'md')
    const props = (out as unknown as { props: { span?: number } }).props
    expect(props.span).toBe(8) // md 配置
  })
})

describe('pickBreakpointConfig', () => {
  it('current=md → 从 md 向下找（md → sm → xs）', () => {
    const responsive = { sm: { span: 6 }, md: { span: 8 } } as never
    expect(pickBreakpointConfig(responsive, 'md')).toEqual({ span: 8 })
  })

  it('current=md 但只有 xs 配置 → fallback 到 xs（移动优先）', () => {
    const responsive = { xs: { span: 24 } } as never
    expect(pickBreakpointConfig(responsive, 'md')).toEqual({ span: 24 })
  })

  it('current=undefined → 返回第一个可用配置', () => {
    const responsive = { xs: { span: 24 }, md: { span: 8 } } as never
    expect(pickBreakpointConfig(responsive, undefined)).toBeDefined()
  })

  it('空 responsive → undefined', () => {
    expect(pickBreakpointConfig({}, 'md')).toBeUndefined()
  })

  it('current 大于最大可用断点 → fallback 到 base config', () => {
    const responsive = { xs: { span: 24 } } as never
    expect(pickBreakpointConfig(responsive, 'xl')).toEqual({ span: 24 })
  })
})

describe('mergeColResponsive', () => {
  it('col=undefined → 原样返回', () => {
    expect(mergeColResponsive(undefined)).toBeUndefined()
  })

  it('col=false → 原样返回', () => {
    expect(mergeColResponsive(false)).toBe(false)
  })

  it('col 是 string（被视作 boolean true） → 返回 true', () => {
    // 边界：col string 不应该出现但需要兜底
    expect(mergeColResponsive(true as never)).toBe(true)
  })

  it('col 无 responsive → 原样返回（不变）', () => {
    const col: ColConfig = { span: 12 }
    expect(mergeColResponsive(col)).toEqual({ span: 12 })
  })

  it('col 有 responsive + current 匹配 → 合并 picked + 删除 responsive', () => {
    const col: ColConfig = {
      span: 24,
      offset: 0,
      responsive: { md: { span: 12, offset: 4 } },
    }
    const out = mergeColResponsive(col, 'md')
    expect(out).toEqual({ span: 12, offset: 4 })
    expect((out as ColConfig | undefined)?.responsive).toBeUndefined()
  })

  it('col 有 responsive + current 不匹配 → 不改 col', () => {
    const col: ColConfig = { span: 24, responsive: { md: { span: 12 } } }
    const out = mergeColResponsive(col, 'xs')
    // xs 没匹配但响应式里有 md 配置 → 仍然合并（移动优先降级到基础配置）
    expect((out as ColConfig | undefined)?.responsive).toBeUndefined()
  })
})

describe('mergeRowResponsive', () => {
  it('row=undefined → undefined', () => {
    expect(mergeRowResponsive(undefined)).toBeUndefined()
  })

  it('row 无 responsive → 原样返回', () => {
    const row: RowConfig = { gutter: 24 }
    expect(mergeRowResponsive(row)).toEqual({ gutter: 24 })
  })

  it('row 有 responsive + current 匹配 → 合并 + 删除 responsive', () => {
    const row: RowConfig = {
      gutter: 0,
      type: 'flex',
      responsive: { sm: { gutter: 16 } },
    }
    const out = mergeRowResponsive(row, 'sm')
    expect(out).toEqual({ gutter: 16, type: 'flex' })
    expect(out?.responsive).toBeUndefined()
  })
})
