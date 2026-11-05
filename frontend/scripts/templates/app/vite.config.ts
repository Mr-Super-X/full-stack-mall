/**
 * Vite 工程配置（__APP_NAME__ 消费端）
 *
 * 插件装配 / 别名 / css 预处理 / 构建分包全部收敛到 @vv/config 的 createViteConfig 工厂
 * （packages/config/src/create-vite-config.ts，单一来源）；本文件只声明 appRoot——
 * appId 与 dev/HMR 端口自同目录 app.manifest.json 单源派生（P2，2026-10-27），
 * 不再传 appName/portOffset（消灭 vite.config ↔ 注册表双写）。
 *
 * base 经 VITE_BASE 注入：gh-pages 聚合构建（scripts/build-pages.ts）按
 * /vue3-vite-project/<app>/ 注入；CLI --base 优先级更高（vite 语义）。
 */
import { fileURLToPath } from 'node:url'
import { createViteConfig } from '@vv/config'

const appRoot = fileURLToPath(new URL('.', import.meta.url))

// https://vite.dev/config/
export default createViteConfig({
  appRoot,
})
