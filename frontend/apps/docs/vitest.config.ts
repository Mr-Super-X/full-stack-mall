import { fileURLToPath } from 'node:url'
import { createVitestConfig } from '@vv/config'
import viteConfig from './vite.config'

// docs 不配置 coverage 阈值：站点内容几乎全是 demo 示例（经浏览器人工验收），
// 单测只覆盖 demo 自有的 composables/config；设阈值会逼出为凑数而写的 demo 断言
export default createVitestConfig({
  appRoot: fileURLToPath(new URL('./', import.meta.url)),
  viteConfig,
})
