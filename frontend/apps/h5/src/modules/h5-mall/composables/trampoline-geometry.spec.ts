import { describe, expect, it } from 'vitest'

import {
  BALL_R,
  GAP,
  HALF,
  ICON_SLOT,
  PANEL,
  REST_CY,
  RING,
  TH0,
  WB,
  X0,
  ballTransform,
  baseYAt,
  boxBlur,
  buildPanelPath,
  clamp,
  cornerMelt,
  dentAt,
  iconOffsetY,
  tabX,
} from './trampoline-geometry'

describe('dentAt（凹槽剖面，spec §4）', () => {
  it('左右严格对称', () => {
    for (const dx of [0, 10, X0, X0 + 5, HALF - 0.1]) {
      expect(dentAt(dx, REST_CY)).toBe(dentAt(-dx, REST_CY))
    }
  })

  it('凹槽外返回 0（平边）', () => {
    expect(dentAt(HALF, REST_CY)).toBe(0)
    expect(dentAt(HALF + 1, REST_CY)).toBe(0)
    expect(dentAt(-HALF - 5, REST_CY)).toBe(0)
  })

  it('弧底（dx=0）深度 = cy + RING，垂直间隙 = GAP', () => {
    expect(dentAt(0, REST_CY)).toBeCloseTo(REST_CY + RING, 6)
    // 径向等隙：弧段是以球心为圆心、RING 为半径的圆（dx=0 处垂直间隙 = RING−BALL_R = GAP；
    // dx≠0 处垂直差随曲率变化，不等 GAP——几何事实，勿"修正" dentAt）
    expect(dentAt(0, REST_CY) - (REST_CY + BALL_R)).toBeCloseTo(GAP, 6)
  })

  it('球升高后肩部自然消失（d0≤0 → 0，spec §4.2）', () => {
    const cyHigh = -(RING * Math.cos(TH0)) - 1
    expect(dentAt(X0 + WB / 2, cyHigh)).toBe(0)
  })

  it('肩部单调递减无回升（相切收口前提）', () => {
    let prev = dentAt(X0, REST_CY)
    for (let dx = X0 + 1; dx < HALF; dx += 1) {
      const cur = dentAt(dx, REST_CY)
      expect(cur).toBeLessThanOrEqual(prev + 1e-9)
      prev = cur
    }
  })
})

describe('baseYAt（基础边含可变顶角，spec §5.1）', () => {
  it('平直段恒为 e', () => {
    expect(baseYAt(PANEL.r + 1, PANEL.r, PANEL.r)).toBe(PANEL.e)
    expect(baseYAt(PANEL.w / 2, PANEL.r, PANEL.r)).toBe(PANEL.e)
    expect(baseYAt(PANEL.w - PANEL.r - 1, PANEL.r, PANEL.r)).toBe(PANEL.e)
  })

  it('顶角为四分之一圆弧：端点深度 = e + rEff', () => {
    expect(baseYAt(0, PANEL.r, PANEL.r)).toBeCloseTo(PANEL.e + PANEL.r, 6)
    expect(baseYAt(PANEL.w, PANEL.r, PANEL.r)).toBeCloseTo(PANEL.e + PANEL.r, 6)
  })

  it('融化后顶角半径缩小（rEff=r−22·cornerMelt）', () => {
    const ballNearLeft = PANEL.r + HALF - 5
    const melt = cornerMelt(PANEL.r - ballNearLeft, REST_CY)
    expect(melt).toBeGreaterThan(0)
    const rEffL = PANEL.r - 22 * melt
    expect(baseYAt(0, rEffL, PANEL.r)).toBeCloseTo(PANEL.e + rEffL, 6)
  })
})

describe('boxBlur', () => {
  it('常数数组模糊后不变（线性保持）', () => {
    const a = new Float32Array(10).fill(7)
    expect(Array.from(boxBlur(a, 3)).every((v) => v === 7)).toBe(true)
  })
})

describe('buildPanelPath（三分量合成，spec §5）', () => {
  /** 从 path d 提取全部 L 命令的 y 值（toks[i]='Lx'，y 在 toks[i+1]；x/y 以空格分隔） */
  function sampleYs(d: string): number[] {
    const toks = d.split(' ')
    const ys: number[] = []
    for (let i = 0; i < toks.length - 1; i++) {
      if (toks[i].startsWith('L')) ys.push(Number(toks[i + 1]))
    }
    return ys
  }

  it('生成合法 path：M 开头、192 段 L（190 采样 + 2 底边）、双底角 A 命令、Z 闭合', () => {
    const d = buildPanelPath({ ballX: tabX(1, 4), ballCy: REST_CY, bulgeX: 0, bulgeA: 0 })
    expect(d.startsWith('M0 ')).toBe(true)
    expect(d.endsWith('Z')).toBe(true)
    expect(d.match(/L/g)!.length).toBe(192)
    expect(d.match(/A28 28/g)!.length).toBe(2)
  })

  it('静止球下凹槽中部下凹（采样深度 > e）', () => {
    const d = buildPanelPath({ ballX: tabX(1, 4), ballCy: REST_CY, bulgeX: 0, bulgeA: 0 })
    const ys = sampleYs(d)
    const midY = ys[95] // 190 个采样 L 的中部
    expect(midY).toBeGreaterThan(PANEL.e)
  })

  it('鼓包使对应区域上顶（边深 < e）', () => {
    const cx = PANEL.w / 2
    const flat = buildPanelPath({ ballX: tabX(0, 4), ballCy: REST_CY, bulgeX: cx, bulgeA: 20 })
    const ys = sampleYs(flat)
    const idx = Math.round(cx / (PANEL.w / 190))
    expect(ys[idx]).toBeLessThan(PANEL.e)
  })

  it('NaN 防御：偶发非法输入沿用上一帧合法 path（防整面板被 SVG 丢弃不绘制）', () => {
    const good = buildPanelPath({ ballX: tabX(1, 4), ballCy: REST_CY, bulgeX: 0, bulgeA: 0 })
    const bad = buildPanelPath({ ballX: NaN, ballCy: REST_CY, bulgeX: 0, bulgeA: 0 })
    expect(bad).toBe(good)
    expect(bad.includes('NaN')).toBe(false)
  })
})

describe('ballTransform（spec §8）', () => {
  const base = { ballX: 100, ballCy: REST_CY, vx: 0, vyRender: 0, squashS: 1 }

  it('idle 无变形：scale(1,1) 且位移以球心为准', () => {
    const t = ballTransform({ ...base, phase: 'idle' })
    expect(t).toContain(`translate(${(100 - BALL_R).toFixed(2)}px`)
    expect(t).toContain('scale(1.000,1.000)')
  })

  it('flight 沿速度拉伸：sx=1.2、sy≈0.833（v=2800 达上限）', () => {
    const t = ballTransform({ ...base, phase: 'flight', vx: 2800, vyRender: 0 })
    expect(t).toMatch(/scale\(1\.2\d\d,0\.8\d\d\)/)
  })

  it('dock 压扁：sy=squashS、sx 体积补偿', () => {
    const t = ballTransform({ ...base, phase: 'dock', squashS: 0.8 })
    expect(t).toContain('scale(1.180,0.800)')
  })
})

describe('缓动与工具', () => {
  it('clamp 钳制', () => {
    expect(clamp(5, 0, 1)).toBe(1)
    expect(clamp(-5, 0, 1)).toBe(0)
  })

  it('iconOffsetY：p=0 停槽、p=1 粘球心', () => {
    expect(iconOffsetY(REST_CY, 0)).toBeCloseTo(0, 9)
    expect(iconOffsetY(REST_CY, 1)).toBeCloseTo(REST_CY - ICON_SLOT, 9)
  })
})
