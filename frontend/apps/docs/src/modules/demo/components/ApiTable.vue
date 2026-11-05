<script setup lang="ts">
/**
 * API 文档通用表格（Props / Events 通用版）
 *
 * 静态手写模式：当前 demo 数量少，直接在 demo 页面传入 items 数组。
 * 未来要做"自动从 .vue 提取 API"时，可在此处加 .vue SFC 解析。
 *
 * 字段约定：
 *   - name: API 名（Props attr / Event 名）
 *   - type: 类型（Props 用；Event 类型如 (err: Error) => void）
 *   - default: 默认值（Props 用）
 *   - description: 说明
 *   - required: 是否必填（Props 用）
 */
interface ApiItem {
  name: string
  type?: string
  default?: string
  description: string
  required?: boolean
}

defineProps<{
  /** 表格标题，如 "Props" / "Events" / "Slots" */
  title: string
  /** 表格项 */
  items: ApiItem[]
  /** section 锚点 id（用于 TOC 跳转） */
  anchor?: string
}>()

const bem = createNamespace('api-table')
</script>

<template>
  <!-- items 为空时不渲染——避免切换路由时 v-if 抖动
       （外部不要写 v-if，会导致 sticky sidebar/toc 重新计算位置） -->
  <section v-if="items.length" :class="bem.b()" :id="anchor">
    <h2 :class="bem.e('title')">{{ title }}</h2>
    <div :class="bem.e('wrap')">
      <table :class="bem.e('table')">
        <thead>
          <tr>
            <th :class="bem.e('col-name')">名称</th>
            <th :class="bem.e('col-type')">类型</th>
            <th :class="bem.e('col-default')">默认值</th>
            <th :class="bem.e('col-desc')">说明</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.name">
            <td>
              <code :class="bem.e('name')">{{ item.name }}</code>
              <el-tag
                v-if="item.required"
                type="danger"
                size="small"
                effect="plain"
                :class="bem.e('required')"
              >
                必填
              </el-tag>
            </td>
            <td>
              <code :class="bem.e('type')">{{ item.type ?? '—' }}</code>
            </td>
            <td>
              <code :class="bem.e('default')">{{ item.default ?? '—' }}</code>
            </td>
            <td :class="bem.e('desc')">{{ item.description }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-api-table {
  margin: 24px 0;
  scroll-margin-top: 80px;

  &__title {
    margin: 0 0 12px;
    font-size: 18px;
    font-weight: 600;
    color: #303133;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--el-border-color-lighter, #ebeef5);
  }

  &__wrap {
    overflow-x: auto;
  }

  &__table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;

    th,
    td {
      padding: 10px 12px;
      text-align: left;
      border-bottom: 1px solid var(--el-border-color-lighter, #ebeef5);
      vertical-align: top;
    }

    th {
      background: #fafafa;
      color: #909399;
      font-weight: 500;
    }

    tbody tr:hover {
      background: #fafbfc;
    }
  }

  &__col-name {
    width: 22%;
  }
  &__col-type {
    width: 22%;
  }
  &__col-default {
    width: 16%;
  }
  &__col-desc {
    width: 40%;
  }

  &__name,
  &__type,
  &__default {
    font-family: 'Fira Code', 'Cascadia Code', 'Consolas', 'Menlo', monospace;
    font-size: 12px;
    background: #f5f7fa;
    color: #303133;
    padding: 1px 6px;
    border-radius: 3px;
  }

  &__required {
    margin-left: 6px;
    vertical-align: middle;
  }

  &__desc {
    color: #606266;
    line-height: 1.6;
  }
}
</style>
