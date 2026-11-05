<script setup lang="ts">
/**
 * 通用错误页（403 / 404 / 500）——统一 6 app 错误页模式。
 *
 * 背景：monorepo 迁移前错误页模式重复且不一致——5 端 404 各自手写 h1 + 返回按钮，
 * admin 的 404/403/500 则完全没有行动按钮（体验最差）。本组件把「状态码 + 说明文案 +
 * 返回按钮」收敛为单一实现，admin 借此补齐返回按钮缺口，6 app 行为对齐。
 *
 * 用法（@vv/ui components/common 目录组件，全局自动注册，模板直接用，无须 import——CLAUDE.md §1.7）：
 *   <ErrorPage status="404" title="页面不存在" return-to="/workbench" return-label="返回工作台" />
 *
 * @group 通用组件
 */
import { useAppRouter } from '@vv/shared'

/** HTTP 状态码字面量（模板字符串形态 status="404"——6 app 消费方统一这么传）。
 *  定义字符串联合而非数字——模板字符串字面量在 SFC prop 绑定中即 string 类型，
 *  若定数字联合则 :status="'404'" 才通过、status="404" 报 TS2322（实测）。 */
type ErrorPageStatus = '403' | '404' | '500'
/** el-result icon 合法值（字面量联合，非 string——:icon 绑定需精确类型） */
type ResultIcon = 'primary' | 'success' | 'info' | 'warning' | 'error'

interface Props {
  /** HTTP 状态码：403 无权访问 / 404 页面不存在 / 500 服务器错误（字符串字面量，如 "404"） */
  status: ErrorPageStatus
  /** 状态码下方的业务说明文案（el-result sub-title） */
  title: string
  /** 返回按钮目标路由路径（如 '/workbench'）；用 router.push 跳转，与消费方迁移前行为一致 */
  returnTo: string
  /** 返回按钮文案（如 '返回工作台'） */
  returnLabel: string
}

const props = defineProps<Props>()

// 包内显式 import @vv/shared（ui → shared 为合法依赖方向，vitest 环境 auto-import 未注入 useAppRouter）；
// createNamespace 由 unplugin-auto-import 注入
const { router } = useAppRouter()

// 状态码 → el-result icon 映射：403 warning / 404 info / 500 error
// as const 保证值为字面量联合类型（满足 el-result :icon 精确类型）；键对齐字符串 status
const ICON_MAP: Record<ErrorPageStatus, ResultIcon> = {
  '403': 'warning',
  '404': 'info',
  '500': 'error',
} as const

// el-result icon：按 status 查表（status 已是 '404' 等字符串字面量）
const resultIcon = ICON_MAP[props.status]

async function goBack(): Promise<void> {
  await router.push(props.returnTo)
}

const bem = createNamespace('error-page')
</script>

<template>
  <div :class="bem.b()">
    <el-result :icon="resultIcon" :title="String(status)" :sub-title="title">
      <template #extra>
        <el-button type="primary" @click="goBack">{{ returnLabel }}</el-button>
      </template>
    </el-result>
  </div>
</template>
