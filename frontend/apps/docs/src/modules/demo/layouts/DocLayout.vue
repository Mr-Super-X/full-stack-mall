<script setup lang="ts">
/**
 * 三栏 demo 文档布局（对标 element-plus 官网）
 *
 * 布局：grid 三列 [sidebar | main | toc]
 *   - 左侧 sidebar：自动从 router 收集所有 Demo* 路由，**零手动维护**——
 *     新增 demo 子路由后 sidebar 自动出现。按组件类型分组（分组规则与中文名
 *     映射见 config/sidebar-groups.ts），组可点击展开收起，右缘可拖拽调整宽度
 *     （150~400px，逻辑见 use-sidebar-drag.ts）。
 *     顶部有"返回首页"按钮，点击回到项目根路由（dashboard /）。
 *   - 中间 main：演示页内容（default slot，路由级布局 DemoDocs.vue 注入 <RouterView />）
 *   - 右侧 toc：本页锚点导航（toc slot，由 DemoDocs.vue 注入 useDocToc 数据渲染）
 *
 * 边界：sidebar 在内容超长时保持 sticky；toc 同理。
 */
import { ArrowDown, ArrowRight, Back, Search } from '@element-plus/icons-vue'
// useAppRouter 由 unplugin-auto-import 从 '@vv/shared' 注入（§1.6），原显式 import 冗余（2026-10-27 导入审计修复）
import { getSidebarGroup, getSidebarLabel, SIDEBAR_GROUPS } from '../config/sidebar-groups'
import { useDemoSearch, type DemoSearchItem } from '../composables/useDemoSearch'
import { collapsedGroups, sidebarWidth } from './sidebar-state'
import { useSidebarDrag } from './use-sidebar-drag'

const route = useRoute()
const { router } = useAppRouter()

interface SidebarItem extends DemoSearchItem {
  /** 用于分组归类（PascalCase 组件名） */
  title: string
}

const sidebarItems = computed<SidebarItem[]>(() => {
  return (
    router
      .getRoutes()
      // 排除 redirect 路由（'Demo' 这种跳转型入口不应出现在侧边栏）
      .filter((r) => typeof r.name === 'string' && r.name.startsWith('Demo') && !r.redirect)
      .map((r) => {
        const title = String(r.meta?.title ?? r.name)
        return {
          name: String(r.name),
          title,
          label: getSidebarLabel(title),
          path: r.path,
        }
      })
  )
})

/** 回到项目根路由（/）。 */
function goHome() {
  router.push('/')
}

// —— 分组归类（空组过滤掉，不渲染） ——
interface SidebarGroup {
  title: string
  items: SidebarItem[]
}

const sidebarGroups = computed<SidebarGroup[]>(() => {
  const map = new Map<string, SidebarItem[]>()
  for (const group of SIDEBAR_GROUPS) map.set(group.title, [])
  for (const item of sidebarItems.value) {
    map.get(getSidebarGroup(item.title))?.push(item)
  }
  return SIDEBAR_GROUPS.map((g) => ({ title: g.title, items: map.get(g.title) ?? [] })).filter(
    (g) => g.items.length > 0
  )
})

// —— 搜索（输入即过滤；未命中分组隐藏，命中组强制展开） ——
const keyword = ref('')
const { filteredGroups, isSearchActive, clearKeyword } = useDemoSearch({
  groups: sidebarGroups,
  keyword,
  collapsedGroups,
})

// —— 展开收起（默认全展开；状态模块级保留，见 sidebar-state.ts） ——
function toggleGroup(groupTitle: string) {
  // 搜索激活期间不响应 toggleGroup 写入 collapsedGroups，
  // 否则会污染用户的折叠偏好（spec §3.4）
  if (isSearchActive.value) return
  const next = new Set(collapsedGroups.value)
  if (next.has(groupTitle)) {
    next.delete(groupTitle)
  } else {
    next.add(groupTitle)
  }
  collapsedGroups.value = next
}

// —— 顶栏粘顶态感知（哨兵 + IntersectionObserver）——
// 默认文档流态顶栏完全透明，与画布融为一体（无色块感）；滚动压住哨兵后
// isStuck = true，才铺底色 + 发丝线遮挡下方穿行的菜单文字。
// CSS 没有 :stuck 伪类，IO 哨兵是实现「滚动才粘顶显形」的标准方案
const sidebarEl = ref<HTMLElement>()
const sentinelEl = ref<HTMLElement>()
const isStuck = ref(false)
let stuckObserver: IntersectionObserver | null = null

onMounted(() => {
  const root = sidebarEl.value
  const sentinel = sentinelEl.value
  if (!root || !sentinel) return
  stuckObserver = new IntersectionObserver(
    ([entry]) => {
      isStuck.value = !entry?.isIntersecting
    },
    { root, threshold: 0 }
  )
  stuckObserver.observe(sentinel)
})

onUnmounted(() => {
  stuckObserver?.disconnect()
  stuckObserver = null
})

// —— 拖拽调整 sidebar 宽度（150~400px 钳制；状态模块级保留，逻辑见 use-sidebar-drag） ——
const { onResizerMousedown } = useSidebarDrag(sidebarWidth, 150, 400)

const bem = createNamespace('doc-layout')
</script>

<template>
  <div
    :class="bem.b()"
    :style="{ gridTemplateColumns: `${sidebarWidth}px 0 minmax(0, 1fr) 180px` }"
  >
    <aside ref="sidebarEl" :class="bem.e('sidebar')">
      <!-- 哨兵：被滚动压出侧栏视口顶部 = 顶栏进入粘顶态（IntersectionObserver 监听） -->
      <div ref="sentinelEl" :class="bem.e('sentinel')" aria-hidden="true" />
      <div :class="[bem.e('sidebar-top'), bem.is('stuck', isStuck)]">
        <button :class="bem.e('home')" type="button" @click="goHome">
          <el-icon :class="bem.e('home-icon')"><Back /></el-icon>
          <span>返回首页</span>
        </button>
        <div :class="bem.e('search')">
          <el-input
            v-model="keyword"
            placeholder="搜索 demo"
            clearable
            size="default"
            :prefix-icon="Search"
            :class="bem.e('search-input')"
          />
        </div>
      </div>
      <ul :class="bem.e('nav')">
        <li v-for="group in filteredGroups" :key="group.title" :class="bem.e('group')">
          <button
            :class="bem.e('group-header')"
            type="button"
            :aria-expanded="isSearchActive || !collapsedGroups.has(group.title)"
            @click="toggleGroup(group.title)"
          >
            <el-icon :class="bem.e('group-arrow')">
              <ArrowRight v-if="!isSearchActive && collapsedGroups.has(group.title)" />
              <ArrowDown v-else />
            </el-icon>
            <span :class="bem.e('group-name')">{{ group.title }}</span>
            <span :class="bem.e('group-count')">{{ group.items.length }}</span>
          </button>
          <el-collapse-transition>
            <ul
              v-show="isSearchActive || !collapsedGroups.has(group.title)"
              :class="bem.e('group-list')"
            >
              <li v-for="item in group.items" :key="item.name">
                <RouterLink
                  :to="item.path"
                  :class="[bem.e('link'), bem.is('active', route.name === item.name)]"
                >
                  {{ item.label }}
                </RouterLink>
              </li>
            </ul>
          </el-collapse-transition>
        </li>
      </ul>
      <div v-if="isSearchActive && filteredGroups.length === 0" :class="bem.e('search-empty')">
        <p :class="bem.e('search-empty-text')">未匹配到「{{ keyword }}」</p>
        <button type="button" :class="bem.e('search-empty-btn')" @click="clearKeyword">
          清空搜索
        </button>
      </div>
    </aside>

    <!-- 拖拽条放在 sidebar 与 main 之间的独立 grid 列，sticky 定位保证滚动时始终可见 -->
    <div :class="bem.e('resizer')" @mousedown="onResizerMousedown" />

    <main :class="bem.e('main')">
      <slot />
    </main>

    <aside :class="bem.e('toc')">
      <slot name="toc" />
    </aside>
  </div>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-doc-layout {
  // grid-template-columns 由内联 style 动态控制（sidebar 宽度可拖拽）
  // 四列：[sidebar | resizer(0宽) | main | toc]
  display: grid;
  gap: 0;
  align-items: start;
  // 强制占满视口高度（减去 default-layout 的 64px header + 上下 padding），
  // 避免 demo 内容少时容器塌陷导致 sidebar / toc 看起来"居中"——
  // 也保证切换路由时容器高度不变，sticky sidebar / toc 不会因为高度差抖动。
  min-height: calc(100vh - 96px);

  &__sidebar,
  &__toc {
    position: sticky;
    top: 16px;
    max-height: calc(100vh - 32px);
    overflow-y: auto;
    // 刻意不加背景色：侧栏透明融入画布，避免色块补丁感。
    // sidebar 自身 padding 置 0、水平内边距交给内部块——sticky 顶栏需
    // 完整通栏铺底色，负 margin + sticky 组合会产生错位
    padding: 0;
  }

  &__toc {
    margin-left: 24px;
    // toc 无 sticky 子块，恢复常规内边距
    padding: 16px;
  }

  &__main {
    padding: 16px;
    margin-left: 24px;
  }

  &__sentinel {
    // 1px 哨兵撑在侧栏内容最顶部：被滚动压出视口即代表顶栏进入粘顶态
    // （0 高度元素 IntersectionObserver 触发不稳，取 1px）
    height: 1px;
  }

  &__sidebar-top {
    // 把 home + search 包成一个 sticky 容器：sidebar 内容超长滚动时
    // 「返回首页」与搜索框始终可见。默认文档流态完全透明（与画布融为一体，
    // 无色块）；滚动压住哨兵后 is-stuck 铺底色，挡住下方穿行的菜单文字
    position: sticky;
    top: 0;
    z-index: 2;
    padding: 14px 16px 12px;
    background: transparent;
    border-bottom: 1px solid transparent;
    transition:
      background 0.2s,
      border-color 0.2s;

    &.is-stuck {
      // 底色用 --el-bg-color（与画布同色）：light 下即白色，遮挡穿行文字
      // 的同时几乎不显现色块边界
      background: var(--el-bg-color);
      border-bottom-color: var(--el-border-color-lighter);
    }
  }

  &__home {
    // 轻量文字链（对齐 EP 官网顶部返回链接）：去框去白底，避免全宽按钮抢戏
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    margin-bottom: 10px;
    padding: 6px 8px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    cursor: pointer;
    transition:
      background 0.15s,
      color 0.15s;

    &:hover {
      background: var(--el-fill-color-light);
      color: var(--el-color-primary);
    }
  }

  &__home-icon {
    font-size: 14px;
  }

  &__search {
    // 无 margin：与 home 间距由 sidebar-top padding-bottom 统一管理
  }

  &__search-input {
    width: 100%;
  }

  &__search-empty {
    padding: 24px 16px;
    text-align: center;
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }

  &__search-empty-text {
    margin: 0 0 8px;
  }

  &__search-empty-btn {
    padding: 4px 12px;
    background: transparent;
    border: 1px solid var(--el-border-color);
    border-radius: 6px;
    color: var(--el-color-primary);
    font-size: 12px;
    cursor: pointer;
    transition: background 0.15s;

    &:hover {
      background: var(--el-color-primary-light-9);
    }
  }

  &__nav {
    // sidebar padding 置 0 后，菜单区自管内边距：顶部留出与搜索框的呼吸距离
    margin: 0;
    padding: 12px 16px 16px;
    list-style: none;
  }

  &__group {
    margin-bottom: 4px;
  }

  &__group-header {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    padding: 8px;
    background: transparent;
    border: none;
    border-radius: 6px;
    // 分组标题：与子菜单同字号（13px），靠字重 + 深色区分层级——
    // 此前 12px 灰字比子项还弱，层级感颠倒
    font-size: 13px;
    font-weight: 600;
    line-height: 18px;
    color: var(--el-text-color-primary);
    cursor: pointer;
    transition:
      background 0.15s,
      color 0.15s;

    &:hover {
      background: var(--el-fill-color-light);
      color: var(--el-color-primary);
    }
  }

  &__group-arrow {
    flex-shrink: 0;
    font-size: 12px;
  }

  &__group-name {
    flex: 1;
    text-align: left;
    letter-spacing: 0.02em;
  }

  &__group-count {
    flex-shrink: 0;
    font-size: 12px;
    font-weight: 400;
    // 计数弱化但不隐身：placeholder 色在灰底上几乎不可读
    color: var(--el-text-color-secondary);
  }

  &__group-list {
    margin: 0;
    padding: 0 0 0 8px;
    list-style: none;
  }

  &__resizer {
    // 独立 grid 列，sticky 定位保证 sidebar 内部滚动或页面滚动时始终可见
    position: sticky;
    top: 16px;
    align-self: start;
    justify-self: end;
    z-index: 1;
    width: 6px;
    height: calc(100vh - 32px);
    cursor: col-resize;

    &:hover {
      background: var(--el-color-primary-light-7);
    }
  }

  &__link {
    display: block;
    // 长组件名（如 XFormCrossFieldReverse）在窄 sidebar 下允许断词，避免撑出横向滚动
    overflow-wrap: break-word;
    padding: 6px 12px;
    margin: 2px 0;
    font-size: 13px;
    color: var(--el-text-color-regular);
    text-decoration: none;
    border-radius: 6px;
    transition:
      background 0.15s,
      color 0.15s;

    &:hover {
      background: var(--el-fill-color-light);
      color: var(--el-color-primary);
    }

    // EP 官网标志选中态：左侧 3px 主色竖条 + tint 底（竖条对齐分组标题左缘）
    &.is-active {
      position: relative;
      background: var(--el-color-primary-light-9);
      color: var(--el-color-primary);
      font-weight: 500;

      &::before {
        content: '';
        position: absolute;
        left: -8px;
        top: 50%;
        transform: translateY(-50%);
        width: 3px;
        height: 16px;
        border-radius: 0 2px 2px 0;
        background: var(--el-color-primary);
      }
    }
  }
}
</style>
