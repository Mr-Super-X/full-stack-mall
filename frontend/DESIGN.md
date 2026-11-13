---
name: vue3-vite-project 四栖工程底座
description: 一套骨架（共享 tokens + Element Plus 秩序）长出四种舱位语境——中后台 / 门户 / H5 / 数据大屏
colors:
  brand-primary: '#409eff'
  brand-success: '#67c23a'
  brand-warning: '#e6a23c'
  brand-danger: '#f56c6c'
  brand-info: '#909399'
  ink-primary: '#303133'
  ink-regular: '#606266'
  ink-secondary: '#909399'
  ink-placeholder: '#c0c4cc'
  paper-base: '#ffffff'
  paper-secondary: '#f5f7fa'
  paper-tertiary: '#fafafa'
  line-base: '#dcdfe6'
  line-light: '#e4e7ed'
  big-night: '#06122b'
  big-abyss: '#02040a'
  big-data-blue: '#4da3ff'
  big-ice-text: '#d6e4ff'
  big-mist-text: '#8fa8d8'
  big-dim-text: '#5f7bab'
  state-error: '#f56c6c'
  state-offline: '#f7c948'
  h5-page: '#f7f8fa'
  h5-ink: '#1a1a1a'
  h5-line: '#ebedf0'
  portal-ink: '#333638'
  portal-paper: '#f6f6f4'
  portal-line: '#e4e4e1'
  portal-dark-paper: '#24272b'
  portal-dark-ink: '#e8e9e7'
  portal-brand: '#5e6d7c'
  portal-brand-deep: '#445466'
  portal-brand-soft: '#e6ebf0'
  portal-accent: '#b08d85'
  portal-bg-card: '#ffffff'
  portal-bg-inverse: '#2e3134'
  scrollbar-thumb: '#b8b8b8'
  scrollbar-thumb-dark: '#4e4e52'
  h5-text-title: '#323233'
  h5-card-bg: '#ffffff'
  mall-bg-page: '#EFEBE5'
  mall-bg-card: '#F8F6F2'
  mall-bg-field: '#F3F0EA'
  mall-bg-inverse: '#43473F'
  mall-ink-1: '#3C403D'
  mall-ink-2: '#6E7169'
  mall-ink-3: '#A5A79F'
  mall-line: '#E2DDD3'
  mall-line-strong: '#CFC8BC'
  mall-brand: '#B08D85'
  mall-brand-deep: '#7E6159'
  mall-brand-soft: '#F3E9E6'
  mall-accent: '#7E97AC'
  mall-accent-soft: '#E5EDF2'
  mall-ok: '#5E8168'
  mall-warn: '#97794B'
  mall-err: '#A96A60'
  mall-on-brand: '#FFFFFF'
  big-panel-bg: 'rgba(13, 38, 76, 0.35)'
  big-mask: 'rgba(10, 24, 48, 0.5)'
  big-title-from: '#ffffff'
  big-title-to: '#7db4ff'
  big-medal-gold: '#f7c948'
  big-kpi-down: '#2fd39a'
  default-light-primary: '#6a6180'
  default-light-primary-d2: '#564e6e'
  default-light-primary-l3: '#9891ad'
  default-light-primary-l5: '#b4afc5'
  default-light-primary-l7: '#cfc9de'
  default-light-primary-l8: '#d1c4e9'
  default-light-primary-l9: '#ece9f4'
  default-light-bg-page: '#f6f5fa'
  default-light-fill-light: '#f4f3f8'
  default-light-menu-active: '#d1c4e9'
  default-light-menu-active-text: '#4f4763'
  default-dark-primary: '#8fa6bc'
  default-dark-primary-l3: '#7e94a9'
  default-dark-primary-l9: '#2b343d'
  default-dark-bg-page: '#12161a'
  default-dark-bg-card: '#1a1f26'
  default-dark-bg-menu: '#161b21'
  default-dark-bg-overlay: '#222831'
  default-dark-text-primary: '#e8edf1'
  default-dark-text-regular: '#c2cbd4'
  default-dark-text-secondary: '#8a97a5'
  default-dark-border-base: '#333d47'
  default-light-success: '#5E8168'
  default-light-warning: '#97794B'
  default-light-danger: '#A96A60'
  default-dark-success: '#6E8A72'
  default-dark-warning: '#A68A5E'
  default-dark-danger: '#A67B72'
typography:
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: '14px'
    fontWeight: 400
    lineHeight: 1.5
  mono:
    fontFamily: "'Fira Code', Monaco, Consolas, 'Courier New', monospace"
rounded:
  sm: '6px'
  md: '12px'
  lg: '20px'
spacing:
  xs: '4px'
  sm: '8px'
  md: '16px'
  lg: '24px'
  xl: '32px'
components:
  button-primary:
    backgroundColor: '{colors.brand-primary}'
    textColor: '#ffffff'
    rounded: '{rounded.sm}'
    padding: '8px 15px'
    height: '32px'
---

# Design System: vue3-vite-project 四栖工程底座

> 本文是**不经 Element Plus 的自有视觉 token** 单一事实源（硬编码色值 / 字号阶梯 / 间距常量）。
> 运行时主题（明暗 / 品牌主色换肤）走 Element Plus 变量体系，见 [docs/06-主题管理规范.md](docs/06-主题管理规范.md)——两者分工：docs/06 管"可换肤"，本文管"四栖各自的固定视觉"。
>
> **维护规则**：新增色值 / 字号 / 间距常量，**先登记本文再使用**。check:doc-currency 管硬数据一致性，本文是语义级一致性的判定基准（/autoplan Cross-phase Theme 4 的解药）。

## Overview

**Creative North Star: "一套骨架，四种舱位"（One Hull, Four Decks）**

共享骨架是 `packages/ui` 全局 tokens（颜色 / 间距 / 圆角 / 字号 / 阴影 / z-index / 动效）+ Element Plus 变量秩序 + BEM `vv` 命名空间 + 五层样式分层（docs/49）。四种舱位在同一骨架上长出各自的视觉语境：**中后台**（default，完全消费 EP 默认体系）、**门户**（portal，白纸极简官网）、**H5**（h5，Vant 灰阶移动端）、**数据大屏**（big，深蓝科技风固定视觉）。

人格是工程秩序感优先于装饰：诚实、精确、可预期。没有 logo 与吉祥物，"品牌感"藏在细节里——密度、对齐、语义化的 z-index 与状态色。四个 showroom 端（portal / big / docs / auth）按演示标准投入视觉，admin / h5 按生产工具标准投入。

**Key Characteristics:**

- **双轨色彩**：可换肤部分（明暗 / 品牌主色）走 EP 变量体系；固定视觉 token 以本文 Colors / Typography 表为锚。
- **四栖分化**：一套 spacing / radius 骨架，四端各自色板与字号纪律互不越界。
- **状态语义化**：z-index 与状态色按语义命名（断连 ≠ 失败），命名即文档。
- **状态响应式深度**：表面静息扁平，阴影与 glow 只在 hover / focus / 弹层等状态响应时出现。

## Colors

> 角色分组：Primary（品牌色）/ 各栖 Neutral（背景-文字-边框）/ 状态色。frontmatter `colors.*` 为机器可读镜像，值以本文表格与 `packages/ui/src/assets/styles/{variables,theme}.scss` 为准。

### Primary（品牌色，四栖共用）

| Token                                                                     | 值                                            | 用途                                                         | 实证             |
| ------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------ | ---------------- |
| `--color-primary`                                                         | `#409eff`                                     | 品牌主色（可被 `VITE_BRAND_COLOR` 运行时覆盖，含 EP 灯色阶） | `variables.scss` |
| `--color-success` / `--color-warning` / `--color-danger` / `--color-info` | `#67c23a` / `#e6a23c` / `#f56c6c` / `#909399` | EP 语义色，中后台语境专用                                    | `variables.scss` |

### 数据大屏 big（深蓝科技风）

| Token                              | 值                            | 用途                               | 实证                        |
| ---------------------------------- | ----------------------------- | ---------------------------------- | --------------------------- |
| `big-bg-page`                      | `#06122b`                     | 视图底色（径向渐变底）             | big-demo 两页、StateDemo    |
| `big-bg-stage-mask`                | `#02040a`                     | layout 比例不符时的留白填充        | `src/layouts/big/index.vue` |
| `big-primary`                      | `#4da3ff`                     | 主数据色（KPI 数值 / 链接 / 强调） | big-demo、StateDemo         |
| `big-text-primary`                 | `#d6e4ff`                     | 主文字                             | big-demo 各页               |
| `big-text-secondary`               | `#8fa8d8`                     | 辅助文字（dt / 说明）              | big-demo 各页               |
| `big-text-muted`                   | `#5f7bab`                     | 弱化文字（时间戳 / 元信息）        | big-demo 各页               |
| `big-panel-bg`                     | `rgba(13, 38, 76, 0.35)`      | KpiCard / PanelBox 面板底          | big-demo 组件               |
| `big-mask` / `big-mask-light`      | `rgba(10,24,48,0.5/0.4)`      | 舞台弹层 / 说明块遮罩              | StateDemo、Wide             |
| `big-title-from` → `big-title-to`  | `#ffffff` → `#7db4ff`         | 页标题渐变双色 stop                | big-demo 三视图             |
| `big-text-hover`                   | `#8fc3ff`                     | 文字 hover 提亮                    | big-demo index              |
| `big-divider`                      | `rgba(143,168,216,0.15)`      | 行分割线（dashed）                 | big-demo index、Wide        |
| `big-medal-gold/silver/bronze`     | `#f7c948`/`#c0c8d8`/`#d98e4a` | 排名奖牌三色                       | RankingList                 |
| `big-rank-active` / `big-rank-bar` | `#3a5a8c` / `#2b6de0`         | 非奖牌名次底 / 进度条渐变起点      | RankingList、Wide           |
| `big-kpi-down`                     | `#2fd39a`                     | 指标下降态（下降 ≠ 错误）          | KpiCard                     |
| `big-state-danger/warning/info`    | 见状态色表                    | 告警高/中/低                       | Wide 告警条                 |

#### 数据大屏 big · 异星荧光森林层（2026-11-03 登记）

> 深蓝锚色板之上的森林系高光层。光晕 token 以 `*-rgb` 三通道分量形态登记，支持就地 `rgba()` 组合透明度（与 `--big-blue-rgb` 模式一致）。

| Token                               | 值                 | 用途                                           | 实证                 |
| ----------------------------------- | ------------------ | ---------------------------------------------- | -------------------- |
| `big-spore-cyan-rgb`                | `77, 163, 255`     | 孢子青光晕（根脉脉动 / 普通 KPI 株光芯）       | KpiCard、index       |
| `big-spore-lilac-rgb`               | `185, 140, 255`    | 孢子丁香紫光晕（交替 KPI 株 / 排名条）         | KpiCard、RankingList |
| `big-bloom-rgb`                     | `245, 248, 250`    | 焦点白 bloom 芯（全页唯一最亮白光）            | KpiCard 焦点株       |
| `big-root-vein`                     | `#0d264c`          | 根脉网络线色（亮边，配合外层透明光晕）         | index.vue SVG        |
| `big-spore-dot-max` / `mid` / `min` | `.7` / `.4` / `.2` | 孢子光点散布透明度三档（青/丁香随机分配）      | index.vue            |
| `big-panel-glow-cyan-rgb`           | `13, 38, 76`       | 面板底部根脉汇聚微亮区（radial-gradient 中心） | PanelBox             |

> big 端为恒深色设计（拼接大屏暗室场景），token 不随 `[data-theme]` 切换——big-tokens.scss 无暗色覆盖段（2026-11-03 审计裁决）。

### H5 移动端 h5

| Token                           | 值                                | 用途                                                                                                        | 实证                           |
| ------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `h5-bg-page`                    | `#f7f8fa`                         | 页面底色                                                                                                    | `src/layouts/h5/index.vue`     |
| `h5-text-title`                 | `#323233`                         | 卡片标题（vant 标题黑）                                                                                     | h5-demo 卡片                   |
| `h5-card-bg`                    | `#ffffff`                         | 卡片底（暗色 `#262626`）                                                                                    | h5-demo 卡片                   |
| `h5-shadow-card`                | `rgba(0, 0, 0, .06)`              | 卡片投影（暗色 0.3 透明度）                                                                                 | h5-demo 卡片                   |
| `vant-primary`                  | `#C08048`                         | vant 品牌色（莫兰迪亮陶橙，2026-11-13 由鲜橙 #ff6a00 降饱和迭代定稿；白字 ≈3.3:1 低于 AA 线，用户裁决接受） | `src/styles/ui-overwrite.scss` |
| vant success / warning / danger | `#5e8168` / `#97794b` / `#a96a60` | vant 语义色莫兰迪低饱和化，复用 mall-ok / mall-warn / mall-err（2026-11-13）                                | 同上                           |

> h5 tokens 已配 `[data-theme='dark']` + `prefers-color-scheme` 双主题覆盖（2026-11-03）。vant 语义色亮色暗色同值（灰绿 / 灰褐 / 陶红暗底可读，与 admin 暗态语义色分档策略不同——h5 无布局级暗色 mixin）。

### H5 商城 h5-mall（陶土 · 莫兰迪，2026-11-04 登记）

> 风格源锁定自 ui-style-skill 陶土模板（seed 4877，根 `style-tokens.json` 选型；源页面 `h5-fashion-mall.html` 转换落地）。
> 值以 `apps/h5/src/modules/h5-mall/styles/h5-mall-tokens.scss` 为实证（经 views/index.vue `@use` 单点引入）；变量挂在 `.vv-h5-mall` 上，**仅对 h5-mall 模块子树生效**，h5 布局与 vant 色系零污染（无暗色覆盖——商城页为恒定暖陶视觉，同 big 端先例）。
> 用法契约（沿用 token notes）：实心按钮 / 角标 = `--mall-brand-deep` 底 + `--mall-on-brand` 白字；浅按钮 / pill = `--mall-brand-soft` 底 + `--mall-brand-deep` 字；强调 `--mall-accent` 只作点缀（眉题 / kicker），面积 ≤10%；正文 `--mall-ink-1`、辅助 `--mall-ink-2`、弱化 `--mall-ink-3`，禁用纯黑。

| Token              | 值                                                       | 用途                                                                                                                                                                                          | 实证                                                                                   |
| ------------------ | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `mall-bg-page`     | `#EFEBE5`                                                | 页面底                                                                                                                                                                                        | styles/h5-mall-tokens.scss                                                             |
| `mall-bg-card`     | `#F8F6F2`                                                | 卡片 / 公告 / tabbar 底                                                                                                                                                                       | 同上                                                                                   |
| `mall-bg-field`    | `#F3F0EA`                                                | 搜索框底 / 奇数位金刚区圆环                                                                                                                                                                   | 同上                                                                                   |
| `mall-bg-inverse`  | `#43473F`                                                | 预留深底（本期未消费）                                                                                                                                                                        | 同上                                                                                   |
| `mall-ink-1/2/3`   | `#3C403D` / `#6E7169` / `#A5A79F`                        | 正文 / 辅助 / 弱化文字三级                                                                                                                                                                    | 同上                                                                                   |
| `mall-line`        | `#E2DDD3`                                                | 1px 细线（边框 / 分割线）                                                                                                                                                                     | 同上                                                                                   |
| `mall-line-strong` | `#CFC8BC`                                                | 强调描边（下划线 / chip 选中边）                                                                                                                                                              | 同上                                                                                   |
| `mall-brand`       | `#B08D85`                                                | 品牌点缀（公告圆点 / 插画）                                                                                                                                                                   | 同上                                                                                   |
| `mall-brand-deep`  | `#7E6159`                                                | 主色文字 / 实心按钮底 / 角标底 / 线稿色                                                                                                                                                       | 同上                                                                                   |
| `mall-brand-soft`  | `#F3E9E6`                                                | 浅主底（banner / pill / icon 圆环）                                                                                                                                                           | 同上                                                                                   |
| `mall-accent`      | `#7E97AC`                                                | 强调点缀（眉题 / kicker，面积 ≤10%）                                                                                                                                                          | 同上                                                                                   |
| `mall-accent-soft` | `#E5EDF2`                                                | 强调浅底（c 档商品色块 / 插画圆）                                                                                                                                                             | 同上                                                                                   |
| `mall-ok/warn/err` | `#5E8168` / `#97794B` / `#A96A60`                        | 状态三色（本期 ok 用于 toast 对勾）                                                                                                                                                           | 同上                                                                                   |
| `mall-on-brand`    | `#FFFFFF`                                                | 深底白字（实心按钮 / 购物袋角标）                                                                                                                                                             | 同上                                                                                   |
| 圆角三档           | 18 / 31 / 49px（828 稿）                                 | sm / md / lg（源 8/14/22 @375 稿 ×2.208）                                                                                                                                                     | 同上（`--mall-r-sm/md/lg`）                                                            |
| 阴影               | `0 22px 57px -40px rgba(60,63,60,.20)`                   | 仅 toast（状态响应式例外，源 shadow-2 换算）                                                                                                                                                  | 同上（`--mall-sh-2`）                                                                  |
| 动效               | `.28s` + `cubic-bezier(.25,.46,.45,.94)`                 | 全模块统一过渡曲线                                                                                                                                                                            | 同上（`--mall-dur` / `--mall-ease`）                                                   |
| tabbar 交互        | Trampoline Tabbar（凹槽抛球，spec §9 槽位映射 `--tb-*`） | 面板 / 球同色 `--mall-bg-card`（GAP 间隙 + 投影保轮廓），选中 `--mall-brand-deep`，未选 `--mall-ink-3`；几何锁定 362 设计稿坐标系、JS scale 适配，组件样式禁写几何 px（pxtorem 双重缩放陷阱） | components/MallTabbar.vue + composables/trampoline-geometry/engine/useTrampolineTabbar |

> 字号（828 稿，h5 字号纪律满足）：正文 34、区块标题 49/38、卡片名 31/28、最小 24（角标 / en 眉题）——正文 ≥28px、辅助 ≥24px（DESIGN.md Typography 表）。

### 门户 portal（云灰 · 极简留白，2026-11-04 改版）

> 风格源锁定自根 `style-tokens.json`（ui-style-skill 云灰模板，seed 29060）。值以 `apps/portal/src/layouts/portal/styles/portal-tokens.scss` 为实证。
> 用法契约：实心按钮 = `--portal-brand` 底 + 白字（亮面 #5e6d7c / dark #5e7488，白字对比均 ≥4.5）；浅色按钮 / pill = `--portal-brand-soft` 底 + `--portal-brand-deep` 字；数据高亮文字 = `--portal-brand-deep`（dark 下为浅色主色文字，语义自洽）；点缀 `--portal-accent` 面积 ≤10%。

| Token                           | light                 | dark                  | 用途                                                                  |
| ------------------------------- | --------------------- | --------------------- | --------------------------------------------------------------------- |
| `portal-bg`                     | `#f6f6f4`             | `#24272b`             | 页面底（原纯白黑白极简，云灰改版重赋值）                              |
| `portal-bg-alt`                 | `#f1f1ef`             | `#2b2e33`             | hover 底 / 输入底（原分区底 #fafafa；特性区改与页面同色后服务交互态） |
| `portal-bg-card`                | `#ffffff`             | `#2e3237`             | 卡片底                                                                |
| `portal-bg-inverse`             | `#2e3134`             | 不随主题              | 恒深底（页脚），dark 保持深档                                         |
| `portal-ink`                    | `#333638`             | `#e8e9e7`             | 主文字（原 #111111）                                                  |
| `portal-ink-2`                  | `#66696c`             | `#a6a9ab`             | 次要文字（原 #555555）                                                |
| `portal-ink-3`                  | `#a3a6a8`             | `#7c7f81`             | 弱化文字（新增）                                                      |
| `portal-line`                   | `#e4e4e1`             | `#3a3d41`             | 1px 细线（原 #eeeeee）                                                |
| `portal-line-strong`            | `#cfd0cc`             | `#4a4d51`             | 强调描边（hover / ghost 按钮边，新增）                                |
| `portal-brand`                  | `#5e6d7c`             | `#5e7488`             | 品牌主色：实心按钮底 / logo 块                                        |
| `portal-brand-deep`             | `#445466`             | `#a9bdd1`             | 主色文字：pill 字 / 浅按钮字 / 数据高亮（dark 语义反转为浅色文字）    |
| `portal-brand-soft`             | `#e6ebf0`             | `#2e3740`             | 浅主底：pill 底 / icon 块 / 浅色按钮（dark 转深色底）                 |
| `portal-accent` / `accent-soft` | `#b08d85` / `#f3e9e6` | `#c4a69e` / `#38302e` | 点缀（面积 ≤10%）                                                     |
| `portal-on-*`（深底族）         | 不随主题              | 不随主题              | 深底反色文字/细线/实白                                                |

> 暗色经 `portal-dark` mixin + `[data-theme]`/`prefers-color-scheme` 接线（2026-11-03 建立接线，2026-11-04 由黑白反转改云灰蓝黑化；提亮规则参照中后台莫兰迪雾霾蓝 precedent）。

### 中后台 default

亮色为**莫兰迪紫固定视觉**（2026-11-04 起，基色 #d1c4e9，由参考仓高饱和紫 #5b5bd6 切换），token 见下表；暗色为莫兰迪雾霾蓝固定视觉（2026-11-03 起，由 slate 蓝黑切换），token 见下表。新增中后台色值时优先用 EP token，确需自有值时登记到本节。

#### 中后台亮色 · 莫兰迪紫（2026-11-04 登记）

> 落点：`apps/admin/src/layouts/default/styles/default-tokens.scss` 的 `default-layout-light`（布局变量）+ `default-layout-ep-light`（EP 覆盖）两个 mixin；经 `index.vue` / `element-overwrite.scss` 的 `[data-layout='default']` 容器与弹层双通道施加。基色 #d1c4e9 为浅色高亮位（EP light-8 / 侧栏激活底），实心按钮底用深族 #6a6180 保证白字对比 ≥4.5（莫兰迪低饱和下深色档必须压深，与暗色雾霾蓝提亮同理）。

| Token                                                      | 值                                | 用途                                                                                                             | 实证                      |
| ---------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `default-light-primary`                                    | `#6a6180`                         | 亮色主色（EP 覆盖 base，白字 ~5.6）                                                                              | `default-layout-ep-light` |
| primary dark-2                                             | `#564e6e`                         | active 深档（白字 ~7.3）                                                                                         | 同上                      |
| primary light-3/5/7                                        | `#9891ad` / `#b4afc5` / `#cfc9de` | 灯阶（hover 文字 / 轨道填充）                                                                                    | 同上                      |
| primary light-8                                            | `#d1c4e9`                         | **用户基色**：选中底 / 高亮位                                                                                    | 同上                      |
| primary light-9                                            | `#ece9f4`                         | 最浅底（hover 底 / 条纹）                                                                                        | 同上                      |
| menu active 底 / 折叠弹层激活底                            | `#d1c4e9`                         | 侧栏紫色识别（`--left-menu-bg-active-color` 等）                                                                 | `default-layout-light`    |
| menu active 文字                                           | `#4f4763`                         | 激活文字（在 #d1c4e9 底上 ~5.0）                                                                                 | 同上                      |
| `--el-bg-color-page` / `--app-content-bg-color`            | `#f6f5fa`                         | 内容区底（微紫调白，原 #f6f7fb）                                                                                 | 两个 mixin                |
| `--el-fill-color-light`                                    | `#f4f3f8`                         | 浅填充（微紫调）                                                                                                 | `default-layout-ep-light` |
| success / warning / danger（语义色莫兰迪化，复用 mall 族） | `#5e8168` / `#97794b` / `#a96a60` | EP 语义色低饱和化：tag / 按钮 / 消息 / 表单校验统一跟随；灯阶按 EP color.mix 公式；info 中性灰不动（2026-11-12） | `default-layout-ep-light` |

> 中性 slate 文字 / 边框（#526077 系）刻意不动——本就是灰调低饱和，与紫族和谐（用户裁决 2026-11-04）。teleport 弹层（含菜单弹层）统一经 `html[data-layout='default']` 变量映射跟随布局主题，无组件级补丁（2026-11-12 清理）。

#### 中后台暗色 · 莫兰迪雾霾蓝（2026-11-03 登记）

> 落点：`apps/admin/src/layouts/default/styles/default-tokens.scss` 的 `default-layout-dark`（布局变量）+ `default-layout-ep-dark`（EP 覆盖）两个 mixin；经 `index.vue` / `element-overwrite.scss` 的 `[data-theme='dark']` 选择器容器施加。全局 `packages/ui/_dark.scss` 的 `--bg-base` 系不受影响（portal / docs / auth 暗色维持原灰阶）。

| Token                                         | 值                                                | 用途                                         | 实证                     |
| --------------------------------------------- | ------------------------------------------------- | -------------------------------------------- | ------------------------ |
| `default-dark-primary`                        | `#8fa6bc`                                         | 暗色主色（EP 覆盖 base）                     | `default-layout-ep-dark` |
| primary light-3/5/7/8/9                       | `#7e94a9`/`#64798c`/`#4a5c6b`/`#3a4754`/`#2b343d` | 暗色灯阶（逐级变暗）                         | 同上                     |
| primary dark-2                                | `#a2b6c9`                                         | hover 提亮                                   | 同上                     |
| `default-dark-bg-page`                        | `#12161a`                                         | 页面底（`--el-bg-color-page` / 内容区）      | 同上                     |
| `default-dark-bg-card`                        | `#1a1f26`                                         | 卡片底（`--el-bg-color` / fill-blank）       | 同上                     |
| `default-dark-bg-overlay`                     | `#222831`                                         | 弹层底（`--el-bg-color-overlay`）            | 同上                     |
| fill 阶梯 light/fill/dark/lighter/extra-light | `#20272f`/`#20262e`/`#171c22`/`#262e37`/`#2c3540` | 填充阶梯（stripe 行用 lighter）              | 同上                     |
| `default-dark-bg-menu`                        | `#161b21`                                         | 侧栏 / 顶栏底                                | `default-layout-dark`    |
| menu active 底 / 文字 / 激活文字              | `#26303a` / `#8a99a8` / `#a8bacb`                 | 菜单激活态三级                               | 同上                     |
| `default-dark-text-primary`                   | `#e8edf1`                                         | 主文字（`--el-text-color-primary`）          | `default-layout-ep-dark` |
| `default-dark-text-regular`                   | `#c2cbd4`                                         | 正文（`--el-text-color-regular`）            | 同上                     |
| `default-dark-text-secondary`                 | `#8a97a5`                                         | 辅助文字（`--el-text-color-secondary`）      | 同上                     |
| success / warning / danger（暗态压暗降饱和）  | `#6e8a72` / `#a68a5e` / `#a67b72`                 | 暗色语义色，与雾霾蓝面板协调（2026-11-12）   | `default-layout-ep-dark` |
| `default-dark-border-base`                    | `#333d47`                                         | 边框 base                                    | 同上                     |
| border light / lighter                        | `#2b333c` / `#232a32`                             | 边框浅档（布局 border-color 同步 `#232a32`） | 同上                     |

> 已知边界（2026-11-12 修复后更新）：teleport 到 body 的弹层统一经 `html[data-layout='default']` 属性选择器的 EP 变量映射跟随布局主题（亮色莫兰迪紫 / 暗色雾霾蓝），date-picker / select / cascader 等业务页内弹层不再回落全局品牌色。修复手段：`injectBrandColor` 不再双写内联 `--el-color-primary`（内联曾压死布局选择器），全局主色改经 `theme-vars.scss` 的 `:root var(--color-primary)` 引用链跟随品牌色。同日清理：原 index.vue 的专属 popper-class 补丁段（`.vv-default-header-popper` / `.vv-context-menu-popper` mixin 重放）与 AppMenu horizontal 弹层局部硬编码已删除——与映射完全同值同生命周期，属三重冗余且硬编码曾致暗色漂移；`.vv-context-menu-popper` 类名保留（ContextMenu.vue 仍有图标间距布局样式消费），UserInfo / LocaleDropdown 的死类名绑定已删。

### 滚动条（全局，base/reset.css 消费）

| Token                                           | light                 | dark                  |
| ----------------------------------------------- | --------------------- | --------------------- |
| `--scrollbar-thumb` / `--scrollbar-thumb-hover` | `#b8b8b8` / `#878987` | `#4e4e52` / `#68686e` |

### 状态色（四栖通用）

| Token           | 值        | 语义                                             | 实证                        |
| --------------- | --------- | ------------------------------------------------ | --------------------------- |
| `state-error`   | `#f56c6c` | 错误 / 高危告警（Alarm 高级别同值）              | StateDemo 错误态、Wide 告警 |
| `state-offline` | `#f7c948` | 断连 / 中危告警（中断 ≠ 失败，与错误态视觉区分） | StateDemo 断连态、Wide 告警 |
| `state-success` | `#4da3ff` | 数据就绪主数据色（大屏语境复用 big-primary）     | StateDemo 成功态            |

> 中后台语境的成功/警告色用 EP 语义色（`--el-color-success/warning`），不与上表混用。

**The 离线非失败 Rule.** 中断 / 断连用琥珀黄（`state-offline`），错误 / 失败用红（`state-error`），两者永不混用——"连不上"不是"做错了"，视觉必须区分。

## Typography

**Body Font:** 系统字体栈（-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif；`--font-family-base`）
**Mono Font:** 'Fira Code', Monaco, Consolas, 'Courier New', monospace（`--font-family-mono`，等宽数值场景如大屏 KPI）

**Character:** 无自定义字体——四栖全部使用系统栈，工程上是零依赖可预期，视觉上是"透明"的：字号阶梯与字重承担全部层级职责。字重档位 400 / 500 / 600 / 700（`--font-weight-*`），行高 1.25 / 1.5 / 1.75（tight / base / relaxed）。

### 字号阶梯（按栖，设计稿 px）

| 栖              | 层级          | 规格                                     | 规则来源                                             |
| --------------- | ------------- | ---------------------------------------- | ---------------------------------------------------- |
| big 1920 稿     | 页标题        | 34px（极细字重 300，字距 8px，光晕阴影） | big-demo（异星森林视觉）                             |
| big 1920 稿     | KPI 数值      | 38px / 焦点株 44px 粗体等宽数字          | KpiCard（异星森林视觉）                              |
| big 1920 稿     | 面板标题      | 17px 字距 2px                            | PanelBox（异星森林视觉）                             |
| big 1920 稿     | 正文 / 辅助   | 12–15px                                  | big-demo、StateDemo（辅助 12–13px 为 mono 编码惯例） |
| big 9000 拼接稿 | 页标题 / 正文 | 56px / 22–30px                           | **×1.5~1.8 系数**（观看距离 5–15 米，docs/35 §3-8）  |
| h5 828 稿       | 正文          | **≥28px**                                | docs/34 §3.1（320 屏可读性推导）                     |
| h5 828 稿       | 辅助说明      | **≥24px**；20px 仅为边界示范，生产禁用   | docs/34 §3.1 注记                                    |
| default/portal  | 全层级        | Element Plus 默认字号体系                | 不自定义                                             |
| auth 登录标签   | 批次号        | 56px 超粗等宽（极端字重对比层级）        | login.scss（运输标签视觉）                           |
| auth 登录标签   | 标题          | 28px 字距 4px                            | login.scss（运输标签视觉）                           |
| auth 登录标签   | 字段名 / 编码 | 11–13px 等宽 mono（印刷编码惯例）        | login.scss（运输标签视觉）                           |
| auth 登录标签   | 检验章按钮    | 16px 字距 4px                            | login.scss（运输标签视觉）                           |

## Layout

间距骨架四栖共用：`--spacing-xs/sm/md/lg/xl` = 4 / 8 / 16 / 24 / 32px（步进 4）；圆角见 Shapes。

| 场景                           | 值                                                                                         | 实证                 |
| ------------------------------ | ------------------------------------------------------------------------------------------ | -------------------- |
| big 1920 稿：页边距 / 面板间距 | 30px / 20px（列 gap 16–30）                                                                | big-demo             |
| big 9000 稿：页边距 / 面板间距 | 100px / 32–100px                                                                           | Wide.vue             |
| 中后台布局尺寸                 | 顶栏 60px（`--header-height`）/ 侧栏 220px、收起 64px（`--sidebar-width/collapsed-width`） | `variables.scss`     |
| 门户布局                       | sticky 顶栏 64px（`--portal-header-h`）/ 内容区最大 1200px（`--portal-max-width`）         | `portal-tokens.scss` |

端级布局行为：big 用 scale 适配（1920 设计稿等比缩放，9000 拼接稿另设 ×1.5~1.8 系数，docs/35）；h5 用 rem 适配（828 设计稿 + postcss-pxtorem，docs/34）；窄容器场景降级用 CSS container query 而非 EP 栅格（视口宽容器窄时栅格断点失效）。

## Elevation & Depth

**状态响应式**：表面静息时扁平，阴影只在状态响应时出现——hover 提升、弹层降临、焦点聚焦；常驻结构性阴影不用。唯一例外是四栖中的 big：深蓝科技风不用阴影表达深度，改用色调分层（`big-abyss` 填充 < `big-night` 面板 < 描边）+ 蓝色 glow（`--big-blue-*-rgb` 三档透明度光晕，叠在边框与高亮数值下）。

### Shadow Vocabulary（中后台 / 门户 / docs / auth，EP 系）

- **ambient-sm**（`--shadow-sm` = `0 1px 2px rgba(0,0,0,0.06)`）：极浅卡片悬停、下拉容器。
- **ambient-md**（`--shadow-md` = `0 2px 8px rgba(0,0,0,0.1)`）：弹层、浮起卡片的状态响应。
- **ambient-lg**（`--shadow-lg` = `0 4px 16px rgba(0,0,0,0.15)`）：Dialog / 抽屉等模态容器。

**The 状态响应 Rule.** 静息表面零阴影；阴影是状态的回声，不是结构的拐杖。深度信息优先用色调分层（`--bg-base/secondary/tertiary` 三级纸面）传达。

## Shapes

- **圆角档位**：`--radius-sm/md/lg` = 6 / 12 / 20px（2026-11-04 由 4/8/12 上调，portal 云灰改版裁决；双写在 `packages/ui/src/assets/styles/variables.scss` 与 `packages/ui/src/styles/tokens/_spacing.scss`）。项目自有组件：按钮/输入 6px，卡片 12px，浮层 20px——档位少而语义固定，禁止自创中间值；EP 组件圆角走 EP 自身变量（`--el-border-radius-*`）不受影响。
- **BEM 命名空间**：前缀 `vv`（`$BEM_PREFIX`），所有组件 class 经 `createNamespace` 拼装，与 sass 根选择器 `.-{$BEM_PREFIX}-<kebab>` 严格对齐（CLAUDE.md §3）。
- **样式块纪律**：`<style lang="scss">` 禁止 scoped（BEM 隔离已足够，scoped 会阻断 `:deep()` 编译）；穿透第三方组件直接写后代选择器。

## Components

**性格一句话：精确克制的企业级默认**——Element Plus 的秩序感做底，自有封装（`@vv/ui`）在其上长出工程签名：配置化、高密度、可扫描。中后台 / docs / auth / portal 四端的按钮、输入、弹窗、表格全部消费 EP 组件，视觉差异由 `element-overwrite/`（按组件拆分的 SCSS，用 `color.mix` 计算品牌色灯阶 light-3/5/7/8/9）与 `ui-overwrite.scss`（端级覆盖）落地，不fork 组件。

### Buttons

- **Shape**: 4px 圆角（`--radius-sm`），高度 32px（EP 默认），padding 8px 15px。
- **Primary**: 品牌主色实心（`--color-primary`），hover 走 EP 灯色阶变亮（`--el-color-primary-light-3`），active 变深。
- **Secondary / Ghost**: EP 默认按钮（白底灰框），文字按钮无框；危险操作用 `danger` 语义色。

### Inputs / Fields

- **Style**: EP 默认——白底、`--border-base` 描边、4px 圆角、高度 32px；focus 边框转主色 + 外发光（EP `--el-input-focus-border-color`）。
- **Error / Disabled**: 错误态 `--color-danger` 描边 + 下方红字；禁用态灰阶纸面。

### Cards / Containers

- **Corner Style**: 8px（`--radius-md`）。**Background**: `var(--bg-base)` 纸面（深色主题自动切深）。**Shadow Strategy**: 静息零阴影，hover 才升 ambient-sm。**Border**: 1px `var(--border-light)`（卡片与容器优先用边框而非阴影分层）。

### Navigation

- **中后台**: 侧栏 220px / 收起 64px，深色纸面 + `vv-` BEM 命名；顶栏 60px 白底；多页签(tags-view)刻意不持久化。
- **门户**: sticky 顶栏 64px，云灰纸面底 + `--portal-ink` 文字，品牌主色点亮（logo 块 / 登录按钮 brand 实心），锚点滚动导航，内容区居中 1200px。
- **大屏**: 无导航组件，页标题 36px 渐变字 + 面包屑式说明（big-demo）。

### Signature Components（@vv/ui）

- **ProTable**: 表格双引擎（EP / vxe-table 可切），搜索区 + 工具栏 + 列设置一体；全屏态走 `--z-index-fullscreen`（1500）。
- **XForm / form-schema**: 配置化表单引擎（schema 驱动渲染），ProDialogForm 弹窗表单组合。
- **BaseChart**: ECharts 容器 + 主题 / 自适应，统一图表签名。
- **NetworkBanner**: 常驻网络横幅，`--z-index-banner`（1999）——刻意贴 EP ElMessage（2000+）之下，瞬时错误优先于常驻横幅。
- **AsyncState**: 异步三态（Loading / Error / Empty）渲染包装，全局三态纪律的组件化身。

## Do's and Don'ts

### Do:

- **Do** 新增自有色值 / 字号 / 间距常量时**先登记本文再使用**（维护规则，CI 语义一致性基准）。
- **Do** 用主题感知变量写组件（`var(--bg-base)` / `var(--text-primary)`），让明暗双主题零成本跟随（docs/06 场景 1）。
- **Do** 中后台语境的语义色优先用 EP token（`--el-color-success/warning`），大屏语境复用 `big-data-blue`。
- **Do** 深度优先用三级纸面分层（`--bg-base/secondary/tertiary`），阴影留给状态。

### Don't:

- **Don't** 在样式里写 `!important`（项目约束 #8，仅用户主动要求时例外）——用选择器特异性 / BEM 命名空间 / 源码顺序解决。
- **Don't** 在非 scoped 样式里写 `:deep()` / `::v-deep`（不会被编译，规则直接丢弃）——穿透第三方组件直接写后代选择器。
- **Don't** 混用离线黄与错误红（The 离线非失败 Rule）；不要把 EP 语义色带进大屏语境。
- **Don't** 给大屏 1920 稿正文用 <14px、给 h5 生产环境用 20px 正文（h5 正文 ≥28px / 辅助 ≥24px，20px 仅边界示范）。
- **Don't** 硬编码 `#fff` / `#000`（docs/06 评审 checklist）——用 `var(--bg-base)` / 纸面 token。
- **Don't** 显式 import 自动注册目录下的全局组件（`@vv/ui` 三目录 + app `src/components/`）——模板直接用，import 会丢 IDE 类型展开。

## 与一致性校验的关系

- **硬数据**（字段数 / props 表 / 文件行数）→ `pnpm check:doc-currency`（CI 阻断）
- **语义级**（本文 token 与代码实际值）→ 人工抽查；抽查清单以本文 Colors / Typography / Layout / Elevation / Shapes 各表为基准，发现漂移先改代码或本文，再同步对方

## 修订记录

| 日期       | 变更                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-04 | h5-mall 商城首页落地（h5-fashion-mall.html 按陶土模板转换，seed 4877；用户裁决设为 h5 rootRedirect 首页）：新增「H5 商城 h5-mall」节（19 项 token + 圆角/阴影/动效 + 字号注记），实证 `apps/h5/src/modules/h5-mall/styles/h5-mall-tokens.scss`（views/index.vue `@use` 单点引入）；变量仅模块子树生效（无暗色覆盖，同 big 端先例）；frontmatter 增补 19 项镜像；token 落点由视图 style 块按用户裁决迁至模块 styles/ 单文件管理（对齐 layouts/portal tokens 先例）                                                                                                                                                                                                                                                                              |
| 2026-11-04 | admin 亮色主题莫兰迪紫化（用户指定基色 #d1c4e9）：亮色由参考仓高饱和紫 #5b5bd6 切换为莫兰迪紫灯阶（H 261° 族）——实心按钮底 #6a6180（白字 ~5.6）、active 深档 #564e6e、light-3/5/7 #9891ad/#b4afc5/#cfc9de、#d1c4e9 落位 light-8（选中高亮/侧栏激活底）、light-9 #ece9f4、激活文字 #4f4763（在基色底上 ~5.0）；内容区底/浅填充微紫调 #f6f5fa/#f4f3f8；中性 slate 文字边框不动（用户裁决）；AppMenu horizontal 弹层局部变量同步；落点 `default-tokens.scss` 亮布局 + 亮 EP 两 mixin，暗色雾霾蓝不受影响；frontmatter 增补 11 项亮色镜像                                                                                                                                                                                                          |
| 2026-11-04 | portal 首页云灰改版（ui-style-skill 选型「云灰 · 极简留白」，seed 29060 锁定根 `style-tokens.json`）：portal token 由黑白极简改云灰板（页面底 #f6f6f4、ink 三档 #333638→#a3a6a8、line 两档 #e4e4e1/#cfd0cc），新增 brand 族（#5e6d7c/#445466/#e6ebf0）、accent 族（#b08d85/#f3e9e6）、bg-card、bg-inverse（恒深底 #2e3134，修复页脚/登录按钮 dark 反转缺陷）；暗色由黑白反转改云灰蓝黑化（brand 提亮参照中后台雾霾蓝 precedent）；全局圆角 4/8/12 → 6/12/20（用户裁决；存量组件零消费，portal 为首批消费方）；SiteHero/SiteFeatures/SiteStats/SiteAbout/SiteFooter/PortalHeader 全面接线 brand 族（实心按钮契约：brand 底 + 白字，双主题白字对比 ≥4.5）；特性区新增 CAPABILITIES 眉题（site.ts `SITE_FEATURES_EYEBROW`）；frontmatter 镜像同步 |
| 2026-11-03 | admin 暗色主题莫兰迪化（用户选定色卡 A 方向）：default-tokens.scss 两个 dark mixin 由 slate 蓝黑切换为雾霾蓝系（主色 `#8fa6bc` / 页面底 `#12161a` / 卡片 `#1a1f26` / 文字 `#e8edf1→#8a97a5` 三级 / 边框 `#333d47→#232a32` 三级）；「中后台 default」节由"不定义自有色板"修正为暗色自有雾霾蓝 token 表（frontmatter 同步增补 12 项镜像）；亮色紫主题、全局 `--bg-base` 灰阶、其他端暗色均不受影响                                                                                                                                                                                                                                                                                                                                               |
| 2026-11-03 | 样式分层规则符合度修复（审计报告 `.claude/agent-reports/2026-11-03-样式分层规则符合度审计.md`）：big 增补 19 token（面板/遮罩/标题渐变/奖牌/排名/状态）、h5 增补 3 token 并配暗色、portal 暗色反转接线（拆分独立小节，修正「不定义自有色板」漂移）、全局滚动条 token 化、Wide.vue 中文类名 `&--高/中/低` 改 `--high/mid/low` 映射                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-11-02 | 合并 impeccable DESIGN.md 规范格式：新增 YAML frontmatter（机器可读 token）+ Overview（北极星「一套骨架，四种舱位」）+ Layout / Elevation & Depth / Shapes / Components / Do's and Don'ts 章节；既有四栖 token 表全量保留，状态色并入 Colors 子节；深度哲学定为状态响应式                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-10-15 | 初版（/autoplan TODOS #4）：big/h5 色板 + 状态色 + 字号阶梯 + 间距，全部取自代码实证值                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
