/**
 * Vite 工程配置（docs 消费端）
 *
 * 插件装配 / 别名 / css 预处理 / 构建分包全部收敛到 @vv/config 的 createViteConfig 工厂
 * （packages/config/src/create-vite-config.ts，单一来源）；本文件只声明 app 参数。
 * 与 admin 的差异：无 vueDevTools / visualizer 私有插件、无 h5Rem（h5 布局归 admin）、
 * 端口偏移 +1（admin 5174 / docs 5175 可并行 dev）。
 *
 * base 经 VITE_BASE 注入：gh-pages 双应用聚合构建（scripts/build-pages.ts）按
 * /vue3-vite-project/docs/ 注入；CLI --base 优先级更高（vite 语义）。
 *
 * 历史：
 *   - 2026-10-22: P2 新建（demo 文档站独立为 apps/docs，Monorepo 迁移）
 */
import { fileURLToPath } from 'node:url'
import { createViteConfig } from '@vv/config'

const appRoot = fileURLToPath(new URL('.', import.meta.url))

// https://vite.dev/config/
export default createViteConfig({
  appRoot,
})
