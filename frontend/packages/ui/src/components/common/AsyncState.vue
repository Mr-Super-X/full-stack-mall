<script setup lang="ts">
/**
 * 通用三态容器（Loading / Error / Empty）+ 默认插槽内容。
 *
 * 设计要点：
 * - 与 useRequest 配合：props 来自 `{ loading, error, isEmpty, retry }`
 * - 三种状态均提供默认 UI + 可覆盖的具名插槽：
 *   - `loading`：默认 `<el-skeleton :rows="3" animated />`
 *   - `error`：默认 `<el-result icon="error">` + 重试按钮；可传入 `:error` 错误对象 + `:retry` 函数
 *   - `empty`：默认 `<el-empty>` 空态（文案走 `common.retry` / `common.empty` i18n 键——
 *     2026-10-28 i18n 审计 P0 接线；包组件依赖宿主全局 i18n 实例，与 EP locale 同契约）
 * - 状态优先级：loading > error > empty > 默认插槽
 *
 * @see `@vv/shared` composables/useRequest —— 配套的请求封装（包内 composables/ 仅 useDialog 族，2026-10-27 审计修断链）
 * @group 通用组件
 */
interface Props {
  loading: boolean
  error: Error | null
  isEmpty: boolean
}
defineProps<Props>()
const emit = defineEmits<{ retry: [] }>()

// 运行时 BEM 命名空间：vv-async-state
const bem = createNamespace('async-state')
</script>

<template>
  <div :class="bem.b()">
    <template v-if="loading">
      <slot name="loading"><el-skeleton :rows="3" animated /></slot>
    </template>
    <template v-else-if="error">
      <slot name="error" :error="error" :retry="() => emit('retry')">
        <el-result icon="error" :title="error.message">
          <template #extra>
            <el-button type="primary" @click="emit('retry')">{{ $t('common.retry') }}</el-button>
          </template>
        </el-result>
      </slot>
    </template>
    <template v-else-if="isEmpty">
      <slot name="empty"><el-empty :description="$t('common.empty')" /></slot>
    </template>
    <template v-else>
      <slot />
    </template>
  </div>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-async-state {
}
</style>
