// Trampoline Tabbar 几何库（纯函数）——逐条对应 design/tabbar-animation-spec.md §2~§5、§8。
//
// 结构裁决（读代码读不出的约定，变更前先看这里）：
//   - 几何永远工作在 tabbar 设计稿坐标系（面板 362×88），渲染层由消费方整体 scale 适配
//     （spec §2.1）——禁止把物理像素或 rem 稿像素混进本文件常量；
//   - 凹槽/鼓包/基础边三分量合成与「模糊只碰分量」圆角保护是 spec §5.3 的事故修复，
//     任何改动不得把 boxBlur 应用到 base 分量上；
//   - buildPanelPath 的采样缓冲是模块级复用（渲染热路径 60fps，刻意避免每帧分配 4×191
//     浮点数组）；纯函数语义不受影响（输出仅由输入状态决定，缓冲不跨帧传递信息）。
//
// 配套：engine.ts（相位机/弹簧编排）、useTrampolineTabbar.ts（Vue 响应式接线）。

/** 面板常量（spec §2.2；e 为平边 y，任意定位基准） */
export const PANEL = { mx: 0, w: 362, h: 88, r: 28, e: 42 } as const
/** 球半径（≈0.30·h） */
export const BALL_R = 26
/** 球缘与凹槽面的几何间隙（spec §4.1：间隙是几何量非颜色，恒距） */
export const GAP = 7
/** 凹槽包裹弧半径 = BALL_R + GAP */
export const RING = BALL_R + GAP
/** 静止球心深度（相对平边）；凸出 = BALL_R − REST_CY ≈ 0.6·BALL_R */
export const REST_CY = 10
/** 图标槽中心相对平边（凹槽底平齐） */
export const ICON_SLOT = 36
/** 容器高 = e + h + 底部余量 4 */
export const TB_H = PANEL.e + PANEL.h + 4

/** 凹槽弧包裹接入角 56°（最陡坡度 tan56°≈1.48；角度不随尺寸缩放） */
export const TH0 = (56 * Math.PI) / 180
/** 圆弧包裹区半宽 ≈27.4 */
export const X0 = RING * Math.sin(TH0)
/** Hermite 过渡肩宽 ≈0.8·BALL_R */
export const WB = 21
/** 凹槽总半宽 ≈48.4 */
export const HALF = X0 + WB

/** 平直段边界（= 面板圆角 r，鼓包端部淡出锚点） */
export const FLAT_L = PANEL.r
export const FLAT_R = PANEL.w - PANEL.r
/** 顶边采样点数与步长（步长 ≤2px，spec §2.2） */
export const N_SAMPLES = 191
export const STEP = PANEL.w / (N_SAMPLES - 1)

/** tab i 的中心 x（N 个 tab 严格等分面板全宽，spec §2.3） */
export function tabX(i: number, n: number): number {
  return PANEL.mx + (PANEL.w * (i + 0.5)) / n
}

export const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v))

/** 凹槽深度剖面（spec §4）：圆弧等隙包裹 + 三次 Hermite 过渡肩（C¹，终点斜率 0）。
 *  @param dx 到球心的水平距离；@param cy 球心相对平边深度（向下为正） */
export function dentAt(dx: number, cy: number): number {
  const ax = Math.abs(dx)
  if (ax >= HALF) return 0
  if (ax <= X0) return cy + Math.sqrt(RING * RING - dx * dx)
  const d0 = cy + RING * Math.cos(TH0)
  if (d0 <= 0) return 0 // 球升高后肩部自然消失（spec §4.2）
  const m0 = clamp((-WB * Math.tan(TH0)) / d0, -3, 0) // 起点斜率配平到圆弧切线
  const u = (ax - X0) / WB
  return d0 * (2 * u * u * u - 3 * u * u + 1 + m0 * (u * u * u - 2 * u * u + u))
}

/** 基础边（含可变顶角，spec §5.1）：顶角四分之一圆弧精确，永不参与模糊（§5.3 圆角保护） */
export function baseYAt(x: number, rEffL: number, rEffR: number): number {
  const e = PANEL.e
  if (x < rEffL) {
    const k = rEffL - x
    return e + rEffL - Math.sqrt(rEffL * rEffL - k * k)
  }
  if (x > PANEL.w - rEffR) {
    const k = x - (PANEL.w - rEffR)
    return e + rEffR - Math.sqrt(rEffR * rEffR - k * k)
  }
  return e
}

/** 顶角融化进度（spec §5.4）：凹槽压到顶角区时该侧圆角 r→r−22 让位 */
export function cornerMelt(dx: number, cy: number): number {
  const p = clamp((dentAt(dx, cy) - 2) / 20, 0, 1)
  return p * p * (3 - 2 * p)
}

/** 盒式模糊（端点 clamp 补边；仅用于凹槽/鼓包分量） */
export function boxBlur(a: Float32Array, r: number): Float32Array {
  const n = a.length
  const out = new Float32Array(n)
  const w = 2 * r + 1
  // noUncheckedIndexedAccess：索引返回 number|undefined，clamp 界内 ?? 0 兜底（热路径开销可忽略）
  const at = (arr: Float32Array, i: number): number => arr[clamp(i, 0, n - 1)] ?? 0
  let sum = 0
  for (let i = -r; i <= r; i++) sum += at(a, i)
  for (let i = 0; i < n; i++) {
    out[i] = sum / w
    sum += at(a, i + r + 1) - at(a, i - r)
  }
  return out
}

/** 采样缓冲（模块级复用，见文件头说明） */
const gBase = new Float32Array(N_SAMPLES)
const gDRaw = new Float32Array(N_SAMPLES)
const gBRaw = new Float32Array(N_SAMPLES)
const gEdge = new Float32Array(N_SAMPLES)

/**
 * 上一次合法 path d（NaN 防御）：浏览器实测发现偶发帧引擎状态出现 NaN（未定位的
 * 竞争），含 NaN 的 d 会被 SVG 整元素丢弃不绘制——面板消失 1~3 帧即用户感知的
 * "tabbar 闪动"。此处降级为沿用上一帧合法 path，保证用户侧永不整面板消失。
 */
let lastValidPanelD = ''

export interface PanelDeformInput {
  ballX: number
  ballCy: number
  bulgeX: number
  bulgeA: number
}

/**
 * 每帧重建面板轮廓 path d（spec §3.1 + §5.2 三分量合成）。
 * 鼓包：高斯 exp(−((x−bux)/40)²) · 端部 24px smoothstep 淡出（保顶角不被侵入）。
 */
export function buildPanelPath(input: PanelDeformInput): string {
  const { ballX, ballCy, bulgeX, bulgeA } = input
  const e = PANEL.e
  const r = PANEL.r
  const W = PANEL.w
  const B = e + PANEL.h
  const bx = ballX - PANEL.mx
  const bux = bulgeX - PANEL.mx
  const rEffL = r - 22 * cornerMelt(FLAT_L - bx, ballCy)
  const rEffR = r - 22 * cornerMelt(FLAT_R - bx, ballCy)

  for (let i = 0; i < N_SAMPLES; i++) {
    const x = i * STEP
    gBase[i] = baseYAt(x, rEffL, rEffR)
    gDRaw[i] = Math.max(0, dentAt(x - bx, ballCy))
    const db = (x - bux) / 40
    const m = Math.min(x - FLAT_L, FLAT_R - x)
    const t = clamp(m / 24, 0, 1)
    gBRaw[i] = bulgeA * Math.exp(-db * db) * (t * t * (3 - 2 * t))
  }
  // ★ 模糊只碰凹槽/鼓包分量，绝不碰 base（spec §5.3 顶角削顶事故修复）
  const dS = boxBlur(boxBlur(gDRaw, 3), 3)
  const bS = boxBlur(boxBlur(gBRaw, 3), 3)
  for (let i = 0; i < N_SAMPLES; i++) {
    gEdge[i] = Math.max(gBase[i] ?? 0, e + (dS[i] ?? 0)) - (bS[i] ?? 0)
  }

  let d = `M0 ${(gEdge[0] ?? 0).toFixed(2)} `
  for (let i = 1; i < N_SAMPLES; i++)
    d += `L${(i * STEP).toFixed(1)} ${(gEdge[i] ?? 0).toFixed(2)} `
  d += `L${W} ${B - r} A${r} ${r} 0 0 1 ${W - r} ${B} L${r} ${B} A${r} ${r} 0 0 1 0 ${B - r} Z`
  // NaN 防御（见 lastValidPanelD 注）：偶发非法值沿用上一帧合法 path
  if (d.includes('NaN')) return lastValidPanelD || d
  lastValidPanelD = d
  return d
}

export interface BallRenderInput {
  phase: string
  ballX: number
  ballCy: number
  /** 帧间差分水平速度（§8 拉伸用） */
  vx: number
  /** 帧间差分竖直速度 */
  vyRender: number
  /** 压扁弹簧当前值（1=无变形） */
  squashS: number
}

/** 球 transform：flight 沿速度方向拉伸（s=1+clamp(v/2800,0,0.20)），dock/idle 压扁（体积守恒感） */
export function ballTransform(input: BallRenderInput): string {
  const { phase, ballX, ballCy, vx, vyRender, squashS } = input
  let sx = 1
  let sy = 1
  let rot = 0
  if (phase === 'flight') {
    const sp = Math.hypot(vx, vyRender)
    const s = 1 + clamp(sp / 2800, 0, 0.2)
    rot = Math.atan2(vyRender, vx)
    sx = s
    sy = 1 / s
  } else if (phase === 'dock' || phase === 'idle') {
    sy = squashS
    sx = 1 + (1 - squashS) * 0.9
  }
  return (
    `translate(${(ballX - BALL_R).toFixed(2)}px,${(PANEL.e + ballCy - BALL_R).toFixed(2)}px) ` +
    `rotate(${rot.toFixed(3)}rad) scale(${sx.toFixed(3)},${sy.toFixed(3)})`
  )
}

/** 图标粘附位移（spec §7.1）：p=0 停图标槽，p=1 粘球心随球起伏 */
export function iconOffsetY(ballCy: number, p: number): number {
  return (ballCy - ICON_SLOT) * p
}
