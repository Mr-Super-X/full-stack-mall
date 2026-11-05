/**
 * vue-i18n 初始化。
 *
 * 模式选择：Composition API（`legacy: false`），全局 `useI18n()` 返回响应式 ref，
 * 与 Vue 3 + Pinia 风格一致。
 *
 * 默认 locale：`zh-CN`；fallback：`en-US`（找不到 key 时回退）。
 * 切换语言：`useAppStore().setLocale(l)` 触发，配合 `App.vue` 中 `i18nLocale` 同步 Element Plus 语言包。
 *
 * @see [`vue-i18n`](https://vue-i18n.intlify.dev/) i18n 库
 * @see [`./zh-CN.ts`](./zh-CN.ts) 简体中文文案
 * @see [`./en-US.ts`](./en-US.ts) 英文文案
 * @group 国际化
 */
import { createI18n } from 'vue-i18n'
import zhCN from './zh-CN'
import enUS from './en-US'

export const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'en-US',
  messages: { 'zh-CN': zhCN, 'en-US': enUS },
})

export default i18n
