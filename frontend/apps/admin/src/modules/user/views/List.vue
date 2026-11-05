<script setup lang="ts">
/**
 * 用户列表页（演示 useRequest + AsyncState 三态集成）。
 *
 * useRequest 提供 `{ data, loading, error, isEmpty, execute }` 五元组：
 * - `data`：成功响应（UserListResponse，含 list + meta）
 * - `loading` / `error` / `isEmpty`：驱动 AsyncState 三态切换
 * - `execute`：AsyncState 重试按钮触发 refetch
 *
 * @see `@vv/shared` composables/useRequest —— 请求封装（@composables 深层别名已定性过渡态，注释路径修正）
 * @see `@vv/ui/components/common/AsyncState` 三态容器（全局自动注册，模板零 import）
 * @see `@api`（别名指 @vv/shared/src/api）modules/user —— getList 接口
 * @group 业务模块：User
 */
import { userApi } from '@api/modules/user'

// AsyncState 经 unplugin-vue-components 全局自动注册（CLAUDE.md §1.7），
// 模板直接用——显式 import 是 v3.0.1 codemod 漏网，2026-10-23 审查修复

const { data, loading, error, isEmpty, execute } = useRequest(() =>
  userApi.getList({ page: 1, pageSize: 10 })
)

// BEM 工具由 unplugin-auto-import 自动注入，无须显式 import
const bem = createNamespace('user-list')
</script>

<template>
  <div :class="bem.b()">
    <AsyncState :loading="loading" :error="error" :is-empty="isEmpty" @retry="execute">
      <el-table :data="data?.list ?? []" stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="name" label="姓名" />
        <el-table-column prop="email" label="邮箱" />
        <el-table-column prop="role" label="角色" />
      </el-table>
    </AsyncState>
  </div>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-user-list {
}
</style>
