/**
 * 包内 type-check 用的 auto-import 全局声明（@vv/ui）。
 *
 * 背景：包内源码按 app 侧约定书写——vue / pinia / vue-router 高频 API、
 * @vv/shared 业务 composables 与 createNamespace 由 vite AutoImport 在转换期注入
 * （app 侧工厂 + packages/ui/vitest.config.ts 两处同构配置），源码不写显式 import。
 * 包独立编译（vue-tsc --build）时没有该转换，需同名全局声明才能闭合类型。
 *
 * 与 app 侧生成的 src/types/auto-imports.d.ts 是「同构子集」关系：
 * 只声明本包实际用到的标识符；app 编译单元内以 app 自己的生成版为准
 * （同名全局声明内容一致，不冲突）。
 *
 * 刻意不声明：弹窗族（useDialog/useConfirm/useLogout）——包内已全部显式相对导入
 * （包规范：内部跨目录用相对路径），无裸用场景。
 *
 * 新增全局标识符时：同步本文件 + 确认工厂与本包 vitest.config 的 AutoImport 清单已覆盖。
 */
declare global {
  const ref: typeof import('vue').ref
  const reactive: typeof import('vue').reactive
  const computed: typeof import('vue').computed
  const watch: typeof import('vue').watch
  const watchEffect: typeof import('vue').watchEffect
  const nextTick: typeof import('vue').nextTick
  const shallowRef: typeof import('vue').shallowRef
  const toRef: typeof import('vue').toRef
  const isRef: typeof import('vue').isRef
  const markRaw: typeof import('vue').markRaw
  const onMounted: typeof import('vue').onMounted
  const onBeforeUnmount: typeof import('vue').onBeforeUnmount
  const onUnmounted: typeof import('vue').onUnmounted
  const onErrorCaptured: typeof import('vue').onErrorCaptured
  const onScopeDispose: typeof import('vue').onScopeDispose
  const useAttrs: typeof import('vue').useAttrs
  const useSlots: typeof import('vue').useSlots
  const useTemplateRef: typeof import('vue').useTemplateRef
  const getCurrentInstance: typeof import('vue').getCurrentInstance
  const resolveComponent: typeof import('vue').resolveComponent
  const defineComponent: typeof import('vue').defineComponent
  const h: typeof import('vue').h
  const defineStore: typeof import('pinia').defineStore
  const storeToRefs: typeof import('pinia').storeToRefs
  const useRoute: typeof import('vue-router').useRoute
  const useRouter: typeof import('vue-router').useRouter
  const createNamespace: typeof import('@vv/shared').createNamespace
  const useDict: typeof import('@vv/shared').useDict
  const useAuth: typeof import('@vv/shared').useAuth
  const useRequest: typeof import('@vv/shared').useRequest
  const useAppRouter: typeof import('@vv/shared').useAppRouter
  const useTheme: typeof import('@vv/shared').useTheme
  const ElMessage: typeof import('element-plus/es').ElMessage
}

// 值注入之外的裸类型使用（AutoImport vue 预设同样覆盖类型空间，如 Ref / VNode）。
// 与 unplugin-auto-import 生成物同构：独立 declare global 块 + 下行抑制 + 尾部 import('vue')
// （合并进上方同一 declare global 会让整块静默失效——TS6 build 模式实测）
declare global {
  // eslint 禁 @ts-ignore（no-op 风险）；此处确需抑制「declare global 内 re-export」告警，故用 expect-error
  // @ts-expect-error -- export type 在 ambient 上下文的合法性与 TS 版本耦合
  export type {
    Component,
    ComponentPublicInstance,
    ComputedRef,
    DirectiveBinding,
    ExtractPropTypes,
    PropType,
    Ref,
    Slots,
    VNode,
  } from 'vue'
  import('vue')
}

export {}
