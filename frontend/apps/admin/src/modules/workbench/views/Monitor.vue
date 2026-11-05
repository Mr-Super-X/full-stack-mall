<script setup lang="ts">
/**
 * 监控页（workbench 模块子路由）：验收嵌套菜单 + 页签缓存。
 *
 * @group 业务模块：Workbench
 */
defineOptions({ name: 'WorkbenchMonitor' })

const bem = createNamespace('workbench-monitor')

const draft = ref('')
const statuses = [
  { service: '网关', status: '正常', ok: true },
  { service: '订单服务', status: '正常', ok: true },
  { service: '消息队列', status: '积压告警', ok: false },
]
</script>

<template>
  <div :class="bem.b()">
    <el-card shadow="never">
      <template #header>
        <span :class="bem.e('heading')">监控页</span>
      </template>
      <el-table :data="statuses" border>
        <el-table-column prop="service" label="服务" />
        <el-table-column label="状态">
          <template #default="{ row }">
            <el-tag :type="row.ok ? 'success' : 'danger'">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
      <el-input
        v-model="draft"
        :class="bem.e('input')"
        placeholder="缓存验证：输入后切走再切回，内容应保留"
      />
    </el-card>
  </div>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-workbench-monitor {
  // 页面级 padding 由布局层 AppView __content 统一提供（--app-content-padding），
  // 视图不再自加——曾双层叠加导致 48px 大间距（2026-09-10 反馈修复）
  &__heading {
    font-size: 15px;
    font-weight: 600;
  }

  &__input {
    max-width: 420px;
    margin-top: 16px;
  }
}
</style>
