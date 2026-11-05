// Trampoline Tabbar 动画引擎（相位机 + 弹簧系统）——逐条对应 design/tabbar-animation-spec.md §1.3、§6、§7。
//
// 结构裁决（读代码读不出的约定，变更前先看这里）：
//   - 全部时间以秒入参、毫秒存状态（tNow 为引擎内时间 ms，测试可控）；
//   - 弹簧一律半隐式欧拉（先速度后位置，spec §6.4），跨端手感一致，禁用平台 spring API；
//   - 相位机纯函数化：step/applyTap 不碰 DOM，Vue 层只管驱动与渲染（见 useTrampolineTabbar.ts）；
//   - 速度接力（§6.5）是防「落地顿挫」的关键：dock 弹簧初速必须取抛物线末速度解析式。
//
// 配套：trampoline-geometry.ts（几何/路径）、useTrampolineTabbar.ts（rAF 编排）。

import { PANEL, REST_CY, clamp, tabX } from './trampoline-geometry'

export type TrampolinePhase = 'idle' | 'ride' | 'flight' | 'dock'

/** 图标浮入/浮出补间参数 */
export interface IconTween {
  from: number
  to: number
  t0: number
  dur: number
}

export interface IconProgress {
  /** 粘附进度 p∈[0,1]：0=停图标槽，1=粘球心 */
  p: number
  tw: IconTween | null
}

export interface TrampolineState {
  phase: TrampolinePhase
  /** 目标选中下标（tap 即指向目标；idle 时球停此） */
  selected: number
  /** 图标占有者（落地 capture 时移交给 selected） */
  owner: number
  /** 引擎内时间（ms），由 step 累加，测试可控 */
  tNow: number
  ball: { x: number; cy: number; vy: number; vx: number; vyRender: number }
  /** 蹦床鼓包（a 正=向上顶起） */
  bulge: { a: number; v: number; x: number }
  /** 落地压扁（s=1 无变形） */
  squash: { s: number; v: number }
  ride: { t0: number; dur: number; liftTo: number; x: number } | null
  fly: {
    t0: number
    dur: number
    x0: number
    x1: number
    H: number
    cy0: number
    cy1: number
  } | null
  icons: IconProgress[]
  /** 帧间差分前置位置（渲染速度用） */
  prevX: number
  prevY: number
}

/** 三根弹簧（spec §2.2；阻尼比 ζ≈0.30~0.37，弹 1~2 个来回即收敛） */
export const SPR_DOCK = { k: 680, c: 19.5 } as const
export const SPR_SQUASH = { k: 600, c: 14.7 } as const
export const SPR_BULGE = { k: 460, c: 12.9 } as const

/** 蓄力时长（spec §6.1） */
export const RIDE_DUR = 130
/** 三种鼓包踢速（spec §6.4）：静止起抛 / 飞行追加 / 原地小跳 */
export const KICK_STATIONARY = 330
export const KICK_MIDFLIGHT = 240
export const KICK_HOP = 190
/** 原地小跳参数（spec §1.3） */
export const HOP_DUR = 300
export const HOP_H = 20
/** 抛物线拱顶恒在平边上方 80px（spec §6.2） */
export const ARC_APEX = 80

export const easeInOutSine = (u: number): number => -(Math.cos(Math.PI * u) - 1) / 2
export const easeOutBack = (u: number): number => {
  const c = 1.55
  const v = u - 1
  return 1 + v * v * ((c + 1) * v + c)
}
export const easeInOutCubic = (u: number): number =>
  u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2

/** 初始态：选中第一个 tab，球停对应凹槽，首位图标已粘球心（spec §1.3 初始状态） */
export function createInitialState(n: number, selected = 0): TrampolineState {
  const x = tabX(selected, n)
  return {
    phase: 'idle',
    selected,
    owner: selected,
    tNow: 0,
    ball: { x, cy: REST_CY, vy: 0, vx: 0, vyRender: 0 },
    bulge: { a: 0, v: 0, x },
    squash: { s: 1, v: 0 },
    ride: null,
    fly: null,
    icons: Array.from({ length: n }, (_, i) => ({ p: i === selected ? 1 : 0, tw: null })),
    prevX: x,
    prevY: PANEL.e + REST_CY,
  }
}

function setIconTween(s: TrampolineState, i: number, to: number): void {
  const ic = s.icons[i]
  if (!ic) return
  ic.tw = { from: ic.p, to, t0: s.tNow, dur: to ? 430 : 320 }
}

function kickBulge(s: TrampolineState, x: number, v0: number): void {
  s.bulge.x = x
  s.bulge.v += v0
}

function startFlight(s: TrampolineState, x0: number, x1: number, dur: number, hopH?: number): void {
  const cy0 = s.ball.cy
  const cy1 = REST_CY + 2 // 略微下压，给落地留 2px
  s.phase = 'flight'
  s.ride = null
  s.fly = {
    t0: s.tNow,
    dur,
    x0,
    x1,
    // 长抛短抛弧线观感一致：拱顶恒在平边上方 ARC_APEX（spec §6.2）
    H: hopH ?? (cy0 + cy1) / 2 - (REST_CY - ARC_APEX),
    cy0,
    cy1,
  }
  s.squash.s = 1
  s.squash.v = 0
}

/** tap 结果：changed=切换选中（宿主可 pop 标签 + emit），same-hop=原地小跳，ignored=动画中重复点击 */
export type TapResult = 'changed' | 'same-hop' | 'ignored'

/** 点击路由（spec §1.3 完整枚举） */
export function applyTap(s: TrampolineState, i: number, n: number): TapResult {
  const same = i === s.selected
  const wasMoving = s.phase !== 'idle'
  if (!same && s.owner >= 0) setIconTween(s, s.owner, 0) // 释放旧图标回槽位
  if (same) {
    if (wasMoving) return 'ignored'
    kickBulge(s, s.ball.x, KICK_HOP)
    startFlight(s, s.ball.x, s.ball.x, HOP_DUR, HOP_H)
    return 'same-hop'
  }
  s.selected = i
  if (!wasMoving) {
    s.phase = 'ride'
    s.ride = { t0: s.tNow, dur: RIDE_DUR, liftTo: 34, x: s.ball.x }
    kickBulge(s, s.ball.x, KICK_STATIONARY)
  } else {
    // 飞行/回弹中追加抛掷：不等回位，从当前位置直接再抛（spec §1.3）
    kickBulge(s, s.ball.x, KICK_MIDFLIGHT)
    const toX = tabX(i, n)
    startFlight(s, s.ball.x, toX, clamp(300 + Math.abs(toX - s.ball.x) * 0.35, 260, 430))
  }
  return 'changed'
}

/** 静息直达（prefers-reduced-motion 降级）：跳过全部抛球/弹簧动画瞬时换 tab */
export function instantSelect(s: TrampolineState, i: number, n: number): void {
  s.selected = i
  s.owner = i
  s.phase = 'idle'
  s.ball.x = tabX(i, n)
  s.ball.cy = REST_CY
  s.ball.vy = 0
  s.ride = null
  s.fly = null
  s.bulge.a = 0
  s.bulge.v = 0
  s.squash.s = 1
  s.squash.v = 0
  s.icons.forEach((ic, idx) => {
    ic.p = idx === i ? 1 : 0
    ic.tw = null
  })
}

/** 动画全部静止（idle + 无补间 + 弹簧归位）→ rAF 停循环判据（use-trampoline-loop 消费） */
export function isSettled(s: TrampolineState): boolean {
  return (
    s.phase === 'idle' &&
    s.icons.every((ic) => ic.tw === null) &&
    Math.abs(s.bulge.a) < 0.01 &&
    Math.abs(s.squash.s - 1) < 0.005
  )
}

/** 主相位机步进 + 并行弹簧 + 图标补间 + 差分速度（spec §6 全章）。
 *  @param dt 帧间隔秒（已在外层 clamp 到 ≤0.034，防后台切回大步长爆炸） */
export function step(s: TrampolineState, dt: number, n: number): void {
  if (dt <= 0) return
  s.tNow += dt * 1000

  if (s.phase === 'ride' && s.ride) {
    const u = clamp((s.tNow - s.ride.t0) / s.ride.dur, 0, 1)
    s.ball.cy = REST_CY - s.ride.liftTo * Math.pow(u, 1.7) - s.bulge.a // 贴着鼓起的表面被顶起
    s.ball.x = s.ride.x
    if (u >= 1) {
      const toX = tabX(s.selected, n)
      startFlight(s, s.ball.x, toX, clamp(300 + Math.abs(toX - s.ball.x) * 0.35, 260, 430))
    }
  } else if (s.phase === 'flight' && s.fly) {
    const u = clamp((s.tNow - s.fly.t0) / s.fly.dur, 0, 1)
    s.ball.x = s.fly.x0 + (s.fly.x1 - s.fly.x0) * easeInOutSine(u)
    s.ball.cy = s.fly.cy0 + (s.fly.cy1 - s.fly.cy0) * u - s.fly.H * 4 * u * (1 - u)
    if (u >= 1) {
      s.ball.x = s.fly.x1
      s.ball.cy = s.fly.cy1
      // capture：抛物线末速度解析式 → 弹簧初速（§6.5 防落地顿挫）
      s.ball.vy = (s.fly.cy1 - s.fly.cy0 + 4 * s.fly.H) / (s.fly.dur / 1000)
      s.phase = 'dock'
      s.fly = null
      s.squash.s = 0.8
      s.squash.v = 0
      s.owner = s.selected // 新图标浮入球心
      setIconTween(s, s.owner, 1)
    }
  } else if (s.phase === 'dock') {
    s.ball.vy += (-SPR_DOCK.k * (s.ball.cy - REST_CY) - SPR_DOCK.c * s.ball.vy) * dt
    s.ball.cy += s.ball.vy * dt
    if (
      Math.abs(s.ball.cy - REST_CY) < 0.25 &&
      Math.abs(s.ball.vy) < 7 &&
      Math.abs(s.squash.s - 1) < 0.005
    ) {
      s.ball.cy = REST_CY
      s.ball.vy = 0
      s.phase = 'idle'
    }
  } else {
    s.ball.x = tabX(s.selected, n)
    s.ball.cy = REST_CY
  }

  // 蹦床鼓包 / 压扁弹簧：与相位并行，所有相位都积分（spec §6.4）
  s.bulge.v += (-SPR_BULGE.k * s.bulge.a - SPR_BULGE.c * s.bulge.v) * dt
  s.bulge.a += s.bulge.v * dt
  s.squash.v += (-SPR_SQUASH.k * (s.squash.s - 1) - SPR_SQUASH.c * s.squash.v) * dt
  s.squash.s += s.squash.v * dt

  // 图标浮入（430ms easeOutBack 带过冲）/ 浮出（320ms easeInOutCubic）
  for (const ic of s.icons) {
    if (ic.tw) {
      const u = clamp((s.tNow - ic.tw.t0) / ic.tw.dur, 0, 1)
      ic.p =
        ic.tw.from + (ic.tw.to - ic.tw.from) * (ic.tw.to === 1 ? easeOutBack(u) : easeInOutCubic(u))
      if (u >= 1) {
        ic.p = ic.tw.to
        ic.tw = null
      }
    }
  }

  // 渲染速度：帧间差分（spec §8）
  const py = PANEL.e + s.ball.cy
  s.ball.vx = (s.ball.x - s.prevX) / dt
  s.ball.vyRender = (py - s.prevY) / dt
  s.prevX = s.ball.x
  s.prevY = py
}
