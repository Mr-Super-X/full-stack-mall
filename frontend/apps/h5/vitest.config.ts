import { fileURLToPath } from 'node:url'
import { mergeConfig } from 'vitest/config'
import { createVitestConfig } from '@vv/config'
import viteConfig from './vite.config'

// h5 不配置 coverage 阈值：h5-demo 示例页以浏览器验收为主，
// 单测只覆盖 h5 自有的 composables/config/layouts；设阈值会逼出为凑数而写的断言。
// vant 4 组件样式经 JS import css（vant/es/*/style/index 内部 import css），vitest 需 inline
// 打进测试进程，否则 Node 直加载 .css 报 Unknown file extension。工厂 deps.inline 默认仅
// element-plus，此处 mergeConfig 追加 vant（数组拼接，不改工厂——packages/config 锁定不动）。
export default mergeConfig(
  createVitestConfig({
    appRoot: fileURLToPath(new URL('./', import.meta.url)),
    viteConfig,
  }),
  { test: { server: { deps: { inline: ['vant'] } } } }
)
