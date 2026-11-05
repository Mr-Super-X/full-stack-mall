import { fileURLToPath } from 'node:url'
import { createVitestConfig } from '@vv/config'
import viteConfig from './vite.config'

// 传完整 vite.config（与 docs/portal 同口径）：spec 经 vite import-analysis 转换时会
// 解析被测模块里的 `@/` 别名与 `.vue` 引用——空 defineConfig({}) 无 alias 直接
// "Failed to resolve import"（packages/shared 的空配置形态不适用于 app）。
// 不配置 coverage 阈值：骨架仅路由 smoke spec，阈值待有真实业务模块后再设
export default createVitestConfig({
  appRoot: fileURLToPath(new URL('./', import.meta.url)),
  viteConfig,
})
