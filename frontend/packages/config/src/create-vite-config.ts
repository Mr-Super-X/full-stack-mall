/**
 * Vite 配置工厂（Monorepo 单一出口）
 *
 * 定位：把「插件装配 + 路径别名 + css 预处理 + 构建分包」收敛为包内唯一实现，
 * 各 app 的 vite.config.ts 只声明 app 参数（appRoot/appName/mockPath/...）与私有插件。
 *
 * 迁移注记：
 *   - packages/ui 已落地（P1-4）：组件目录 / 本地图标集合 / scss bem mixin 均经
 *     UI_SRC_DIR 直取包源码；resolvePkgFirst 的 legacy 回落留待 P5 清理
 *   - AutoImport：已迁入 @vv/shared 的 composables/utils 走包名注入（from: '@vv/shared'）；
 *     弹窗族（useDialog/useConfirm/useLogout）自 P1-4 随迁 @vv/ui，走 '@vv/ui/composables/*'
 *     包子路径注入（exports "./*" 通配解析）
 */
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import type { ComponentResolver } from 'unplugin-vue-components/types'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
// unplugin-vue-components v32 已移除内置 IconsResolver，图标解析器改从 unplugin-icons/resolver 导入
import Icons from 'unplugin-icons/vite'
import IconsResolver from 'unplugin-icons/resolver'
import { FileSystemIconLoader } from 'unplugin-icons/loaders'
import { viteMockServe } from 'vite-plugin-mock'
import { defineConfig, loadEnv, type PluginOption } from 'vite'

// 包内相对导入必须带 .ts 扩展名（同 index.ts 注释：Node 原生 ESM 不补全扩展名）
import { createAppAliases, resolvePkgFirst, UI_SRC_DIR } from './app-aliases.ts'
import { cleanMockBundled } from './clean-mock-bundled.ts'
import { versionCheckVitePlugin } from './version-check-vite.ts'
import { createPostcssPlugins } from './postcss.ts'
import { createProxyConfig } from './proxy.ts'
import { createScssPreprocessorOptions } from './scss.ts'
import { SERVER_DEFAULTS } from './server.ts'
import { VENDOR_CHUNKS } from './vendor-chunks.ts'
import { readAppManifest } from './app-manifest.mjs'

/** auto-import 注入条目（unplugin-auto-import v21 数组语法：{ from, imports }） */
interface VvAutoImportEntry {
  from: string
  imports: Array<string | { name: string; as: string }>
}

/**
 * 以源码级消费的 @vv/* workspace 模块清单 —— 单一事实来源（新增包/子路径只改这里）：
 *   ① optimizeDeps.exclude 逐条点名禁止 esbuild 预打包（2026-10-22 P4 实证：预打包不经
 *     auto-import 转换，shared store 内注入的 defineStore/ref 会成为自由变量 → 模块求值即
 *     ReferenceError；rolldown-vite 扫描器把每个包子路径当独立 dep id，根包 exclude 不覆盖
 *     子路径，composables/* 三条注入入口必须逐条点名）；
 *   ② 下方 AutoImport 的 from 字段从本清单派生（imports 非空的条目），同组包两处点名曾
 *     是双写漂移点，收敛后不可能再偏。
 * imports 为空的条目（'@vv/ui' 根包 / '@vv/mock'）只被显式 import（SFC 组件、mock 源），
 * 不经 auto-import 注入，仅参与 ① 的 exclude。
 *
 * 复杂度预算（2026-10-28 /autoplan C5 裁决）：本清单刻意显式——imports 列名不走
 * dirs 自动扫描（避免误扫 *.spec.ts 与内部 API 污染 setup 全局作用域），故**不做
 * 目录扫描/导出解析式派生化**。新增注入条目的门槛：必须附本注释同款事故记录
 * （什么坑导致需要这条），条目总数超过 12 时触发「app 侧改显式 import」复审。
 */
const VV_SOURCE_MODULES: readonly VvAutoImportEntry[] = [
  {
    from: '@vv/shared',
    imports: [
      // useAppRouter 是项目自研的路由高层 API（区别于 vue-router 自带的 useRouter）
      'useAppRouter',
      // 业务侧高频 composables：显式列名不走 dirs 自动扫描——避免误扫同目录 *.spec.ts
      'useRequest',
      'useAuth',
      // 字典组合式 API（契约形态按 code 解构）
      'useDict',
      // BEM 类名工具
      'createNamespace',
    ],
  },
  { from: '@vv/ui', imports: [] },
  { from: '@vv/mock', imports: [] },
  // 弹窗族（useDialog/useConfirm/useLogout）自 P1-4 起随组件归 @vv/ui，from 走包子路径
  // （exports "./*" 通配 → ./src/composables/*）。同模块的 DialogCancelledError /
  // setDialogAppContext / getDialogAppContext 不注入：第一个是类型（不参与运行时），
  // 后两个只在 main.ts / useConfirm 内部调用（不应污染 setup 全局作用域）
  { from: '@vv/ui/composables/useDialog', imports: ['useDialog'] },
  // useConfirm：二次确认；取消时 resolve(false) 而非 reject，调用方无须 try/catch
  { from: '@vv/ui/composables/useConfirm', imports: ['useConfirm'] },
  { from: '@vv/ui/composables/useLogout', imports: ['useLogout'] },
]

export interface AppViteOptions {
  /** app 根目录（绝对路径，调用方用 fileURLToPath(new URL('.', import.meta.url))） */
  appRoot: string
  /**
   * app 标识与 dev/HMR 端口自 `appRoot/app.manifest.json` 单源派生（P2，2026-10-27），
   * 不再由调用方传 appName/portOffset（消灭 vite.config ↔ apps-registry 双写）。
   */
  /**
   * vite base；缺省读 VITE_BASE 环境变量（`?? '/'`）。CLI --base 优先级更高（gh-pages
   * 聚合构建 scripts/build-pages.ts 走 CLI 注入）。原 6 app 逐字同构的
   * `process.env.VITE_BASE ?? '/'` 收敛为工厂缺省（2026-10-23 重复性审查）
   */
  base?: string
  /**
   * mock 目录绝对路径（vite-plugin-mock 以 isAbsPath 判定，dist/index.mjs:224，须绝对路径）；
   * 缺省 `path.join(appRoot, '../../packages/mock/src')`（@vv/mock 包源码——6 app 均此值，
   * 2026-10-23 收敛为工厂缺省）。无 mock 依赖的 app 传空串 '' 退出（falsy 不挂
   * vite-plugin-mock 与 cleanMockBundled）
   */
  mockPath?: string
  /** h5 rem 适配开关（postcss-pxtorem，作用域 appRoot/src/layouts/h5 与 src/modules/h5-*） */
  h5Rem?: boolean
  /** app 私有插件（如 vite-plugin-vue-devtools / rollup-plugin-visualizer） */
  extraPlugins?: PluginOption[]
  /**
   * app 级组件库 resolver 扩展（2026-10-27 vant 集成引入）：注入到 Components 插件的
   * resolvers 数组（ElementPlusResolver 之后、IconsResolver 之前——图标 resolver 只认
   * i- 前缀，顺序不影响；EP resolver 只认 El 前缀，vant 的 Van 前缀无冲突）。
   *
   * 为什么不开 extraPlugins 加第二实例：vite 按插件 name 去重，两个同名
   * unplugin-vue-components 实例后者被静默忽略（vant 集成实测踩坑——<van-button>
   * 解析失败回退为原生自定义元素，组件不渲染）。
   *
   * @example h5 集成 vant 4
   * ```ts
   * import { VantResolver } from 'unplugin-vue-components/resolvers'
   * createViteConfig({ ..., componentResolvers: [VantResolver()] })
   * ```
   */
  componentResolvers?: ComponentResolver[]
}

export function createViteConfig({
  appRoot,
  base = process.env.VITE_BASE ?? '/',
  mockPath = path.join(appRoot, '../../packages/mock/src'),
  h5Rem = false,
  extraPlugins = [],
  componentResolvers = [],
}: AppViteOptions) {
  // P2（2026-10-27）：appId 与 dev/HMR 端口自 app.manifest.json 单源派生（消灭 appName/portOffset 双写）
  const manifest = readAppManifest(appRoot)
  const appName = manifest.name
  const devPort = manifest.port
  // 本地 app 图标集合（i-app-*）：P1-4 起命中 @vv/ui 包源码（existsSync 自动切换，
  // legacyRoot 回落仅作过渡兜底，P5 清理）
  const iconsDir = resolvePkgFirst(
    path.join(UI_SRC_DIR, 'assets/icons'),
    path.join(appRoot, 'src/assets/icons')
  )

  return defineConfig(({ mode }) => ({
    base,
    plugins: [
      vue(),
      vueJsx(),
      UnoCSS(),
      AutoImport({
        imports: [
          'vue',
          'vue-router',
          'pinia',
          // 业务侧注入条目由 VV_SOURCE_MODULES 派生（单源，见常量头注）
          ...VV_SOURCE_MODULES.filter((entry) => entry.imports.length > 0),
        ],
        resolvers: [
          // importStyle: 'css' —— 组件/API（ElMessage 等）样式按需自动注入，
          // main.ts 不再全量引入 element-plus/dist/index.css（gzip 省 ~30KB）
          ElementPlusResolver({ importStyle: 'css' }),
        ],
        dts: path.join(appRoot, 'src/types/auto-imports.d.ts'),
      }),
      // ===== 图标体系（docs/39）=====
      // 编译期把模板中的 <i-ep-plus /> 等标签解析为内联 SVG Vue 组件，
      // 图标按需打包、产物零外部请求（插件只认 ~icons/* 虚拟模块导入）
      Icons({
        compiler: 'vue3',
        customCollections: {
          // app 集合：本地 SVG 资产（git 管理），编译期由 FileSystemIconLoader 读取；
          // transform 把非 none 的 fill/stroke 强制 currentColor，使图标跟随父级 color / CSS 变量换色
          app: FileSystemIconLoader(iconsDir, (svg) =>
            svg
              .replace(/fill="(?!none")[^"]*"/g, 'fill="currentColor"')
              .replace(/stroke="(?!none")[^"]*"/g, 'stroke="currentColor"')
          ),
        },
      }),
      Components({
        resolvers: [
          ElementPlusResolver({ importStyle: 'css' }),
          // app 级组件库扩展位（如 h5 的 VantResolver）——注入在 EP 之后、图标之前；
          // 前缀命名空间隔离（El / Van / i-）保证互不干扰，见 AppViteOptions.componentResolvers
          ...componentResolvers,
          // 图标标签解析：只放行 ep / tabler / app 三个集合，
          // 写错集合名/图标名的 i-* 标签不被解析 → 构建期虚拟模块解析失败直接报错
          IconsResolver({
            prefix: 'i',
            enabledCollections: ['ep', 'tabler'],
            customCollections: ['app'],
          }),
        ],
        // 声明要自动导入的全局组件 —— 目录下所有 .vue（deep: true 含任意深度子目录）
        // 均注册到 vue.GlobalComponents，消费方模板直接用 <BaseChart /> / <ProTable /> /
        // <XForm /> 等，不要显式 import（CLAUDE.md §1.7 强约束）
        // P1-4 起三个包目录命中 @vv/ui 源码；appRoot/src/components 已删除，
        // existsSync 过滤后仅作未来 app 私有组件目录的扩展位
        dirs: [
          path.join(UI_SRC_DIR, 'components/common'),
          path.join(UI_SRC_DIR, 'components/ProTable'),
          path.join(UI_SRC_DIR, 'components/form-schema'),
          path.join(appRoot, 'src/components'),
        ].filter((dir) => existsSync(dir)),
        deep: true,
        dts: path.join(appRoot, 'src/types/components.d.ts'),
      }),
      // mock 启用开关由 VITE_USE_MOCK 控制（2026-07-27 切换）。
      // dev 默认开启：VITE_USE_MOCK=undefined 时 `!== 'false'` 判定为 true。
      // ⚠️ 此处读 process.env（config 装配期）——vite 的 .env 文件只注入
      // import.meta.env，不进 process.env：.env 里设 VITE_USE_MOCK=false 对本开关
      // **无效**（2026-10-28 /autoplan R2-E7 口径修正，README §环境变量表同口径）。
      // 联调真实后端必须经 shell env：`VITE_USE_MOCK=false pnpm -C apps/<a> dev`。
      // （import.meta.env.VITE_USE_MOCK 的另一消费点是 prod-mock.ts 的 PROD 判定，
      // 只读 prod 构建态——与 dev 中间件开关互不干扰。）
      // 共享默认层（2026-11-09 同 baseURL）：经 loadEnv 读 app > 仓库根 .env 的
      // VITE_USE_MOCK——根 .env 一键切全 app mock/真后端开关，app/shell 仍可覆盖。
      // mockPath 为绝对路径（vite-plugin-mock 以 isAbsPath 判定，dist/index.mjs:224）
      ...(mockPath
        ? [
            viteMockServe({
              mockPath,
              enable:
                (loadEnv(mode, appRoot, 'VITE_').VITE_USE_MOCK ??
                  loadEnv(mode, path.join(appRoot, '../../'), 'VITE_').VITE_USE_MOCK ??
                  process.env.VITE_USE_MOCK) !== 'false',
              watchFiles: true,
            }),
            // 清理 vite-plugin-mock 在 mock/ 生成的 _*.bundled_*.mjs 临时文件；
            // 必须显式传 mockPath——dev cwd 是 app 目录，cwd 相对解析会静默空转
            cleanMockBundled(mockPath),
          ]
        : []),
      // 版本检测（构建侧）：build 时往 outDir 写 version.json（runtime 轮询消费，见
      // packages/shared/src/plugins/versionCheck.ts）；apply: 'build'，dev serve 零开销
      versionCheckVitePlugin(),
      // dev 启动引导（2026-10-28 D1）：打印访问地址与场景提示，消除「dev 起来后不知道打开哪、
      // 为什么 404」的新人摩擦（README 快速开始已同步收敛为单一推荐路径）
      {
        name: 'vv-dev-welcome',
        apply: 'serve',
        configureServer(server) {
          server.httpServer?.once('listening', () => {
            const addr = server.httpServer?.address()
            const port = typeof addr === 'object' && addr ? addr.port : devPort
            console.log(
              `\n  ➜ ${appName}: http://localhost:${port}${base}\n` +
                '  ➜ 未登录跳 /auth/login 在单 app 模式 404 属预期（auth 独立端口）；跨应用登录用 pnpm dev:gateway\n' +
                '  ➜ 多应用同域规范入口：dev:gateway 起后 http://localhost:8080/（/ 302 → /portal/，对齐生产 nginx rootRedirect）\n' +
                (appName === 'admin'
                  ? '  ➜ admin 免登录演示：.env.development 加 VITE_DEMO_NO_AUTH=true 直达 /workbench\n'
                  : '')
            )
          })
        },
      },
      ...extraPlugins,
    ],
    define: {
      'import.meta.env.VITE_APP_ID': JSON.stringify(appName),
      // 统一注入 API baseURL——优先级：shell env > app .env > 仓库根 .env（共享默认）> '/api' 保底。
      // ⚠️ 机制事实（2026-10-26 mock 前缀统一实测踩坑）：esbuild define 对
      // `import.meta.env.X` 的精确键替换优先于 Vite 的 .env 注入——define 写死
      // 保底值时 .env 里的同键配置永远不会生效（浏览器实测 baseURL 仍为保底值，
      // 登录 404）。故 define 的值必须自行经 loadEnv 合并 .env 文件。
      // 文件读取按构建 mode 取对应 env 文件（2026-10-28 /autoplan E1 修复）：
      // dev  mode='development' → .env.development（各 app 配 /mock）；
      // prod mode='production'  → .env.production（无该键，落 '/api' 保底）。
      // 修复前固定 mode='development' 且注释错称「prod 不读该文件」——实际 loadEnv 按
      // 显式传入的 mode 读文件，致本地 pnpm build 产物把 /mock 打进生产包（构建不可复现）。
      // gh-pages 由 build-pages.ts 注入 shell env，优先级最高，不受影响。
      // 统一环境配置（2026-11-09 改造，用户批准）：仓库根 .env 放公共默认，app 级只写覆盖项，
      // 根治 per-app 错配漏配（auth 漏配 mock/真后端割裂致 Ctrl+F5 登录被踢回登录页的事故）。
      // baseURL **由 VITE_USE_MOCK 开关推导**（开=mock=/mock，关=真后端=/api）——单一开关
      // 一键切换，避免 VITE_USE_MOCK 与 VITE_API_BASE_URL 双变量矛盾；仅当 app 显式配
      // VITE_API_BASE_URL（连非默认后端）时才覆盖推导值。优先级：shell > app > 根 > 推导。
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(
        process.env.VITE_API_BASE_URL ??
          loadEnv(mode, appRoot, 'VITE_').VITE_API_BASE_URL ??
          loadEnv(mode, path.join(appRoot, '../../'), 'VITE_').VITE_API_BASE_URL ??
          ((loadEnv(mode, appRoot, 'VITE_').VITE_USE_MOCK ??
            loadEnv(mode, path.join(appRoot, '../../'), 'VITE_').VITE_USE_MOCK ??
            process.env.VITE_USE_MOCK) !== 'false'
            ? '/mock'
            : '/api')
      ),
    },
    // 浏览器消费的 @vv/* 源码链接包禁止预打包（2026-10-22 P4 实证）：
    // esbuild 预打包不经 unplugin-auto-import 转换，shared store 内 auto-import 注入的
    // defineStore/ref 在 bundle 里是自由变量 → 模块求值即 ReferenceError（dev 冷缓存必现）；
    // 排除后按源码 /@fs/ 逐个服务，auto-import 正常注入且 HMR 生效（portal/h5/big 长期形态）。
    // 注：rolldown-vite 扫描器把每个包子路径当独立 dep id（根包 exclude 不覆盖），
    // composables/* 三条 auto-import 注入入口须逐条点名——清单单源 VV_SOURCE_MODULES
    optimizeDeps: {
      exclude: VV_SOURCE_MODULES.map((entry) => entry.from),
    },
    server: {
      ...SERVER_DEFAULTS,
      port: devPort,
      // HMR WebSocket 直连本 app dev server 端口，绕过 8080 nginx 网关——
      // vite client 的 ws URL = ws://host:port/__HMR_BASE__（__HMR_BASE__=config.base=/<app>/），
      // 经网关 8080 时 nginx 的 /<app>/ HTTP 反代把 ws upgrade 当普通请求转发，vite ws handler
      // 收不到正确 upgrade（client:865 WebSocket connection to ws://localhost:8080/<app>/ failed）。
      // 让 client 直连 5174-5179（vite 原生 ws 端点，hmrBase=/<app>/ 匹配），HMR 恢复。
      // host 显式 localhost：避免 vite 默认取 network IP 致 client 连不通。
      hmr: {
        host: 'localhost',
        port: devPort,
        clientPort: devPort,
      },
      // 联调真实后端时在 proxy.ts 内按需补充 _env 字段解析（当前返回 {} 占位）
      proxy: createProxyConfig(process.env),
    },
    // legacyRoot 传 appRoot 自身：resolvePkgFirst 的过渡兜底（包已全落地，P5 清理）
    resolve: { alias: createAppAliases(appRoot, appRoot) },
    css: {
      // h5 rem 适配（postcss-pxtorem）：enableRem=true 时仅转换 appRoot/src 下
      // layouts/h5 与 modules/h5-*（见 postcss.ts）；false 时零插件
      postcss: { plugins: createPostcssPlugins({ appRoot, enableRem: h5Rem }) },
      preprocessorOptions: {
        // additionalData 注入到每个 <style lang="scss"> / .scss 文件开头，让 bem mixin
        // 通过 $BEM_PREFIX 自动拼前缀；与 src/utils/bem.ts 的 import.meta.env.VITE_BEM_PREFIX
        // 共享同一来源（环境变量，未设置时回退 'vv' 保持向后兼容）。
        //
        // 关键技术点：sass 的 @use 模块化语义要求「变量只在 module 内部定义」，用 with 语法
        // 把变量值注入到 bem 模块内部的 !default 兜底；调用方文件不要再写 @use 'bem'，
        // 避免重复引入——由本 additionalData 统一引入。
        //
        // silenceDeprecations（'new-global' / 'if-function'）原因见 scss.ts。
        //
        // R-B：bemPath 用绝对路径（包化后 cwd 不再是注入参照系）；
        // P1-4 起指 @vv/ui 包内路径（bem.scss 随 assets 迁包）；
        // 2026-11-03 样式目录骨架化：mixins/ 更名 tools/（sass partial _bem.scss）；
        // 同日起 styles/ 自 assets/ 上移 src/styles/（assets/ 只留静态资源）
        scss: createScssPreprocessorOptions({
          bemPath: path.join(UI_SRC_DIR, 'styles/tools/bem'),
        }),
        less: { javascriptEnabled: true },
      },
    },
    build: {
      target: 'es2022',
      sourcemap: false,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        // 显式启用 tree-shaking（true = rolldown 默认推荐配置）
        // 注：Vite 8 用 rolldown 替代 rollup，类型只接受 boolean | TreeshakingOptions，
        // 不再支持 'recommended' 字符串；需精细化定制（manualPureFunctions / moduleSideEffects
        // 等）时改 TreeshakingOptions 对象，字段说明见 @rolldown/types
        treeshake: true,
        output: {
          // ===== 产物文件分类输出：js / css / img 分目录，其它资源归 assets/ =====
          // 目的：dist 目录结构清晰，运维可按目录维度排查问题 + CDN 按目录配置差异化缓存策略
          // 注：rolldown 兼容 rollup 的 entryFileNames / chunkFileNames / assetFileNames 语义
          entryFileNames: 'js/[name]-[hash].js',
          chunkFileNames: 'js/[name]-[hash].js',
          assetFileNames(assetInfo) {
            // 按资源扩展名分目录：css → css/；常见图片 → img/；字体等其它资源 → assets/
            // 注：rolldown 的 PreRenderedAsset.name 已 @deprecated，改用 names 数组（取首个原始文件名判定）
            const assetName = assetInfo.names[0] ?? ''
            if (assetName.endsWith('.css')) return 'css/[name]-[hash][extname]'
            const IMG_EXTENSIONS = [
              '.png',
              '.jpg',
              '.jpeg',
              '.gif',
              '.svg',
              '.webp',
              '.ico',
              '.bmp',
              '.avif',
              '.tiff',
              '.apng',
            ]
            if (IMG_EXTENSIONS.some((ext) => assetName.endsWith(ext)))
              return 'img/[name]-[hash][extname]'
            return 'assets/[name]-[hash][extname]'
          },
          // 手动拆分第三方库（vendor chunk）→ 利用浏览器强缓存
          // 业务代码 (src/) 变化时只更新业务 chunk，第三方库 chunk 命中缓存
          // 注：Vite 8 用 rolldown 替代 rollup，manualChunks 必须是函数（不能是对象）
          manualChunks(id) {
            // 业务代码不归 vendor
            if (!id.includes('node_modules')) return undefined
            // VENDOR_CHUNKS 来自 vendor-chunks.ts —— 顺序敏感（vue → ui → charts），
            // 先匹配先返回，新加组必须 append 到末尾
            for (const { name, patterns } of VENDOR_CHUNKS) {
              if (patterns.some((pattern) => id.includes(pattern))) return name
            }
            // 其他第三方库：axios / vue-i18n / 等
            return 'vendor-utils'
          },
        },
      },
    },
  }))
}
