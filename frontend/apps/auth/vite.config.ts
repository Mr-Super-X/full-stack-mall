/**
 * Vite 工程配置（auth 统一登录应用）
 *
 * 插件装配 / 别名 / css 预处理 / 构建分包全部收敛到 @vv/config 的 createViteConfig 工厂
 * （packages/config/src/create-vite-config.ts，单一来源）；本文件只声明 app 参数。
 * 端口偏移 +5（admin 5174 / docs 5175 / portal 5176 / h5 5177 / big 5178 / auth 5179
 * 可并行 dev）。
 *
 * base 经 VITE_BASE 注入：gh-pages 多应用聚合构建（scripts/build-pages.ts 自动发现
 * apps/*）按 /vue3-vite-project/auth/ 注入；CLI --base 优先级更高（vite 语义）。
 *
 * 历史：
 *   - 2026-10-22: P4 新建（auth 模块从 apps/admin 独立，跨应用统一登录协议落地）
 */
import { fileURLToPath } from 'node:url'
import { createViteConfig } from '@vv/config'

const appRoot = fileURLToPath(new URL('.', import.meta.url))

// https://vite.dev/config/
export default createViteConfig({
  appRoot,
})
