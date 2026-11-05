# @vv/ui

全局组件包：`components/common` + `components/ProTable` + `components/form-schema` 三目录组件

- 弹窗族 composables（`useDialog` / `useConfirm` / `useLogout`）+ 图标 / 样式资产（BEM mixin、本地图标集合）。

> **消费形态（必读）**：本包是 pnpm workspace **源码直链包**（`workspace:*` 链接、`"private": true`），
> **不是 npm 发布包**——不建 dist、不经打包发布，宿主构建期直接编译包内 `.vue` / `.ts` 源码。
> 因此存在**编译期隐式契约**：组件样式依赖宿主注入的 SCSS `$BEM_PREFIX` 变量、composable 依赖
> 宿主 auto-import 注入、组件注册依赖宿主 `unplugin-vue-components` 目录扫描。
> **换宿主前必须逐项落实下文「宿主装配契约」**，否则样式编译失败 / 模块求值 ReferenceError /
> 组件无法解析。

## 宿主装配契约（前置条件，缺一不可）

### ① vite `scss.additionalData` 注入 `$BEM_PREFIX`（样式生死线）

包内全部组件 `<style lang="scss">` 的根选择器写作 `.#{$BEM_PREFIX}-<block>`，变量来自宿主注入。
宿主必须等价复刻以下配置（单一事实来源：`packages/config/src/create-vite-config.ts` 的
`createScssPreprocessorOptions`，实现在 `packages/config/src/scss.ts`）：

```ts
css: {
  preprocessorOptions: {
    scss: {
      // 每份 <style lang="scss"> 文件开头统一 @use（宿主文件不要再写 @use 'bem'，避免重复引入）
      additionalData: `@use 'bem' as * with ($BEM_PREFIX: '${process.env.VITE_BEM_PREFIX ?? 'vv'}');\n`,
      // sass 模块搜索路径：指向本包 styles/tools 目录（_bem.scss 所在目录）
      loadPaths: ['<path-to>/@vv/ui/src/styles/tools'],
      // bem mixin 的 $block !global / if() 前缀拼接触发 Dart Sass 1.78+ deprecation，须静默否则 CI 红
      silenceDeprecations: ['new-global', 'if-function'],
    },
  },
}
```

> 关键点：bem mixin 在**包内**（`packages/ui/src/styles/tools/_bem.scss`），
> `loadPaths` 必须指向包内该目录；`@use` 用**裸模块名**（'bem'），不要把绝对路径写进
> `@use`（盘符冒号会被 sass 解析为 URL scheme 报 "Can't find stylesheet to import"）。
> `$BEM_PREFIX` 缺省 `'vv'`，与 TS 端 `createNamespace`（`import.meta.env.VITE_BEM_PREFIX`）
> 共享同一来源——**两处必须同步**，否则类名与选择器漂移、整片样式失效。

### ② unplugin-auto-import 注入弹窗族（运行时生死线）

包内 composable 源码按宿主装配契约书写——vue 高频 API 由宿主 `unplugin-auto-import` 注入，少数文件带显式 import 的系 §1.6.1 来源注释的刻意添加（2026-10-27 审计修正原「无显式 import」的绝对化表述）：

| `from`                               | 必须注入的标识符                                                 |
| ------------------------------------ | ---------------------------------------------------------------- |
| `'vue'` / `'vue-router'` / `'pinia'` | 全套 preset（`ref` / `computed` / `useRoute` / `defineStore` …） |
| `'@vv/ui/composables/useDialog'`     | `useDialog`                                                      |
| `'@vv/ui/composables/useConfirm'`    | `useConfirm`                                                     |
| `'@vv/ui/composables/useLogout'`     | `useLogout`                                                      |

> 三条弹窗族入口走**包子路径**（`exports "./*"` 通配解析），单一事实来源：
> `packages/config/src/create-vite-config.ts` 的 `VV_SOURCE_MODULES` 常量。
> 同模块的 `DialogCancelledError` / `setDialogAppContext` / `getDialogAppContext`
> 不注入：三者都是命令式 API 或运行时类——`DialogCancelledError` 是 `extends Error` 的
> 运行时 class（useDialog 取消时 reject 抛出，调用方 `instanceof` 判别），后两者只在
> app 入口接线——不应污染 setup 全局作用域，消费方经 `@vv/ui/composables/useDialog`
> 包子路径显式 import。

### ③ unplugin-vue-components `dirs` 扫描三目录（组件注册生死线）

包内组件**不在**根 barrel 聚合，宿主模板零 import 直接使用 `<BaseChart />` / `<ProTable />` /
`<XForm />` 依赖宿主 `unplugin-vue-components` 按目录扫描注册：

```ts
Components({
  dirs: [
    '<path-to>/@vv/ui/src/components/common', // 基础组件（ErrorPage / AsyncState / BaseChart …）
    '<path-to>/@vv/ui/src/components/ProTable', // ProTable 族
    '<path-to>/@vv/ui/src/components/form-schema', // XForm / form-schema 族
    // + 宿主私有组件目录（若有）
  ],
  deep: true, // 深扫任意深度子目录（ProDialog / XForm 等子包自动覆盖）
  dts: 'src/types/components.d.ts', // 注册声明输出到宿主，IDE 才有 GlobalComponents 类型提示
})
```

> 消费方**禁止**对三目录组件写显式 import（会让 IDE hover 丢失 DefineComponent 展开，
> 见根 CLAUDE.md §1.7）；唯一合法显式 import 场景是取 `InstanceType<typeof Xxx>` 作模板 ref 类型。

### ④ optimizeDeps.exclude 逐条点名 @vv/*（dev 生死线）

同 `@vv/shared` 的契约：源码直链包禁止 esbuild 预打包（预打包不经过 auto-import 转换 →
模块求值 ReferenceError）。宿主必须 `optimizeDeps.exclude` 点名 `@vv/ui` 及全部
`@vv/ui/composables/*` 子路径（rolldown-vite 把每个包子路径当独立 dep id，根包 exclude 不覆盖）。

## 依赖清单（peerDependencies）

宿主必须提供（版本由宿主自身决定，本仓库口径见 `pnpm-workspace.yaml` catalog）：

| 依赖                              | 用途                                          |
| --------------------------------- | --------------------------------------------- |
| `vue` / `vue-router` / `pinia`    | 组件 / composable 基建                        |
| `element-plus`                    | 组件库底座（ElMessage / ElDialog 等按需注入） |
| `lodash-es` / `dayjs`             | 工具消费                                      |
| `echarts`                         | BaseChart 系组件                              |
| `vxe-table`                       | ProTable 渲染引擎                             |
| `zod`                             | form-schema 校验                              |
| `sortablejs`                      | 拖拽排序（vxe 扩展）                          |
| `@wangeditor/editor` + `-for-vue` | RichTextEditor 组件                           |
| `dompurify`                       | 富文本 XSS 清洗                               |

另有 workspace 依赖 `@vv/shared: workspace:*`（宿主同时须满足 `@vv/shared` README 的宿主契约）。

> ⚠️ **vue 版本警示（可复用隐性地雷）**：本仓库 `pnpm-workspace.yaml` 的 `overrides`
> 把 vue 及全部 `@vue/*` 子包钉在 `beta` tag——本包全部组件与测试都跑在 Vue **beta** 上。
> 复用到使用 vue **稳定版** 的宿主时，兼容性**未经验证**，接入后必须自行跑通构建 + 单测。

## 最小宿主 vite.config 接入示例

不使用 `@vv/config` 工厂时的最小复刻：

```ts
// 宿主工程 vite.config.ts（ESM；resolve 包根用 import.meta.resolve，Node >= 20.6）
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'

const UI = path.dirname(fileURLToPath(import.meta.resolve('@vv/ui/package.json'))) // 包根目录

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      imports: [
        'vue',
        'vue-router',
        'pinia',
        { from: '@vv/ui/composables/useDialog', imports: ['useDialog'] },
        { from: '@vv/ui/composables/useConfirm', imports: ['useConfirm'] },
        { from: '@vv/ui/composables/useLogout', imports: ['useLogout'] },
      ],
      dts: 'src/types/auto-imports.d.ts',
    }),
    Components({
      dirs: [
        `${UI}/src/components/common`,
        `${UI}/src/components/ProTable`,
        `${UI}/src/components/form-schema`,
      ],
      deep: true,
      dts: 'src/types/components.d.ts',
    }),
  ],
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use 'bem' as * with ($BEM_PREFIX: 'vv');\n`,
        loadPaths: [`${UI}/src/styles/tools`],
        silenceDeprecations: ['new-global', 'if-function'],
      },
    },
  },
  optimizeDeps: {
    exclude: [
      '@vv/shared',
      '@vv/ui',
      '@vv/mock',
      '@vv/ui/composables/useDialog',
      '@vv/ui/composables/useConfirm',
      '@vv/ui/composables/useLogout',
    ],
  },
})
```

## 包结构速览

| 子路径                                           | 内容                                                                | 消费方式                                                         |
| ------------------------------------------------ | ------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `.`（根 barrel）                                 | 仅 `createGlobalComponents` 全局组件注册插件工厂                    | `app.use(createGlobalComponents())`                              |
| `./composables/{useDialog,useConfirm,useLogout}` | 弹窗族（DialogCancelledError / appContext 工具经子路径显式 import） | auto-import 注入                                                 |
| `./components/{common,ProTable,form-schema}`     | 全部全局组件                                                        | unplugin-vue-components dirs 扫描（**禁显式 import**，见契约 ③） |
| `./assets`                                       | bem.scss / 样式 / 本地图标集合                                      | scss 注入（见契约 ①）+ unplugin-icons FileSystemIconLoader       |
