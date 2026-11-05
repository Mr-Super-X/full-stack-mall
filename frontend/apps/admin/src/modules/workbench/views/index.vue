<script setup lang="ts">
/**
 * 工作台首页（workbench 模块 index 子路由）。
 *
 * 验收要点：页签切换后本页输入框内容应保留（keep-alive 缓存生效，
 * 组件 name 'Workbench' 与路由 name 对齐是缓存命中前提）。
 *
 * @group 业务模块：Workbench
 */
defineOptions({ name: 'Workbench' })

// withRepoPrefix：跨 app 跳链加部署前缀（gh-pages base=<repo>/<app>/ 下不 404，易用性审查 P0-2）
import { withRepoPrefix } from '@vv/shared'

const bem = createNamespace('workbench-home')

const note = ref('')
const todoItems = [
  '四模式布局切换（顶栏右侧 LayoutSwitcher）',
  '侧边栏折叠 / 页签右键菜单',
  '主题明暗切换',
  '中英文切换',
]

/** 能力演示入口（跨应用整页跳转，P3 改造后 admin 内不再注册这些路由）。
 *
 * P3-1/P3-2/P3-3：Home→apps/portal、H5Demo→apps/h5、BigDemo 系列→apps/big，
 * 均独立为跨应用。这里以整页跳转（新窗口打开）链接到各应用落地页——经同域网关
 * （dev:gateway :8080）同源 path 可达；直查端口见各 desc 提示。 */
interface PanelLink {
  path: string
  label: string
  desc: string
}
const panelLinks: PanelLink[] = [
  { path: '/portal/home', label: '门户首页', desc: 'portal 顶部导航布局（apps/portal）' },
  {
    path: '/h5/h5-demo',
    label: 'H5 移动端演示',
    desc: 'rem 适配 · 桌面打开请用 DevTools 设备模拟',
  },
  {
    path: '/big/big-demo',
    label: '数据大屏演示（1920）',
    desc: 'transform scale 等比缩放（apps/big）',
  },
  {
    path: '/big/big-demo/wide',
    label: '超宽拼接屏演示（9000×1080）',
    desc: 'meta.bigScreen 异形设计稿',
  },
  { path: '/big/big-demo/state-demo', label: '大屏五态示范', desc: '成功/加载/错误/空/断连形态' },
]

/** 跨应用整页跳转：新窗口打开目标 app（跨 app 无共享 router，须整页 location）。
 *  path 经 withRepoPrefix 加部署前缀——gh-pages 形态（base=<repo>/<app>/）下不 404。 */
function openPanel(path: string): void {
  window.open(withRepoPrefix(path), '_blank')
}
</script>

<template>
  <div :class="bem.b()">
    <el-card shadow="never">
      <template #header>
        <span :class="bem.e('heading')">工作台首页</span>
      </template>
      <p :class="bem.e('desc')">
        本模块用于验收 default 布局复刻效果，路由挂载于
        <code>@/layouts/default/index.vue</code>
        。
      </p>
      <el-input
        v-model="note"
        :class="bem.e('input')"
        type="textarea"
        :rows="3"
        placeholder="在此输入内容，切换到其他页签再切回——内容保留即 keep-alive 缓存生效"
      />
    </el-card>

    <el-card shadow="never" :class="bem.e('card')">
      <template #header>
        <span :class="bem.e('heading')">验收清单</span>
      </template>
      <ul :class="bem.e('list')">
        <li v-for="item in todoItems" :key="item">{{ item }}</li>
      </ul>
    </el-card>

    <el-card shadow="never" :class="bem.e('card')">
      <template #header>
        <span :class="bem.e('heading')">能力演示导航</span>
      </template>
      <ul :class="bem.e('list')">
        <li v-for="item in panelLinks" :key="item.path">
          <el-link type="primary" @click="openPanel(item.path)">{{ item.label }}</el-link>
          —— {{ item.desc }}
        </li>
      </ul>
    </el-card>
  </div>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-workbench-home {
  // 页面级 padding 由布局层 AppView __content 统一提供（--app-content-padding），
  // 视图不再自加——曾双层叠加导致 48px 大间距（2026-09-10 反馈修复）
  &__heading {
    font-size: 15px;
    font-weight: 600;
  }

  &__desc {
    margin: 0 0 12px;
    color: var(--el-text-color-secondary);
  }

  &__input {
    max-width: 560px;
  }

  &__card {
    margin-top: 16px;
  }

  &__list {
    margin: 0;
    padding-left: 18px;
    line-height: 2;
    color: var(--el-text-color-regular);
  }
}
</style>
