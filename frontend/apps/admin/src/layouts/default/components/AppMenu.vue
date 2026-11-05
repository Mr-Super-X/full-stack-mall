<script setup lang="ts">
/**
 * 递归菜单（复刻参考仓 components/Menu，SFC 递归实现替代其 tsx render 函数）。
 *
 * 行为矩阵：
 * - 单子项提升（resolveSingleChild）：仅一个可见子项且未设 alwaysShow 时，
 *   父菜单"提升"为单菜单项（显示子项标题/图标，路径指向子项）——参考仓标志性行为
 * - 外链：path 为 http(s)/ftp URL 时点击新窗口打开
 * - vertical 模式：跟随 appStore.sidebarCollapsed 折叠（仅显示图标，弹层悬浮）
 * - 展开态标题溢出：OverflowText 在文字被 ellipsis 截断时 hover 出完整 tooltip
 *   （栏宽被拖拽手柄改变后长标题场景）
 * - horizontal 模式：用于 top 布局顶栏导航
 * - 激活项：meta.activeMenu 优先，否则当前路由 path
 * - 手风琴：config.ui.uniqueOpened 仅作用于 vertical
 *
 * 递归说明：内层 AppMenu 复用本文件组件（按文件名自引用），el-menu-item /
 * el-sub-menu 通过 element-plus 的 provide/inject 把 select 事件上报给根
 * el-menu，因此只有根实例绑定 @select。
 *
 * 颜色策略：不传 EP 的 background-color/text-color/active-text-color props——EP 会
 * 把它们以内联样式落到每个菜单项，CSS 覆盖只能上 !important（违反规范 §4#13）。
 * 改由容器/弹层分别定义 --el-menu-bg-color 等官方变量驱动（见样式块头注释）
 *
 * @see [`../config/menu.ts`](../config/menu.ts) buildMenuTree / resolveSingleChild
 * @see [`../config/app.ts`](../config/app.ts) uniqueOpened 开关
 * @group 布局：Default
 */
import type { MenuNode } from '../config/types'
import { isUrl, resolveSingleChild } from '../config/menu'
import { defaultLayoutConfig } from '../config/app'
import { useAppStore } from '@vv/shared'
import MenuIcon from './MenuIcon.vue'
import OverflowText from './OverflowText.vue'

const bem = createNamespace('app-menu')

const props = withDefaults(
  defineProps<{
    /** 菜单树（根实例传 buildMenuTree 结果，递归实例传子节点） */
    menuNodes: MenuNode[]
    /** 渲染模式：vertical 侧栏 / horizontal 顶栏 */
    mode?: 'vertical' | 'horizontal'
    /** 内部递归标记：根实例为 false（绑定 select / 渲染滚动容器） */
    isNested?: boolean
  }>(),
  { mode: 'vertical', isNested: false }
)

const appStore = useAppStore()
const route = useRoute()
const { router } = useAppRouter()

/** 折叠仅作用于 vertical 模式 */
const isCollapsed = computed(() => props.mode === 'vertical' && appStore.sidebarCollapsed)

/**
 * 折叠 tooltip 开关：仅根实例生效——折叠态下图标是唯一可见内容，hover 弹
 * tooltip 提示目标页名称；递归实例渲染在 hover 弹层内（展开态、文字完整
 * 可见），不需要 tooltip
 */
const showCollapsedTooltip = computed(() => isCollapsed.value && !props.isNested)

/** 激活菜单项：meta.activeMenu 优先（隐藏详情页高亮其列表页场景） */
const activeMenu = computed(() => {
  const meta = route.meta as { activeMenu?: string }
  return meta.activeMenu || route.path
})

/** 折叠弹层类名（element-plus teleports 到 body，需 BEM 前缀动态拼接） */
const popperClass = computed(() => `${bem.b()}-popper--${props.mode}`)

/** 节点应渲染为"单子项提升"的菜单项（而非父菜单分组） */
function isPromotedItem(node: MenuNode): boolean {
  if (!node.children?.length) return true
  if (node.alwaysShow) return false
  return resolveSingleChild(node).oneShowingChild
}

/** 提升项的渲染目标节点：单子项提升 → 子项；无可见子项 → 自身 */
function promotedNode(node: MenuNode): MenuNode {
  const { onlyChild } = resolveSingleChild(node)
  return onlyChild ?? node
}

function handleSelect(index: string): void {
  if (isUrl(index)) {
    window.open(index, '_blank', 'noopener,noreferrer')
  } else {
    router.push(index)
  }
}
</script>

<template>
  <!-- 根实例：包滚动容器（vertical）并绑定 select -->
  <nav v-if="!isNested" :class="[bem.b(), bem.m(mode), bem.is('collapsed', isCollapsed)]">
    <el-scrollbar v-if="mode === 'vertical'" :class="bem.e('scroll')">
      <el-menu
        :default-active="activeMenu"
        :mode="mode"
        :collapse="isCollapsed"
        :unique-opened="defaultLayoutConfig.ui.uniqueOpened"
        :popper-class="popperClass"
        @select="handleSelect"
      >
        <template v-for="node in menuNodes" :key="node.path">
          <!-- 单子项提升 / 叶子节点：直接菜单项 -->
          <el-menu-item v-if="isPromotedItem(node)" :index="promotedNode(node).path">
            <!-- 折叠态 tooltip：图标为唯一可见内容，hover 提示目标页名称（标题与
                 展开态文字同源，随 locale 切换自动更新）；此分支不渲染标题 span——
                 EP collapse 样式本就把直接子 span 隐藏（0×0 + visibility:hidden） -->
            <el-tooltip
              v-if="showCollapsedTooltip && promotedNode(node).icon"
              :content="promotedNode(node).title"
              placement="right"
              :show-after="300"
            >
              <MenuIcon :name="promotedNode(node).icon" />
            </el-tooltip>
            <template v-else>
              <MenuIcon v-if="promotedNode(node).icon" :name="promotedNode(node).icon" />
              <OverflowText :text="promotedNode(node).title" />
            </template>
          </el-menu-item>

          <!-- 父菜单分组 -->
          <!-- el-sub-menu :index 的 as any：EP 2.14 + TS6 已知 prop 类型 bug，非业务逻辑 -->
          <el-sub-menu v-else :index="node.path as any" teleported :popper-class="popperClass">
            <template #title>
              <MenuIcon v-if="node.icon" :name="node.icon" />
              <OverflowText :text="node.title" />
            </template>
            <AppMenu :menu-nodes="node.children ?? []" :mode="mode" is-nested />
          </el-sub-menu>
        </template>
      </el-menu>
    </el-scrollbar>

    <el-menu
      v-else
      :default-active="activeMenu"
      mode="horizontal"
      :popper-class="popperClass"
      @select="handleSelect"
    >
      <template v-for="node in menuNodes" :key="node.path">
        <el-menu-item v-if="isPromotedItem(node)" :index="promotedNode(node).path">
          <MenuIcon v-if="promotedNode(node).icon" :name="promotedNode(node).icon" />
          <OverflowText :text="promotedNode(node).title" />
        </el-menu-item>
        <!-- as any 原因同上（EP 2.14 + TS6 prop 类型 bug） -->
        <el-sub-menu v-else :index="node.path as any" teleported :popper-class="popperClass">
          <template #title>
            <MenuIcon v-if="node.icon" :name="node.icon" />
            <OverflowText :text="node.title" />
          </template>
          <AppMenu :menu-nodes="node.children ?? []" :mode="mode" is-nested />
        </el-sub-menu>
      </template>
    </el-menu>
  </nav>

  <!-- 递归实例：只渲染节点列表，select 由根 el-menu 统一处理 -->
  <template v-else>
    <template v-for="node in menuNodes" :key="node.path">
      <el-menu-item v-if="isPromotedItem(node)" :index="promotedNode(node).path">
        <MenuIcon v-if="promotedNode(node).icon" :name="promotedNode(node).icon" />
        <OverflowText :text="promotedNode(node).title" />
      </el-menu-item>
      <!-- as any 原因同上（EP 2.14 + TS6 prop 类型 bug） -->
      <el-sub-menu v-else :index="node.path as any" teleported :popper-class="popperClass">
        <template #title>
          <MenuIcon v-if="node.icon" :name="node.icon" />
          <OverflowText :text="node.title" />
        </template>
        <AppMenu :menu-nodes="node.children ?? []" :mode="mode" is-nested />
      </el-sub-menu>
    </template>
  </template>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-app-menu {
  // 菜单颜色走 EP 官方 CSS 变量通道——不传 background-color/text-color/active-text-color
  // props：EP 会把这些 props 以内联样式落到每个菜单项上，CSS 侧覆盖只能上 !important
  // （违反项目规范 §4#13）。变量在容器与弹层分别定义（弹层 teleport 到 body，继承不到
  // 容器作用域），菜单项基色/激活色交给 EP 默认规则按变量渲染
  --el-menu-bg-color: var(--left-menu-bg-color);
  --el-menu-text-color: var(--left-menu-text-color);
  --el-menu-active-color: var(--left-menu-text-active-color);

  height: 100%;
  overflow: hidden;
  background: var(--left-menu-bg-color);
  flex: none;
  transition: width var(--transition-time-02);

  &__scroll {
    height: 100%;
  }

  // 展开宽度跟随父容器（aside 宽度可被拖拽手柄改变，见 ../config/resize.ts），
  // 折叠宽度仍为固定 token（折叠是预设档位，无需跟随）
  &--vertical:not(.is-collapsed) {
    width: 100%;
  }
  &--vertical.is-collapsed {
    width: var(--left-menu-min-width);
  }
  &--horizontal {
    flex: 1;
    min-width: 0;
    background: transparent;
  }

  // 非 scoped 样式下 :deep() 不会被编译、整条规则被浏览器丢弃——直接写后代选择器
  .el-menu {
    width: 100%;
    padding: 8px 0;
    border: none;

    .el-sub-menu__title,
    .el-menu-item {
      width: calc(100% - 20px);
      height: 44px;
      margin: 3px 10px;
      line-height: 44px;
      border-radius: 10px;
      transition:
        color 160ms ease,
        background-color 160ms ease;
    }

    // 激活态：文字色由 --el-menu-active-color 变量驱动（EP 默认规则），这里补主题色背景；
    // 特异性（0-4-0）高于 EP .el-menu-item.is-active（0-2-0），无须 !important
    .el-menu-item.is-active {
      font-weight: 600;
      background-color: var(--left-menu-bg-active-color);
    }

    // 子菜单父标题激活时同步高亮文字
    .is-active > .el-sub-menu__title {
      color: var(--left-menu-text-active-color);
    }

    // 箭头图标固定 1em 宽，避免不同图标字体下错位（对齐参考仓）
    .el-sub-menu__icon-arrow {
      width: 1em;
    }

    .el-sub-menu__title,
    .el-menu-item {
      &:hover {
        color: var(--left-menu-text-active-color);
        background-color: var(--left-menu-bg-active-color);
      }
    }

    // 内嵌子菜单（未 teleported 的二级及以下）：纵向间隙布局 + 浅底区分层级
    // （底色曾需 !important 压 EP 内联背景——颜色改走变量通道后内联样式消失，平权即可）
    .el-menu--inline {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 6px 0 0;
      background-color: var(--left-menu-bg-light-color);

      > .el-sub-menu {
        display: flex;
        flex-direction: column;
      }

      .el-menu-item {
        margin-top: 0;
        margin-bottom: 0;
      }
    }
  }

  // 折叠态：图标居中
  .el-menu--collapse {
    width: var(--left-menu-min-width);

    > .el-menu-item,
    > .el-sub-menu > .el-sub-menu__title {
      justify-content: center;
      width: 48px;
      padding: 0;
      margin-right: 12px;
      margin-left: 12px;
    }

    // 折叠态图标固定 22px（对齐参考仓 .v-icon 22px）
    .el-icon {
      flex: none;
      width: 22px;
      height: 22px;
    }
  }

  // vertical 模式：图标与标题间距 0px（horizontal 模式由 EP 默认处理）
  &--vertical {
    .el-menu > .el-sub-menu > .el-sub-menu__title {
      margin-top: 0;
      margin-bottom: 0;
    }

    .el-menu--vertical > .el-sub-menu {
      margin: 3px 0;
    }

    .el-sub-menu__title,
    .el-menu-item {
      gap: 0px;
    }

    .el-menu--collapse {
      > .el-menu-item,
      > .el-sub-menu > .el-sub-menu__title {
        gap: 0;
      }
    }
  }

  // 水平模式（top 布局顶栏）：颜色同走 EP 变量通道（顶栏配色与侧栏不同，覆盖变量值）
  &--horizontal {
    --el-menu-bg-color: transparent;
    --el-menu-text-color: var(--top-header-text-color);
    --el-menu-active-color: var(--el-color-primary);

    .el-menu--horizontal {
      display: flex;
      gap: 4px;
      align-items: center;
      height: var(--top-tool-height);
      padding: 0 12px;
      background: transparent;

      > .el-menu-item,
      > .el-sub-menu .el-sub-menu__title {
        width: auto;
        height: 38px;
        padding: 0 15px;
        margin: 0;
        line-height: 38px;
        // border: 0 同时压制 EP 水平激活态的 2px 底部指示条——本规则特异性
        // （0-4-0）高于 EP .el-menu--horizontal > .el-menu-item.is-active（0-3-0）
        border: 0;
        border-radius: 10px;

        &:hover {
          color: var(--el-color-primary);
          background: var(--top-header-hover-color);
        }
      }

      > .el-menu-item.is-active,
      > .el-sub-menu.is-active .el-sub-menu__title {
        font-weight: 600;
        color: var(--el-color-primary);
        background: var(--el-color-primary-light-9);
      }

      // EP 水平箭头绝对定位于标题右侧（实测 right:20px、宽 12px，占用右侧 20-32px
      // 区域），右内边距必须盖住箭头——沿用 15px 会让标题文案伸进箭头下方叠压
      // （2026-09-10 top 布局工作台多级菜单实测）
      > .el-sub-menu .el-sub-menu__title {
        padding-right: 34px;
      }
    }
  }
}

// ─── 折叠弹层（element-plus teleports 到 body，全局样式）────────────
// 类名由 `${bem.b()}-popper--${mode}` 动态拼接（见组件 popperClass 计算属性）。
// 颜色走 EP 变量通道（弹层继承不到容器作用域的变量，在此重定义一次）。
// 选择器带 .el-popper 前缀：把特异性提到 0-2-0 压过 EP .el-popper.is-light 的默认
// 边框/阴影（等特异性靠源码顺序决胜——组件样式注入晚于 EP），项目规范 §4#13 禁用 !important
.el-popper.#{$BEM_PREFIX}-app-menu-popper--vertical {
  --el-menu-bg-color: var(--left-menu-bg-color);
  --el-menu-text-color: var(--left-menu-text-color);
  --el-menu-active-color: var(--left-menu-text-active-color);

  // 子项极多时（demo 模块 60+ 页）弹层会超出视口——限高 + 内部滚动。
  // 限高与水平弹层同一偏移（100vh - 300px，用户方 2026-09-10 定值）：
  // 原 100vh - 20px 实测弹层 933px 近全屏，折叠态悬停菜单过高（用户反馈）
  max-height: calc(100vh - 300px);
  overflow-y: auto;
  border: 1px solid var(--layout-border-color);
  border-radius: 12px;
  box-shadow: var(--layout-shadow);

  .el-menu {
    padding: 6px;
  }

  .el-sub-menu__title,
  .el-menu-item {
    height: 40px;
    margin: 2px 0;
    line-height: 40px;
    border-radius: 8px;

    &:hover {
      color: var(--left-menu-text-active-color);
      background-color: var(--left-menu-bg-active-color);
    }
  }

  .el-menu-item.is-active {
    background-color: var(--left-menu-bg-active-color);
  }
}

// horizontal 弹层：EP 把 popper-class 同时复制到外层 el-popper 与内层
// .el-menu--popup-container，变量挂类名两处都生效；滚动只挂内层容器（外层同限高会出
// 双层滚动条）。颜色变量与 vertical 弹层同一套 EP 变量通道，不落地内联样式
.#{$BEM_PREFIX}-app-menu-popper--horizontal {
  --el-menu-bg-color: var(--top-header-bg-color);
  --el-menu-text-color: var(--top-header-text-color);
  --el-menu-active-color: var(--el-color-primary);

  // teleport 到 body 取不到容器作用域的紫色主色（见 default-tokens.scss 作用域分层说明），
  // 因该类名为 default 布局专属，在此局部定义 EP 主色变量（暗色覆盖见文件底部；
  // 值与 default-layout-ep-light 莫兰迪紫灯阶保持同步，2026-11-04 随亮色莫兰迪化更新）
  --el-color-primary: #6a6180;
  --el-color-primary-light-9: #ece9f4;

  &.el-menu--popup-container {
    // 子项极多时（demo 模块 60+ 页，实测弹层 2334px）会超出视口撑出 body 滚动条——
    // 限高 + 内部滚动，与 vertical 弹层同一策略（2026-09-10 top 布局实测修复）
    max-height: calc(100vh - 300px);
    overflow-x: hidden;
    overflow-y: auto;
  }

  .el-menu {
    min-width: 180px;
    padding: 6px;
  }

  .el-sub-menu__title,
  .el-menu-item {
    height: 40px;
    margin: 2px 0;
    line-height: 40px;
    border-radius: 8px;

    &:hover {
      color: var(--el-color-primary);
      background-color: var(--top-header-hover-color);
    }
  }

  .el-menu-item.is-active {
    font-weight: 600;
    background-color: var(--el-color-primary-light-9);
  }
}

// 边框三件套带 .el-popper 前缀挂外层（0-2-0 压过 EP .el-popper.is-light 默认边框/阴影，
// 等特异性靠源码顺序决胜——组件样式注入晚于 EP）
.el-popper.#{$BEM_PREFIX}-app-menu-popper--horizontal {
  border: 1px solid var(--layout-border-color);
  border-radius: 12px;
  box-shadow: var(--layout-shadow);
}

// 暗色：水平弹层局部 EP 变量（与 theme store 的 data-theme 机制对齐）。
// 色值与 default-tokens.scss default-layout-ep-dark 单一事实源保持一致
// （2026-11-03 暗色改雾霾蓝时此处硬编码遗漏致漂移，已同步；改 mixin 时须同步此处）。
[data-theme='dark'] .#{$BEM_PREFIX}-app-menu-popper--horizontal {
  --el-color-primary: #8fa6bc;
  --el-color-primary-light-9: #2b343d;
}

// 跟随系统：仅当用户未显式设置 data-theme
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) .#{$BEM_PREFIX}-app-menu-popper--horizontal {
    --el-color-primary: #8fa6bc;
    --el-color-primary-light-9: #2b343d;
  }
}
</style>
