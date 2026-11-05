---
AIGC:
  {
    'Label': '1',
    'ContentProducer': '001191110108MA01KP2T5U00000',
    'ProduceID': '621d394b-13a0-4551-a640-d15a380565a6',
    'ReservedCode1': '',
    'ContentPropagator': '001191110108MA01KP2T5U00000',
    'PropagateID': '621d394b-13a0-4551-a640-d15a380565a6',
    'ReservedCode2': '',
  }
---

# Trampoline Tabbar · 凹槽抛球交互动画 — Tabbar 区域实现规范（配色无关）

> **版本** v2.0 · **范围**：只覆盖 tabbar 区域（面板 + 标签 + 白球 + 全部动效），不含宿主页面/手机外壳/内容页。
> **配色**：本文档**不含任何品牌色倾向**。所有颜色以语义槽位（§9）描述，由你的 UI 设计色板填充；几何与动画公式对任何配色成立。
> **目标**：只凭这份文档，开发者或 AI 能在任意项目、任意平台、任意 tab 数量与配色下 1:1 复刻这套交互动画。
> 另有一个带示例配色的可运行演示 `tabbar-animation.html` 可对照体验（本文不依赖它）。

---

## §0 使用方法

1. **接入 Web 项目**：直接抄 §10 参考骨架（纯 HTML/CSS/JS、零依赖），填好 §9 样式槽位即可；
2. **移植到其它平台**：看 §11 概念映射表，再回到 §4/§5/§6 抄数学；
3. **理解后重写**：按 §2～§8 规格自行实现（§4、§5 是效果好坏的分水岭，公式逐条照抄）;
4. **手感调优**：查 §12 调参速查表；上线前过一遍 §13 QA 清单；
5. **宿主联动**：骨架在 `tap()` 内标注了联动点——tab 切换后你的页面/路由逻辑从那里接入，tabbar 自身不感知宿主。

---

## §1 效果定义与交互规则

### 1.1 一句话

一块白色（→你的面板色）圆角面板，N 个 tab 等分面板宽度；一个圆形"球"停在当前选中 tab 的凹槽里。点击其它 tab 时——**面板顶边像蹦床一样先在原地鼓起把球"抛"出去，球沿抛物线飞到目标 tab 上空，落进凹槽压出形变并弹簧回弹，新图标从凹槽浮起进入球心**。

### 1.2 层次解剖（自下而上，全部在 tabbar 容器内）

| 层            | 内容                                                                          | z 序 |
| ------------- | ----------------------------------------------------------------------------- | ---- |
| 容器 `.tb`    | 宽 = 面板宽，高 = 面板高 + 顶部余量；背景可透明                               | 0    |
| 面板          | 圆角矩形，**顶边是逐帧重建的形变曲线**（凹槽/鼓包），四角圆弧                 | 20   |
| tab 图标/文字 | 未选中色 → 选中色（accent），几何位置不变                                     | 30   |
| 球            | 直径约 0.6×面板高；静止时凹在顶边（凸出约 0.3×球直径），球心是选中 tab 的图标 | 45   |

### 1.3 交互规则（完整枚举）

| 操作                            | 行为                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| 点击**其它** tab（当前静止）    | 蓄力 130ms（球贴着鼓起的表面被顶起）→ 抛物线飞行 → 落地弹簧回弹；蹦床鼓包踢速 **330** |
| 点击其它 tab（**飞行/回弹中**） | 不等回位，从球当前位置直接再抛（鼓包踢速 **240**，飞行时长按剩余距离重算）            |
| 点击**当前** tab（静止）        | 原地兴奋小跳：拱高 20px、时长 300ms、鼓包踢速 **190**，图标保持粘在球心               |
| 点击当前 tab（动画中）          | 忽略                                                                                  |
| 初始状态                        | 建议选中第一个 tab（骨架默认）；球停在对应凹槽                                        |

### 1.4 相位机

```
              点击其它tab            u>=1                   球到达终点
   ┌────────┐ ────────► ┌──────┐ ────────► ┌────────┐ ────────► ┌──────┐
   │  idle  │           │ ride │           │ flight │           │ dock │
   └────────┘ ◄──────── └──────┘           └────────┘           └──────┘
      ▲        弹簧收敛           点击当前tab:原地小跳(dock后回idle)
      └────────────── 收敛判据满足 ──────────────┘
```

---

## §2 容器、坐标系与设计常量

### 2.1 容器与坐标

- **设计稿单位**：一切几何在 tabbar 设计稿坐标中计算（参考稿：面板 362×88）；渲染容器整体 `scale` 适配实际宽度，**不要**把物理像素混进几何计算。
- **单一局部坐标系**：容器左上角为原点，平边（面板顶边平直段）位于 `y = e`。**e 可取任意值**（参考实现取 42）——它只是整体竖直偏移，所有定位（球/图标/文字/路径）都以 `e` 为基准换算。
- **溢出要求（关键）**：球飞行拱顶在平边上方约 80px、鼓包上顶更高——球会越出容器上边界。渲染层必须允许溢出绘制（Web：SVG `overflow:visible` + 宿主不可 `overflow:hidden`；原生平台无此问题）。
- **换算易错点**：球心/鼓包中心若存于容器坐标，面板采样时须减去面板左边距 `mx`（mx 可取 0，此时容器即面板坐标系）。

### 2.2 常量表（参考值；右列为按你的尺寸等比缩放的建议）

```js
PANEL   = { mx:0, w:362, h:88, r:28, e:42 }   // r≈0.32·h；e 任意
N_TAB   = 4                                   // 任意 N，公式通用
BALL_R  = 26                                  // ≈0.30·h（直径 52 ≈ 0.59·h）
GAP     = 7                                   // 球缘与凹槽面的几何间隙 ≈0.27·BALL_R
RING    = BALL_R + GAP = 33                   // 凹槽包裹弧半径
REST_CY = 10                                  // 球凸出 = BALL_R−REST_CY = 16 ≈0.6·BALL_R
ICON_SLOT = 36                                // 图标槽中心相对平边 ≈1.38·BALL_R
TH0     = 56°                                 // 凹槽弧包裹接入角（角度，不随尺寸缩放）
X0      = RING·sin(TH0) ≈ 27.36               // 圆弧包裹区半宽
WB      = 21                                  // Hermite 过渡肩宽 ≈0.8·BALL_R
HALF    = X0 + WB ≈ 48.36                     // 凹槽总半宽
FLAT_L  = 28, FLAT_R = w−28                   // 平直段边界（= 面板圆角 r）
N       = 191, STEP = w/190 ≈ 1.905           // 顶边采样：步长 ≤2px 即可
SPR_DOCK   = {k:680, c:19.5}                  // 落地回弹弹簧
SPR_SQUASH = {k:600, c:14.7}                  // 压扁恢复弹簧
SPR_BULGE  = {k:460, c:12.9}                  // 蹦床鼓包弹簧
```

> 弹簧参数与尺寸弱相关（决定的是运动手感），整体换尺寸后先按上表等比缩放几何，再按 §12 微调弹簧。

### 2.3 标签等分布局

```js
tabX(i) = PANEL.mx + PANEL.w·(i + 0.5) / N_TAB
```

- 每格宽 `w/N`，N 个 tab **严格等分面板全宽**；
- tab 热区按钮：`left = tabX(i) − 36.5`（≈半热区宽 73/2）、`top = e − 46`（上外延 46px 扩大点按面）、尺寸 `73 × (h + 58)`；
- 图标 24×24 水平居中，中心位于 `e + ICON_SLOT`（图标槽，凹槽底平齐）；文字标签在图标下方约 15px。

---

## §3 静态几何构建

### 3.1 面板路径（每帧重建的轮廓）

面板 = 一条闭合路径：**顶边是 N 点采样折线（形变区），左右下三角是标准圆弧**（局部 y：平边 `e`，底边 `e+h`）：

```
M 0,edge[0]  L x1,edge[1] … L w,edge[N-1]           ← 顶边（含两个顶角圆弧的采样）
L w,(e+h−r)  A r,r 0 0 1 (w−r),(e+h)                ← 右侧边 + 右下角弧
L r,(e+h)    A r,r 0 0 1 0,(e+h−r)                  ← 底边 + 左下角弧
Z                                                    ← 左侧边闭合
```

- 顶角与底角半径均为 `r`；
- **顶角画法**：顶角不是单独的弧命令，而是基础边函数 `baseYAt(x)` 的一部分（见 §5.1），随"圆角融化"可整体缩放（§5.4）。

### 3.2 球与凹槽的静止关系

- 静止时球心 `cy = REST_CY`（相对平边，向下为正），球凸出平边 `BALL_R − REST_CY`；
- 凹槽以球为负模：`dentAt` 生成的面与球面保持恒定 `GAP` 间隙，左右严格对称。

---

## §4 核心数学：凹槽剖面 `dentAt(dx, cy)`

凹槽深度（相对平边、y 向下为正）是**与球同心的圆弧等隙包裹 + 三次 Hermite 过渡肩**：

```js
/* dx: 到球心的水平距离; cy: 球心相对平边深度 */
function dentAt(dx, cy){
  const ax = Math.abs(dx);
  if(ax >= HALF) return 0;                       // 凹槽外：平边
  if(ax <= X0)  return cy + Math.sqrt(RING*RING − dx*dx);   // ① 圆弧等隙包裹
  const d0 = cy + RING*Math.cos(TH0);            // 肩部起点深度
  if(d0 <= 0) return 0;                          // 球升高后肩部自然消失
  const m0 = clamp(−WB*Math.tan(TH0)/d0, −3, 0); // 起点斜率配平系数
  const u  = (ax − X0)/WB;                       // 肩部归一化坐标 0..1
  const h  = (2*u*u*u − 3*u*u + 1) + m0*(u*u*u − 2*u*u + u);
  return d0 * h;                                 // ② 三次 Hermite 过渡肩
}
```

### 4.1 形状的由来（按视觉参考标定）

| 特征           | 目标               | 本公式的实现                       |
| -------------- | ------------------ | ---------------------------------- |
| 底部间隙       | 恒定               | GAP（弧段处处与球面等距）          |
| 最大坡度       | ≈1.6（柔和但立体） | tan(TH0)=1.48，出现在圆弧→肩部接点 |
| 球缘外回到平边 | ≈球半径 0.8 倍     | WB=21（肩宽）                      |

### 4.2 Hermite 肩部的构造（保证 C¹ 平滑）

- `h1(u)=2u³−3u²+1`：值 1→0、两端斜率 0 —— 提供从 d0 平滑降到 0 的主形；
- `h5(u)=u³−2u²+u`：值恒 0、u=0 处斜率 1 —— 叠加 `m0` 后把**肩部起点斜率**精确配到圆弧切线 `−tan(TH0)`；
- 肩部终点斜率恒 0 → 与平边**相切收口**，无折痕、无陡壁；
- 球升高（cy 变小）时 `d0≤0`，整段肩部自动归零；圆弧段被 `max(0,·)` 裁剪处坡度 ≤1，不产生陡立断崖。

> **调参**：`TH0` 越小凹槽开口越平缓（坡度 tanTH0），`WB` 越大过渡越长越柔和；两者共同决定 `HALF`（凹槽总半宽）。

---

## §5 顶边合成与圆角保护（★ 全片最容易踩的坑）

### 5.1 基础边 `baseYAt(x)`（含可变顶角）

```js
function baseYAt(x){
  const e = PANEL.e;
  if(x < rEffL){                                 // 左顶角：四分之一圆弧
    const k = rEffL − x;
    return e + rEffL − Math.sqrt(rEffL*rEffL − k*k);
  }
  if(x > PANEL.w − rEffR){                       // 右顶角：对称
    const k = x − (PANEL.w − rEffR);
    return e + rEffR − Math.sqrt(rEffR*rEffR − k*k);
  }
  return e;                                      // 平直段
}
```

### 5.2 三分量采样 + 合成（每帧）

```js
for(i = 0..N-1){
  const x = i*STEP;
  base[i] = baseYAt(x);                                        // 分量1：基础边
  dRaw[i] = Math.max(0, dentAt(x − bx, ball.cy));              // 分量2：凹槽（bx=球心局部x）
  const db = (x − bux)/40;                                     // bux=鼓包中心局部x
  const m  = Math.min(x − FLAT_L, FLAT_R − x);
  const t  = clamp(m/24, 0, 1);                                // 端部 24px 淡出坡
  bRaw[i] = bulge.a * Math.exp(−db*db) * (t*t*(3−2*t));        // 分量3：鼓包·高斯·淡出
}
dS = boxBlur(boxBlur(dRaw,3), 3);        // 只模糊分量！
bS = boxBlur(boxBlur(bRaw, 3), 3);
edge[i] = Math.max(base[i], e + dS[i]) − bS[i];               // 合成
```

- **鼓包**：高斯 `exp(−((x−bux)/40)²)`，宽度系数 40（≈1.5×球半径）；振幅 `bulge.a` 由 §6.4 弹簧驱动（正=向上顶起）。
- **端部淡出** `env`：距面板端 `r`~`r+24px` 平滑斜坡（smoothstep），保证鼓包永不侵入顶角。
- **两次 boxBlur(3)** 的作用：抹平 `max()` 拐点与采样折线的 C² 微折痕。

### 5.3 ★ 圆角保护：模糊绝不能碰基础边

> **事故案例**（真实踩坑）：把整条合成边 `max(base, e+d)−b` 直接两次 boxBlur → 顶角弧线被"低通削顶"**约 8px**——顶角四分之一圆弧的外端切线接近竖直（每个采样步 y 变化 ~10px），模糊把它当作高频信号削平，加上 boxBlur 在数组端点的 clamp 补边加重塌陷。表现为：**选中中间 tab（顶角全半径）时左上/右上圆角"缺了一块"**；选中边缘 tab 时因凹槽到达、圆角融化成小半径（§5.4）削角被掩盖，问题更隐蔽。

**修复 = 分量化**：模糊只作用于"凹槽/鼓包"两个光滑分量。平直段 `base ≡ e`（常数），由模糊的线性性：

```
blur(e + d − b) = e + blur(d) − blur(b)
```

→ 中段形变形状与"整条模糊"**逐位一致（零回归）**，而顶角弧线从不参与模糊、永远精确。**任何平台移植时必须保持这个结构。**

### 5.4 圆角融化（端部贴边让位）

球在边缘 tab 时凹槽会压到顶角区，此时该侧顶角按凹槽深度"融化"变小（`r` → `r−22`），把空间让给凹槽：

```js
function cornerMelt(dx){                          // dx = 角起点到球心的局部距离
  const p = clamp((dentAt(dx, ball.cy) − 2)/20, 0, 1);
  return p*p*(3−2*p);                             // smoothstep
}
rEffL = r − 22 * cornerMelt(FLAT_L − bx);         // 融化范围 r → r−22
rEffR = r − 22 * cornerMelt(FLAT_R − bx);
```

凹槽越过融化后的圆角继续压入时，经合成式的 `max(base, e+dS)` 自然取代圆弧，过渡连续。融化量 `22` 应略小于 `r`（保留一个小圆头），灵敏度分母 `20` 控制响应深度的快慢。

---

## §6 动画状态机与弹簧系统

所有时间参数以**秒**计；主循环 `dt = clamp(帧间隔, 0, 0.034)`（0.034 防后台切回时大步长爆炸）。

### 6.1 ride —— 蓄力（130ms）

```js
u = clamp((tNow − t0)/130, 0, 1)
lift = 34 * u^1.7                    // 先慢后快的 anticipation
ball.cy = REST_CY − lift − bulge.a   // 球贴着蹦床表面被顶起
ball.x  = 原位置                      // 横向不动
u≥1 → 进入 flight，时长 = clamp(300 + dist·0.35, 260, 430) ms
```

进入 ride 的同时 `kickBulge(起点x, 330)`（见 6.4）。

### 6.2 flight —— 抛物线飞行

```js
u = clamp((tNow − t0)/dur, 0, 1)
ball.x  = x0 + (x1−x0) · easeInOutSine(u)          // 横向：sin 缓入缓出
ball.cy = (cy0 + (cy1−cy0)·u) − H·4u(1−u)           // 纵向：抛物线拱
```

- 终点 `cy1 = REST_CY + 2`（略微下压，给落地留 2px）；
- **拱顶高度恒定**：默认 `H = (cy0+cy1)/2 − (REST_CY − 80)`，即抛物线顶永远在平边上方 80px——长抛短抛弧线观感一致；
- 原地小跳：`H=20, dur=300`；
- `u≥1` → `capture()`：把抛物线**末速度**无缝交给弹簧（见 6.5），并触发新图标浮入。

### 6.3 dock —— 落地回弹（欠阻尼弹簧）

```js
ball.vy += (−680·(ball.cy−REST_CY) − 19.5·ball.vy)·dt   // SPR_DOCK
ball.cy += ball.vy·dt
```

收敛判据（同时满足 → 回 idle）：`|cy−REST_CY|<0.25 && |vy|<7 && |squash.s−1|<0.005`。

### 6.4 蹦床鼓包与压扁（两个独立弹簧，与相位并行）

```js
// 鼓包：kickBulge(x, v0) 置中心并叠加初速；三种踢速
//   330 = 静止起抛新 tab；240 = 飞行中追加抛；190 = 原地小跳
bulge.v += (−460·bulge.a − 12.9·bulge.v)·dt;  bulge.a += bulge.v·dt
// 压扁：落地瞬间 squash.s=0.80
squash.v += (−600·(squash.s−1) − 14.7·squash.v)·dt;  squash.s += squash.v·dt
```

统一用**半隐式欧拉**（先更新速度再更新位置），跨平台手感一致；阻尼比 ζ=c/(2√k)：DOCK≈0.37、BULGE≈0.30、SQUASH≈0.30，弹 1~2 个来回即收敛。

### 6.5 速度接力（防"落地顿挫"的关键）

抛物线在终点的纵向速度解析可得，直接作为弹簧初速：

```js
vyImpact = ((cy1 − cy0) + 4H) / dur_seconds
ball.vy = vyImpact        // 弹簧从真实落速继续，凹槽随球压深再回弹
squash.s = 0.80           // 同帧触发压扁
```

---

## §7 图标与标签动效

### 7.1 图标浮入与粘附

- 每个图标有一个进度 `p∈[0,1]`：浮入 430ms `easeOutBack(c=1.55)`（过冲一下再落位），浮出 320ms `easeInOutCubic`；
- 位置：`translateY((ball.cy − ICON_SLOT) · p)` —— `p=0` 停在图标槽（`e+ICON_SLOT`），`p=1` **粘在球心**，之后随球一起动（蓄力/回弹时图标跟着球起伏）；
- 图标资源由你的 UI 提供（建议 24×24、`currentColor` 描边 2~2.4px），颜色完全由 §9 槽位驱动；
- _可选技巧_：若选中态需要彩色/渐变图标，用"双层叠加"——底层单色描边，上层彩层 `opacity 0→1` 淡入 280ms，上层用 `url(#gradient)` 描边。别直接切换图标资源，会有跳变。

### 7.2 标签 pop

选中的文字标签：`transform: scale(1) → 35% 处 scale(1.14) → 100% 回 1`，420ms `cubic-bezier(.34,1.8,.5,1)`；颜色 `未选中色 → accent` 260ms。CSS keyframes 重触发前 `void el.offsetWidth` 强制 reflow（否则动画不重启）；非 Web 平台用显式进度驱动无此坑。

### 7.3 宿主联动

tab 切换时对外只暴露一个时点：`tap(i)` 内更新选中态之后（骨架已注释标出）。你的页面切换/路由/埋点从该点接入；**内容页的切换动效不属于本规范范围**，建议其时长与 tabbar 错开（页面淡入 ≥300ms，不与落地回弹抢注意力）。

---

## §8 球体渲染（挤压与拉伸）

球是 `直径 2·BALL_R` 的圆形元素，用 transform 逐帧驱动（位移以球心为准）：

| 相位        | 变形                                                                                           |
| ----------- | ---------------------------------------------------------------------------------------------- |
| flight      | 沿速度方向拉伸：`s = 1 + clamp(速度/2800, 0, 0.20)`，`rotate(atan2(vy,vx))` 后 `scale(s, 1/s)` |
| dock / idle | 压扁：`scaleY(squash.s)`，`scaleX(1 + (1−squash.s)·0.9)`（体积守恒感）                         |

速度用帧间差分 `(pos − prev)/dt` 获得；位移 `translate(球心x − BALL_R, e + 球心cy − BALL_R)`。

---

## §9 样式槽位（配色无关 · 由你的 UI 设计填充）

本动画的观感核心**全部是几何与运动**：凹槽间隙是 `GAP=7px` 的几何间距而非颜色——球与面板同色时，凹槽轮廓依然由间隙和投影保证。把下面 8 个槽位填上你的色板即可，几何/动画代码零改动：

| 槽位（语义）               | 作用范围                       | 取值要求                                                  |
| -------------------------- | ------------------------------ | --------------------------------------------------------- |
| `--tb-bg`                  | 容器背景                       | 可透明（透出宿主），或填你的页面底色                      |
| `--tb-panel`               | 面板填充                       | 与容器背景需有可辨识对比——凹槽/鼓包的轮廓全靠这条边显现   |
| `--tb-ball`                | 球填充                         | 可与面板同色（GAP 间隙 + 投影区分轮廓）；也可直接用强调色 |
| `--tb-accent`              | 选中态：图标 + 文字 + 球内图标 | 与面板高对比（建议 ≥3:1），全部 tab 统一                  |
| `--tb-icon` / `--tb-label` | 未选中图标 / 文字              | 与面板中等对比（建议 ≥2:1），视觉强度低于 accent          |
| `--tb-panel-shadow`        | 面板投影                       | 深底容器用暗投影；浅底容器建议改"1px 细描边 + 更浅投影"   |
| `--tb-ball-shadow`         | 球投影                         | 同上；球悬空时投影是唯一的高度线索，别删                  |
| 图标资源                   | 24×24 图标                     | `currentColor` 描边；颜色完全由槽位驱动，切换色板零改图标 |

> 对比度建议按 WCAG 文本对比度公式衡量。参考骨架默认填的是**无彩色灰阶**（白/灰/墨），不含任何品牌色倾向。

---

## §10 参考实现（Tabbar 组件 · 零依赖 · 配色全走槽位）

> 单文件即完整的 tabbar 组件：外层 `.tbWrap` 只负责缩放，`.tb` 整体可搬进你的项目；8 个 CSS 槽位集中在 `:root`。占位图标为通用线性图标，替换成你的资源即可。宿主联动点在 `tap()` 内注释处。

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Trampoline Tabbar · Tabbar 区域参考实现（配色无关）</title>
    <style>
      /* ★★★ 样式槽位（规范 §9）：把这里的无彩占位值全部替换成你的 UI 设计色板 ★★★
     本骨架默认只有黑/白/灰，不含任何品牌色倾向；换色板零改动 JS */
      :root {
        --tb-bg: transparent; /* 容器背景：可透出宿主页面 */
        --tb-panel: #ffffff; /* 面板底色 */
        --tb-panel-shadow: 0 10px 24px rgba(0, 0, 0, 0.12); /* 面板投影（浅底容器可改细描边） */
        --tb-ball: var(--tb-panel); /* 球色：可与面板同色（GAP 间隙+投影保证轮廓） */
        --tb-ball-shadow: 0 4px 10px rgba(0, 0, 0, 0.16), 0 1px 3px rgba(0, 0, 0, 0.1);
        --tb-icon: #9aa3ad; /* 未选中图标 */
        --tb-label: #9aa3ad; /* 未选中文字 */
        --tb-accent: #1f2933; /* 选中色：图标 + 文字 + 球内图标 */
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        background: #f2f4f7; /* ← 仅演示底色（可删除）；tabbar 本身透明 */
        font-family:
          -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;
      }
      /* 外层 wrap 只负责缩放与布局占位；.tb 即完整 tabbar 组件，可整体搬进你的项目。
     注意：球会飞出 tabbar 上边界约 100px —— 宿主布局不要对该区域 overflow:hidden */
      .tbWrap {
        width: 100%;
        max-width: 430px;
        position: relative;
      }
      .tb {
        position: relative;
        width: 362px;
        height: 134px;
        margin: 0 auto;
        background: var(--tb-bg);
        transform-origin: top center;
        user-select: none;
        -webkit-user-select: none;
      }
      .tb svg {
        position: absolute;
        left: 0;
        top: 0;
        z-index: 20;
        overflow: visible;
        filter: drop-shadow(var(--tb-panel-shadow));
      }
      .ball {
        position: absolute;
        left: 0;
        top: 0;
        width: 52px;
        height: 52px;
        border-radius: 50%;
        background: var(--tb-ball);
        box-shadow: var(--tb-ball-shadow);
        z-index: 45;
        will-change: transform;
        cursor: pointer;
      }
      .tab {
        position: absolute;
        border: 0;
        background: none;
        cursor: pointer;
        padding: 0;
        font: inherit;
        -webkit-tap-highlight-color: transparent;
      }
      .tab .iconWrap {
        position: absolute;
        width: 24px;
        height: 24px;
        left: 50%;
        margin-left: -12px;
        top: 70px;
        z-index: 30;
        color: var(--tb-icon);
        transition: color 0.26s ease;
        will-change: transform;
      }
      .tab.active .iconWrap {
        color: var(--tb-accent);
        z-index: 50;
      }
      .tab .iconWrap svg {
        display: block;
        width: 24px;
        height: 24px;
        overflow: visible;
      }
      .tab .label {
        position: absolute;
        left: 0;
        right: 0;
        top: 97px;
        text-align: center;
        font-size: 12.5px;
        letter-spacing: 0.2px;
        z-index: 30;
        color: var(--tb-label);
        transition: color 0.26s ease;
      }
      .tab.active .label {
        color: var(--tb-accent);
        font-weight: 600;
      }
      .tab.active .label.pop {
        animation: tbPop 0.42s cubic-bezier(0.34, 1.8, 0.5, 1);
      }
      @keyframes tbPop {
        0% {
          transform: scale(1);
        }
        35% {
          transform: scale(1.14);
        }
        100% {
          transform: scale(1);
        }
      }
    </style>
  </head>
  <body>
    <div class="tbWrap" id="tbWrap">
      <div class="tb" id="tb">
        <svg width="362" height="134" viewBox="0 0 362 134" fill="none">
          <path id="tbPath" fill="var(--tb-panel)" />
        </svg>
        <div class="ball" id="tbBall"></div>
        <nav id="tbTabs" style="position:absolute;inset:0"></nav>
      </div>
    </div>

    <script>
      'use strict'
      /* =============================================================
       * Trampoline Tabbar —— 凹槽鼓起抛球 · 抛物线飞行 · 落地回弹
       * 配套规范：tabbar-animation-spec.md（几何/数学/状态机逐条对应）
       * 结构：仅 tabbar 区域；颜色全部经 CSS 变量注入；
       *       几何常量集中在下方，可按你的 UI 设计等比调整。
       * ============================================================= */

      /* ---------- 设计常量（参考值：362×88 面板 · 4 tab · 52px 球） ---------- */
      const PANEL = { mx: 0, w: 362, h: 88, r: 28, e: 42 } // e: 平边 y（任意值，所有定位以它为基准）
      const N_TAB = 4 // tab 数量：公式对任意 N 成立
      const BALL_R = 26,
        GAP = 7,
        RING = BALL_R + GAP // GAP=球缘与凹槽面的几何间隙（非颜色）
      const REST_CY = 10 // 球心相对平边；凸出 = BALL_R − REST_CY = 16
      const ICON_SLOT = 36 // 图标槽中心相对平边
      const TB_H = PANEL.e + PANEL.h + 4 // 容器高 134（底部余量 4）

      /* 凹槽剖面：ρ=RING 圆弧等隙包裹至 ±TH0，接 WB 宽三次 Hermite 过渡肩（C¹，终点斜率 0） */
      const TH0 = (56 * Math.PI) / 180 // 接入角：最陡坡度 tan56°≈1.48
      const X0 = RING * Math.sin(TH0) // 圆弧包裹区半宽 ≈27.4
      const WB = 21 // 过渡肩宽（≈0.8·BALL_R）
      const HALF = X0 + WB // 凹槽总半宽 ≈48.4

      const tabX = (i) => PANEL.mx + (PANEL.w * (i + 0.5)) / N_TAB // 等分面板全宽

      /* ★ 你的 tab 数据：文案与图标全部替换成你自己的（图标建议 24×24 currentColor） */
      const TABS = [
        { key: 'home', label: 'Home' },
        { key: 'search', label: 'Search' },
        { key: 'heart', label: 'Collect' },
        { key: 'user', label: 'Me' },
      ]

      /* 占位图标：24×24 线性风格，描边 currentColor（颜色由 CSS 槽位驱动） */
      function iconSVG(key) {
        if (key === 'home')
          return `<svg viewBox="0 0 24 24"><path d="M4 11.4 12 4.6l8 6.8" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.3 9.8V19a1.1 1.1 0 0 0 1.1 1.1h9.2a1.1 1.1 0 0 0 1.1-1.1V9.8" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>`
        if (key === 'search')
          return `<svg viewBox="0 0 24 24"><circle cx="10.9" cy="10.9" r="6.2" fill="none" stroke="currentColor" stroke-width="2.1"/><path d="m15.7 15.7 4.5 4.5" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/></svg>`
        if (key === 'heart')
          return `<svg viewBox="0 0 24 24"><path d="M12 19.4C7 15.9 4.2 12.9 4.2 9.8c0-2.4 1.9-4.2 4.1-4.2 1.5 0 2.9.8 3.7 2 .8-1.2 2.2-2 3.7-2 2.2 0 4.1 1.8 4.1 4.2 0 3.1-2.8 6.1-7.8 9.6Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`
        return `<svg viewBox="0 0 24 24"><circle cx="12" cy="8.3" r="3.6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4.9 19.4c1.4-2.9 4-4.5 7.1-4.5s5.7 1.6 7.1 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`
      }

      /* ---------- DOM ---------- */
      const tbEl = document.getElementById('tb')
      const tabsNav = document.getElementById('tbTabs')
      const ballEl = document.getElementById('tbBall')
      const panelPath = document.getElementById('tbPath')
      const tabEls = [],
        iconEls = [],
        labelEls = []

      TABS.forEach((t, i) => {
        const btn = document.createElement('button')
        btn.className = 'tab'
        btn.dataset.i = i
        btn.style.cssText = `left:${(tabX(i) - 36.5).toFixed(1)}px;top:${PANEL.e - 46}px;width:73px;height:${PANEL.h + 46 + 12}px;`
        btn.innerHTML = `<span class="iconWrap">${iconSVG(t.key)}</span><span class="label">${t.label}</span>`
        tabsNav.appendChild(btn)
        tabEls.push(btn)
        iconEls.push(btn.querySelector('.iconWrap'))
        labelEls.push(btn.querySelector('.label'))
      })

      /* ---------- 动画状态 ---------- */
      let sel = 0,
        owner = 0,
        phase = 'idle',
        tNow = 0 // idle | ride | flight | dock
      const ball = { x: tabX(0), cy: REST_CY, vx: 0, vy: 0 }
      const bulge = { a: 0, v: 0, x: tabX(0) } // 蹦床鼓包（正=向上顶起）
      const squash = { s: 1, v: 0 } // 落地压扁
      let fly = null,
        ride = null
      const icons = TABS.map((t, i) => ({ p: i === owner ? 1 : 0, tw: null }))

      /* ---------- 缓动/工具 ---------- */
      const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
      const easeInOutSine = (u) => -(Math.cos(Math.PI * u) - 1) / 2
      const easeOutBack = (u) => {
        const c = 1.55
        u -= 1
        return 1 + u * u * ((c + 1) * u + c)
      }
      const easeInOutCubic = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2)

      /* ---------- 弹簧（半隐式欧拉，内联在主循环） ---------- */
      const SPR_DOCK = { k: 680, c: 19.5 } // 落地回弹
      const SPR_SQUASH = { k: 600, c: 14.7 } // 压扁恢复
      const SPR_BULGE = { k: 460, c: 12.9 } // 蹦床鼓包

      /* ---------- 点击切换 ---------- */
      function tap(i) {
        const same = i === sel,
          wasMoving = phase !== 'idle'
        if (!same && owner >= 0) setIconTween(owner, 0) // 释放旧图标回槽位
        if (same && !wasMoving) {
          kickBulge(ball.x, 190) // 原地兴奋小跳
          startFlight(ball.x, ball.x, 300, 20)
        } else if (same && wasMoving) {
          return // 动画中忽略重复点击
        } else {
          tabEls[sel].classList.remove('active')
          sel = i
          tabEls[sel].classList.add('active')
          labelEls[sel].classList.remove('pop')
          void labelEls[sel].offsetWidth // 强制 reflow 以重触发动画
          labelEls[sel].classList.add('pop')
          // ★ 宿主联动点：在此回调你的页面切换 / 路由（本骨架只管 tabbar 自身）
          const fromX = ball.x,
            toX = tabX(i),
            dist = Math.abs(toX - fromX)
          if (phase === 'idle') {
            phase = 'ride' // 蓄力 130ms
            ride = { t0: tNow, dur: 130, liftTo: 34, x: fromX }
            kickBulge(fromX, 330)
          } else {
            // 飞行中追加抛掷
            kickBulge(ball.x, 240)
            startFlight(ball.x, toX, clamp(300 + dist * 0.35, 260, 430))
          }
        }
      }

      function startFlight(x0, x1, dur, Hopt) {
        phase = 'flight'
        const cy0 = ball.cy,
          cy1 = REST_CY + 2
        // 抛物线拱顶恒在平边上方 80px：长抛短抛弧线观感一致
        const H = Hopt !== undefined ? Hopt : (cy0 + cy1) / 2 - (REST_CY - 80)
        fly = { t0: tNow, dur, x0, x1, H, cy0, cy1 }
        squash.s = 1
        squash.v = 0
      }

      function kickBulge(x, v0) {
        bulge.x = x
        bulge.v += v0
      }

      function capture() {
        // 抛物线末速度解析式 → 弹簧初速（防落地顿挫），凹槽随球压深再回弹
        const F = fly.dur / 1000
        ball.vy = (fly.cy1 - fly.cy0 + 4 * fly.H) / F
        phase = 'dock'
        squash.s = 0.8
        squash.v = 0
        owner = sel // 新图标浮入球心
        setIconTween(owner, 1)
      }

      function setIconTween(i, to) {
        const ic = icons[i]
        ic.tw = { from: ic.p, to, t0: tNow, dur: to ? 430 : 320 } // 浮入带过冲 / 浮出平滑
      }

      /* ---------- 主循环 ---------- */
      let lastT = performance.now(),
        prevPx = ball.x,
        prevPy = PANEL.e + ball.cy

      function frame(now) {
        const dt = clamp((now - lastT) / 1000, 0, 0.034)
        lastT = now
        tNow += dt * 1000
        if (dt <= 0) {
          requestAnimationFrame(frame)
          return
        }

        if (phase === 'ride') {
          const u = clamp((tNow - ride.t0) / ride.dur, 0, 1)
          ball.cy = REST_CY - ride.liftTo * Math.pow(u, 1.7) - bulge.a // 贴着鼓起的表面被顶起
          ball.x = ride.x
          if (u >= 1) {
            const toX = tabX(sel),
              dist = Math.abs(toX - ball.x)
            startFlight(ball.x, toX, clamp(300 + dist * 0.35, 260, 430))
          }
        } else if (phase === 'flight') {
          const u = clamp((tNow - fly.t0) / fly.dur, 0, 1)
          ball.x = fly.x0 + (fly.x1 - fly.x0) * easeInOutSine(u)
          ball.cy = fly.cy0 + (fly.cy1 - fly.cy0) * u - fly.H * 4 * u * (1 - u)
          if (u >= 1) {
            ball.x = fly.x1
            ball.cy = fly.cy1
            capture()
          }
        } else if (phase === 'dock') {
          ball.vy += (-SPR_DOCK.k * (ball.cy - REST_CY) - SPR_DOCK.c * ball.vy) * dt
          ball.cy += ball.vy * dt
          if (
            Math.abs(ball.cy - REST_CY) < 0.25 &&
            Math.abs(ball.vy) < 7 &&
            Math.abs(squash.s - 1) < 0.005
          ) {
            ball.cy = REST_CY
            ball.vy = 0
            phase = 'idle'
          }
        } else {
          ball.x = tabX(sel)
          ball.cy = REST_CY
        }

        bulge.v += (-SPR_BULGE.k * bulge.a - SPR_BULGE.c * bulge.v) * dt
        bulge.a += bulge.v * dt
        squash.v += (-SPR_SQUASH.k * (squash.s - 1) - SPR_SQUASH.c * squash.v) * dt
        squash.s += squash.v * dt

        const py = PANEL.e + ball.cy
        ball.vx = (ball.x - prevPx) / dt
        ball.vyRender = (py - prevPy) / dt
        prevPx = ball.x
        prevPy = py

        renderBall()
        renderIcons()
        renderPanel()
        requestAnimationFrame(frame)
      }

      /* ---------- 球渲染（飞行沿速度拉伸 / 落地压扁回弹） ---------- */
      function renderBall() {
        let sx = 1,
          sy = 1,
          rot = 0
        if (phase === 'flight') {
          const sp = Math.hypot(ball.vx, ball.vyRender)
          const s = 1 + clamp(sp / 2800, 0, 0.2)
          rot = Math.atan2(ball.vyRender, ball.vx)
          sx = s
          sy = 1 / s
        } else if (phase === 'dock' || phase === 'idle') {
          sy = squash.s
          sx = 1 + (1 - squash.s) * 0.9
        }
        ballEl.style.transform =
          `translate(${(ball.x - 26).toFixed(2)}px,${(PANEL.e + ball.cy - 26).toFixed(2)}px) ` +
          `rotate(${rot.toFixed(3)}rad) scale(${sx.toFixed(3)},${sy.toFixed(3)})`
      }

      /* ---------- 图标渲染（浮入/浮出 + 粘在球心） ---------- */
      function renderIcons() {
        icons.forEach((ic, i) => {
          if (ic.tw) {
            const u = clamp((tNow - ic.tw.t0) / ic.tw.dur, 0, 1)
            ic.p =
              ic.tw.from +
              (ic.tw.to - ic.tw.from) * (ic.tw.to === 1 ? easeOutBack(u) : easeInOutCubic(u))
            if (u >= 1) {
              ic.p = ic.tw.to
              ic.tw = null
            }
          }
          iconEls[i].style.transform = `translateY(${((ball.cy - ICON_SLOT) * ic.p).toFixed(2)}px)`
        })
      }

      /* ---------- 面板形变（分量式合成 —— 圆角保护原理见规范 §5.3） ---------- */
      const FLAT_L = PANEL.r,
        FLAT_R = PANEL.w - PANEL.r
      const N = 191,
        STEP = PANEL.w / (N - 1)
      const base = new Float32Array(N),
        dRaw = new Float32Array(N),
        bRaw = new Float32Array(N),
        edge = new Float32Array(N)
      let rEffL = PANEL.r,
        rEffR = PANEL.r // 顶角有效半径（融化 28→6）

      function baseYAt(x) {
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
      function cornerMelt(dx) {
        const p = clamp((dentAt(dx, ball.cy) - 2) / 20, 0, 1)
        return p * p * (3 - 2 * p)
      }
      /* 凹槽深度：|dx|≤X0 与球同心的精确圆弧（等隙）；X0..HALF 三次 Hermite 过渡肩（C¹，终点斜率 0） */
      function dentAt(dx, cy) {
        const ax = Math.abs(dx)
        if (ax >= HALF) return 0
        if (ax <= X0) return cy + Math.sqrt(RING * RING - dx * dx)
        const d0 = cy + RING * Math.cos(TH0)
        if (d0 <= 0) return 0
        const m0 = clamp((-WB * Math.tan(TH0)) / d0, -3, 0)
        const u = (ax - X0) / WB
        return d0 * (2 * u * u * u - 3 * u * u + 1 + m0 * (u * u * u - 2 * u * u + u))
      }
      function boxBlur(a, r) {
        const n = a.length,
          out = new Float32Array(n),
          w = 2 * r + 1
        let sum = 0
        for (let i = -r; i <= r; i++) sum += a[clamp(i, 0, n - 1)]
        for (let i = 0; i < n; i++) {
          out[i] = sum / w
          sum += a[clamp(i + r + 1, 0, n - 1)] - a[clamp(i - r, 0, n - 1)]
        }
        return out
      }
      function renderPanel() {
        const e = PANEL.e,
          r = PANEL.r,
          W = PANEL.w,
          B = e + PANEL.h
        const bx = ball.x - PANEL.mx,
          bux = bulge.x - PANEL.mx
        rEffL = r - 22 * cornerMelt(FLAT_L - bx)
        rEffR = r - 22 * cornerMelt(FLAT_R - bx)
        for (let i = 0; i < N; i++) {
          const x = i * STEP
          base[i] = baseYAt(x) // 分量1：基础边（顶角弧线精确，永不模糊）
          dRaw[i] = Math.max(0, dentAt(x - bx, ball.cy)) // 分量2：凹槽
          const db = (x - bux) / 40
          const m = Math.min(x - FLAT_L, FLAT_R - x),
            t = clamp(m / 24, 0, 1)
          bRaw[i] = bulge.a * Math.exp(-db * db) * (t * t * (3 - 2 * t)) // 分量3：鼓包·高斯·端部淡出
        }
        const dS = boxBlur(boxBlur(dRaw, 3), 3)
        const bS = boxBlur(boxBlur(bRaw, 3), 3) // ★ 模糊只碰分量，绝不碰 base（§5.3）
        for (let i = 0; i < N; i++) edge[i] = Math.max(base[i], e + dS[i]) - bS[i]
        let d = `M0 ${edge[0].toFixed(2)} `
        for (let i = 1; i < N; i++) d += `L${(i * STEP).toFixed(1)} ${edge[i].toFixed(2)} `
        d += `L${W} ${B - r} A${r} ${r} 0 0 1 ${W - r} ${B} L${r} ${B} A${r} ${r} 0 0 1 0 ${B - r} Z`
        panelPath.setAttribute('d', d)
      }

      /* ---------- 事件 & 缩放适配 ---------- */
      tabEls.forEach((btn, i) => btn.addEventListener('click', () => tap(i)))
      ballEl.addEventListener('click', () => tap(sel))

      function fit() {
        const wrap = document.getElementById('tbWrap')
        const s = Math.min(1, wrap.clientWidth / PANEL.w)
        tbEl.style.transform = `scale(${s})`
        wrap.style.height = Math.round(TB_H * s) + 'px' // 补偿缩放后的布局高度
      }
      addEventListener('resize', fit)
      fit()
      renderBall()
      renderIcons()
      renderPanel()
      requestAnimationFrame(frame)
    </script>
  </body>
</html>
```

---

## §11 跨平台移植指南

### 11.1 概念映射

| 本实现     | Web/SVG                           | iOS                                       | Android                            | Flutter                    | RN                                                 |
| ---------- | --------------------------------- | ----------------------------------------- | ---------------------------------- | -------------------------- | -------------------------------------------------- |
| 形变面板   | `<path>` 逐帧 `setAttribute("d")` | `CAShapeLayer.path` + `CADisplayLink`     | `Path` + `ValueAnimator`/自绘 View | `CustomPainter` + `Ticker` | `react-native-svg` + Reanimated `useFrameCallback` |
| 三根弹簧   | 自写半隐式欧拉（§6.3/6.4 两行式） | 同左，或 `UIViewPropertyAnimator`(spring) | `SpringForce`/`DynamicAnimation`   | `SpringSimulation`         | Reanimated `withSpring` 或自积分                   |
| 缓动函数   | 纯函数 3 行                       | 同左                                      | 同左                               | `Curves` 自定义            | 同左                                               |
| 球/图标    | CSS transform                     | `CATransform3D`/frame                     | `View.property`                    | `Transform`                | `Animated` style                                   |
| 顶角精确弧 | 采样折线（191 点，弦差 <0.05px）  | `UIBezierPath(addArc)` 融进折线           | `Path.arcTo`                       | `Path.arcTo`               | 同 SVG                                             |
| 样式槽位   | CSS 自定义属性                    | 语义化 UIColor 常量                       | colors.xml 资源                    | ThemeData                  | Theme token                                        |

> 推荐：弹簧**全部自积分**（半隐式欧拉），不用平台各自的 spring API——参数 `k/c` 与 dt 解耦，跨端手感逐帧一致。

### 11.2 移植要点（踩坑预警）

1. **模糊只碰分量**（§5.3）：任何渲染栈都一样——先分别平滑凹槽/鼓包数组，再与精确的基础边 `max` 合成；否则顶角被削平；
2. **速度接力**（§6.5）：弹簧初速必须用抛物线末速度解析式，否则落地一帧"顿挫"；
3. **时间基准**：一切用 `dt`（秒）积分，禁止按帧号推进；后台切回时 clamp `dt ≤ 34ms`；
4. **坐标换算**：球/鼓包中心若存于容器坐标，面板采样须减去面板左边距 `mx`；
5. **缩放**：整体 scale 适配，几何永远工作在 tabbar 设计稿坐标系；
6. **溢出**：球飞行越出 tabbar 上边界属预期效果，宿主布局勿截断该区域；
7. **重触发**：CSS keyframes 类动画重放前强制 reflow（Web）或用显式进度驱动（其它平台无此坑）。

---

## §12 调参速查表

| 想要的效果              | 改哪里                                                              |
| ----------------------- | ------------------------------------------------------------------- |
| 绿隙（凹槽间隙）更宽/窄 | `GAP`（7；凹槽面与球缘恒距）                                        |
| 球凸出面板更多/更少     | `REST_CY`（10；凸出 = BALL_R − REST_CY）                            |
| 凹槽开口更平缓/陡       | `TH0`（56°↓更平缓）+ `WB`（21↑过渡更长）                            |
| 抛得更高                | ride 的 `liftTo`(34)、原地跳 `H`(20)、拱顶偏移 `(REST_CY−80)` 的 80 |
| 飞行更快/慢             | `dur = clamp(300 + dist·0.35, 260, 430)` 的系数与范围               |
| 落地弹跳次数/软硬       | `SPR_DOCK {k:680, c:19.5}`（ζ≈0.37，0.30~0.45 手感最佳）            |
| 蹦床鼓包幅度            | 三种踢速 `330/240/190` 与 `SPR_BULGE`                               |
| 压扁幅度                | 落地初值 `0.80` 与 `SPR_SQUASH`                                     |
| 图标浮入弹性            | `easeOutBack` 的 `c=1.55` 与 430ms                                  |
| 顶角融化深度/灵敏度     | `cornerMelt` 中的 `22`（融化量）与 `/20`（灵敏度）                  |
| 鼓包宽度                | 高斯 `exp(−((x−bux)/40)²)` 的 40                                    |
| 整体换尺寸              | 按 §2.2 右列比例等比缩放几何，再微调弹簧                            |

---

## §13 QA 清单（上线前必查）

1. **顶角圆角完整性**（回归概率最高）：以 scale=1 渲染（窗口够宽），提取选中**中间 tab** 时的角部轮廓，与理想四分之一圆对比，**偏差应 ≤1.5px**。削角重现 = 有人把模糊混回了基础边（§5.3）。像素检测阈值需高于宿主底色亮度。
2. **凹槽间隙恒定性**：任意相位下球缘到凹槽面垂直间距应恒为 `GAP` ±1（这是几何量，与配色无关）。
3. **凹槽对称性**：静止时左右壁等深，偏差 ≤1px。
4. **慢速关键帧**：0.25× 速度下抓五帧——蓄力/飞行/触底/回弹/静止，逐帧检查：无瞬移、无穿模、弧线无折痕、图标粘附正确、球越出容器上边界时未被截断。
5. **追加抛掷**：飞行中点击另一个 tab，应从当前位置直接再抛，不回起点。
6. **边缘 tab 融化**：选中两端 tab 时对应侧顶角融为小圆角、凹槽接管，另一侧顶角保持完整半径。
7. **任意 N 验证**：把 `N_TAB` 改成 3/5，等分布局与动画应依然成立。
8. **换色板验证**：只改 §9 槽位（含"球与面板同色"与"球用强调色"两种），轮廓应始终可辨、几何与动画不变。
9. **控制台零报错**；断网/`file://` 直开可用（零外部依赖）。
10. **快速连点**：连点多个 tab，球始终只有一颗，图标最终落在最后点击的目标。

---

_规范结束。本文档与 §10 内嵌骨架同步维护；改参数请同时更新 §2.2 常量表与 §10 源码。_

---

_AI生成_
