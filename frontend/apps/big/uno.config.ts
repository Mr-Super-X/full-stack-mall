import { defineConfig, presetUno, presetAttributify } from 'unocss'

export default defineConfig({
  presets: [presetUno(), presetAttributify()],
  theme: {
    colors: {
      primary: 'var(--el-color-primary)',
      success: 'var(--el-color-success)',
      warning: 'var(--el-color-warning)',
      danger: 'var(--el-color-danger)',
    },
  },
  // big-demo 模块与 big layout 均为 BEM 命名空间（.vv-big-demo / .vv-big-layout 等）+
  // scss 写死设计稿 px，**不依赖 unocss 原子化类**。排除扫描可避免 unocss HMR 与 Vite 8
  // 的兼容 bug 导致 `__uno.css:19` setTimeout 递归（页面白屏）——与 apps/docs 同口径。
  exclude: [/src\/modules\/big-demo\/.*/, /src\/layouts\/big\/.*/],
  // 复合工具类（.vv-flex-* / .vv-ellipsis-* / .vv-clearfix 等）统一在
  // @vv/ui 的 src/styles/utilities/custom.scss 中定义（见 docs/05-BEM样式规范.md）。
  // 此处不定义 BEM 命名空间的快捷类，避免与项目样式规范冲突。
})
