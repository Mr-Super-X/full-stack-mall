# 37-h5 rem 适配决策记录（ADR）

> 面向维护者。使用指南见 `docs/34-H5布局与rem适配.md`；本文记录"为什么是这样"——每个决策附被否方案与根因证据。
> 立项：/autoplan Phase 1 E5（2026-10-15），补齐与 `docs/25-XForm架构与决策记录.md` 同级的决策纪律。

## 背景与目标

让中后台模板零成本长出 H5 移动页面能力：路由挂 h5 layout 即生效，样式**直接写设计稿 px**（所见即所得），对 default/portal 后台布局零污染。

## 决策 1：编译时 + 运行时双层架构

- **选型**：编译时 `postcss-pxtorem`（`build/postcss.ts`）按 828 稿 rootValue=82.8 转 rem；运行时 `src/layouts/h5/config/rem.ts` 按 `min(视口宽,540)/10` 动态定 1rem 的实际像素。
- **被否方案 A：纯运行时（JS 按设计稿比例动态换算注入样式）**——运行时开销大、与项目 scss + BEM 体系脱节，开发者心智成本高。
- **被否方案 B：纯 vw**——`1px` 物理细线无法表达（vw 最小单位随屏宽变化）、字号跨屏可控性差。
- **根因**：rem 同时满足"写 px 所见即所得"与"1px 细线保物理像素"（`minPixelValue: 2`，小于 2px 不转）。

## 决策 2：828 设计稿基准

- **选型**：`H5_DESIGN_WIDTH = 828`（build/postcss.ts 唯一常量），rootValue = 稿宽/10。
- **理由**：828 = 414pt × 2（iPhone 主流逻辑宽度 2 倍图），一份设计稿同时覆盖 375/390/414 逻辑宽度的整数倍关系；换 750 稿只改这一行，业务代码零改动。
- **代价**：828/320 ≈ 2.6× 缩放跨度 → 小屏辅助字号易跌破可读线，故有 §3.1 字号规范（正文 ≥28px 稿、辅助 ≥24px 稿；20px 仅为边界示范）。

## 决策 3：范围限定 = 前缀约定目录 + 负向先行 exclude 正则

- **选型**：仅转换 `src/layouts/h5/` 与 `src/modules/h5-*/`（模块以 `h5-` 前缀命名，新增零配置接入）；`H5_EXCLUDE_REGEX` 用负向先行 `^(?!.*目标段).*$` 实现 include 语义。
- **被否方案：exclude 函数形态**——postcss-pxtorem v6.1.0 源码实测：exclude 为函数时，返回 false（不排除）会 fall through 到 `filePath.match(fn)`（index.js:135），函数被强制转正则，视字符串化结果抛 SyntaxError 或静默错误匹配。只能用 RegExp 形态（实施偏差已回填记录：commit `dd6447c`）。
- **正则形态还须兼容**：vite 在 Windows 下的 input.file 形态（`D:/...` 正斜杠 + `?vue&type=style` query 后缀）——故目标段同时兼容 `[\\/]` 两种分隔符。

## 决策 4：运行时视口读 window.innerWidth，不用 documentElement.clientWidth

- **选型**：`rem.ts` 的 `applyRootMetrics` 用 `window.innerWidth`。
- **根因**：宽屏限宽（`html.style.width = 540px`）生效后，`clientWidth` 读到的是 html 元素自身宽度恒为 540——从宽屏 resize 回窄屏时读到残留限宽值，fontSize 计算错误；`innerWidth` 永远是视口宽度，不受 html 内联 width 影响。

## 决策 5：激活时机 = setup 顶层同步（2026-10-15，T8）

- **选型**：`src/layouts/h5/index.vue` 在 `<script setup>` 顶层调用 `activateRem()`（首次应用同步写 html fontSize），`onUnmounted(deactivateRem)` 配对恢复。
- **被否方案（前实现）：onMounted 激活**——onMounted 在首帧渲染**之后**，第一帧以浏览器默认 16px root 渲染再跳变，产生 FOUC；且与 big layout 的 setup 顶层初始化（`big/index.vue`）策略不对称。
- **安全依据**：`activateRem` 幂等（重复调用先恢复快照再激活），异常卸载后再次进入可自恢复；回归防线 `src/layouts/h5/index.spec.ts` 的 setup 探针用例（子组件 setup 瞬间 fontSize 必须已激活）。

## 被否决的方案汇总（评审否决记录）

| 方案                   | 否决理由                                                                                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 引入 vant 等移动 UI 库 | vant 按 375 稿设计（推荐 rootValue 37.5），与本仓 828/82.8 双基准失调；且 node_modules 不在转换范围，组件不随屏宽缩放（docs/34 限制 #9） |
| UnoCSS rem 原子类      | uno 按 16px 基准生成 rem，与本仓 82.8 基准冲突（docs/34 限制 #3）                                                                        |
| @media 断点            | `mediaQuery: false` 只跳过 @media 参数，块内声明仍 rem 化——断点不缩而内容缩，两者脱钩产生矛盾布局（docs/34 限制 #4）                     |

> **修订记录（2026-10-27）**：「引入 vant 等移动 UI 库」否决已被集成事实撤销——vant 4 正式集成进 apps/h5（VantResolver 按需引入 + vant-vars.scss 主题覆盖，见 docs/34 §0），混用策略定为「vant 组件物理 px 不缩放 + 自定义组件 rem 缩放」。原否决记录保留作历史，其「双基准失调」技术事实由 §0 的混用约定吸收。

## 相关文件

| 文件                                   | 职责                                                                                                                                                                                                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/config/src/postcss.ts`       | 编译时配置单一来源（常量 + 路径判定 + exclude 正则 + 插件数组）                                                                                                                                                                                               |
| `apps/h5/src/layouts/h5/config/rem.ts` | 运行时激活/恢复（快照模型 + 防抖 + bfcache）                                                                                                                                                                                                                  |
| `apps/h5/src/layouts/h5/index.vue`     | 布局壳（setup 顶层激活）                                                                                                                                                                                                                                      |
| `apps/h5/src/plugins/remAdaptation.ts` | viewport meta 幂等                                                                                                                                                                                                                                            |
| 测试                                   | `packages/config/src/postcss.spec.ts`（含 T9 真实转换集成）/ `apps/h5/src/layouts/h5/config/rem.spec.ts` / `packages/shared/src/plugins/remAdaptation.spec.ts`（apps/h5 侧 remAdaptation.ts 为薄封装，spec 在共享包）/ `apps/h5/src/layouts/h5/index.spec.ts` |
