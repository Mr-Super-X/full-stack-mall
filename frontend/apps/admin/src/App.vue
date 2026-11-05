<script setup lang="ts">
/**
 * 应用根组件。
 *
 * 三层职责：
 * 1. ElConfigProvider：注入 Element Plus 全局配置（locale / size / button 配置）
 * 2. ErrorBoundary：捕获子树渲染错误，提供"恢复"按钮
 * 3. AsyncState + RouterView：路由出口，remote 模式下首次进入时显示骨架屏
 *
 * i18n 同步：监听 vue-i18n 的 locale 变化，自动更新 Element Plus 语言包；
 * 若 `elementLocales` 缺失目标 locale 则 fallback 到 zhCn（避免新增 locale 后忘记注册）。
 *
 * @see [`@/router`](./router/index.ts) 路由配置
 * @see [`@/locales`](./locales/index.ts) i18n 入口
 * @see `@vv/ui/components/common/ErrorBoundary.vue` 错误边界（全局自动注册）
 * @see `@vv/ui/components/common/AsyncState.vue` 三态容器（全局自动注册）
 * @group 应用根
 */
import { useI18n } from 'vue-i18n'
// router store 是 admin 私有（P1-3：@store 别名指向 @vv/shared，仅含 4 个共享 store）
import { useRouterStore } from '@/store/modules/router'
import { useAppStore } from '@vv/shared'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import en from 'element-plus/es/locale/lang/en'
import type { Language } from 'element-plus/es/locale'

// BEM 工具由 unplugin-auto-import 自动注入，无须显式 import
const bem = createNamespace('app')

// ErrorBoundary / AsyncState 是 @vv/ui 全局自动注册组件（unplugin-vue-components 深扫
// components/common，CLAUDE.md §1.7），模板直接用，禁止显式 import——显式 import 会让
// IDE hover 丢失 DefineComponent 完整类型展开；2026-10-23 架构审查修复 v3.0.1 codemod 漏网

const routerStore = useRouterStore()
const appStore = useAppStore()
const { isLoadingRemoteMenu } = storeToRefs(routerStore)
const route = useRoute()
const { locale: i18nLocale } = useI18n()

// 仅"远程菜单加载中 且 当前导航无任何路由匹配"时才显示骨架：
//   - 首次进入（路由待远程注入，matched 为空）→ 必须遮挡，否则白屏
//   - 页面间跳转（如登录页 → 首页，当前页 matched 非空）→ 保持当前页面，
//     避免 AsyncState 把登录页替换成骨架造成闪屏（2026-08-12 修复）
const showRemoteMenuLoading = computed(
  () => isLoadingRemoteMenu.value && route.matched.length === 0
)

// Element Plus 语言包映射（与 src/locales/index.ts 同步）。
// 表内不存在时 fallback 到 zhCn，避免新增 locale 后忘记注册导致组件显示英文。
const elementLocales: Record<string, Language> = {
  'zh-CN': zhCn,
  'en-US': en,
}

// 语言同步总线：appStore.locale 是唯一事实源（持久化），此处 watch 同步到
// vue-i18n 全局实例（i18nLocale 可写）与 <html lang>（SEO / 无障碍）。
// { immediate: true } 兼做刷新后的初始化回灌（persist 恢复 store 后生效）。
// 任何调用 appStore.setLocale() 的入口（default 布局 LocaleDropdown 等）都自动生效。
watch(
  () => appStore.locale,
  (l) => {
    i18nLocale.value = l
    document.documentElement.lang = l
  },
  { immediate: true }
)

// 类型归因：element-plus 2.x ConfigProviderProps 是 ExtractPropTypes 元组
// （type/required/validator/__epPropKey）形态，与运行时值类型不等价（C1 根因，
// 详见 types/TYPE-CAST-AUDIT.md）。locale 是 Language 对象、size 是 string，
// 运行时均生效；TS 层用 Record<string, unknown> 替代 `as any`（全局 §1.5 违规，
// 归因详见 src/components/form-schema/types/TYPE-CAST-AUDIT.md）。
// 模板 <ElConfigProvider v-bind="elementConfig"> 接受 string-keyed 对象。
// locale 跟随 Vue I18n 当前语言自动切换。
const elementConfig = computed<Record<string, unknown>>(() => ({
  locale: elementLocales[i18nLocale.value] ?? zhCn,
  size: 'default',
  button: { autoInsertSpace: true },
}))
</script>

<template>
  <div :class="bem.b()">
    <ElConfigProvider v-bind="elementConfig">
      <ErrorBoundary>
        <!--
          remote 模式首次进入时，守卫在后台拉取菜单，
          用 AsyncState 包裹 RouterView 显示 Loading 骨架屏，
          避免用户看到空白页
        -->
        <AsyncState :loading="showRemoteMenuLoading" :error="null" :is-empty="false">
          <RouterView v-slot="{ Component }">
            <Transition name="fade" mode="out-in">
              <component :is="Component" />
            </Transition>
          </RouterView>
        </AsyncState>
      </ErrorBoundary>
    </ElConfigProvider>
  </div>
</template>

<style lang="scss">
// 路由过渡动画（全局 fade 效果，与 transition.scss 中 @keyframes vv-fade-in 配合）
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease-in-out;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
