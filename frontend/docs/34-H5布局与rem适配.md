# H5 布局与 REM 适配使用指南

> 适用：移动端 H5 页面开发。routes 挂 h5 layout 即获得 rem 适配能力，样式直接写设计稿 px。
> 决策记录（为何自研 / 828 选型 / 范围限定根因）见 [docs/37-h5-rem适配决策记录.md](37-h5-rem适配决策记录.md)。

## 0. Vant 4 集成（2026-10-27）

h5 已集成 **vant 4** 作为基础组件库（按需引入 + CSS 变量主题覆盖）：

- **按需引入**：模板直接用 `<van-button>` / `<van-cell>` 等——`apps/h5/vite.config.ts` 传 `componentResolvers: [VantResolver()]`（工厂扩展位，注入 Components 插件 resolvers 数组），组件解析 + CSS sideEffects 自动注入
- **主题覆盖**：`apps/h5/src/layouts/h5/styles/vant-vars.scss` 全局覆盖 vant CSS 变量（品牌橙 `#ff6a00` / 圆角 / 尺寸）；如需局部覆盖用 vant 的 `ConfigProvider` 组件（官方文档：https://vant-ui.github.io/vant/#/zh-CN/config-provider）
- **隔离保证**：vant 依赖只进 `apps/h5/package.json`，resolver 只在本 app 的 vite.config 装配，其他 app 零感知
- **rem 适配兼容**：vant 组件内部尺寸是物理 px（不经 pxtorem 转换——`postcss.ts` 的 exclude 正则锚定 `appRoot/src/layouts/h5` 与 `modules/h5-*`，vant 样式在 `node_modules/vant/lib` 不匹配）；h5 自定义组件经 pxtorem 等比缩放，两者混用无冲突
- **分包归属**：vant 产物归 `vendor-ui` chunk（与 element-plus 同组——同为 UI 库、按需后体量小不污染缓存；其他 app 不装 vant，pattern 只在本 app 命中）

**验证页**：`pnpm dev:gateway h5` → `http://localhost:8080/h5/h5-demo/vant-test/`（按需引入 + 主题覆盖演示）

## 1. 快速上手

```ts
// apps/h5/src/modules/h5-xxx/routes/index.ts
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/h5-xxx',
    component: () => import('@/layouts/h5/index.vue'), // ← 获得 H5 面板能力
    children: [
      {
        path: '',
        name: 'H5Xxx',
        component: () => import('../views/index.vue'),
        // H5 典型场景需要免登录（真机扫码预览）：meta 声明 + 白名单注册双管齐下
        meta: { title: 'H5 页面标题', requiresAuth: false },
      },
    ],
  },
]

export default routes
```

> **免登录提示**：`requiresAuth: false` 只是宽松标记，真正放行需在 `apps/h5/src/router/whitelist.ts`
> 的 `createWhiteList('NotFound', h5DemoRouteNames)` 调用中并入新模块的 `routeNames`（从 `@/modules/h5-xxx/routes` 导出，如 `createWhiteList('NotFound', [...h5DemoRouteNames, ...h5XxxRouteNames])`）。参照 h5-demo 模块的写法。

```scss
// h5 范围内的组件样式：直接写 828 设计稿标注的 px，构建时自动转 rem
.#{$BEM_PREFIX}-h5-xxx {
  &__card {
    width: 200px; // 编译后 2.41546rem（unitPrecision 默认 5 位）；375 屏渲染 90.6px（200×375/828）
    font-size: 28px;
  }
}
```

**转换范围（只有这两类路径被转换）：**

- `apps/h5/src/layouts/h5/`（布局自身）
- `apps/h5/src/modules/h5-*/`（**约定：h5 业务模块以 `h5-` 前缀命名**，新增模块零配置接入）

后台（default）/ 门户（portal）/ element-plus 样式零污染。

## 2. 换算公式

| 阶段   | 规则                                             | 配置位置                                                        |
| ------ | ------------------------------------------------ | --------------------------------------------------------------- |
| 编译时 | `X px → X / 82.8 rem`（rootValue = 设计稿宽/10） | `packages/config/src/postcss.ts` `H5_DESIGN_WIDTH = 828`        |
| 运行时 | `1rem = min(视口宽, 540) / 10 px`                | `apps/h5/src/layouts/h5/config/rem.ts` `H5_REM_MAX_WIDTH = 540` |

换 750 设计稿：只改 `packages/config/src/postcss.ts` 的 `H5_DESIGN_WIDTH = 750` 一行，业务代码零改动。

## 3. 已知限制（必读）

| #   | 限制                                           | 原因                                                                                                                          | 应对                                                                                                                                      |
| --- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 内联样式 `:style` / JS 计算的 px 不转换        | postcss 只处理样式表                                                                                                          | 动态尺寸在 JS 侧自行按 `设计稿px × 视口宽/828` 换算                                                                                       |
| 2   | Element Plus 组件样式不缩放                    | node_modules 不在转换范围                                                                                                     | h5 页用原生元素 + BEM（参考 h5-demo）；**EP 复杂组件勿用于 h5**                                                                           |
| 3   | UnoCSS 原子类（`w-4` 等）按 16px 基准生成 rem  | uno 不在转换范围且 rem 基准假设 16px                                                                                          | **h5 模块内禁用 uno rem 原子类**，只写 BEM scss px                                                                                        |
| 4   | 媒体查询断点 px 不转换，但**块内声明仍会转换** | `mediaQuery: false` 只跳过 `@media` 的参数；块内 decl 照常 rem 化                                                             | **h5 内禁止写 @media 断点**——断点 600px 不缩而内容缩放，两者脱钩会产生矛盾布局                                                            |
| 5   | keyframes 内 px 会被转换                       | postcss-pxtorem walkDecls 全量                                                                                                | 通常正是期望行为；微距动画（≤2px 位移）窄屏会亚像素化消失；需豁免的选择器在 `packages/config/src/postcss.ts` 追加 `selectorBlackList`     |
| 6   | 1px 边框不转换                                 | `minPixelValue: 2`                                                                                                            | 特性而非缺陷——保持物理 1px 细线。注意反面：2px 边框会被转成 0.02415rem，375 屏渲染约 0.9px（窄屏真机偏细）                                |
| 7   | 同 rule 内重复声明同名属性会导致后者静默失效   | 插件 `declarationExists` 检查：第一条转 rem 后，第二条同值声明被视为"已存在"而跳过，px 残留且后者胜出                         | 不写 `width: 100px; width: 100px` 式重复声明（含 sass 展开可能产生的重复）                                                                |
| 8   | CSS 变量值会转换，但 `var()` fallback 不转换   | pxRegex 排除 `var()` 表达式                                                                                                   | `--w: 200px` → rem ✓；`var(--w, 100px)` 的 fallback 100px 保持 px——fallback 勿依赖缩放语义                                                |
| 9   | vant 组件不随屏缩放（物理 px）                 | vant 样式在 `node_modules/vant/lib`，不匹配 pxtorem 转换范围正则——vant 组件内部尺寸保持物理 px，自定义组件经 pxtorem 等比缩放 | **既定混用策略**（vant 4 已集成，见 §0）：vant 组件按官方 375 稿视觉直接使用，自定义布局/字号走 828 稿 BEM px；双基准冲突顾虑已由 §0 排除 |

## 3.1 字号设计规范建议

828 稿下辅助字号 ≤20px 时，320 小屏渲染约 7.7px（828/320 ≈ 2.6× 缩放跨度是稿宽的结构性副作用）。
**建议：h5 页面正文 ≥28px 稿、辅助说明 ≥24px 稿**；h5-demo 的字号阶梯（28/24/20px）即边界示范。

> ⚠️ 20px 是**边界示范值**（演示"下限长什么样"），生产页面辅助说明请勿使用——320 小屏渲染 7.7px 不可读。评审 h5 页面字号时以"生产 ≥24px 稿"为准绳，demo 的 20px 不构成豁免先例。

## 4. 运行时行为

| 场景           | 行为                                                                                                  |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| 进入 h5 路由   | h5 layout setup 顶层激活 fontSize 计算（首帧渲染前生效，无 FOUC）+ resize/pageshow 监听（防抖 300ms） |
| 离开 h5 路由   | onUnmounted → 恢复进入前 html 内联样式 + 移除监听（对后台零残留）                                     |
| 宽屏（>540px） | 页面限 540px 居中，fontSize 按 54px 计算                                                              |
| 宽屏拖回窄屏   | 限宽内联样式自动清理（用 window.innerWidth 计算，不受 html 限宽影响）                                 |
| iOS 地址栏收缩 | `min-height: 100vh` + `100dvh` 渐进增强（h5 layout 与 demo 页均已应用）                               |
| 极端场景       | innerWidth ≤ 0（隐藏 iframe/预渲染）跳过计算保持现状，可见后 resize 自愈                              |

## 5. 验收示例

`pnpm -C apps/h5 dev` 后访问 `http://localhost:5177/h5-demo`（免登录；或 `pnpm dev:gateway` 走 `http://localhost:8080/h5/h5-demo`）：Chrome DevTools 设备模拟 iPhone SE（375px）
观察卡片/字号等比缩放；拖宽视口超过 540px 观察居中；跳回 `/workbench` 后台布局无残留。
