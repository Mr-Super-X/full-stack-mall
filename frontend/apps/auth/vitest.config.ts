import { fileURLToPath } from 'node:url'
import { createVitestConfig } from '@vv/config'
import viteConfig from './vite.config'

// auth 不配置 coverage 阈值：app 只含登录页 + blank 布局（经浏览器人工验收），
// 单测只覆盖 auth 模块随迁的 spec；设阈值会逼出为凑数而写的无意义断言
export default createVitestConfig({
  appRoot: fileURLToPath(new URL('./', import.meta.url)),
  viteConfig,
})
