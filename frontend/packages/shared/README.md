# @vv/shared

共享基建包：网络层（http / cache / retry / token-refresh）+ 全局 store（app / user / theme / dict）+ 项目 composables（`useAppRouter` / `useRequest` / `useAuth` / `useDict` / `useTheme`）+ BEM 工具（`createNamespace`）+ 跨应用统一登录协议。

> **消费形态（必读）**：本包是 pnpm workspace **源码直链包**（`workspace:*` 链接、`"private": true`），
> **不是 npm 发布包**——不建 dist、不经打包发布，宿主构建期直接编译包内 `.ts` 源码。
> 自 **P0（2026-10-27）共享包自包含改造**起，本包生产源码**全量显式 import**——
> 不再依赖宿主 `unplugin-auto-import` 补齐 `ref/defineStore/ElMessage` 等自由变量，
> 包级 Vitest 配置已摘除该插件（测试通过即运行时自包含的权威证明）。
> **换宿主前只需具备 Vue3 + Vite（import.meta.env 体系）+ 下方依赖清单**，详见「宿主装配契约」。

## 宿主装配契约（前置条件）

### ① 生产源码零注入依赖（2026-10-27 P0 起）

包内生产源码**全量显式 import**——不再依赖宿主 `unplugin-auto-import` 补齐自由变量；
包级 Vitest 配置（`vitest.config.ts`）已无该插件，测试通过即运行时自包含的权威证明。
宿主只需具备：Vue3 + Vite（`import.meta.env` 体系）+ 下方依赖清单。
（历史：改造前本节前身为「unplugin-auto-import 按清单注入」，已随 P0 退役。）

### ② optimizeDeps.exclude（存量防退化，待验证收敛）

> P0 后 shared 源码已无注入式自由变量，本条对 shared 属**存量防退化配置**；
> @vv/ui 仍是注入式源码（未迁移），整条 exclude 保留。待真实 dev 冷启动验证后另行评估删减。

源码直链包**禁止 esbuild 预打包**：预打包不经过 auto-import 转换，包内被注入的
`defineStore` / `ref` 会成为自由变量 → dev 冷缓存模块求值即 `ReferenceError`。
（注：此风险对 P0 后的 @vv/shared 已消除——其源码已显式 import；本节主要为 @vv/ui 保留。）

```ts
optimizeDeps: {
  // 根包 exclude 不覆盖子路径：rolldown-vite 扫描器把每个包子路径当独立 dep id，
  // 三条弹窗族注入入口（@vv/ui/composables/*）必须逐条点名
  exclude: ['@vv/shared', '@vv/ui', '@vv/mock',
    '@vv/ui/composables/useDialog', '@vv/ui/composables/useConfirm', '@vv/ui/composables/useLogout'],
}
```

### ③ VITE_BEM_PREFIX 注入（可选，缺省 `'vv'`）

`createNamespace`（`src/utils/bem.ts`）运行时读 `import.meta.env.VITE_BEM_PREFIX` 决定 BEM 类名前缀，
未注入时回退 `'vv'`。宿主若要自定义前缀：vite `define` 注入同名变量，且 **SCSS 侧
`$BEM_PREFIX` 必须同步**（SCSS 注入装配见 `@vv/ui` README——两处共享同一来源，不同步则
TS 端类名与 CSS 选择器漂移、整片样式失效）。

## 依赖清单（peerDependencies）

宿主必须提供以下包（版本由宿主自身 catalog / dependencies 决定，本仓库口径见
`pnpm-workspace.yaml` catalog）：

| 依赖                                                           | 用途                                                 |
| -------------------------------------------------------------- | ---------------------------------------------------- |
| `vue` / `vue-router` / `pinia` / `pinia-plugin-persistedstate` | 响应式 / 路由 / 状态管理基建                         |
| `axios`                                                        | 网络层硬依赖（`src/api/http.ts` 模块加载即建实例）   |
| `vue-i18n`                                                     | locales 子路径消费时（根 barrel 刻意不聚合 locales） |
| `element-plus` / `lodash-es` / `dayjs`                         | composable / store 内零散消费                        |

> ⚠️ **vue 版本警示（可复用隐性地雷）**：本仓库 `pnpm-workspace.yaml` 的 `overrides`
> 把 vue 及全部 `@vue/*` 子包钉在 `beta` tag——本包的全部开发与测试都跑在 Vue **beta** 上。
> 复用到使用 vue **稳定版** 的宿主时，兼容性**未经验证**（`peerDependencyRules.allowAny` +
> catalog `^3.5.38` 允许宿主装稳定版，但行为无保障），接入后必须自行跑通构建 + 单测。

## 最小宿主 vite.config 接入示例

不使用 `@vv/config` 工厂时的最小复刻（两个插件的完整装配见
`packages/config/src/create-vite-config.ts`）：

```ts
// 宿主工程 vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      imports: [
        'vue',
        'vue-router',
        'pinia',
        {
          from: '@vv/shared',
          imports: ['useAppRouter', 'useRequest', 'useAuth', 'useDict', 'createNamespace'],
        },
      ],
      // dts 声明输出到宿主 src/types，IDE 才能识别注入的标识符
      dts: 'src/types/auto-imports.d.ts',
    }),
  ],
  optimizeDeps: { exclude: ['@vv/shared', '@vv/ui', '@vv/mock'] },
  // BEM 前缀自定义时才需要（缺省 'vv'；SCSS 侧须同步注入 $BEM_PREFIX，见 @vv/ui README）：
  // define: { 'import.meta.env.VITE_BEM_PREFIX': JSON.stringify('acme') },
})
```

## 包结构速览

| 子路径                                    | 内容                                                                            | 消费方式                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------- |
| `.`（根 barrel）                          | utils / enums / types / 5 个 composable / store barrel / router 基建 / 登录协议 | auto-import 注入 + 显式 import                 |
| `./store`                                 | 全局 store barrel（app / user / theme / dict）                                  | auto-import（`defineStore` 注入）或显式 import |
| `./router-guards`                         | 通用路由守卫骨架                                                                | 显式 import                                    |
| `@api` / `@composables` / `@utils` 等别名 | 包内对应子目录（宿主别名装配见 `@vv/config` 的 `createAppAliases`）             | 视宿主别名配置                                 |

根 barrel **刻意不聚合**（import 即副作用，仅 Vite 上下文可执行）：
`./locales`（模块加载即 createI18n）、`./directives`（import.meta.glob 自动注册）、
`./api`（模块加载即建 axios 实例）——按需经子路径 / 别名消费。
