<script setup lang="ts">
/**
 * PortalNav：企业官网顶部锚点导航（纯链接列表）。
 *
 * 2026-10-20 企业官网改造：弃用 el-menu（hover 子菜单/激活态是后台管理范式），
 * 改为真实 <a href="#anchor"> 链接：
 * - 点击 → click.prevent 后 scrollIntoView 平滑滚动（保留 href 供无 JS / SEO 降级）
 * - 当前区块高亮 → IntersectionObserver scroll-spy（rootMargin 顶部偏移 header 高度 64px）
 * - jsdom / 旧浏览器无 IntersectionObserver 时静默跳过（守卫判断，点击高亮仍可用）
 *
 * @see [`../config/nav.ts`](../config/nav.ts) 锚点配置
 * @see [`../config/types.ts`](../config/types.ts) PortalNavItem 类型
 * @group 布局：Portal
 */
import type { PortalNavItem } from '@/layouts/portal/config/types'

const bem = createNamespace('portal-nav')

const props = defineProps<{
  items: PortalNavItem[]
}>()

/** 当前高亮导航 key（初始首项；点击 / scroll-spy 回写） */
const activeKey = ref(props.items[0]?.key ?? '')

let observer: IntersectionObserver | undefined

function scrollTo(item: PortalNavItem): void {
  activeKey.value = item.key
  document.querySelector(item.anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

onMounted(() => {
  // jsdom 与部分旧浏览器无 IntersectionObserver，跳过 scroll-spy
  if (typeof IntersectionObserver === 'undefined') return
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) activeKey.value = entry.target.id
      }
    },
    // 顶部 -64px（header 高度）：区块顶边越过 header 下沿才算进入视口；
    // 数值与 portal-tokens.scss 的 --portal-header-h 保持同步（CSS 无法将 rootMargin 绑到变量）
    { rootMargin: '-64px 0px -70% 0px' }
  )
  for (const item of props.items) {
    const el = document.querySelector(item.anchor)
    if (el) observer.observe(el)
  }
})

onUnmounted(() => {
  observer?.disconnect()
})
</script>

<template>
  <nav :class="bem.b()" aria-label="主导航">
    <a
      v-for="item in items"
      :key="item.key"
      :href="item.anchor"
      :class="[bem.e('link'), bem.is('active', activeKey === item.key)]"
      :aria-current="activeKey === item.key ? 'location' : undefined"
      @click.prevent="scrollTo(item)"
    >
      {{ item.label }}
    </a>
  </nav>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-portal-nav {
  display: flex;
  align-items: center;
  gap: 32px;

  &__link {
    position: relative;
    font-size: 15px;
    color: var(--portal-ink-2);
    text-decoration: none;
    line-height: var(--portal-header-h);
    transition: color 0.2s ease;

    &:hover {
      color: var(--portal-ink);
    }

    // 激活态：黑色短下划线
    &.is-active {
      color: var(--portal-ink);
      font-weight: 600;

      &::after {
        content: '';
        position: absolute;
        left: 50%;
        bottom: 14px;
        transform: translateX(-50%);
        width: 16px;
        height: 2px;
        background: var(--portal-ink);
      }
    }
  }

  // 窄屏隐藏锚点导航，保留品牌 + 登录入口（移动端无汉堡菜单，KISS）
  @media (max-width: 768px) {
    display: none;
  }
}
</style>
