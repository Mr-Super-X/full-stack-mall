/**
 * big layout scale 运行时单测。
 *
 * 覆盖：四档目标视口（1920/2560/4K/9000×1080）的 scale 与居中偏移、
 * meta 收窄守卫（缺省/非法值回退）、视口为 0 的防御。
 */
import { describe, expect, it } from 'vitest'
import {
  BIG_SCALE_RESIZE_DELAY,
  DEFAULT_BIG_SCREEN_SIZE,
  computeBigScale,
  resolveBigScreenSize,
} from './scale'

describe('computeBigScale', () => {
  const design = { width: 1920, height: 1080 }

  it('1920×1080 视口 → scale=1 无偏移', () => {
    expect(computeBigScale(design, 1920, 1080)).toEqual({ scale: 1, offsetX: 0, offsetY: 0 })
  })

  it('2560×1440 视口 → scale=4/3 等比放大', () => {
    const { scale, offsetX, offsetY } = computeBigScale(design, 2560, 1440)
    expect(scale).toBeCloseTo(4 / 3, 5)
    expect(offsetX).toBeCloseTo(0, 5)
    expect(offsetY).toBeCloseTo(0, 5)
  })

  it('3840×2160 (4K) 视口 → scale=2', () => {
    expect(computeBigScale(design, 3840, 2160).scale).toBe(2)
  })

  it('9000×1080 拼接屏视口 → 高度瓶颈 scale=1，两侧留白居中', () => {
    const { scale, offsetX, offsetY } = computeBigScale(design, 9000, 1080)
    expect(scale).toBe(1)
    expect(offsetX).toBe((9000 - 1920) / 2)
    expect(offsetY).toBe(0)
  })

  it('超宽设计稿 9000×1080 在 9000×1080 视口 → scale=1 恰好铺满', () => {
    const wide = { width: 9000, height: 1080 }
    expect(computeBigScale(wide, 9000, 1080)).toEqual({ scale: 1, offsetX: 0, offsetY: 0 })
  })

  it('超宽设计稿在 1920 开发机视口 → 宽度瓶颈缩小预览', () => {
    const wide = { width: 9000, height: 1080 }
    const { scale, offsetY } = computeBigScale(wide, 1920, 1080)
    expect(scale).toBeCloseTo(1920 / 9000, 5)
    expect(offsetY).toBeCloseTo((1080 - 1080 * (1920 / 9000)) / 2, 5)
  })

  it('视口为 0（隐藏 iframe/预渲染）→ 回退 scale=1 不塌陷', () => {
    expect(computeBigScale(design, 0, 0)).toEqual({ scale: 1, offsetX: 0, offsetY: 0 })
    expect(computeBigScale(design, 1920, 0).scale).toBe(1)
  })

  it('视口 NaN/Infinity（如 9000/0 误算）→ 回退 scale=1，不产出 NaN transform', () => {
    // NaN <= 0 为 false，「<= 0」守卫会漏——必须走 isValidSize（终审 M1 修复回归）
    expect(computeBigScale(design, Number.NaN, 1080)).toEqual({ scale: 1, offsetX: 0, offsetY: 0 })
    expect(computeBigScale(design, Number.POSITIVE_INFINITY, 1080).scale).toBe(1)
    expect(computeBigScale(design, 1920, Number.NaN).scale).toBe(1)
  })

  it('设计稿尺寸非法（0/负数）→ 回退默认 1920×1080', () => {
    const m = computeBigScale({ width: 0, height: -1 }, 1920, 1080)
    expect(m).toEqual({ scale: 1, offsetX: 0, offsetY: 0 })
  })
})

describe('resolveBigScreenSize', () => {
  it('meta 缺省 → 默认 1920×1080', () => {
    expect(resolveBigScreenSize({})).toEqual(DEFAULT_BIG_SCREEN_SIZE)
    expect(resolveBigScreenSize(undefined)).toEqual(DEFAULT_BIG_SCREEN_SIZE)
    expect(resolveBigScreenSize(null)).toEqual(DEFAULT_BIG_SCREEN_SIZE)
  })

  it('meta.bigScreen 合法 → 收窄为声明尺寸', () => {
    expect(resolveBigScreenSize({ bigScreen: { width: 9000, height: 1080 } })).toEqual({
      width: 9000,
      height: 1080,
    })
  })

  it.each([
    ['非对象', { bigScreen: '9000x1080' }],
    ['width 非数字', { bigScreen: { width: '9000', height: 1080 } }],
    ['width 为 0', { bigScreen: { width: 0, height: 1080 } }],
    ['height 为负', { bigScreen: { width: 9000, height: -1080 } }],
    ['NaN', { bigScreen: { width: Number.NaN, height: 1080 } }],
    [
      'Infinity（如 9000/0 误算）',
      { bigScreen: { width: Number.POSITIVE_INFINITY, height: 1080 } },
    ],
  ])('meta.bigScreen %s → 回退默认', (_label, meta) => {
    expect(resolveBigScreenSize(meta)).toEqual(DEFAULT_BIG_SCREEN_SIZE)
  })
})

describe('常量契约', () => {
  it('默认设计稿 = 1920×1080，防抖 150ms', () => {
    expect(DEFAULT_BIG_SCREEN_SIZE).toEqual({ width: 1920, height: 1080 })
    expect(BIG_SCALE_RESIZE_DELAY).toBe(150)
  })
})
