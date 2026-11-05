<script setup lang="ts">
/**
 * 多页签（复刻参考仓 TagsView）：横向滚动页签条 + 右键菜单 + 工具按钮。
 *
 * 功能矩阵：
 * - 路由切换自动加入页签（router/index.ts afterEach → store.addRouteView）
 * - affix 固定页签初始化预置（filterAffixRoutes，无需访问过也常驻、不可关闭）
 * - 左/右滚动按钮、当前页签自动滚动到可视区
 * - 刷新按钮 / "更多"按钮（点击触发当前页签菜单）
 * - 右键菜单：刷新 / 关闭 / 关闭左侧 / 关闭右侧 / 关闭其他 / 全部关闭
 * - 刷新实现：store.removeCachedView 剔除 keep-alive 缓存 + 布局壳注入的
 *   refresh 句柄重建当前路由组件（替代参考仓的 /redirect 路由方案，不新增路由）
 *
 * @see [`../../store/modules/tags-view`](../../../store/modules/tags-view.ts) 页签状态
 * @see [`../config/menu.ts`](../config/menu.ts) filterAffixRoutes affix 收集
 * @see [`../index.vue`](../index.vue) refresh 句柄 provide 方
 * @see [`./AppView.vue`](./AppView.vue) refreshKey 消费方
 * @group 布局：Default
 */
import {
  ArrowLeft,
  ArrowRight,
  Back,
  CircleClose,
  Close,
  Minus,
  MoreFilled,
  Refresh,
  Right,
} from '@element-plus/icons-vue'
import { useTagsViewStore, type TagView } from '@/store/modules/tags-view'
import { useI18n } from 'vue-i18n'
import { filterAffixRoutes } from '../config/menu'
import { defaultLayoutConfig } from '../config/app'
import ContextMenu, { type ContextMenuItem } from './ContextMenu.vue'
import MenuIcon from './MenuIcon.vue'

// 命名空间用 default-tags-view 而非 tags-view：
// 历史上 src/components/common/TagsView 曾以全局非 scoped 样式占用 vv-tags-view
// 命名空间（该死代码已删除，命名空间保留不回迁，避免 git 历史中的样式互相覆盖问题重演）
const bem = createNamespace('default-tags-view')

/** 布局壳（default/index.vue）注入的页签刷新句柄（重建当前路由组件） */
const refreshView = inject<() => void>('default-layout-refresh')

const route = useRoute()
const { router } = useAppRouter()
const { t } = useI18n()
const tagsViewStore = useTagsViewStore()

const tagsViewRef = ref<HTMLElement>()
const scrollbarRef = ref<{ wrapRef: HTMLElement | undefined }>()

const visitedViews = computed(() => tagsViewStore.visitedViews)
const activeTag = computed(() => visitedViews.value.find((view) => view.path === route.fullPath))

/** 所有页签被关光后的兜底跳转路径 */
const defaultPath = computed(() => '/')

/** 页签显示名：有 titleKey 时走 i18n 实时翻译（title 是加入页签时的语言快照） */
function tagTitle(view: TagView): string {
  return view.titleKey ? t(view.titleKey) : view.title
}

function isActive(view: TagView): boolean {
  return view.path === route.fullPath
}

/** 当前激活页签滚动到可视区 */
async function moveActiveIntoView() {
  await nextTick()
  tagsViewRef.value
    ?.querySelector<HTMLElement>(`[data-tag-active="true"]`)
    ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
}

function scrollTags(left: number) {
  scrollbarRef.value?.wrapRef?.scrollBy({ left, behavior: 'smooth' })
}

function navigateTo(view?: TagView) {
  router.push(view?.path || defaultPath.value)
}

/** 关闭单个页签；关的是当前页则跳转到相邻页签 */
async function closeTag(view: TagView) {
  if (view.affix) return
  const index = visitedViews.value.findIndex((v) => v.name === view.name)
  const wasActive = isActive(view)
  tagsViewStore.removeView(view)
  if (!wasActive) return
  await navigateTo(visitedViews.value[index] ?? visitedViews.value[index - 1])
}

async function closeAllTags() {
  tagsViewStore.closeAll()
  await navigateTo(visitedViews.value.at(-1))
}

/** 批量关闭后，若当前页已不在页签栏，回退到传入页签 */
async function keepCurrentVisible(fallback: TagView) {
  if (!visitedViews.value.some((view) => isActive(view))) {
    await navigateTo(fallback)
  }
}

async function closeOtherTags(view: TagView) {
  tagsViewStore.closeOthers(view)
  await keepCurrentVisible(view)
}

async function closeLeftTags(view: TagView) {
  tagsViewStore.closeLeft(view)
  await keepCurrentVisible(view)
}

async function closeRightTags(view: TagView) {
  tagsViewStore.closeRight(view)
  await keepCurrentVisible(view)
}

/** 刷新页签：剔除 keep-alive 缓存 + 重建当前路由组件 */
async function refreshTag(view?: TagView) {
  if (!view) return
  tagsViewStore.removeCachedView(view.name)
  await nextTick()
  refreshView?.()
}

function hasClosableView(views: TagView[]): boolean {
  return views.some((view) => !view.affix)
}

function createContextMenu(view: TagView): ContextMenuItem[] {
  const index = visitedViews.value.findIndex((v) => v.name === view.name)
  const otherViews = visitedViews.value.filter((v) => v.name !== view.name)

  const items: ContextMenuItem[] = [
    { icon: Refresh, label: t('tagsView.menuRefresh'), command: () => refreshTag(view) },
    {
      icon: Close,
      label: t('tagsView.menuClose'),
      disabled: view.affix,
      command: () => closeTag(view),
    },
    {
      divided: true,
      icon: Back,
      label: t('tagsView.menuCloseLeft'),
      disabled: index <= 0 || !hasClosableView(visitedViews.value.slice(0, index)),
      command: () => closeLeftTags(view),
    },
    {
      icon: Right,
      label: t('tagsView.menuCloseRight'),
      disabled: index < 0 || !hasClosableView(visitedViews.value.slice(index + 1)),
      command: () => closeRightTags(view),
    },
    {
      divided: true,
      icon: CircleClose,
      label: t('tagsView.menuCloseOthers'),
      disabled: !hasClosableView(otherViews),
      command: () => closeOtherTags(view),
    },
    {
      icon: Minus,
      label: t('tagsView.menuCloseAll'),
      disabled: !hasClosableView(visitedViews.value),
      command: closeAllTags,
    },
  ]
  return items
}

// 初始化：预置 affix 固定页签（当前本地仅 Workbench 工作台首页，远程菜单也可标记 affix）
// 注意：此路径直读路由表、不经 tags-view 的 NO_TAGS 名单，两个出口需同步维护
onMounted(() => {
  filterAffixRoutes(router, t).forEach((view) => tagsViewStore.addView(view))
})

// 路由切换后把激活页签滚进可视区
watch(
  () => route.fullPath,
  () => moveActiveIntoView(),
  { flush: 'post' }
)
</script>

<template>
  <div ref="tagsViewRef" :class="bem.b()">
    <button
      :class="[bem.e('tool'), bem.em('tool', 'first')]"
      type="button"
      :aria-label="t('tagsView.scrollLeft')"
      @click="scrollTags(-200)"
    >
      <el-icon><ArrowLeft /></el-icon>
    </button>

    <div :class="bem.e('viewport')">
      <el-scrollbar ref="scrollbarRef" :class="bem.e('scrollbar')">
        <div :class="bem.e('list')">
          <ContextMenu
            v-for="item in visitedViews"
            :key="item.name"
            :schema="createContextMenu(item)"
            :class="[bem.e('item'), bem.is('active', isActive(item)), bem.is('affix', item.affix)]"
          >
            <div :class="bem.e('item-body')" :data-tag-active="isActive(item)">
              <RouterLink :to="item.path" :class="bem.e('link')">
                <MenuIcon
                  v-if="defaultLayoutConfig.ui.tagsViewIcon && item.icon"
                  :name="item.icon"
                />
                <span>{{ tagTitle(item) }}</span>
              </RouterLink>
              <button
                v-if="!item.affix"
                :class="bem.e('close')"
                type="button"
                :aria-label="`${t('tagsView.closeTag')}: ${tagTitle(item)}`"
                @click.stop="closeTag(item)"
              >
                <el-icon :size="13"><Close /></el-icon>
              </button>
            </div>
          </ContextMenu>
        </div>
      </el-scrollbar>
    </div>

    <button
      :class="bem.e('tool')"
      type="button"
      :aria-label="t('tagsView.scrollRight')"
      @click="scrollTags(200)"
    >
      <el-icon><ArrowRight /></el-icon>
    </button>
    <button
      :class="bem.e('tool')"
      type="button"
      :aria-label="t('tagsView.refresh')"
      :disabled="!activeTag"
      @click="refreshTag(activeTag)"
    >
      <el-icon><Refresh /></el-icon>
    </button>
    <ContextMenu trigger="click" :schema="activeTag ? createContextMenu(activeTag) : []">
      <button
        :class="bem.e('tool')"
        type="button"
        :aria-label="t('tagsView.more')"
        :disabled="!activeTag"
      >
        <el-icon><MoreFilled /></el-icon>
      </button>
    </ContextMenu>
  </div>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-default-tags-view {
  position: relative;
  display: flex;
  width: 100%;
  height: var(--tags-view-height);
  // 背景由布局壳统一提供（topbar / __tags 毛玻璃），组件自身保持透明

  // 非 scoped 样式下 :deep() 不会被编译、整条规则被浏览器丢弃——直接写后代选择器
  .el-scrollbar__view {
    height: 100%;
  }

  &__viewport {
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }

  &__scrollbar,
  &__list {
    height: 100%;
  }

  &__list {
    display: flex;
    gap: 4px;
    padding: 3px 4px;
    box-sizing: border-box;
  }

  &__tool {
    display: grid;
    flex: none;
    width: var(--tags-view-height);
    height: var(--tags-view-height);
    padding: 0;
    color: var(--el-text-color-placeholder);
    cursor: pointer;
    background: transparent;
    border: 0;
    border-left: 1px solid var(--layout-border-color);
    transition:
      color 160ms ease,
      background-color 160ms ease;
    place-items: center;

    &:hover:not(:disabled),
    &:focus-visible {
      color: var(--el-color-primary);
      background: var(--top-header-hover-color);
      outline: none;
    }

    &:disabled {
      cursor: default;
      opacity: 0.45;
    }

    &--first {
      border-right: 1px solid var(--layout-border-color);
      border-left: 0;
    }
  }

  &__item {
    flex: none;
    height: 100%;
    overflow: hidden;
    color: var(--el-text-color-regular);
    cursor: pointer;
    background: var(--top-header-bg-color);
    border: 1px solid var(--layout-border-color);
    border-radius: 8px;
    transition:
      color 160ms ease,
      background-color 160ms ease,
      border-color 160ms ease;

    &:hover,
    &:focus-within {
      color: var(--el-color-primary);
    }

    &.is-active {
      font-weight: 600;
      color: var(--el-color-primary);
      background: var(--el-color-primary-light-9);
      border-color: var(--el-color-primary-light-7);
    }
  }

  &__item-body,
  &__link {
    display: flex;
    align-items: center;
    height: 100%;
    // 项目 reset.css 对 div/a 均设 font-weight: normal，会阻断激活页签 600 字重的继承链，
    // 逐级 inherit 恢复（item → item-body → link）
    font-weight: inherit;
  }

  &__link {
    gap: 5px;
    padding: 0 12px;
    font-size: 12px;
    color: inherit;
    text-decoration: none;
    white-space: nowrap;

    &:focus-visible {
      outline: 2px solid var(--el-color-primary-light-7);
      outline-offset: -2px;
    }
  }

  &__item:not(.is-affix) &__link {
    padding-right: 4px;
  }

  &__close {
    display: grid;
    width: 24px;
    height: 100%;
    padding: 0;
    color: inherit;
    pointer-events: none;
    cursor: pointer;
    background: transparent;
    border: 0;
    opacity: 0;
    transition:
      color 160ms ease,
      opacity 160ms ease;
    place-items: center;

    &:hover,
    &:focus-visible {
      color: var(--el-color-danger);
      outline: none;
    }
  }

  // 悬停 / 激活 / 聚焦时显示关闭按钮
  &__item:hover &__close,
  &__item.is-active &__close,
  &__close:focus-visible {
    pointer-events: auto;
    opacity: 1;
  }
}
</style>
