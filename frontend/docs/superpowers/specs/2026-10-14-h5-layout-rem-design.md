# H5 Layout + REM 适配 设计文档

> **日期**：2026-10-14 | **分支**：`feature/engine-optimization` | **状态**：已获用户批准（2026-10-14）
>
> **一句话**：routes 中父记录 `component` 挂 `@/layouts/h5/index.vue` 即获得 H5 面板能力（与 home 用 portal、workbench 用 default 同构）；h5 目录下样式直接写设计稿标注的 px，构建时 postcss-pxtorem 自动转 rem，运行时按屏宽动态计算 html fontSize。

## 1. 背景与目标

项目中后台（default）与门户（portal）布局已就位，缺移动端 H5 面板能力。目标：

1. 新增 `layouts/h5` 布局，消费方式与现有布局完全一致（路由 `component` 直挂）
2. h5 代码**直接写 px**（所见即所得：设计稿标多少写多少），构建时自动转 rem
3. 运行时 rem 适配做成 Vue 插件（`src/plugins/remAdaptation.ts`）
4. 新增 `modules/h5-demo` 示例模块，作为能力验收页

## 2. 关键决策（已与用户确认）

| # | 决策点 | 结论 | 理由 |
|---|--------|------|------|
| 1 | px→rem 转换方案 | **postcss-pxtorem**（编译时） | npm 已验证存在（v6.1.0）；include/propList/minPixelValue 久经考验；运行时部分（html fontSize）两方案都需要，此处只选构建侧 |
| 2 | 设计稿基准宽度 | **828px**（rootValue = 82.8） | 与用户提供的参考代码一致；用户要求"所见即所得"——设计稿标多少 px 就写多少 px，rootValue 只是构建常量。将来换 750 稿只改 `build/postcss.ts` 的 `H5_DESIGN_WIDTH` 一行 |
| 3 | 宽屏限宽策略 | **540px 居中** | 参考代码的 1024 在宽屏下 1rem=102px 元素巨大；540 更接近移动端观感。离开 h5 布局自动恢复，不残留 |

### 对参考代码的两处必要完善

| 参考代码做法 | 本设计 | 为什么必须改 |
|---|---|---|
| `install` 时全局一次性设置 fontSize/width/margin | **激活/恢复绑定到 h5 layout 组件生命周期**（onMounted/onUnmounted） | SPA 多布局共存：从 h5 页返回 default 后台时，`html width:1024px + margin:auto` 残留会把后台布局挤压居中。布局即组件，挂载=激活、卸载=恢复，语义精确且可逆 |
| 运行时创建 viewport meta | install 时**幂等检查**（已存在则跳过） | `index.html:6` 已静态声明同样的 viewport content，重复创建是冗余；插件保留幂等兜底（其他入口 HTML 复用插件时仍安全） |

## 3. 架构（编译时 + 运行时双轨）

```text
编译时（构建管线，px 自动转 rem）            运行时（浏览器，决定 1rem 的实际像素）
───────────────────────────────          ─────────────────────────────────
build/postcss.ts（新增，单一来源）          src/plugins/remAdaptation.ts（新增，薄插件）
  └─ postcss-pxtorem                        └─ install(): viewport meta 幂等确保
     ├─ rootValue: 82.8                     src/layouts/h5/config/rem.ts（新增，纯TS）
     │   = H5_DESIGN_WIDTH(828) / 10          ├─ activateRem(): html fontSize
     ├─ include: 仅命中                        │   = min(屏宽, 540) / 10
     │   · src/layouts/h5/                   │   + 宽屏限 540px 居中（width+margin）
     │   · src/modules/h5-*/（前缀约定）       │   + resize/pageshow 监听（防抖300ms）
     │   → 后台/portal/EP 样式零污染          └─ deactivateRem(): 恢复进入前内联样式
     ├─ minPixelValue: 2（1px 边框不转）          + 移除监听 + 清防抖定时器
     └─ mediaQuery: false（默认）            src/layouts/h5/index.vue
                                                └─ onMounted(activateRem)
                                                   onUnmounted(deactivateRem)
```

**换算公式**（所见即所得的数学保证）：

```text
编译时：X px → X / 82.8 rem        （rootValue = 设计稿宽 / 10）
运行时：1rem = min(屏宽, 540) / 10 px
渲染值 = X / 82.8 × min(屏宽,540) / 10 = X × min(屏宽,540) / 828 px

例：设计稿 200px 卡片 → 写 200px → 编译 2.4155rem
    → 375 屏渲染 200×375/828 = 90.6px（等比缩放 ✓）
    → 540+ 屏渲染 200×540/828 = 130.4px（限宽后按 540 等比 ✓）
```

## 4. 文件清单

### 新增

| # | 路径 | 职责 |
|---|------|------|
| 1 | `build/postcss.ts` | postcss 插件配置单一来源：`H5_DESIGN_WIDTH` / `H5_REM_ROOT_VALUE` / `isH5RemTarget()` / `POSTCSS_PLUGINS` |
| 2 | `build/postcss.spec.ts` | 常量数值断言 + `isH5RemTarget()` Windows（`\`）/ POSIX（`/`）路径命中与不命中用例 + 插件对象形状 |
| 3 | `src/plugins/remAdaptation.ts` | Vue 插件：`install()` 幂等确保 viewport meta；文件头注释说明 fontSize 部分为何不在 install（SPA 多布局共存） |
| 4 | `src/plugins/remAdaptation.spec.ts` | jsdom：无 meta 时创建、已存在时不重复、content 值正确 |
| 5 | `src/layouts/h5/index.vue` | h5 布局壳：BEM(`h5-layout`) 容器 + RouterView + 生命周期驱动 activate/deactivate |
| 6 | `src/layouts/h5/config/rem.ts` | 纯 TS（无 Vue 依赖）：`activateRem()` / `deactivateRem()` / `H5_REM_MAX_WIDTH=540` / `H5_REM_RESIZE_DELAY=300` |
| 7 | `src/layouts/h5/config/rem.spec.ts` | jsdom：fontSize 计算（mock clientWidth 375/540/1024 三档）、限宽居中、deactivate 恢复进入前值、resize 防抖（fake timers）、pageshow persisted、重复 activate 幂等 |
| 8 | `src/modules/h5-demo/` | `pnpm new-module h5-demo` 生成 6 骨架文件后改造（见 §6） |
| 9 | `docs/34-H5布局与rem适配.md` | 使用指南（docs 序号 34 当前空缺，原 34 已迁至 docs/23） |

### 修改

| # | 路径 | 变更点 |
|---|------|--------|
| 1 | `vite.config.ts` | `css.postcss = { plugins: POSTCSS_PLUGINS }`（inline 配置后 vite 不再查找 postcss.config，项目无此文件，无冲突） |
| 2 | `build/index.ts` | barrel 追加 re-export `POSTCSS_PLUGINS` 等 |
| 3 | `src/plugins/index.ts` | 注册 remAdaptation（默认启用，支持 `remAdaptation: false` 关闭） |
| 4 | `src/plugins/errorHandler.d.ts` | `PluginsOptions` 追加 `remAdaptation?: false`（本插件无可配项，仅保留关闭开关） |
| 5 | `src/router/whitelist.ts` | 字面量数组追加 `'H5Demo'`（prod 也可访问，方便部署后真机扫码演示） |
| 6 | `src/modules/h5-demo/routes/index.ts` | 脚手架产物改造：layout 换 `@/layouts/h5/index.vue`，meta 精简（`requiresAuth: false`） |
| 7 | `src/modules/h5-demo/views/Index.vue` | 脚手架产物改造：rem 适配演示页（见 §6） |
| 8 | `CHANGELOG.md` | 顶部新增功能条目（对齐现有格式） |
| 9 | `CLAUDE.md` | §2.1 基线快照表 #6 layouts 职责补 h5；顶部"最近更新"按惯例追加版本段 |
| 10 | `README.md` | §4 Layout 速选加 h5 行（README:394-400 表格） |
| 11 | `package.json` | devDependencies 加 `postcss-pxtorem` + `@types/postcss-pxtorem`（包无内置 d.ts；tsconfig.node.json 的 `types: ["node"]` 不影响显式 import 解析 @types） |

## 5. 单元设计

### 5.1 `build/postcss.ts`（编译时单一来源）

**API 以 v6.1.0 源码实测为准**（README 过时）：defaults 中 `exclude: null`（**不是** README 声称的 `/node_modules/i`），且**不存在 `include` 选项**——传入会被静默忽略导致全量转换。作用域隔离必须用 `exclude` 函数反向判定（源码 `index.js:133` 确认支持 `(filePath) => boolean`）：

```ts
export const H5_DESIGN_WIDTH = 828                    // 设计稿宽度（换 750 稿改这一行）
export const H5_REM_ROOT_VALUE = H5_DESIGN_WIDTH / 10 // 82.8

/** 路径是否属于 h5 rem 转换范围。正则兼容 Windows 反斜杠路径（vite 在 win 下 input.file 为 D:\...\src\...） */
export function isH5RemTarget(filePath: string): boolean {
  return (
    /src[\\/]layouts[\\/]h5[\\/]/.test(filePath) ||
    /src[\\/]modules[\\/]h5-[^\\/]+[\\/]/.test(filePath) // 约定：h5 业务模块以 h5- 前缀命名
  )
}

export const POSTCSS_PLUGINS = [
  pxtorem({
    rootValue: H5_REM_ROOT_VALUE,
    propList: ['*'],      // 源码默认只转 font 系 4 个属性，必须显式全开
    minPixelValue: 2,     // 源码行为：pixels < minPixelValue 不转 → 1px 边框保持物理 1px
    mediaQuery: false,
    // exclude 函数反向判定 = include 语义；filePath 防御 undefined（无来源的内联样式保守不转换）
    exclude: (filePath: string) => !filePath || !isH5RemTarget(filePath),
  }),
]
```

### 5.2 `src/plugins/remAdaptation.ts`（薄插件）

- `install()`: 查 `document.querySelector('meta[name="viewport"]')`，不存在则创建（content 与 index.html 现有值一致）；存在则跳过
- 不做 fontSize 设置——文件头注释写明原因（SPA 多布局共存，全局一次性设置会泄漏到 default/portal 布局；激活/恢复归 h5 layout 生命周期）
- 范式对齐 `webVitals.ts`（default export `{ install }`）

### 5.3 `src/layouts/h5/config/rem.ts`（运行时核心，纯 TS）

- `activateRem()`: 保存进入前 `html.style` 的 fontSize/width/margin 三个值 → 计算 `min(clientWidth, 540)/10` 写 fontSize → 屏宽>540 时写 width/margin 居中 → 挂 resize（防抖 300ms）与 pageshow（`e.persisted` 时重算，bfcache 场景）监听。重复调用幂等（先 deactivate 再 activate）
- `deactivateRem()`: 写回保存的三个值（通常为 ''）、移除监听、清防抖定时器
- 不做 keep-alive 适配（onActivated/onDeactivated）：本项目 keep-alive 只作用于 default layout 内业务页，layout 壳不被缓存——YAGNI，docs/34 注明

### 5.4 `src/layouts/h5/index.vue`（布局壳）

对齐 `blank/index.vue` 的极简形态 + 生命周期两行：

```vue
<script setup lang="ts">
import { activateRem, deactivateRem } from './config/rem'
const bem = createNamespace('h5-layout')
onMounted(activateRem)
onUnmounted(deactivateRem)
</script>

<template>
  <div :class="bem.b()">
    <RouterView />
  </div>
</template>
```

样式：`min-height: 100vh` + h5 容器背景。**自身样式也写 px**（在 include 范围内，同样被转换——layout 即首批消费者）。

### 5.5 边界铁律合规说明

- `layouts/h5/` 自包含：`config/rem.ts` 在布局目录内，符合 §1.2「layouts 自包含」
- 布局不 import `@/components/`、不 import 其他 layouts
- `plugins/remAdaptation.ts` 只依赖 DOM API（符合 §2.1 plugins 职责）
- h5-demo 模块只 import 本模块内部 + 全局自动注入物

## 6. h5-demo 示例模块

流程：`pnpm new-module h5-demo`（§4 #2 强制）→ 改造两个文件：

**routes/index.ts**（改造后）：

```ts
const routes: RouteRecordRaw[] = [
  {
    path: '/h5-demo',
    component: () => import('@/layouts/h5/index.vue'),
    children: [
      {
        path: '',
        name: 'H5Demo',
        component: () => import('../views/Index.vue'),
        meta: { title: 'H5 示例', requiresAuth: false },
      },
    ],
  },
]
```

**views/Index.vue** 演示内容（全部写 px，直观验收转换结果）：

1. 实时信息条：当前 html fontSize 计算值 + 屏宽（onMounted 读取 + resize 监听更新）
2. 卡片：`width: 200px`（828 稿）+ `font-size: 28px/24px/20px` 字号阶梯
3. 1px 边框对照组：`border: 1px solid`（不转换，保持物理 1px）vs `border: 2px solid`（转换为 rem）
4. 限宽演示说明文案（桌面 >540px 打开时居中效果）

store/apis/index.ts 等脚手架骨架保留原样（演示标准模块结构，本示例不发请求）。

## 7. 已知限制（写入 docs/34，消费方必读）

| # | 限制 | 原因 | 应对 |
|---|------|------|------|
| 1 | 内联样式 `:style` / JS 计算的 px 不转换 | postcss 只处理样式表 | 动态尺寸在 JS 侧自行按 `设计稿px × 屏宽/828` 换算，或改用 CSS 变量 |
| 2 | Element Plus 组件样式不缩放 | node_modules 被 exclude，EP 保持 px 原值 | h5 页用原生元素 + BEM（示例页即如此）；EP 复杂组件勿用于 h5 |
| 3 | UnoCSS 原子类（`w-4`/`text-lg` 等）按 16px 基准生成 rem | uno 不经过本 postcss include 且其 rem 基准假设 16px | **h5 模块内禁用 uno rem 原子类**，只写 BEM scss px |
| 4 | 媒体查询参数中的 px 不转换 | `mediaQuery: false` | h5 不需要响应式断点（rem 本身即适配），勿在 h5 写 @media |
| 5 | keyframes 内 px 会被转换 | postcss-pxtorem walkDecls 全量 | 动画尺寸按 rem 缩放通常正是期望行为；个别需豁免的选择器在 `build/postcss.ts` 的 `selectorBlackList` 配置项中追加 |

## 8. 测试策略

| 文件 | 环境 | 用例 |
|------|------|------|
| `build/postcss.spec.ts` | node | rootValue=82.8；`isH5RemTarget` 命中 `src\layouts\h5\index.vue`（win）/ `src/modules/h5-demo/views/Index.vue`（posix）；不命中 `src/modules/user/views/List.vue` / `src/layouts/default/index.vue` / 空字符串；POSTCSS_PLUGINS[0].postcssPlugin === 'postcss-pxtorem' |
| `src/plugins/remAdaptation.spec.ts` | jsdom | 无 meta→创建且 content 正确；已有 meta→不重复创建（数量仍为 1） |
| `src/layouts/h5/config/rem.spec.ts` | jsdom + fake timers | ① mock clientWidth=375 → fontSize='37.5px' ② =1024 → fontSize='54px' 且 width='540px' margin='0 auto' ③ deactivate 恢复进入前值 ④ resize 触发后 300ms 内不重复计算（防抖） ⑤ pageshow persisted=true 重算 ⑥ 重复 activate 幂等 |

jsdom 的 `documentElement.clientWidth` 默认 0，用 `Object.defineProperty` mock。

## 9. 验收清单

- [ ] `pnpm test` 全绿（含 3 个新 spec）
- [ ] `pnpm type-check:full` 通过
- [ ] `pnpm lint` 通过
- [ ] `pnpm check:routes` 通过（H5Demo 在白名单且在实际 routes 中）
- [ ] `pnpm build` 通过且 h5-demo 样式产物为 rem（grep dist css 验证）
- [ ] 浏览器实测（chrome-devtools MCP）：
  - [ ] 375×667 设备模拟访问 `/h5-demo`：卡片渲染宽 ≈ 90.6px（200×375/828）
  - [ ] 桌面 1280 宽访问：页面限 540px 居中，html fontSize=54px
  - [ ] `/h5-demo` → 跳转 `/workbench`：html 内联 fontSize/width/margin 已恢复，后台布局零残留
- [ ] `pnpm dev:local` 下无需登录可直接访问 `/h5-demo`

## 10. 文档同步清单

| 文档 | 同步内容 |
|------|----------|
| `docs/34-H5布局与rem适配.md`（新增） | 使用指南：routes 配置方法、px 写法约定、§7 限制表、h5- 前缀模块命名约定 |
| `CLAUDE.md` | §2.1 基线快照表 #6 layouts 职责补 h5；顶部追加版本变更段 |
| `README.md` | §4 Layout 速选加 h5 行 |
| `docs/07-路由模块设计.md` | §Layout 选择速查加 h5 行 |
| `CHANGELOG.md` | 新功能条目 |

---

## 附录：实施偏差记录（2026-10-14 验收后回填）

实施期发现两处与设计稿的偏差，均以代码事实为准（实现文件头注释有完整根因记录）：

1. **§5.1 exclude 形态**：设计为「exclude 函数反向判定」，实测 postcss-pxtorem v6.1.0 函数形态有源码缺陷（函数返回 false 时 fall through 到 `filePath.match(fn)` 抛 SyntaxError，index.js:135）。实际交付为 `H5_EXCLUDE_REGEX` 负向先行正则（`build/postcss.ts`），`isH5RemTarget()` 保留为独立可测导出。
2. **§5.3 视口宽度读取**：设计为 `documentElement.clientWidth`，实施改为 `window.innerWidth`——clientWidth 在限宽（html.style.width=540px）生效后读到的是元素自身残留宽度，宽屏 resize 回窄屏会算错 fontSize。innerWidth 恒为视口宽，不受 html 内联 width 影响。

验收实测（chrome-devtools MCP）：375 屏 fontSize=37.5px、200px 卡片渲染 90.57px（≈理论 90.58）；1280 屏限 540px 居中（左留白 370px）；h5→/login SPA 内切换后 html 内联 fontSize/width/margin 全部恢复清空。
