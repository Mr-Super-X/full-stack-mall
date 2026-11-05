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
  // auth 模块（登录页）用 BEM 命名空间（.vv-login 等），**不依赖 unocss 原子化类**。
  // 排除扫描可避免 unocss HMR 与 Vite 8 的兼容 bug 导致 `__uno.css:19`
  // setTimeout 递归（页面白屏）——与 portal 排除 home 模块同因。
  exclude: [/src\/modules\/auth\/.*/],
  // 复合工具类（.vv-flex-* / .vv-ellipsis-* / .vv-clearfix 等）统一在
  // @vv/ui 的 src/styles/utilities/custom.scss 中定义（见 docs/05-BEM样式规范.md）。
  // 此处不定义 BEM 命名空间的快捷类，避免与项目样式规范冲突。
})
