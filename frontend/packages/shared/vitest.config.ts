/**
 * @vv/shared 单测配置（vitest）
 *
 * P0（2026-10-27）：包源码全量显式 import，测试不再需要 AutoImport 插件补齐
 * 自由变量。装配走 @vv/config 工厂 createVitestConfig（css:true + EP inline 口径
 * 单源）——本包无 .vue 组件，viteConfig 传最小空配置即可。
 *
 * 为什么 css 必须 true：源码显式 import 的 element-plus `*.css` 副作用在
 * Node 无加载器（ERR_UNKNOWN_FILE_EXTENSION）——css:true + deps.inline
 * （EP 组件经 inline 打进测试进程）是仓库既有统一口径（工厂注释同述）。
 * 单测只验证逻辑与样式 import 的存在性，样式渲染正确性由浏览器冒烟兜底。
 */
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { createVitestConfig } from '@vv/config'

export default createVitestConfig({
  appRoot: fileURLToPath(new URL('./', import.meta.url)),
  viteConfig: defineConfig({}),
})
