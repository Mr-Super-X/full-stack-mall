<script setup lang="ts">
/**
 * 面包屑：从 route.matched 派生层级路径。
 *
 * 规则（复刻参考仓 Breadcrumb）：
 * - 过滤 meta.visible === false 与 meta.breadcrumb === false 的记录
 * - 过滤无 title/titleKey 的记录（纯布局包装层，如 /user 父记录）——参考仓只
 *   渲染有标题的记录，否则空标题渲染成开头孤立的 "/" 分隔符
 * - 相邻同标题去重（如父路由与子路由同 title 只显示一次）
 * - 仅中间层级可点击跳转（最后一项为纯文本）
 * - 图标展示受 config.ui.breadcrumbIcon 控制
 *
 * @see [`../config/app.ts`](../config/app.ts) breadcrumbIcon 开关
 * @group 布局：Default
 */
import { useI18n } from 'vue-i18n'
import { resolveRouteTitle } from '@/router/helpers'
import { defaultLayoutConfig } from '../config/app'
import MenuIcon from './MenuIcon.vue'

const bem = createNamespace('app-breadcrumb')

const route = useRoute()
const { t } = useI18n()

interface Crumb {
  path: string
  title: string
  // 显式允许 undefined（exactOptionalPropertyTypes）
  icon?: string | undefined
  clickable: boolean
}

const crumbs = computed<Crumb[]>(() => {
  const matched = route.matched.filter((record) => {
    if (record.meta.visible === false || record.meta.breadcrumb === false) return false
    // 无 title/titleKey 的记录（纯布局包装层，如 /user 的父记录）不参与面包屑——
    // 对标参考仓只渲染有标题的记录；否则空标题会渲染成开头一个孤立的 "/" 分隔符
    const meta = record.meta as { title?: string; titleKey?: string }
    return Boolean(meta.title ?? meta.titleKey)
  })
  // 相邻同标题去重：最后一项不参与比较（始终保留当前页）
  const visible = matched.filter(
    (record, index) =>
      index === matched.length - 1 || record.meta.title !== matched[index + 1]?.meta.title
  )
  return visible.map((record, index) => ({
    path: record.path,
    // titleKey 命中时走 i18n（语言切换实时更新），否则用 meta.title / name 兜底
    title: resolveRouteTitle(record, t),
    icon: (record.meta.icon as string | undefined) ?? undefined,
    // 仅中间层级可点击（最后一项是当前页）
    clickable: index < visible.length - 1,
  }))
})
</script>

<template>
  <el-breadcrumb :class="bem.b()" separator="/">
    <!-- 中间层级可点击（显式分支而非 :to="undefined"：EP 2.14 + TS6 下 exactOptionalPropertyTypes 不接收 undefined） -->
    <!-- key 带 index 后缀：空 path 的 index 子路由（path: ''）规范化后与父记录同 path
         （如 /workbench 的父记录与子记录都是 '/workbench'），纯 path 作 key 会重复 -->
    <el-breadcrumb-item v-for="(crumb, index) in crumbs" :key="`${crumb.path}-${index}`">
      <RouterLink v-if="crumb.clickable" :to="crumb.path" :class="bem.e('link')">
        <MenuIcon v-if="defaultLayoutConfig.ui.breadcrumbIcon && crumb.icon" :name="crumb.icon" />
        <span :class="bem.e('text')">{{ crumb.title }}</span>
      </RouterLink>
      <span v-else :class="bem.e('plain')">
        <MenuIcon v-if="defaultLayoutConfig.ui.breadcrumbIcon && crumb.icon" :name="crumb.icon" />
        <span :class="bem.e('text')">{{ crumb.title }}</span>
      </span>
    </el-breadcrumb-item>
  </el-breadcrumb>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-app-breadcrumb {
  display: flex;
  align-items: center;
  height: 100%;

  // 最后一项（当前页）：弱化颜色且不可 hover
  .el-breadcrumb__item:last-child {
    .el-breadcrumb__inner {
      color: var(--el-text-color-placeholder);

      &:hover {
        color: var(--el-text-color-placeholder);
      }
    }
  }

  .el-breadcrumb__inner {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--top-header-text-color);

    &:hover {
      color: var(--el-color-primary);
    }
  }

  // 链接继承 __inner 颜色（hover 高亮由 __inner 驱动），末项弱化色同样经继承生效
  &__link,
  &__plain {
    display: flex;
    gap: 4px;
    align-items: center;
    color: inherit;
    text-decoration: none;
  }

  &__text {
    line-height: 1;
  }
}
</style>
