/**
 * 侧栏宽度常量与钳制函数测试。
 *
 * clampMenuWidth 被拖拽手柄 / 布局壳渲染 / store 持久化值回灌三处消费，
 * 边界行为（默认值回退、上下界、取整）必须钉死。
 *
 * @see [`./resize.ts`](./resize.ts) 被测实现
 * @group 布局：Default
 */
import { describe, expect, it } from 'vitest'
import { clampMenuWidth, MENU_DEFAULT_WIDTH, MENU_MAX_WIDTH, MENU_MIN_WIDTH } from './resize'

describe('clampMenuWidth', () => {
  it('null / undefined / NaN / Infinity 回退默认值（持久化字段允许为 null）', () => {
    expect(clampMenuWidth(null)).toBe(MENU_DEFAULT_WIDTH)
    expect(clampMenuWidth(undefined)).toBe(MENU_DEFAULT_WIDTH)
    expect(clampMenuWidth(Number.NaN)).toBe(MENU_DEFAULT_WIDTH)
    expect(clampMenuWidth(Infinity)).toBe(MENU_DEFAULT_WIDTH)
    expect(clampMenuWidth(-Infinity)).toBe(MENU_DEFAULT_WIDTH)
  })

  it('区间内值原样返回（小数取整）', () => {
    expect(clampMenuWidth(160)).toBe(160)
    expect(clampMenuWidth(480)).toBe(480)
    expect(clampMenuWidth(224.4)).toBe(224)
    expect(clampMenuWidth(300.6)).toBe(301)
  })

  it('越下界钳制到 MENU_MIN_WIDTH，越上界钳制到 MENU_MAX_WIDTH', () => {
    expect(clampMenuWidth(0)).toBe(MENU_MIN_WIDTH)
    expect(clampMenuWidth(72)).toBe(MENU_MIN_WIDTH) // 折叠态宽度不可作为展开态宽
    expect(clampMenuWidth(159)).toBe(MENU_MIN_WIDTH)
    expect(clampMenuWidth(481)).toBe(MENU_MAX_WIDTH)
    expect(clampMenuWidth(99999)).toBe(MENU_MAX_WIDTH)
  })
})
