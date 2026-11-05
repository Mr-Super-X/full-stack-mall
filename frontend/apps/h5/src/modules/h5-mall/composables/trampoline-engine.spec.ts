import { describe, expect, it } from 'vitest'

import { PANEL, REST_CY, tabX } from './trampoline-geometry'
import {
  applyTap,
  createInitialState,
  easeInOutCubic,
  easeInOutSine,
  easeOutBack,
  instantSelect,
  step,
  type TrampolineState,
} from './trampoline-engine'

const N = 4
const DT = 0.016 // 60fps

/** 驱动 step 直至谓词满足或步数上限（防死循环） */
function runUntil(s: TrampolineState, pred: () => boolean, maxSteps = 2000): void {
  for (let i = 0; i < maxSteps && !pred(); i++) step(s, DT, N)
}

describe('createInitialState', () => {
  it('初始选中首 tab：球停凹槽、首位图标粘球心', () => {
    const s = createInitialState(N)
    expect(s.phase).toBe('idle')
    expect(s.selected).toBe(0)
    expect(s.owner).toBe(0)
    expect(s.ball.x).toBeCloseTo(tabX(0, N), 6)
    expect(s.ball.cy).toBe(REST_CY)
    expect(s.icons[0].p).toBe(1)
    expect(s.icons[1].p).toBe(0)
  })
})

describe('applyTap → 全相位流转（spec §1.3 / §6）', () => {
  it('idle 点其它 tab → ride 蓄力（130ms）→ flight', () => {
    const s = createInitialState(N)
    expect(applyTap(s, 2, N)).toBe('changed')
    expect(s.selected).toBe(2)
    expect(s.phase).toBe('ride')

    runUntil(s, () => s.phase !== 'ride', Math.ceil(0.15 / DT))
    expect(s.phase).toBe('flight')
    expect(s.fly!.x0).toBeCloseTo(tabX(0, N), 6)
    expect(s.fly!.x1).toBeCloseTo(tabX(2, N), 6)
  })

  it('flight 落地 → dock 弹簧回弹，末速度按抛物线解析式接力（§6.5）', () => {
    const s = createInitialState(N)
    applyTap(s, 2, N)
    runUntil(s, () => s.phase === 'flight')
    const fly = { ...s.fly! }
    runUntil(s, () => s.phase === 'dock')
    const expectVy = (fly.cy1 - fly.cy0 + 4 * fly.H) / (fly.dur / 1000)
    expect(s.ball.vy).toBeCloseTo(expectVy, 4)
    expect(s.squash.s).toBeLessThan(0.85) // capture 同帧压扁 0.8（已积分一帧，允许微漂）
    expect(s.owner).toBe(2) // capture 移交图标
  })

  it('dock 收敛回 idle：球精确归位 REST_CY', () => {
    const s = createInitialState(N)
    applyTap(s, 2, N)
    runUntil(s, () => s.phase === 'idle')
    expect(s.ball.cy).toBe(REST_CY) // 收敛分支显式归位
    expect(s.ball.vy).toBe(0)
    expect(s.ball.x).toBeCloseTo(tabX(2, N), 6)
  })

  it('idle 点当前 tab → 原地小跳（x0=x1、拱高 20）', () => {
    const s = createInitialState(N)
    expect(applyTap(s, 0, N)).toBe('same-hop')
    expect(s.phase).toBe('flight')
    expect(s.fly!.x0).toBe(s.fly!.x1)
    expect(s.fly!.H).toBe(20)
  })

  it('动画中重复点当前 tab → ignored', () => {
    const s = createInitialState(N)
    applyTap(s, 2, N)
    step(s, DT, N) // 进入动画
    expect(applyTap(s, 0, N)).toBe('changed') // 追加抛（目标 0）
    expect(applyTap(s, 0, N)).toBe('ignored') // 动画中再点当前目标 → 忽略
  })

  it('飞行中追加抛掷：从当前位置直接再抛，不回起点（§1.3）', () => {
    const s = createInitialState(N)
    applyTap(s, 2, N)
    runUntil(s, () => s.phase === 'flight')
    step(s, DT, N) // 飞一段
    const xMid = s.ball.x
    applyTap(s, 3, N)
    expect(s.fly!.x0).toBeCloseTo(xMid, 6) // 从当前位置起抛
    expect(s.fly!.x0).not.toBeCloseTo(tabX(0, N), 3)
    expect(s.fly!.x1).toBeCloseTo(tabX(3, N), 6)
    expect(s.selected).toBe(3)
  })
})

describe('图标补间（spec §7.1）', () => {
  it('旧图标浮出（tap 即启动）、新图标浮入（capture 启动），补间完成归位', () => {
    const s = createInitialState(N)
    applyTap(s, 1, N)
    expect(s.icons[0].tw).not.toBeNull() // 旧图标释放补间随 tap 启动
    runUntil(s, () => s.phase === 'dock')
    expect(s.icons[1].tw).not.toBeNull() // 新图标浮入补间随 capture 启动
    runUntil(s, () => s.icons[1].tw === null && s.icons[0].tw === null)
    expect(s.icons[0].p).toBe(0)
    expect(s.icons[1].p).toBe(1)
  })
})

describe('instantSelect（reduced-motion 降级）', () => {
  it('瞬时换 tab：跳过动画、图标立即归位', () => {
    const s = createInitialState(N)
    applyTap(s, 2, N)
    step(s, DT, N)
    instantSelect(s, 3, N)
    expect(s.phase).toBe('idle')
    expect(s.ball.x).toBeCloseTo(tabX(3, N), 6)
    expect(s.ball.cy).toBe(REST_CY)
    expect(s.icons[3].p).toBe(1)
    expect(s.icons[0].p).toBe(0)
    expect(s.bulge.a).toBe(0)
    expect(s.squash.s).toBe(1)
  })
})

describe('防御与差分', () => {
  it('dt≤0 时 step 为空操作（后台切回大步长防御）', () => {
    const s = createInitialState(N)
    const t0 = s.tNow
    step(s, 0, N)
    step(s, -1, N)
    expect(s.tNow).toBe(t0)
  })

  it('idle 下差分速度为 0（无 NaN/Infinity）', () => {
    const s = createInitialState(N)
    for (let i = 0; i < 5; i++) step(s, DT, N)
    expect(s.ball.vx).toBe(0)
    expect(s.ball.vyRender).toBe(0)
  })

  it('idle 下球始终吸附选中 tab（外部改 selected 的兜底）', () => {
    const s = createInitialState(N)
    s.selected = 2
    step(s, DT, N)
    expect(s.ball.x).toBeCloseTo(tabX(2, N), 6)
    expect(s.ball.cy).toBe(REST_CY)
  })
})

describe('缓动端点', () => {
  it('easeOutBack / easeInOutCubic / easeInOutSine 0→1', () => {
    expect(easeOutBack(0)).toBeCloseTo(0, 9)
    expect(easeOutBack(1)).toBeCloseTo(1, 9)
    expect(easeInOutCubic(0)).toBeCloseTo(0, 9)
    expect(easeInOutCubic(1)).toBeCloseTo(1, 9)
    expect(easeInOutSine(0)).toBeCloseTo(0, 9)
    expect(easeInOutSine(1)).toBeCloseTo(1, 9)
    expect(easeInOutSine(0.5)).toBeCloseTo(0.5, 6)
  })
})

describe('面板渲染输入（与 geometry 联动）', () => {
  it('飞行中球心纵坐标可越过平边上方 80px（拱顶恒定，§6.2）', () => {
    const s = createInitialState(N)
    applyTap(s, 3, N) // 最远端 tab，dist 最大
    runUntil(s, () => s.phase === 'flight')
    let minCy = Infinity
    runUntil(
      s,
      () => {
        minCy = Math.min(minCy, s.ball.cy)
        return s.phase === 'dock'
      },
      1000
    )
    // 拱顶 = REST_CY − ARC_APEX(80) 附近（允许采样步进误差）
    expect(minCy).toBeLessThan(REST_CY - 70)
    expect(minCy).toBeGreaterThan(REST_CY - 95)
  })

  it('tNow 单调递增驱动补间（引擎时间为内部累加制）', () => {
    const s = createInitialState(N)
    const t0 = s.tNow
    step(s, DT, N)
    expect(s.tNow).toBeCloseTo(t0 + DT * 1000, 6)
  })
})

// PANEL 引用守卫：engine 依赖 PANEL.e 计算差分纵坐标
describe('PANEL 常量锚点', () => {
  it('PANEL.e 与 REST_CY 与设计常量一致', () => {
    expect(PANEL.e).toBe(42)
    expect(REST_CY).toBe(10)
  })
})
