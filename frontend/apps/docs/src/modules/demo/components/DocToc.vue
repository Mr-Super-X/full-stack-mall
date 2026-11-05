<script setup lang="ts">
/**
 * 右侧楼层导航（滚动感知版）
 *
 * 激活算法：取「区块顶部 ≤ 视口中线」的最后一个区块（贪心顺序扫描）——
 * - 长区块滚过时激活态随之推进（顶部分界线即切换点）；
 * - 滚到底时自然落在最后一项（楼层导航惯例）；
 * - 不受 IntersectionObserver「长区块底部持续 intersecting」的干扰。
 *
 * 滚动监听用 document capture 阶段：scroll 不冒泡，capture 才能收到
 * 内层滚动容器（非 window）的滚动事件；demo 页本身滚 window，双保险。
 * 点击链接先立即高亮（点击反馈），落地后由 scroll 校准到实际位置。
 */
const props = defineProps<{
  items: { id: string; label: string }[]
  title?: string
}>()

// 默认激活第一项；滚动/点击时更新
const activeId = ref(props.items[0]?.id ?? '')

// 点击锁定：激活跟随浏览器滚动（smooth）会滑过中间项、落地后与点击目标错位——
// 锁定期间滚动不更新激活，解锁后保持点击目标，直到用户主动滚动才几何跟随
const locked = ref(false)
let lockTimer: ReturnType<typeof setTimeout> | null = null

function updateActive(): void {
  if (locked.value) return
  // 分界带 = 视口中线：区块顶部越过中线即视为「已读到」，取最后一个满足项
  const bandBottom = window.innerHeight * 0.5
  let current = props.items[0]?.id ?? ''
  for (const item of props.items) {
    const el = document.getElementById(item.id)
    if (!el) continue
    if (el.getBoundingClientRect().top <= bandBottom) current = item.id
    else break
  }
  activeId.value = current
}

// 点击立即高亮目标 + 短暂锁定（覆盖 smooth 滚动全程，解锁后不重算——保持点击意图）
function activate(id: string) {
  activeId.value = id
  locked.value = true
  if (lockTimer) clearTimeout(lockTimer)
  lockTimer = setTimeout(() => {
    locked.value = false
  }, 600)
}

onMounted(() => {
  updateActive()
  document.addEventListener('scroll', updateActive, { capture: true, passive: true })
  window.addEventListener('resize', updateActive)
})

onUnmounted(() => {
  if (lockTimer) clearTimeout(lockTimer)
  document.removeEventListener('scroll', updateActive, { capture: true })
  window.removeEventListener('resize', updateActive)
})

const bem = createNamespace('doc-toc')
</script>

<template>
  <nav :class="bem.b()" v-if="items.length">
    <h3 :class="bem.e('title')">{{ title ?? '本页导航' }}</h3>
    <ul :class="bem.e('list')">
      <li v-for="item in items" :key="item.id">
        <a
          :href="`#${item.id}`"
          :class="[bem.e('link'), item.id === activeId ? bem.em('link', 'active') : '']"
          @click="activate(item.id)"
        >
          {{ item.label }}
        </a>
      </li>
    </ul>
  </nav>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-doc-toc {
  font-size: 12px;

  &__title {
    margin: 0 0 8px;
    font-size: 12px;
    font-weight: 600;
    color: var(--el-text-color-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  &__list {
    margin: 0;
    padding: 0;
    list-style: none;
    border-left: 1px solid var(--el-border-color-light);
  }

  &__link {
    display: block;
    padding: 4px 12px;
    margin-left: -1px;
    border-left: 1px solid transparent;
    color: var(--el-text-color-regular);
    text-decoration: none;
    line-height: 1.6;
    transition:
      color 0.15s,
      border-color 0.15s;

    &:hover {
      color: var(--el-color-primary);
      border-left-color: var(--el-color-primary);
    }

    // 当前激活楼层：左侧竖线 + 主色 + 加粗（滚动跟随与点击跳转都会进入此态）
    &--active {
      color: var(--el-color-primary);
      border-left-color: var(--el-color-primary);
      font-weight: 600;
    }
  }
}
</style>
