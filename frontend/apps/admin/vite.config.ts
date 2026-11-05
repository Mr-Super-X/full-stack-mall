/**
 * Vite 工程配置（admin 消费端）
 *
 * 插件装配 / 别名 / css 预处理 / 构建分包全部收敛到 @vv/config 的 createViteConfig 工厂
 * （packages/config/src/create-vite-config.ts，单一来源）；本文件只声明 app 参数与
 * admin 私有插件（vueDevTools / visualizer）。
 *
 * 历史：
 *   - 2026-09-10: 抽出 SRC_DIR_ALIASES / vendorChunks / server / scss 到 build/* 单一来源
 *     （单应用时代；v3.0.0 Monorepo 迁移后该 build/ 目录已整体随迁为 @vv/config 包，见下条）
 *   - 2026-10-22: P1-1 收敛为 @vv/config 工厂消费（Monorepo 迁移）
 */
import { fileURLToPath } from 'node:url'
import vueDevTools from 'vite-plugin-vue-devtools'
import { visualizer } from 'rollup-plugin-visualizer'
import { createViteConfig } from '@vv/config'

const appRoot = fileURLToPath(new URL('.', import.meta.url))

// https://vite.dev/config/
export default createViteConfig({
  appRoot,
  // h5-demo 模块与 h5 layout 已抽离到 apps/h5，rem 转换责任随迁
  // （postcss.ts 转换范围锚定各 appRoot，admin 关闭后零污染；apps/h5 开 h5Rem: true）
  h5Rem: false,
  extraPlugins: [
    vueDevTools(),
    // 包体积分析（默认关闭，通过 ANALYZE=true 启用）
    // peerDeps 支持 rolldown 1.x（Vite 8 用），无需额外配置
    ...(process.env.ANALYZE === 'true'
      ? [
          visualizer({
            filename: 'dist/stats.html',
            gzipSize: true,
            brotliSize: true,
            template: 'treemap', // 树状图，模块层级清晰
          }),
        ]
      : []),
  ],
})
