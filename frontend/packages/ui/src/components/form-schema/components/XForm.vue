<script setup lang="ts">
/**
 * XForm —— schema 驱动的 element-plus 表单渲染器
 *
 * 模板 + props/attrs 透传 + ElConfigProvider + ElForm 骨架，所有业务编排收敛到 ../composables/use-xform-composer.ts。
 *
 * @group XForm 组件
 */
import { ElForm, ElRow, ElCol } from 'element-plus'

import { useXFormComposer } from '../composables/use-xform-composer'
import XFormDebugBanner from './XFormDebugBanner.vue'
import XFormErrorToast from './XFormErrorToast.vue'
import SchemaField from './SchemaField.vue'
import type { XFormExpose, XFormProps } from '../types'

// 全局样式（label 颜色、必填星号等覆盖）—— 仅 XForm.vue 加载，未使用 XForm 的页面无需引入
import 'element-plus/dist/index.css'
import '../styles/element-form-overwrite.scss'

const props = defineProps<XFormProps>()
// exactOptionalPropertyTypes 下 vue 推导的 props 类型（LooseRequired 包裹）与
// XFormProps 在 optional 字段（如 model?: T vs model: T）上有严格类型差异，
// 收口为 XFormProps 让下游 useXFormComposer 不重复处理。
// （归因见 types/TYPE-CAST-AUDIT.md；外部消费方仍通过 defineExpose(exposed) 拿不到此别名）
const propsModel = props as XFormProps
// BEM namespace 由 unplugin-auto-import 自动注入，无需显式 import
const {
  bem,
  elFormRef,
  renderToComponent,
  fieldErrors,
  topLevelNodes,
  topLevelRow,
  topLevelColumn,
  topLevelColSpan,
  topLevelDisabled,
  topLevelLabelWidth,
  topLevelLabelPosition,
  topLevelScrollToError,
  topLevelScrollIntoViewOptions,
  validateErrors,
  forbiddenErrors,
  asyncOptionsWarnings,
  showDebugBanner,
  exposed,
  installDevDebugHook,
  errorBus,
  scrollToField,
} = useXFormComposer({ props: propsModel })

defineExpose(exposed satisfies XFormExpose)

/**
 * 缓存模板里反复出现的派生值 —— 避免每次响应式依赖变化都重算
 *
 * - fieldErrorKeys：纯字符串，浅比较友好，作为 data-attr 稳定触发 attribute update
 * - topLevelGutter：消除模板两个分支里重复的 `topLevelRow?.gutter ?? 0 as never`
 * - resolvedModel：兜底空对象，避免下游 `props.model` 为 undefined 时 ElForm 抛错
 */
const fieldErrorKeys = computed(() => Object.keys(fieldErrors.value).join(','))
const topLevelGutter = computed(() => topLevelRow.value?.gutter ?? 0)
const resolvedModel = computed(() => (props.model ?? {}) as Record<string, unknown>)

/**
 * dev console 钩子移到 onMounted —— 避免 SSR 环境下 window 访问抛错；
 * 仅 dev 开启，prod 模式下 installDevDebugHook 是 no-op
 */
onMounted(() => installDevDebugHook())
</script>

<template>
  <!--
    模板根是单个原生 div —— Vue 自动继承外部传入的非 props 属性（class/style/@click/data-*），
    这是样式覆盖场景的关键路径（见 demo/xform-style-override）。
    刻意不包裹 ElConfigProvider：
    - locale 继承 App.vue 全局配置（跟随 i18n 切 zh-CN/en-US；原先内层固定 zhCn
      反而覆盖全局语言，切英语后表单内仍是中文）
    - size 由 ElForm 的 size prop 注入（EP 组件 useSize 优先取 form 注入，等效）
  -->
  <div :class="bem.b()" :data-field-errors="fieldErrorKeys">
    <ElForm
      ref="elFormRef"
      :model="resolvedModel"
      :size="props.size ?? ''"
      :validate-trigger="['change', 'blur']"
      :disabled="topLevelDisabled"
      :label-position="topLevelLabelPosition"
      :label-width="topLevelLabelWidth"
      :scroll-to-error="topLevelScrollToError"
      :scroll-into-view-options="topLevelScrollIntoViewOptions"
    >
      <ElRow v-if="topLevelColumn" :gutter="topLevelGutter">
        <ElCol
          v-for="(node, i) in topLevelNodes"
          :key="node.key ?? node.name ?? i"
          :span="topLevelColSpan"
        >
          <SchemaField :node="node" :render-fn="renderToComponent" />
        </ElCol>
      </ElRow>
      <ElRow v-else-if="topLevelRow" :gutter="topLevelGutter">
        <SchemaField
          v-for="(node, i) in topLevelNodes"
          :key="node.key ?? node.name ?? i"
          :node="node"
          :render-fn="renderToComponent"
        />
      </ElRow>
      <SchemaField
        v-else
        v-for="(node, i) in topLevelNodes"
        :key="node.key ?? node.name ?? i"
        :node="node"
        :render-fn="renderToComponent"
      />
      <!-- 扩展插槽：嵌入表单内部底部（提交按钮 / 说明文案） -->
      <slot name="footer" />
    </ElForm>
    <!--
      XFormDebugBanner / toastContainer slot 都是 Teleport-to-body 的旁挂浮层（不占主 DOM），
      收敛在主 div 内部维持模板单根节点 —— 若作为模板的并列根节点，组件根会变成 fragment，
      Vue 3 对 fragment 根不做 $attrs 自动继承，消费方传入的 class/style 会触发
      "Extraneous non-props attributes" 警告且样式透传失效
    -->
    <XFormDebugBanner
      v-if="showDebugBanner"
      :validate-errors="validateErrors"
      :forbidden-errors="forbiddenErrors"
      :async-options-warnings="asyncOptionsWarnings"
      @locate="scrollToField"
    />
    <!-- OPT-7：user-facing 错误 OSD —— 由 showErrorToast prop 独立控制（默认关闭），
         与 showDebugBanner（schema 校验/安全扫描横幅，dev 自动开）互不耦合。
         优化点（2026-09-15 review）：toast 容器可通过 slot 替换，业务可用 ElNotification / 自定义组件替代
           <XForm>
             <template #toastContainer="{ events }">
               <MyToastList :events="events" @dismiss="errorBus.dismiss" />
             </template>
           </XForm>
         @see docs/24 §Slots 段（toastContainer 完整契约 + ToastEvent 类型）
         @see src/components/form-schema/composables/use-form-error-bus.ts (errorBus 来源) -->
    <slot name="toastContainer" :events="errorBus.events.value">
      <XFormErrorToast
        :events="errorBus.events.value"
        :enabled="props.showErrorToast ?? false"
        @dismiss="errorBus.dismiss"
        @dismiss-all="errorBus.dismissAll"
      />
    </slot>
  </div>
</template>

<style lang="scss">
/* 命名空间占位 —— 子组件覆盖样式各自下钻到 .#{$BEM_PREFIX}-x-form__xxx */
.#{$BEM_PREFIX}-x-form {
}
</style>
