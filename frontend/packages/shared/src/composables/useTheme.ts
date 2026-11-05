/**
 * 主题 Composable。
 *
 * 对 `useThemeStore` 的便捷封装，组件中调用更简洁。
 *
 * 设计要点：
 * - **三态模式**：`mode` 取值 `'light'` / `'dark'` / `'auto'`；`auto` 模式下 `isDark` 跟随系统
 *   `prefers-color-scheme`（由 useThemeStore 通过 `matchMedia` 监听），业务方只需读 `isDark` 即可，
 *   无须关心当前是手动还是自动
 * - **副作用链**：`setMode` / `toggleMode` 写入 store 后触发 2 类联动：
 *   1. `document.documentElement` 双轨应用：`data-theme` 属性（themes/ 业务变量轨道）
 *      + `classList` 加/去 `dark` 类（element-plus dark/css-vars 组件暗色轨道）
 *   2. localStorage 持久化（`pinia-plugin-persistedstate`，`pick: ['mode']`）
 * - **品牌色**：`--color-primary` / `--el-color-primary` 由 `injectBrandColor`
 *   在应用启动时按 `VITE_BRAND_COLOR` 一次性注入（详见 docs/06），不随主题模式切换重算
 * - **与 BEM 前缀无关**：`mode` 切换不影响 `vv-*` 前缀（`VITE_BEM_PREFIX` 独立于主题）
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * const { mode, isDark, setMode, toggleMode } = useTheme()
 * </script>
 *
 * <template>
 *   <el-button @click="toggleMode">
 *     {{ isDark ? '☀️ 浅色' : '🌙 深色' }}
 *   </el-button>
 *   <el-radio-group v-model="mode" @change="setMode">
 *     <el-radio-button value="light">浅色</el-radio-button>
 *     <el-radio-button value="dark">深色</el-radio-button>
 *     <el-radio-button value="auto">跟随系统</el-radio-button>
 *   </el-radio-group>
 * </template>
 * ```
 *
 * @see [`src/store/modules/theme`](../store/modules/theme) theme store（持久化、跟随系统、副作用联动）
 * @see [`docs/06-主题管理规范.md`](../../docs/06-主题管理规范.md) CSS 变量速查 + useTheme API 完整契约
 * @group 主题组合式 API
 */

import { storeToRefs } from 'pinia'
import { useThemeStore } from '../store/modules/theme.ts'

/**
 * 获取主题切换相关响应式状态与方法。
 *
 * 返回值：
 * - `mode`：当前主题模式（`'light'` / `'dark'` / `'auto'`）
 * - `isDark`：当前是否为深色（computed；`auto` 模式下跟随系统）
 * - `setMode`：手动设置模式
 * - `toggleMode`：在 `'light'` 与 `'dark'` 间切换
 *
 * @group 主题组合式 API
 */
export function useTheme() {
  const store = useThemeStore()
  const { mode, isDark } = storeToRefs(store)
  return {
    mode,
    isDark,
    setMode: store.setMode,
    toggleMode: store.toggleMode,
  }
}
