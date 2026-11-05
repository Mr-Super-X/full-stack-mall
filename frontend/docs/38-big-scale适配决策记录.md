# 38-big scale 适配决策记录（ADR）

> 面向维护者。使用指南见 `docs/35-大屏布局与scale适配.md`；本文记录"为什么是这样"。
> 立项：/autoplan Phase 1 E5（2026-10-15）。

## 背景与目标

让中后台模板长出数据大屏/拼接屏能力：路由挂 big layout 即生效，样式**写死设计稿 px**（默认 1920×1080，异形屏经 `meta.bigScreen` 声明），适配 1920/2560/4K/9000px 拼接屏，对其它布局零残留。

## 决策 1：transform: scale 容器整体缩放

- **选型**：`scale = min(vw/dw, vh/dh)`，容器写死设计稿尺寸，`translate(居中偏移) scale(s)`，只缩放 layout 自有容器 div，不碰 html/body。
- **被否方案 A：`zoom`**——非标准 CSS（Firefox 长期不支持，且 Safari 的 zoom 与 transform 语义细节不同），跨浏览器风险不可接受。
- **被否方案 B：vw/vh 全量换算**——每个元素尺寸都要人工换算，嵌套元素复合失真；且与"写死设计稿 px"的开发体验目标冲突。
- **对 h5 rem 的差异化**：big 走纯运行时缩放、**零编译转换**（big 目录不在 postcss-pxtorem 范围）——比 h5 更干净，无全局 html 状态残留风险。

## 决策 2：设计稿尺寸走路由 meta.bigScreen 契约

- **选型**：缺省 1920×1080；超宽/异形页在路由记录上声明 `meta: { bigScreen: { width: 9000, height: 1080 } }`；layout `watch(() => route.meta.bigScreen)` 立即重算。
- **被否方案：全局单配置**——同一 layout 内需要 1920 标准页与 9000 拼接页共存（big-demo 即此形态），全局配置无法表达；meta 随路由走天然支持同 layout 多设计稿。
- **守卫**：`resolveBigScreenSize` 类型守卫对非法值（非正数/NaN/Infinity）一律回退 1920×1080。
- **watch 不防抖**：同 layout 内跳转若防抖会出现中间态闪烁（先旧比例后新比例）；视口 resize 才走 150ms 防抖（`scheduleRecalc`），两者刻意不同策略。

## 决策 3：BigChart 模块自治，不动公共 BaseChart

- **选型**：`src/modules/big-demo/components/BigChart.vue` 薄封装 echarts，init 时 `devicePixelRatio × scale` 补偿位图放大。
- **理由**：补偿语义是 big 场景特有（transform scale 使 canvas 位图被视觉放大 scale 倍），塞进公共 BaseChart 会把场景负担强加给所有消费方，违反"组件放 common 需场景无关"的边界铁律（CLAUDE.md §1.2）。
- **MAX_EFFECTIVE_DPR = 2.5 钳制（2026-10-15，T7）**：`dpr × scale` 无上限时，4K 拼接屏（scale=2）× 高 DPR 环境（dpr=2）→ 有效 dpr=4 → canvas 位图面积放大 16 倍（单图 ≈130MB GPU 显存），整页多图可致 WebGL 上下文丢失。2.5 依据：大屏典型观看距离 2-3 米，超出该密度的像素增益人眼不可分辨。回归防线：`BigChart.spec.ts` 钳制用例。

## 决策 4：架构性限制显式接受，而非修复

以下限制经评估为 transform scale 方案的固有代价，选择文档化（docs/35 §4）+ 约束写法，而非工程修复：

| 限制                                                              | 为何不修                                                                        | 应对                                                       |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| teleport 弹层（ElSelect 下拉/ElTooltip/ElMessageBox）不随缩放     | 弹层 teleport 到 body，在 scale 容器外，修 = 接管 EP 弹层定位体系，成本远超收益 | 大屏页交互控件用内联形态（按钮/开关/滑块）                 |
| stage 的 transform 成为后代 `position: fixed` 的 containing block | transform 创建新的包含块是 CSS 规范行为                                         | 悬浮元素用 absolute 相对 stage 定位                        |
| 跨 DPR 显示器拖动时 dpr 补偿过期                                  | scale 不变不触发重建，无可靠监听钩子                                            | 可接受（轻微模糊）；浏览器缩放会触发 innerWidth 变化已覆盖 |
| echarts registerMap 无 unregister                                 | echarts 无该 API                                                                | 一次性 159KB 常驻属可接受设计，勿误判内存泄漏              |

## 被否决的方案汇总

| 方案                                      | 否决理由                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------ |
| 复用公共 BaseChart + prop 开关            | 见决策 3：场景负担强加公共组件                                                 |
| 每个大屏页自带缩放逻辑（Vue2 mixin 流派） | 重复代码 + 行为漂移；layout 收敛后路由声明即接入                               |
| 缩放同时改 html fontSize（复用 h5 rem）   | 全局 html 状态在 layout 切换时需快照恢复，残留风险高；scale 容器方案零全局状态 |

## 相关文件

| 文件                                                    | 职责                                                                                           |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `apps/big/src/layouts/big/config/scale.ts`              | scale 纯计算 + meta 守卫 + inject 契约                                                         |
| `apps/big/src/layouts/big/index.vue`                    | 布局壳（setup 顶层初始化 + provide）                                                           |
| `apps/big/src/modules/big-demo/components/BigChart.vue` | dpr×scale 补偿 + 钳制                                                                          |
| 测试                                                    | `scale.spec.ts`（18 用例）/ `index.spec.ts` / `BigChart.spec.ts`（8 用例）/ `useClock.spec.ts` |
