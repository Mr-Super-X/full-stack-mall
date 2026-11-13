<script setup lang="ts">
/**
 * Default 布局外壳（复刻 vue-element-plus-admin 的 Layout.vue，四模式）。
 *
 * 模式矩阵（跟随 appStore.layout，移动端一律强制 sidebar + 抽屉）：
 * - sidebar：左栏（Logo + 全量菜单）+ 顶栏工具条 + 页签 + 内容
 * - top：顶栏（Logo + 横向菜单 + 工具条）+ 页签 + 内容
 * - mixed：顶栏（Logo + 主导航 + 工具条）+ 二级侧栏（当前模块子菜单）+ 内容
 * - dual：左 rail（compact Logo + 主导航竖排）+ 二级侧栏 + 顶栏工具条 + 页签 + 内容
 *
 * 菜单数据源：buildMenuTree(router) 从 router.getRoutes() 派生（见 config/menu.ts），
 * mixed/dual 的二级菜单 = 当前激活顶层模块的 children。
 *
 * 移动端（≤767px，appStore.mobile）：侧栏变 fixed 抽屉 + 遮罩，点遮罩收起。
 *
 * @see [`./components/ToolHeader.vue`](./components/ToolHeader.vue) 顶栏工具条
 * @see [`./components/AppMenu.vue`](./components/AppMenu.vue) 递归菜单
 * @see [`./components/PrimaryNav.vue`](./components/PrimaryNav.vue) 主导航
 * @see [`./components/TagsView.vue`](./components/TagsView.vue) 多页签
 * @see [`./config/menu.ts`](./config/menu.ts) 菜单树派生
 * @see `@vv/shared` store/modules/app —— layout / sidebarCollapsed / mobile
 * @group 布局
 */
import { useAppStore } from '@vv/shared'
import { useI18n } from 'vue-i18n'
import { useMenuResizing } from './config/useMenuResizing'
import { useMenuTree } from './config/useMenuTree'
import Logo from './components/Logo.vue'
import AppMenu from './components/AppMenu.vue'
import PrimaryNav from './components/PrimaryNav.vue'
import ToolHeader from './components/ToolHeader.vue'
import TagsView from './components/TagsView.vue'
import AppView from './components/AppView.vue'
import SidebarResizer from './components/SidebarResizer.vue'

const bem = createNamespace('default-layout')

const appStore = useAppStore()
const { t } = useI18n()

/** 菜单树派生与主导航跳转（四模式菜单数据源，@see ./config/useMenuTree） */
const { menuTree, activePrimary, secondaryNodes, selectPrimary } = useMenuTree()

/** 侧栏拖拽调宽状态与派生样式（主栏 + 二级侧栏，@see ./config/useMenuResizing） */
const {
  sidebarLiveWidth,
  secondaryLiveWidth,
  sidebarWidthPx,
  secondaryWidthPx,
  sidebarAsideStyle,
  secondaryAsideStyle,
} = useMenuResizing()

/** 移动端强制 sidebar 抽屉模式 */
const layout = computed(() => (appStore.mobile ? 'sidebar' : appStore.layout))

/** Backtop 目标滚动容器类名（动态拼接 BEM，避免硬编码前缀） */
const backtopTarget = computed(() => `.${bem.e('scroll')}`)

/** 移动端点遮罩收起抽屉 */
function closeMobileMenu() {
  appStore.sidebarCollapsed = true
}

/**
 * 页签刷新机制（provide 必须上提到本布局壳）：
 * TagsView（命令发起方）与 AppView（key 消费方）是 <main> 下的平级兄弟，
 * 由 AppView provide 时 TagsView inject 不到（控制台告警 + 刷新静默失效），
 * 故 refresh 句柄与 key 都从布局壳注入，AppView / TagsView 各自 inject。
 * @see [`./components/AppView.vue`](./components/AppView.vue) key 消费方
 * @see [`./components/TagsView.vue`](./components/TagsView.vue) 命令发起方
 */
const refreshKey = ref(0)
function refreshCurrentView() {
  refreshKey.value++
}
provide('default-layout-refresh', refreshCurrentView)
provide('default-layout-refresh-key', refreshKey)

/**
 * 布局激活期间在 <html> 标记 data-layout="default"——teleport 到 body 的 EP 弹层
 * （下拉/对话框/消息等）不在容器内，靠该属性命中 element-overwrite.scss 的变量映射，
 * 与布局本体共用同一套紫色主题（@see ./styles/element-overwrite.scss）。
 * 卸载时仅清除自己写入的值，避免误伤其他布局的标记。
 */
function applyLayoutScope() {
  document.documentElement.setAttribute('data-layout', 'default')
}

function clearLayoutScope() {
  if (document.documentElement.getAttribute('data-layout') === 'default') {
    document.documentElement.removeAttribute('data-layout')
  }
}

onMounted(applyLayoutScope)
onUnmounted(clearLayoutScope)
</script>

<template>
  <section :class="[bem.b(), bem.m(layout)]">
    <!-- top / mixed 模式顶栏 -->
    <header v-if="layout === 'top' || layout === 'mixed'" :class="bem.e('topbar')">
      <Logo />
      <AppMenu v-if="layout === 'top'" :menu-nodes="menuTree" mode="horizontal" />
      <PrimaryNav
        v-else
        :nodes="menuTree"
        :active-path="activePrimary?.path"
        mode="top"
        @select="selectPrimary"
      />
      <ToolHeader
        :show-collapse="layout === 'mixed'"
        :show-breadcrumb="false"
        :class="bem.e('top-tools')"
      />
    </header>

    <div :class="bem.e('body')">
      <!-- sidebar 模式左栏 -->
      <aside
        v-if="layout === 'sidebar'"
        :class="[
          bem.e('sidebar'),
          bem.is('collapsed', appStore.sidebarCollapsed),
          bem.is('mobile', appStore.mobile),
          bem.is('resizing', sidebarLiveWidth !== null),
        ]"
        :style="sidebarAsideStyle"
      >
        <Logo />
        <AppMenu :menu-nodes="menuTree" />
        <SidebarResizer
          v-if="!appStore.mobile && !appStore.sidebarCollapsed"
          v-model="sidebarLiveWidth"
          :base="sidebarWidthPx"
          @commit="appStore.sidebarWidth = $event"
        />
      </aside>

      <!-- dual 模式一级 rail -->
      <aside v-if="layout === 'dual'" :class="bem.e('rail')">
        <Logo compact />
        <el-scrollbar>
          <PrimaryNav
            :nodes="menuTree"
            :active-path="activePrimary?.path"
            mode="rail"
            @select="selectPrimary"
          />
        </el-scrollbar>
      </aside>

      <!-- mixed / dual 模式二级侧栏 -->
      <aside
        v-if="layout === 'mixed' || layout === 'dual'"
        :class="[
          bem.e('secondary'),
          bem.is('collapsed', appStore.sidebarCollapsed),
          bem.is('resizing', secondaryLiveWidth !== null),
        ]"
        :style="secondaryAsideStyle"
      >
        <div v-if="!appStore.sidebarCollapsed" :class="bem.e('secondary-title')">
          {{ activePrimary?.title ?? '' }}
        </div>
        <AppMenu :menu-nodes="secondaryNodes" />
        <SidebarResizer
          v-if="!appStore.mobile && !appStore.sidebarCollapsed"
          v-model="secondaryLiveWidth"
          :base="secondaryWidthPx"
          @commit="appStore.secondaryWidth = $event"
        />
      </aside>

      <main :class="bem.e('workspace')">
        <ToolHeader v-if="layout === 'sidebar' || layout === 'dual'" :class="bem.e('toolbar')" />
        <TagsView :class="bem.e('tags')" />
        <div v-loading="appStore.globalLoading" :class="bem.e('scroll')">
          <AppView />
          <el-backtop :target="backtopTarget" :right="20" :bottom="20" />
        </div>
      </main>
    </div>

    <!-- 移动端抽屉遮罩 -->
    <button
      v-if="appStore.mobile && !appStore.sidebarCollapsed"
      :class="bem.e('mask')"
      type="button"
      :aria-label="t('header.closeMenu')"
      @click="closeMobileMenu"
    ></button>
  </section>
</template>

<style lang="scss">
// 非 scoped：default-tokens 的 CSS 变量 + 折叠弹层需对子组件/teleport 节点可见
@use './styles/default-tokens.scss' as *;
// EP 弹层变量映射（html[data-layout='default'] 选择器，需在 tokens 之后加载以复用其 mixin）
@use './styles/element-overwrite.scss';

.#{$BEM_PREFIX}-default-layout {
  display: flex;
  flex-direction: column;
  width: 100%;
  // 不用 height: 100%：App.vue 的 ErrorBoundary / AsyncState 包装层（block + auto 高）
  // 截断了 #app → 布局的百分比高度链，100% 会退化为内容高度，整页随 body 滚动。
  // 布局是路由级全屏基座，直接锚定视口高度；100dvh 规避移动端地址栏收缩。
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background: var(--app-content-bg-color);

  // EP 变量覆盖限定在 default 布局容器（亮色紫主色 + slate 文字 / 暗色莫兰迪雾霾蓝），不污染全局主题。
  // 选择器需与 theme store 的 data-theme 机制对齐：显式 dark + auto 跟随系统。
  @include default-layout-ep-light;

  // ─── 顶栏（top / mixed 模式）────────────────────────
  &__topbar {
    z-index: 20;
    display: flex;
    align-items: center;
    height: var(--top-tool-height);
    // 毛玻璃：底色 94% 不透明 + 16px 背景模糊，滚动内容从顶栏下透出（参考仓标志性质感）
    background: color-mix(in srgb, var(--top-header-bg-color) 94%, transparent);
    border-bottom: 1px solid var(--layout-border-color);
    box-shadow: var(--layout-shadow);
    backdrop-filter: blur(16px);
    flex: none;

    // top 模式横向菜单占满顶栏中段
    .#{$BEM_PREFIX}-app-logo {
      min-width: var(--left-menu-max-width);
    }
  }

  &__top-tools {
    height: 100%;
    padding-left: 6px;
    margin-left: auto;
    border-left: 1px solid var(--layout-border-color);
    flex: none;
  }

  // ─── 主体（侧栏 + 工作区）───────────────────────────
  &__body {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  &__sidebar,
  &__secondary,
  &__rail {
    z-index: 30;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
    background: var(--left-menu-bg-color);
    border-right: 1px solid var(--layout-border-color);
    transition:
      width var(--transition-time-02),
      transform var(--transition-time-02);
    flex: none;

    // 拖拽调宽期间禁用过渡（否则 width 动画造成橡皮筋滞后）；
    // 仅 sidebar/secondary 会绑 is-resizing（手柄 v-if 在折叠/移动端不渲染）
    &.is-resizing {
      transition: none;
    }
  }

  // sidebar 模式左栏（position: relative 为拖拽手柄提供定位上下文）
  &__sidebar {
    position: relative;
    width: var(--left-menu-max-width);

    &.is-collapsed {
      width: var(--left-menu-min-width);

      // 收起态标题隐藏，logo 水平居中（与 dual rail 同款处理）
      .#{$BEM_PREFIX}-app-logo {
        justify-content: center;
        padding: 0;
      }
    }
  }

  // mixed / dual 二级侧栏（底色稍浅区分层级；position: relative 同主栏）
  &__secondary {
    position: relative;
    width: var(--left-menu-max-width);
    background: var(--left-menu-bg-light-color);

    // 二级侧栏菜单透明显示二级侧栏底色（AppMenu 根节点自带侧栏底色，需覆盖）
    .#{$BEM_PREFIX}-app-menu {
      background: transparent;
    }

    &.is-collapsed {
      width: var(--left-menu-min-width);
    }
  }

  &__secondary-title {
    height: 46px;
    padding: 0 18px;
    overflow: hidden;
    font-size: 13px;
    font-weight: 700;
    line-height: 46px;
    color: var(--logo-title-text-color);
    text-overflow: ellipsis;
    white-space: nowrap;
    border-bottom: 1px solid var(--layout-border-color);
    flex: none;

    &::before {
      display: inline-block;
      width: 6px;
      height: 6px;
      margin-right: 9px;
      vertical-align: 1px;
      background: var(--el-color-primary);
      border-radius: 50%;
      content: '';
      box-shadow: 0 0 0 4px var(--el-color-primary-light-9);
    }
  }

  // dual 模式一级 rail
  &__rail {
    width: var(--layout-rail-width);

    .#{$BEM_PREFIX}-app-logo {
      justify-content: center;
      width: var(--layout-rail-width);
      padding: 0;
    }
  }

  // ─── 工作区（工具条 + 页签 + 内容滚动区）─────────────
  &__workspace {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }

  &__scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  // ─── 工作区顶部悬浮条（工具条 + 页签）：毛玻璃 96% ───────
  // 背景只在此定义（TagsView 组件内不再自带底色），统一毛玻璃质感
  &__toolbar,
  &__tags {
    z-index: 10;
    flex: none;
    background: color-mix(in srgb, var(--top-header-bg-color) 96%, transparent);
    border-bottom: 1px solid var(--layout-border-color);
    backdrop-filter: blur(16px);
  }

  &__toolbar {
    z-index: 20;
    box-shadow: var(--layout-shadow);
  }

  // ─── 移动端遮罩 ──────────────────────────────────────
  &__mask {
    position: fixed;
    inset: 0;
    z-index: 25;
    cursor: pointer;
    background: var(--app-mask);
    border: 0;
    backdrop-filter: blur(2px);
  }
}

// ─── 拖拽调宽全局态（SidebarResizer 在拖拽中加/移该类）────────────────
// 禁文本选择 + 锁定 col-resize 光标：鼠标移出手柄热区后选择/光标行为仍可控
body.#{$BEM_PREFIX}-resizing {
  cursor: col-resize;
  user-select: none;
}

// ─── 暗色：EP 变量覆盖（与 theme store 的 data-theme 机制对齐）──
[data-theme='dark'] .#{$BEM_PREFIX}-default-layout {
  @include default-layout-ep-dark;
}

// 跟随系统：仅当用户未显式设置 data-theme
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) .#{$BEM_PREFIX}-default-layout {
    @include default-layout-ep-dark;
  }
}

// ─── 移动端：侧栏变抽屉 ────────────────────────────────
@media (max-width: 767px) {
  .#{$BEM_PREFIX}-default-layout__sidebar.is-mobile {
    position: fixed;
    inset: 0 auto 0 0;
    z-index: 30;
    width: min(82vw, var(--left-menu-max-width));
    box-shadow: 20px 0 50px var(--app-drawer-shadow);

    &.is-collapsed {
      transform: translateX(-100%);
    }
  }
}

// ─── 无障碍：减少动画偏好 ──────────────────────────────
@media (prefers-reduced-motion: reduce) {
  .#{$BEM_PREFIX}-default-layout {
    &__sidebar,
    &__secondary,
    &__rail {
      transition: none;
    }
  }
}
</style>
