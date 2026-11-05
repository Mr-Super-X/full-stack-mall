<script setup lang="ts">
/**
 * 分析页（workbench 模块子路由）：验收嵌套菜单 + 页签缓存。
 *
 * @group 业务模块：Workbench
 */
defineOptions({ name: 'WorkbenchAnalysis' })

const bem = createNamespace('workbench-analysis')

const draft = ref('')
const metrics = [
  { label: '访问量', value: '12,480' },
  { label: '转化率', value: '4.6%' },
  { label: '客单价', value: '¥ 328' },
]
</script>

<template>
  <div :class="bem.b()">
    <el-card shadow="never">
      <template #header>
        <span :class="bem.e('heading')">分析页</span>
      </template>
      <div :class="bem.e('metrics')">
        <div v-for="m in metrics" :key="m.label" :class="bem.e('metric')">
          <span :class="bem.e('metric-value')">{{ m.value }}</span>
          <span :class="bem.e('metric-label')">{{ m.label }}</span>
        </div>
      </div>
      <el-input
        v-model="draft"
        :class="bem.e('input')"
        placeholder="缓存验证：输入后切走再切回，内容应保留"
      />
    </el-card>
  </div>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-workbench-analysis {
  // 页面级 padding 由布局层 AppView __content 统一提供（--app-content-padding），
  // 视图不再自加——曾双层叠加导致 48px 大间距（2026-09-10 反馈修复）
  &__heading {
    font-size: 15px;
    font-weight: 600;
  }

  &__metrics {
    display: flex;
    gap: 32px;
    margin-bottom: 16px;
  }

  &__metric {
    display: flex;
    flex-direction: column;
  }

  &__metric-value {
    font-size: 22px;
    font-weight: 600;
    color: var(--el-color-primary);
  }

  &__metric-label {
    margin-top: 4px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  &__input {
    max-width: 420px;
  }
}
</style>
