/**
 * Vite 工程配置（h5 移动端消费端）
 *
 * 插件装配 / 别名 / css 预处理 / 构建分包全部收敛到 @vv/config 的 createViteConfig 工厂
 * （packages/config/src/create-vite-config.ts，单一来源）；本文件只声明 app 参数。
 * 与 admin 的差异：无 vueDevTools / visualizer 私有插件；h5Rem: true——
 * h5-demo 模块与 h5 layout 自 P3-2 起物理独立到本 app（admin 已摘除并关 h5Rem），
 * postcss-pxtorem 转换范围锚定本 appRoot（见 packages/config/src/postcss.ts）；
 * 端口偏移 +3（admin 5174 / docs 5175 / h5 5177 可并行 dev）。
 *
 * 历史：
 *   - 2026-10-22: P3-2 新建（h5 移动端独立为 apps/h5，Monorepo 迁移）
 */
import { fileURLToPath } from 'node:url'
import { createViteConfig } from '@vv/config'
import { VantResolver } from 'unplugin-vue-components/resolvers'

const appRoot = fileURLToPath(new URL('.', import.meta.url))

// https://vite.dev/config/
export default createViteConfig({
  appRoot,
  // h5 rem 适配：仅转换本 app src/layouts/h5 与 src/modules/h5-*（postcss.ts 约定）
  h5Rem: true,
  // vant 4 按需引入：经工厂 componentResolvers 扩展位注入（解析 <van-*> 前缀 +
  // sideEffects 自动注入组件 CSS——vant/es/button/style/index 是 JS 入口内部 import css，
  // 此前误判为路径不匹配，实测按需引入 + CSS 注入均正常）。
  // 隔离：只在本 app 装配，其他 app 零感知
  componentResolvers: [VantResolver()],
})
