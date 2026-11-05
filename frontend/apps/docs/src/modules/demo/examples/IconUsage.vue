<script setup lang="ts">
/**
 * IconUsage —— 图标体系用法总览（静态 i-标签 / 动态 AppDynamicIcon / 本地 app 集合）
 *
 * 验证方法：
 * 1. 「静态用法」区看到 ep / tabler / app 三集合图标正常渲染，默认 1.2em。
 * 2. 「动态用法」区图标由数据驱动渲染，:size="20" 的齿轮明显小于其他。
 * 3. 「本地自定义集合」区按代码片段步骤可复刻出 app:logo 图标（新增流程见 docs/39 §3.2/§3.3）。
 */
import type { AppIconName } from '@vv/ui/components/common/AppDynamicIcon/registry'
import DemoFrame from '../components/DemoFrame.vue'
import DemoField from '../components/DemoField.vue'
import ApiTable from '../components/ApiTable.vue'
import { useDocToc } from '../composables/useDocToc'
import { extractApi } from '../utils/extractApi'
import appDynamicIconSource from '@vv/ui/components/common/AppDynamicIcon/AppDynamicIcon.vue?raw'

// BEM 工具（createNamespace）由 unplugin-auto-import 自动注入，详见 CLAUDE.md §3
const bem = createNamespace('demo-icon-usage')

// 动态用法演示数据：模拟「图标名存在配置里」的场景（后端菜单 / JSON 配置），模板按字符串渲染
const dynamicList: { name: AppIconName; label: string }[] = [
  { name: 'ep:plus', label: 'ep:plus' },
  { name: 'tabler:home', label: 'tabler:home' },
  { name: 'app:logo', label: 'app:logo' },
]

const tocItems = [
  { id: 'demo-find', label: '去哪找图标' },
  { id: 'demo-static', label: '静态用法' },
  { id: 'demo-dynamic', label: '动态用法' },
  { id: 'demo-custom', label: '本地自定义集合' },
  { id: 'api-syntax', label: '语法速查' },
  { id: 'api-props', label: 'AppDynamicIcon Props' },
]

useDocToc(tocItems)

// —— 查找入口：新人最频繁的问题「这个图标去哪找」——集合 → 官方索引地址 + 命名转换技巧 ——
const finderRows: { collection: string; url: string; urlText: string; tip: string }[] = [
  {
    collection: 'ep',
    url: 'https://element-plus.org/zh-CN/component/icon',
    urlText: 'element-plus.org/zh-CN/component/icon',
    tip: 'EP 官方图标页。图标名 = EP 组件名转 kebab-case：Plus → plus、MagicStick → magic-stick，拼成 i-ep-magic-stick。',
  },
  {
    collection: 'tabler',
    url: 'https://icon-sets.iconify.design/tabler/',
    urlText: 'icon-sets.iconify.design/tabler',
    tip: '图标名本身就是 kebab-case，直接拼 i-tabler-<名字>（如 chart-bar）。业务图标首选扩展库。',
  },
  {
    collection: '全集合搜索',
    url: 'https://icon-sets.iconify.design/',
    urlText: 'icon-sets.iconify.design',
    tip: 'iconify 全集合搜索（支持中文搜「设置」「下载」等）。⚠️ 项目白名单仅 ep / tabler / app，搜到其他集合需先走新增集合流程（docs/39 §3.1）。',
  },
  {
    collection: 'app（本地）',
    url: '',
    urlText: 'src/assets/icons/（本仓库目录）',
    tip: '业务私有图标放这里，git 管理。新增三步走见下方「本地自定义集合」区。',
  },
]

// —— AppDynamicIcon Props 自动提取（name/type 从源码解析，description 手写字典 merge） ——
const propDescriptions: Record<string, string> = {
  name: '图标名（集合:图标 语法），合法取值 = registry key 联合（AppIconName）；外部不可信字符串先过 isAppIconName 守卫。',
  size: '图标尺寸（px），透传 SVG width/height；不传则跟随父级 font-size（默认 1.2em）。',
}

const propsItems = extractApi(appDynamicIconSource).props.map((p) => ({
  ...p,
  description: propDescriptions[p.name] ?? '—',
}))

// —— 语法速查表（手写：静态语法无 props 可提取） ——
const syntaxItems = [
  {
    name: '<i-集合-图标 />',
    type: '静态标签',
    description:
      '编译期解析内联 SVG，零 import。集合：ep（Element Plus）/ tabler（Tabler）/ app（本地）。',
  },
  {
    name: '<AppDynamicIcon name="集合:图标" />',
    type: '动态组件',
    description:
      '图标名来自数据（菜单/配置）时用。name 合法取值 = registry key 联合（AppIconName），写错 vue-tsc 报错。',
  },
  {
    name: ':size="number | string"',
    type: '动态组件 prop',
    description: '透传 SVG width/height（px）；不传则跟随父级 font-size（默认 1.2em）。',
  },
  {
    name: 'color / font-size',
    type: 'CSS 控制',
    description:
      '所有集合 fill/stroke 已 currentColor 化，尺寸颜色一律用 CSS 控制，勿给 i-* 标签加属性。',
  },
]
</script>

<template>
  <DemoFrame
    title="IconUsage 图标体系"
    source="src/components/common/AppDynamicIcon/registry.ts"
    :introductions="[
      '一套语法、零体积焦虑、类型安全、离线可用：图标编译期内联 SVG，产物零 iconify API 请求。',
      '静态 <i-集合-图标 /> 覆盖 99% 场景；图标名来自数据时用 &lt;AppDynamicIcon name=&quot;集合:图标&quot; /&gt;。',
      '业务私有图标放 src/assets/icons（app 集合），git 管理、编译期校验、随包分发。',
    ]"
  >
    <section id="demo-find" :class="bem.b()">
      <DemoField
        label="去哪找图标：官方索引 + 命名技巧"
        :code="`ep     → https://element-plus.org/zh-CN/component/icon\n         （组件名转 kebab：Plus → i-ep-plus、MagicStick → i-ep-magic-stick）\ntabler → https://icon-sets.iconify.design/tabler/\n         （图标名即 kebab，直接拼 i-tabler-<名字>）\n全集合 → https://icon-sets.iconify.design/（支持中文搜索；\n         白名单外集合先走 docs/39 §3.1 新增流程）\napp    → src/assets/icons/（本地 SVG，三步走见「本地自定义集合」）`"
      >
        <table :class="bem.e('finder')">
          <thead>
            <tr>
              <th>集合</th>
              <th>查找地址</th>
              <th>命名技巧</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in finderRows" :key="row.collection">
              <td>
                <code>{{ row.collection }}</code>
              </td>
              <td>
                <a
                  v-if="row.url"
                  :href="row.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  :class="bem.e('link')"
                >
                  {{ row.urlText }}
                </a>
                <code v-else>{{ row.urlText }}</code>
              </td>
              <td>{{ row.tip }}</td>
            </tr>
          </tbody>
        </table>
      </DemoField>
    </section>

    <section id="demo-static" :class="bem.b()">
      <DemoField
        label="静态用法：三集合"
        :code="`<i-ep-plus />\n<i-tabler-home />\n<i-app-logo />`"
      >
        <div :class="bem.e('grid')">
          <span :class="bem.e('cell')">
            <i-ep-plus />
            <code>i-ep-plus</code>
          </span>
          <span :class="bem.e('cell')">
            <i-ep-edit />
            <code>i-ep-edit</code>
          </span>
          <span :class="bem.e('cell')">
            <i-tabler-home />
            <code>i-tabler-home</code>
          </span>
          <span :class="bem.e('cell')">
            <i-tabler-settings />
            <code>i-tabler-settings</code>
          </span>
          <span :class="bem.e('cell')">
            <i-app-logo />
            <code>i-app-logo</code>
          </span>
          <span :class="bem.e('cell')">
            <i-app-close />
            <code>i-app-close</code>
          </span>
        </div>
      </DemoField>

      <DemoField
        label="尺寸与颜色：跟随 CSS（currentColor）"
        :code="`<span style=&quot;font-size: 32px; color: var(--el-color-primary)&quot;>\n  <i-ep-plus />\n</span>`"
      >
        <div :class="bem.e('row')">
          <span style="font-size: 16px"><i-ep-plus /></span>
          <span style="font-size: 24px"><i-ep-plus /></span>
          <span style="font-size: 32px"><i-ep-plus /></span>
          <span style="color: var(--el-color-primary); font-size: 24px"><i-tabler-home /></span>
          <span style="color: var(--el-color-success); font-size: 24px"><i-tabler-home /></span>
          <span style="color: var(--el-color-danger); font-size: 24px"><i-app-logo /></span>
        </div>
      </DemoField>
    </section>

    <section id="demo-dynamic">
      <DemoField
        label="动态用法：AppDynamicIcon（名字来自数据）"
        :code="`<AppDynamicIcon v-for=&quot;m in menuItems&quot; :key=&quot;m.icon&quot; :name=&quot;m.icon&quot; />\n<AppDynamicIcon name=&quot;tabler:settings&quot; :size=&quot;20&quot; />`"
      >
        <div :class="bem.e('grid')">
          <span v-for="item in dynamicList" :key="item.name" :class="bem.e('cell')">
            <AppDynamicIcon :name="item.name" />
            <code>name="{{ item.label }}"</code>
          </span>
          <span :class="bem.e('cell')">
            <AppDynamicIcon name="tabler:settings" :size="20" />
            <code>:size="20"</code>
          </span>
        </div>
      </DemoField>
    </section>

    <section id="demo-custom">
      <DemoField
        label="本地自定义集合 app:：新增与使用（完整流程）"
        :code="`// ① 存入 SVG 资产（源文件规范见 docs/39 §4.3）\n// src/assets/icons/logo.svg\n\n// ② 静态用法：模板直接用\n<i-app-logo />\n\n// ③ 动态用法：registry.ts 登记一行\n//    （位于 src/components/common/AppDynamicIcon/，与组件同目录内聚）\nimport AppLogo from 'virtual:icons/app/logo'\nconst registry = { /* ... */, 'app:logo': AppLogo } as const`"
      >
        <div :class="bem.e('grid')">
          <span :class="bem.e('cell')">
            <i-app-logo />
            <code>静态 &lt;i-app-logo /&gt;</code>
          </span>
          <span :class="bem.e('cell')">
            <AppDynamicIcon name="app:logo" />
            <code>动态 name="app:logo"</code>
          </span>
        </div>
        <p :class="bem.e('tip')">
          上方两个图标来自同一份
          <code>src/assets/icons/logo.svg</code>
          ；新增图标按左侧代码三步走，详见
          <code>docs/39-图标体系与使用规范.md</code>
          §3.2 / §3.3。
        </p>
      </DemoField>
    </section>

    <ApiTable title="双语法速查" :items="syntaxItems" anchor="api-syntax" />
    <ApiTable title="AppDynamicIcon Props" :items="propsItems" anchor="api-props" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-icon-usage {
  &__finder {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;

    th,
    td {
      padding: 8px 12px;
      border: 1px solid var(--el-border-color-lighter);
      text-align: left;
      vertical-align: top;
      line-height: 1.7;
    }

    th {
      background: var(--el-fill-color-light);
      font-weight: 600;
    }
  }

  &__link {
    color: var(--el-color-primary);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  &__grid {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  &__cell {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 4px;
    font-size: 20px;

    code {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }

  &__row {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  &__tip {
    margin: 12px 0 0;
    font-size: 13px;
    color: var(--el-text-color-secondary);
    line-height: 1.8;
  }
}
</style>
