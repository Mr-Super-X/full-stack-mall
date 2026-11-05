<script setup lang="ts">
/**
 * ProTable CSV 导入导出 demo —— 零依赖 csv utils 业务接线（2026-09-18 设计落地）
 *
 * 演示能力：
 * - exportCsv：拉全量 mock 数据 → BOM + RFC4180 转义 → 浏览器下载（done 枚举经 value 翻译）
 * - importCsv：File → 引号感知状态机解析 → 表头列名映射 prop → 行数据展示
 *
 * 职责边界（设计 D7）：utils 只负责「行数据 ↔ 文件」；全量拉取 / 类型转换 /
 * 逐行校验 / 提交后端 / 错误明细回显全部归业务层。
 *
 * 验证步骤：
 * 1. 点「导出全部（CSV）」→ 下载 export-*.csv，Excel 打开中文不乱码、金额已翻译
 * 2. 点「选择 CSV 导入」→ 选刚导出的文件 → 解析结果表格展示（值均为 string）
 * 3. 导入表头含未声明列 → 自动忽略不报错
 *
 * 路由：自动注册为 /demo/pro-table-import-export
 */
import {
  ElButton,
  ElMessage,
  ElTable,
  ElTableColumn,
  ElUpload,
  type UploadFile,
} from 'element-plus'
import { Download, Upload } from '@element-plus/icons-vue' // 显式 import（§1.6.1 来源注释）
import { exportCsv, importCsv, type CsvColumn } from '@vv/ui/components/ProTable/utils/index.ts'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import ApiTable from '../../components/ApiTable.vue'
import { useDocToc } from '../../composables/useDocToc'
import { csvColumnItems } from './configs/protable-demos-api'
import { projectRequestApi } from './configs/projects'

const bem = createNamespace('demo-pro-table-import-export')

/** 导出/导入共用的列映射 —— label 即 CSV 表头文案，prop 即行字段名 */
const csvColumns: CsvColumn[] = [
  { prop: 'id', label: 'ID' },
  { prop: 'title', label: '项目' },
  { prop: 'amount', label: '金额' },
  // done 布尔 → 中文翻译（导出时 value 生效；导入时按 label『状态』映射回 prop）
  { prop: 'done', label: '状态', value: (r) => (r['done'] ? '已完成' : '进行中') },
  { prop: 'createdAt', label: '创建时间' },
]

const exporting = ref(false)
/** 导入解析结果（值均为 string —— 类型转换与校验归业务层） */
const importedRows = ref<Record<string, unknown>[]>([])

/** 导出：业务自行拉全量（组件不内建分页全量），utils 只负责文件生成 */
async function handleExport(): Promise<void> {
  exporting.value = true
  try {
    const res = await projectRequestApi({ pageNum: 1, pageSize: 1000 })
    exportCsv(res.data as unknown as Record<string, unknown>[], {
      filename: '项目台账.csv',
      columns: csvColumns,
    })
    ElMessage.success(`已导出 ${res.data.length} 行（CSV 下载已触发）`)
  } finally {
    exporting.value = false
  }
}

/** 导入：File → importCsv → 业务校验位（此处仅展示解析结果） */
async function handleFileChange(uploadFile: UploadFile): Promise<void> {
  const file = uploadFile.raw
  if (!file) return
  try {
    importedRows.value = await importCsv(file, { columns: csvColumns })
    ElMessage.success(`解析成功 ${importedRows.value.length} 行（类型转换/校验归业务层）`)
  } catch (err) {
    ElMessage.error(`解析失败：${err instanceof Error ? err.message : String(err)}`)
  }
}

const exportCode = `// 业务拉全量 → exportCsv 只负责「行数据 → 文件」
const res = await projectRequestApi({ pageNum: 1, pageSize: 1000 })
exportCsv(res.data, {
  filename: '项目台账.csv',
  columns: [
    { prop: 'title', label: '项目' },
    // value：自定义取值（枚举翻译 / 金额格式化 / 字段拼接）
    { prop: 'done', label: '状态', value: (r) => (r.done ? '已完成' : '进行中') },
  ],
})`

const importCode = `// File → importCsv：引号感知解析 + 表头列名映射 prop
const rows = await importCsv(file, { columns: csvColumns })
// rows: Array<Record<string, unknown>> —— 值均为 string
// 类型转换 / 逐行校验 / 提交后端 / 错误明细回显 全部归业务层`

const tocItems = [
  { id: 'demo-csv-export', label: '导出（exportCsv）' },
  { id: 'demo-csv-import', label: '导入（importCsv）' },
  { id: 'api-csv-column', label: 'CsvColumn 字段' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="ProTableImportExport CSV 导入导出（零依赖 utils）"
    source="src/components/ProTable/utils/exportCsv.ts"
    :introductions="[
      '零依赖 CSV：BOM 防 Excel 中文乱码 + RFC4180 引号转义（含逗号/换行/引号的字段安全往返）。',
      '职责边界：utils 只负责「行数据 ↔ 文件」；分页全量拉取、类型转换、逐行校验、错误明细回显归业务层。',
      '需要 .xlsx 或服务端大文件异步导出时再独立立项（spec 2026-09-18 非目标）。',
    ]"
  >
    <section :class="bem.b()">
      <DemoField id="demo-csv-export" label="导出：拉全量 + 枚举翻译 + BOM" :code="exportCode">
        <p :class="bem.e('hint')">
          验证：点按钮 → 下载「项目台账.csv」→ Excel 打开中文不乱码、「状态」列已翻译为中文
        </p>
        <ElButton type="primary" :loading="exporting" :icon="Download" @click="handleExport">
          导出全部（CSV）
        </ElButton>
      </DemoField>

      <DemoField
        id="demo-csv-import"
        label="导入：File → 行数据（表头列名映射）"
        :code="importCode"
      >
        <p :class="bem.e('hint')">
          验证：选刚导出的 CSV → 解析结果展示（值均为 string）；表头多出的列自动忽略
        </p>
        <ElUpload
          :show-file-list="false"
          :auto-upload="false"
          accept=".csv"
          :on-change="handleFileChange"
        >
          <ElButton :icon="Upload">选择 CSV 导入</ElButton>
        </ElUpload>
        <ElTable
          v-if="importedRows.length > 0"
          :data="importedRows.slice(0, 8)"
          :class="bem.e('result')"
          size="small"
          border
        >
          <ElTableColumn prop="id" label="ID" width="70" />
          <ElTableColumn prop="title" label="项目" min-width="140" />
          <ElTableColumn prop="amount" label="金额" width="120" />
          <ElTableColumn prop="done" label="状态" width="100" />
          <ElTableColumn prop="createdAt" label="创建时间" width="170" />
        </ElTable>
        <p v-if="importedRows.length > 8" :class="bem.e('hint')">
          仅展示前 8 行，共解析 {{ importedRows.length }} 行
        </p>
      </DemoField>
    </section>

    <ApiTable
      title="CsvColumn 字段（2026-09-18）"
      :items="csvColumnItems"
      anchor="api-csv-column"
    />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-pro-table-import-export {
  &__hint {
    margin: 0 0 12px;
    font-size: 13px;
    line-height: 1.7;
    color: var(--el-text-color-regular);
  }

  &__file-input {
    display: none;
  }

  &__result {
    margin-top: 12px;
  }
}
</style>
