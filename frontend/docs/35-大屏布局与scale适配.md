# 大屏布局与 scale 适配使用指南

> 适用：数据大屏 / 拼接屏页面开发。routes 挂 big layout 即获得 scale 等比缩放能力，样式直接写设计稿 px。
> 决策记录（transform scale / meta 契约 / BigChart 自治的根因）见 [docs/38-big-scale适配决策记录.md](38-big-scale适配决策记录.md)。
>
> 与 h5 rem 适配（docs/34）同为「编译时/运行时双层」思路的大屏变体——但 big 走 **transform: scale 容器缩放**，不改 html fontSize、不经 postcss 转换，比 h5 更干净（零全局残留风险）。

## 1. 快速上手

```ts
// apps/big/src/modules/big-xxx/routes/index.ts
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/big-xxx',
    component: () => import('@/layouts/big/index.vue'), // ← 获得大屏 scale 能力
    children: [
      {
        path: '',
        name: 'BigXxx',
        component: () => import('../views/index.vue'),
        // 大屏典型场景需要免登录（演示厅直接打开）：meta 声明 + 白名单注册双管齐下
        meta: { title: '大屏标题', requiresAuth: false },
      },
    ],
  },
]

export default routes
```

> **免登录提示**：`requiresAuth: false` 只是宽松标记，真正放行需在 `apps/big/src/router/whitelist.ts`
> 的 `createWhiteList('NotFound', bigDemoRouteNames)` 调用中并入新模块的 `routeNames`（从 `@/modules/big-xxx/routes` 导出）。参照 big-demo 模块的写法。

```vue
<script setup lang="ts">
// 视图内组件注意：模块内组件不在 unplugin-vue-components 全局注册范围
// （仅 components/common|ProTable|form-schema 三目录），必须显式 import
import PanelBox from '../components/PanelBox.vue'

const bem = createNamespace('big-xxx')
</script>

<style lang="scss">
// big 范围内样式直接写设计稿 px（默认 1920×1080），无任何编译转换，scale 容器统一缩放
.#{$BEM_PREFIX}-big-xxx {
  width: 1920px;
  height: 1080px;
}
</style>
```

## 2. 适配原理

| 阶段   | 规则                                                             | 位置                                       |
| ------ | ---------------------------------------------------------------- | ------------------------------------------ |
| 编译时 | **无转换**——px 原样输出（big 目录不在 postcss-pxtorem 范围）     | —                                          |
| 运行时 | `scale = min(vw/dw, vh/dh)`，容器 `translate(居中偏移) scale(s)` | `apps/big/src/layouts/big/config/scale.ts` |

各视口效果（默认 1920×1080 设计稿）：

| 视口      | scale | 效果                       |
| --------- | ----- | -------------------------- |
| 1920×1080 | 1     | 恰好铺满                   |
| 2560×1440 | 1.333 | 等比放大铺满               |
| 3840×2160 | 2     | 等比放大铺满（4K）         |
| 9000×1080 | 1     | 高度撑满，两侧深色留白居中 |

### 与 h5 rem 的对照

| 维度       | h5（rem）                        | big（scale）                              |
| ---------- | -------------------------------- | ----------------------------------------- |
| 作用对象   | 全局 html fontSize（需快照恢复） | layout 自有容器 div（销毁即清理）         |
| 编译转换   | postcss-pxtorem（h5 前缀目录）   | 无                                        |
| 超宽策略   | 限宽 540px 居中                  | 等比缩放居中留白                          |
| 图表清晰度 | 容器真实尺寸，天然清晰           | BigChart 用 `devicePixelRatio×scale` 补偿 |
| 弹层       | 正常                             | teleport 弹层不随缩放（见 §4 限制）       |

### 设计稿尺寸契约（meta.bigScreen）

默认设计稿 1920×1080。超宽/异形屏页面通过路由 meta 声明自己的设计稿尺寸：

```ts
{
  path: 'wide',
  name: 'BigDemoWide',
  component: () => import('../views/Wide.vue'),
  meta: {
    title: '超宽拼接大屏',
    requiresAuth: false,
    bigScreen: { width: 9000, height: 1080 }, // ← 本页设计稿 9000×1080
  },
}
```

- 同 layout 内跳转（1920 页 ↔ 9000 页）时 layout `watch(() => route.meta.bigScreen)` 立即重算（不防抖，避免中间态闪烁）
- `meta.bigScreen` 非法（非正数/非数字/NaN/Infinity）一律回退 1920×1080（`resolveBigScreenSize` 类型守卫）
- **开发体验**：9000×1080 页在普通 1920 显示器上 scale≈0.21 整体缩小预览，开发调试无需真拼接屏

## 3. 编写约束（必读）

1. **样式写死设计稿 px**，不写 rem/vw/% 自适应——scale 容器统一缩放，响应式是画蛇添足
2. **视图根节点宽高写死设计稿尺寸**（如 `width: 1920px; height: 1080px`）
3. **模块内组件必须显式 import**（big-demo/components 不在全局注册 dirs）
4. **图表用模块内 `BigChart`**（不用公共 BaseChart——它需要 `devicePixelRatio×scale` 初始化补偿，属模块自治关注点）；BigChart 依赖父链确定高度（flex grow / grid 行 / 固定 height）
5. **PanelBox 高度契约**：组件根不写 `height:100%`（flex item 下 basis:auto 时 100% 会劫持为父容器全高导致塌陷）；消费侧用 flex grow 比例提供高度
6. **BEM 无 scoped scss**（§3 规范），穿透第三方组件直接写后代选择器
7. **背景图实践**（来自 Vue2 大屏 mixin 流派的实战经验）：若设计师给了整屏背景图，容器底色取**背景图最边缘颜色**、图片 `background-size: cover` 铺满——cover 裁切产生的缝隙与底色无缝衔接，比例不符的留白区不突兀
8. **拼接屏字号系数**：超宽/远距离观看页（如 9000 稿拼接屏，观看距离 5~15 米）字号按 1920 稿 **×1.5~1.8** 取——1:1 物理显示下 1920 稿字号在远距不可读（Wide.vue 字号尺度注释即先例）；标准 1920 近距离屏保持 1:1
9. **KPI 指标卡三态**：KpiCard 的 trend 支持升/降/平三态配色，数值实时抖动演示走 `jitterValue` 基准抖动（±5% 围绕基准值，非当前值复利）——长跑不漂移

## 4. 已知限制（必读）

1. **teleport 弹层组件不随缩放**：ElSelect 下拉、ElTooltip、ElMessageBox 等 teleport 到 body 的浮层不在 scale 容器内，位置/尺寸失真——大屏页交互控件用内联形态（按钮/开关/滑块）
2. **fixed 定位陷阱**：stage 容器带 transform 后成为后代 `position: fixed` 元素的 containing block（fixed 不再相对视口）——悬浮元素请用 absolute 相对 stage 定位
3. **跨 DPR 显示器拖动**：窗口拖到不同 devicePixelRatio 的显示器且逻辑视口不变时，BigChart 的 dpr 补偿过期（轻微模糊）；浏览器缩放会连带改变 innerWidth 触发重建，已覆盖
4. **echarts 地图注册残留**：`echarts.registerMap` 无 unregister API，wide 页卸载后注册表残留属可接受设计（一次性 159KB 常驻），勿误判内存泄漏
5. **big layout 不进 keep-alive**（项目 keep-alive 只作用于 default 内业务页，与 h5 同策略）

## 5. 新增大屏页面接入步骤

1. `pnpm new-module big-xxx` 生成骨架
2. routes/index.ts：父路由挂 `@/layouts/big/index.vue`，children 声明页面（异形尺寸加 `meta.bigScreen`）
3. `apps/big/src/router/whitelist.ts` 的 `createWhiteList` 调用中并入新模块 `routeNames`（需免登录时）
4. 视图按 §3 约束编写（写死设计稿 px、显式 import 模块组件）
5. `pnpm check:routes` 校验一致性
6. （推荐）照抄五态实践：`/big-demo/state-demo` 集中示范异步数据在大屏场景的五种形态（成功/加载中/错误/空/断连，每态附设计要点）；Wide 页地图区是真实异步加载场景（GeoJSON 二级 chunk，页面壳先渲染、地图区就地呈现加载/失败态）

## 6. 验证记录（2026-10-15 chrome-devtools 实测）

| 视口      | 页面             | 实测 scale | 结果                                               |
| --------- | ---------------- | ---------- | -------------------------------------------------- |
| 1758×964  | /big-demo        | 0.893      | 高度瓶颈 + 居中偏移正确（非精确视口验证 min 算法） |
| 2560×1440 | /big-demo        | 1.333      | 铺满，文字矢量清晰                                 |
| 3840×2160 | /big-demo        | 2          | 铺满，图表 dpr 补偿后清晰                          |
| 9000×1080 | /big-demo        | 1          | offsetX=3540 精确居中，两侧留白                    |
| 9000×1080 | /big-demo/wide   | 1          | 9000 设计稿铺满，五面板零溢出                      |
| 1920×1080 | /big-demo/wide   | 0.213      | 整体缩小预览居中（开发红利）                       |
| wide↔标准 | 同 layout 跳转   | —          | meta watch 立即重算，无中间态                      |
| 回归      | /h5-demo、/login | —          | h5 rem 正常（54px/540px 限宽），html 内联零残留    |

> 注：本表为 2026-10-15（Monorepo 迁移前）单应用时代历史快照——`/h5-demo` 现属 apps/h5、`/login` 现属 apps/auth，回归语义以迁移后六 app 实测为准。

console 全程零 error/warn；生产构建 Wide chunk 独立（GeoJSON 不拖累 1920 页）。

## 7. 相关文件索引

| 文件                                                       | 职责                                         |
| ---------------------------------------------------------- | -------------------------------------------- |
| `apps/big/src/layouts/big/index.vue`                       | 纯壳布局（fixed 容器 + stage + provide）     |
| `apps/big/src/layouts/big/config/scale.ts`                 | scale 纯计算 + meta 守卫 + inject 契约       |
| `apps/big/src/layouts/big/config/scale.spec.ts`            | 18 用例（四视口/非法 meta/防御回退）         |
| `apps/big/src/modules/big-demo/views/index.vue`            | 1920 标准大屏                                |
| `apps/big/src/modules/big-demo/views/Wide.vue`             | 9000 超宽拼接屏                              |
| `apps/big/src/modules/big-demo/views/StateDemo.vue`        | 异步数据五态实践页（成功/加载/错误/空/断连） |
| `apps/big/src/modules/big-demo/components/BigChart.vue`    | ECharts 薄封装（dpr×scale 防模糊）           |
| `apps/big/src/modules/big-demo/components/PanelBox.vue`    | 四角装饰面板（高度契约见文件头）             |
| `apps/big/src/modules/big-demo/components/KpiCard.vue`     | 指标卡（trend 三态）                         |
| `apps/big/src/modules/big-demo/components/RankingList.vue` | 排名列表（1920 稿尺度）                      |
| `apps/big/src/modules/big-demo/components/SwitchGroup.vue` | 联动开关组（9000 页）                        |
| `apps/big/src/modules/big-demo/composables/useClock.ts`    | 实时时钟（onScopeDispose，带 spec）          |
| `apps/big/src/modules/big-demo/config/charts.ts`           | 1920 页三个图表 option                       |
| `apps/big/src/modules/big-demo/config/china-map.ts`        | 地图 option + GeoJSON 注册（独立 chunk）     |
| `apps/big/src/modules/big-demo/apis/index.ts`              | 静态 mock 数据层 + jitterValue 数值抖动      |
| `apps/big/src/modules/big-demo/store/index.ts`             | 模块私有 store（useBigDemoStore 草稿态）     |
