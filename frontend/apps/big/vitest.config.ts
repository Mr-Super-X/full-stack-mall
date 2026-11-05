import { fileURLToPath } from 'node:url'
import { createVitestConfig } from '@vv/config'
import viteConfig from './vite.config'

// big 单测配置：随迁的 layouts/big 与 big-demo spec 消费 element-plus 组件
// （BigChart 等）——jsdom + css:true + deps.inline 口径由 @vv/config 工厂统一装配
export default createVitestConfig({
  appRoot: fileURLToPath(new URL('./', import.meta.url)),
  viteConfig,
})
