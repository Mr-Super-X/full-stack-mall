<script setup lang="ts">
/**
 * ProTable v3.1 状态保持 demo —— statePersist（路由返回恢复 / F5 不恢复）
 *
 * 演示能力：
 * - tableKey + statePersist：搜索参数 / 页码 / 每页大小 / 排序状态的路由级持久化
 * - 恢复时机判定：localStorage 快照（${tableKey}:state）+ sessionStorage alive 标记
 *   （beforeunload 清除）—— 路由跳走再回来恢复；F5 刷新不恢复（全新会话）
 *
 * 验证步骤：
 * 1. 搜索框输入「项目-1」、翻到第 2 页、点 ID 表头排序
 * 2. 点下方按钮跳去 Overview 页面 → 浏览器「后退」回来 → 搜索词 / 页码 / 排序全部恢复
 * 3. 按 F5 刷新 → 不恢复（alive 标记随 beforeunload 清除）
 *
 * 路由：自动注册为 /demo/pro-table-state-persist
 */
import { ElButton } from 'element-plus'
import type { ProColumn } from '@vv/ui/components/ProTable/index.ts'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import ApiTable from '../../components/ApiTable.vue'
import { useDocToc } from '../../composables/useDocToc'
import { statePersistItems, statePersistStorageItems } from './configs/protable-demos-api'
import { projectRequestApi, type ProjectRow } from './configs/projects'

const bem = createNamespace('demo-pro-table-state-persist')

const columns: ProColumn<ProjectRow>[] = [
  { prop: 'id', label: 'ID', width: 70, sortable: true },
  {
    prop: 'title',
    label: '项目',
    minWidth: 140,
    search: { el: 'input', defaultValue: '', span: 8 },
  },
  { prop: 'amount', label: '金额', width: 140, formatter: 'amount' },
]

const persistCode = `<!-- 需配合 table-key；搜索 / 分页 / 排序路由级持久化 -->
<ProTable table-key="demo-v31-persist" state-persist :columns="columns" :request-api="requestApi" />

// localStorage 存快照（\${tableKey}:state）+ sessionStorage alive 标记（beforeunload 清除）：
// 跳路由再回来 → 恢复搜索词 / 页码 / 排序；按 F5 刷新 → alive 标记消失，不恢复`

/* ───────────── 跳路由工具（验证「返回恢复」的配套动作） ───────────── */

const router = useAppRouter() // 项目 composable @composables/useAppRouter

function goOverview(): void {
  // pushByName 内部已统一错误处理（handleRouterError）；void 标记有意不 await
  void router.pushByName('DemoProTableOverview')
}

const tocItems = [
  { id: 'demo-state-persist', label: '能力演示' },
  { id: 'api-state-persist', label: 'statePersist Prop' },
  { id: 'api-state-persist-storage', label: '存储约定' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="ProTableStatePersist 状态保持"
    source="src/components/ProTable/composables/useStatePersist.ts"
    :introductions="[
      '搜索 / 分页 / 排序的路由级持久化：跳走再回来恢复，F5 刷新不恢复。',
      '恢复时机靠 localStorage 快照 + sessionStorage alive 标记双重判定。',
    ]"
  >
    <section id="demo-state-persist" :class="bem.b()">
      <DemoField label="statePersist（路由返回恢复 / F5 不恢复）" :code="persistCode">
        <p :class="bem.e('hint')">
          验证：① 搜索框输入「项目-1」、翻到第 2 页、点 ID 表头排序 ② 点下方按钮跳走 →
          浏览器「后退」回来 → 搜索词 / 页码 / 排序全部恢复 ③ 按 F5 刷新 → 不恢复（全新会话）
        </p>
        <div :class="bem.e('actions')">
          <ElButton size="small" @click="goOverview">跳去 Overview 页面（验证返回恢复）</ElButton>
          <span :class="bem.e('msg')">跳走后点浏览器「后退」回到本页</span>
        </div>
        <ProTable
          :columns="columns"
          :request-api="projectRequestApi"
          table-key="demo-v31-persist"
          row-key="id"
          state-persist
          :page-size="5"
          :show-selected-tags="false"
        />
      </DemoField>
    </section>

    <ApiTable title="statePersist Prop" :items="statePersistItems" anchor="api-state-persist" />
    <ApiTable
      title="存储约定（localStorage + sessionStorage）"
      :items="statePersistStorageItems"
      anchor="api-state-persist-storage"
    />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-pro-table-state-persist {
  &__hint {
    margin: 0 0 12px;
    font-size: 13px;
    line-height: 1.7;
    color: var(--el-text-color-regular);
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }

  &__msg {
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }
}
</style>
