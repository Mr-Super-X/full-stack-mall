# 大屏布局（big layout）与 scale 适配设计稿

> **日期**：2026-10-14 | **分支**：`feature/h5-layout` | **状态**：已确认（brainstorming 三轮问答闭环）
>
> **需求**：在 `layouts/` 新增 big layout、`modules/` 新增大屏示例模块；routes 中配置 big layout 即获得大屏面板展示能力（与 home→portal、workbench→default 同构）；适配 1920×1080 / 2560×1440 / 4K / 9000px 演示厅拼接屏；**不影响其它视图**。

---

## 1. 已确认的四个关键决策（用户问答记录）

| # | 问题 | 决策 |
|---|------|------|
| 1 | 9000px 拼接屏的期望展示行为 | **等比缩放居中留白**为主方案；**另单独做一个 9000×1080 超宽示例页**（中间地图 + 两侧操作面板） |
| 2 | 适配底层技术方案 | **transform: scale 整体缩放**（非 rem/vw） |
| 3 | demo 内容深度 | **两个 demo 均为完整业务大屏**（1920 标准 + 9000 超宽） |
| 4 | 9000 示例中间地图实现 | **ECharts geo/map + 内置精简中国 GeoJSON**（演示厅无外网依赖） |

可推断默认项（照 h5-demo 先例，不再单独确认）：
- big-demo 两个路由加入 `router/whitelist.ts` 免登录（演示厅直接打开）
- big layout 为纯壳（RouterView + scale 容器），标题栏等业务视觉归 demo 视图
- 暗色科技风为 demo 自带样式，不动全局 theme store

## 2. 架构总览

```text
src/
├── layouts/big/                        ← 新增（§2.3 例外：用户已明确指定路径）
│   ├── index.vue                       # 纯壳：深色全屏底 + scale 容器 + RouterView
│   └── config/
│       ├── scale.ts                    # 缩放运行时（纯 TS 无 Vue 依赖，可单测）
│       └── scale.spec.ts               # 计算逻辑单测
│
├── modules/big-demo/                   ← 新增（pnpm new-module 脚手架生成后填充）
│   ├── routes/index.ts                 # 父路由挂 big layout，两个子路由
│   ├── views/
│   │   ├── Index.vue                   # /big-demo    1920×1080 标准大屏
│   │   └── Wide.vue                    # /big-demo/wide 9000×1080 超宽示例
│   ├── components/                     # PanelBox / KpiCard / RankingList / BigChart
│   ├── config/china.json               # 内置精简中国 GeoJSON（省级，约 200KB）
│   ├── apis/ store/ index.ts           # 脚手架骨架（静态 mock 数据在 apis/）
│
└── router/whitelist.ts                 # +2 行：'BigDemo'、'BigDemoWide'
```

### 2.1 零影响保证（硬约束）

| 措施 | 说明 |
|------|------|
| scale 只作用于 big layout 自有容器 div | **不碰 `html`/`body`**——比 h5 rem 更干净，无全局残留风险 |
| 不加 postcss 规则 | scale 方案样式写死设计稿 px，无需编译时转换，`build/postcss.ts` 零改动 |
| 不改 theme store / default / portal / h5 | demo 深色样式全部落在 big-demo 模块 BEM 命名空间内 |
| `onUnmounted` 移除全部监听 | resize/pageshow 监听、mock 定时器随路由切走销毁 |

## 3. scale 运行时（`src/layouts/big/config/scale.ts`）

### 3.1 设计稿尺寸契约（路由 meta）

```ts
// 缺省 = { width: 1920, height: 1080 }；超宽页显式声明
meta: { title: '超宽大屏', requiresAuth: false, bigScreen: { width: 9000, height: 1080 } }
```

layout 内 `watch(() => route.meta.bigScreen)` 热切换（同 layout 内 1920 页 ↔ 9000 页跳转时重算）。

### 3.2 算法

```text
scale = min(vw / designW, vh / designH)
容器：width=designW px、height=designH px、position absolute
      transform: scale(s)、transform-origin: top left
      left = (vw - designW × s) / 2、top = (vh - designH × s) / 2   ← 居中留白
```

各视口效果（标准 1920×1080 页）：

| 视口 | scale | 效果 |
|------|-------|------|
| 1920×1080 | 1 | 恰好铺满 |
| 2560×1440 | 1.333 | 等比放大铺满 |
| 3840×2160 (4K) | 2 | 等比放大铺满 |
| 9000×1080 | 1 | 高度撑满，两侧留白（深色底填充） |
| 9000×1080 → 超宽页 | 1 | 设计稿 9000×1080，恰好铺满 |

**开发体验红利**：9000×1080 页在普通 1920 显示器上 scale≈0.21 整体缩小预览，无需真接拼接屏即可开发调试。

### 3.3 清晰度策略

- **文本/CSS**：transform scale 为矢量重绘，任意倍率不模糊
- **ECharts canvas**：唯一模糊源。canvas 物理像素 = CSS 尺寸 × devicePixelRatio，视觉再放大 s 倍 → `s > dpr` 时模糊
- **解法**：demo 模块内 `BigChart.vue` 薄封装 `echarts.init(el, null, { devicePixelRatio: window.devicePixelRatio × 当前 scale })`，scale 变化时 resize + 必要时重建
- **不动公共 `BaseChart`**——big-demo 模块自包含（§1.2 模块边界铁律）

### 3.4 生命周期与监听

- `activateScale(getDesignSize)`：立即计算 + 挂 `resize`（防抖 150ms）+ `pageshow`（bfcache persisted 重算）——照 `h5/config/rem.ts` 已验证模式
- `deactivateScale()`：移除监听、清防抖定时器；容器 DOM 随 layout 销毁，无需样式快照（与 rem 改 html 不同）

## 4. demo 页内容结构

### 4.1 `/big-demo`（1920×1080 标准大屏）

深色科技风经典三区布局：

```text
┌──────────────────────────────────────────────────────────┐
│  ✦ 标题栏：大屏名称 + 实时时钟 + 装饰流光        80px     │
├────────────┬──────────────────────────────┬──────────────┤
│ 左栏 460px  │      中央区 940px             │ 右栏 460px   │
│  KPI×2     │  中央 KPI 数字带（4 项）        │  趋势图      │
│  占比饼图   │  主图表（柱状+折线双轴）        │  排名列表    │
│            │  实时数据滚动条                │              │
└────────────┴──────────────────────────────┴──────────────┘
```

### 4.2 `/big-demo/wide`（9000×1080 超宽示例）

```text
┌────────────────────────────────────────────────────────────────┐
│ ✦ 超宽标题栏（时钟居中，两端装饰）                    100px      │
├─────────────────┬──────────────────────────────┬───────────────┤
│ 左操作面板 1800 │   ECharts 中国地图 5000        │ 右操作面板    │
│  指标卡组        │   geo 撒点 + 涟漪散点 + 飞线    │  筛选按钮组   │
│  区域排行        │                              │  告警列表     │
│  控制开关组      │                              │              │
└─────────────────┴──────────────────────────────┴───────────────┘
```

### 4.3 组件拆分（`modules/big-demo/components/`）

| 组件 | 职责 | 约束 |
|------|------|------|
| `PanelBox.vue` | 四角装饰边框面板（标题 + 默认插槽） | 大屏标志性视觉；BEM `vv-panel-box` |
| `KpiCard.vue` | 指标卡（图标 + 数值 + 同比） | 静态数值，YAGNI 不做滚动动画 |
| `RankingList.vue` | 排名列表（序号奖牌色 + 条形占比） | — |
| `BigChart.vue` | ECharts 薄封装 | `devicePixelRatio × scale` 防模糊；随 scale resize |

数据：`apis/` 内静态 mock 常量 + `setInterval` 模拟实时跳动（`onUnmounted` 清理）。

样式约束：全部写死设计稿 px（无 rem 转换）、BEM + 无 scoped scss、`lang="scss"`。

## 5. 已知限制（写入使用文档）

1. big layout 内**避免 teleport 弹层组件**（ElSelect 下拉、ElTooltip 等 teleport 到 body，不随容器缩放）——demo 操作面板全部用内联控件（按钮/开关/滑块）
2. GeoJSON 精简至省级（约 200KB），内置仓库随包分发，无运行时外网请求
3. big layout 不进入 keep-alive 缓存范围（与 h5 同策略，项目 keep-alive 只作用于 default 内业务页）

## 6. 测试 / 校验 / 文档

| 类别 | 内容 |
|------|------|
| 单测 | `scale.spec.ts`：1920/2560/4K/9000 视口的 scale 与居中偏移断言、meta 缺省回退 1920×1080、防抖、deactivate 清理 |
| 工程校验 | `pnpm check:routes` + `pnpm type-check:full` + `pnpm test` 全绿 |
| 使用文档 | `docs/35-大屏布局与scale适配.md`：如何给新页面配 big layout + meta 契约 + 弹层限制 + 新设计稿尺寸接入步骤 |
| 同步文档 | `CLAUDE.md` §2.1 表格（layouts 职责 + modules 清单）+ 最近更新段；`CHANGELOG.md`；`README.md` Layout 速选 |
| 浏览器验证 | chrome-devtools 实测 4 种视口（1920×1080 / 2560×1440 / 3840×2160 / 9000×1080）截图核验 + 回归 default/portal/h5 布局零影响 |

## 7. 实施顺序（供 plan 阶段参考）

1. `pnpm new-module big-demo` 生成骨架
2. `layouts/big/config/scale.ts` + 单测（TDD：先 spec 后实现）
3. `layouts/big/index.vue` 纯壳
4. big-demo routes + 白名单 + 两个空视图占位 → 路由可用
5. demo 组件（PanelBox → KpiCard → RankingList → BigChart）
6. 1920 标准页填充
7. 9000 超宽页填充（含 GeoJSON 内置 + 地图配置）
8. 浏览器四视口实测 + 其它布局回归
9. 文档同步（docs/35 + CLAUDE.md + CHANGELOG + README）
