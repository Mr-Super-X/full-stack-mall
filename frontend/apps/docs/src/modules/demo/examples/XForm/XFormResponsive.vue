<script setup lang="ts">
/**
 * 演示响应式栅格
 *
 * 场景：
 * 1. RowConfig.responsive:不同断点下 gutter / type / align / justify 不同
 * 2. ColConfig.responsive:不同断点下 span / offset / push / pull 不同
 * 3. 数组节点 col.responsive 透传
 *
 * 断点(element-plus 标准 5 档):
 * - xs: < 768px(手机)
 * - sm: ≥ 768px(平板)
 * - md: ≥ 992px(小屏)
 * - lg: ≥ 1200px(桌面)
 * - xl: ≥ 1920px(大屏)
 *
 * 注:v3.5 已知限制 —— element-plus el-row 不自动监听 viewport resize,
 * 运行时调整浏览器窗口宽度,字段间距(gutter)和对齐(justify)不会实时变化。
 * 字段宽度(col.span)同理：需 XForm 内部 useResizeObserver 触发 schema 重渲染（未实装），
 * 当前仅支持 schema 字段透传到 el-row / el-col props（mount 时一次性渲染）。
 *
 * 验证方式:刷新页面 + DevTools 切 viewport 断点 + 看 gutter/span 不变(已知限制)。
 */
import { ElMessage } from 'element-plus'
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import ApiTable from '../../components/ApiTable.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import { responsiveItems } from './configs/xform-demos-api'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import xFormSource from './XFormResponsive.vue?raw'
import ModelPreview from '../../components/ModelPreview.vue'

const { formRef, bem, onReset, copySchema } = useXFormDemo({
  name: 'responsive',
  schema: () => schema,
  model: () => model,
})

// ============== 响应式断点(仅 demo 显示用) ==============
const currentBreakpoint = ref<'xs' | 'sm' | 'md' | 'lg' | 'xl'>('md')
const width = ref(0)
const updateBreakpoint = () => {
  if (typeof window === 'undefined') return
  width.value = window.innerWidth
  if (width.value < 768) currentBreakpoint.value = 'xs'
  else if (width.value < 992) currentBreakpoint.value = 'sm'
  else if (width.value < 1200) currentBreakpoint.value = 'md'
  else if (width.value < 1920) currentBreakpoint.value = 'lg'
  else currentBreakpoint.value = 'xl'
}
onMounted(() => {
  updateBreakpoint()
  window.addEventListener('resize', updateBreakpoint)
})
onUnmounted(() => {
  window.removeEventListener('resize', updateBreakpoint)
})

const schema: SchemaNode = {
  // label-position 配置在 schema 顶层（自描述）
  // 'top' 让 label 在 input 上方,避免挤占 col 宽度（响应式布局推荐）
  labelPosition: 'top',
  // Row 响应式:不同断点不同 gutter（差距拉大便于观察）+ justify 居中变化
  // 注意：gutter 仅在"一行多列"时可见 —— xs 默认一行一列,sm+ 一行多列
  row: {
    gutter: 32,
    justify: 'start',
    responsive: {
      xs: { gutter: 0, justify: 'start' }, // 手机:无间距,一行一列
      sm: { gutter: 16, justify: 'start' }, // 平板:每行 4 字段
      md: { gutter: 40, justify: 'center' }, // 中屏:每行 4 字段,居中
      lg: { gutter: 60, justify: 'end' }, // 桌面:每行 4 字段,右对齐
      xl: { gutter: 80, justify: 'space-between' }, // 大屏:每行 4 字段,两端分散
    },
  },
  children: [
    // 4 个同行字段 —— xs 占满 24（一行一个）,sm+ 占 6（一行 4 个）使 gutter 可见
    {
      label: '用户名',
      name: 'username',
      component: 'Input',
      col: { responsive: { xs: { span: 24 }, sm: { span: 6 } } },
    } as SchemaNode,
    {
      label: '邮箱',
      name: 'email',
      component: 'Input',
      col: { responsive: { xs: { span: 24 }, sm: { span: 6 } } },
    } as SchemaNode,
    {
      label: '电话',
      name: 'phone',
      component: 'Input',
      col: { responsive: { xs: { span: 24 }, sm: { span: 6 } } },
    } as SchemaNode,
    {
      label: '地址',
      name: 'address',
      component: 'Input',
      col: { responsive: { xs: { span: 24 }, sm: { span: 6 } } },
    } as SchemaNode,
    // 第 2 行 4 字段
    {
      label: '公司',
      name: 'company',
      component: 'Input',
      col: { responsive: { xs: { span: 24 }, sm: { span: 6 } } },
    } as SchemaNode,
    {
      label: '职位',
      name: 'title',
      component: 'Input',
      col: { responsive: { xs: { span: 24 }, sm: { span: 6 } } },
    } as SchemaNode,
    {
      label: '部门',
      name: 'department',
      component: 'Input',
      col: { responsive: { xs: { span: 24 }, sm: { span: 6 } } },
    } as SchemaNode,
    {
      label: '入职日期',
      name: 'hireDate',
      component: 'DatePicker',
      props: { valueFormat: 'YYYY-MM-DD' },
      col: { responsive: { xs: { span: 24 }, sm: { span: 6 } } },
    } as SchemaNode,
  ],
}

const model = reactive<Record<string, unknown>>({
  username: '',
  email: '',
  phone: '',
  address: '',
  company: '',
  title: '',
  department: '',
  hireDate: '',
})

// formRef / onReset / copySchema 由 useXFormDemo 统一提供（见 import 区下方）

async function onSave() {
  if (!formRef.value) return
  const valid = await formRef.value.validate()
  if (!valid) {
    ElMessage.error('校验失败')
    return
  }
  ElMessage({
    message: '保存成功:\n' + JSON.stringify(model, null, 2),
    type: 'success',
    duration: 0,
    showClose: true,
  })
}

const tocItems = [
  { id: 'demo-responsive', label: '响应式布局演示' },
  { id: 'api-responsive', label: 'responsive 配置' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="响应式栅格"
    source="src/components/form-schema/XForm.vue"
    :introductions="[
      'RowConfig.responsive / ColConfig.responsive：不同断点下不同的 gutter / span / offset 等布局参数。',
      '断点（element-plus 标准 5 档）：xs < 768 / sm < 992 / md < 1200 / lg < 1920 / xl ≥ 1920',
      '⚠️ v3.5 已知限制：运行时 resize 浏览器窗口,字段布局不会实时变化（XForm 暂未集成 useResizeObserver）—— 验证方式是「DevTools 切 viewport 断点 + 刷新页面」看 gutter/span 变化。',
    ]"
  >
    <section id="demo-responsive">
      <DemoField label="响应式" :code="xFormSource">
        <XForm ref="formRef" :schema="schema" :model="model" />
        <div :class="bem.e('actions')">
          <el-button type="primary" @click="onSave">保存</el-button>
          <el-button @click="onReset">重置</el-button>
          <el-button @click="copySchema">复制 schema</el-button>
        </div>
        <div :class="bem.e('state')">
          <div>
            <strong>当前断点:</strong>
            <el-tag size="large" type="primary">{{ currentBreakpoint }}</el-tag>
            <span style="margin-left: 12px">
              <strong>视口宽度:</strong>
              {{ width }}px
            </span>
          </div>
          <div>
            <strong>说明:</strong>
            切换
            <code>mode (schema ref)</code>
            可观察响应式；当前 XForm 不支持 viewport resize 自动重渲染。
            <ul>
              <li>
                <strong>字段间距</strong>
                :xs=0 → sm=16 → md=40 → lg=60 → xl=80 (px)
              </li>
              <li>
                <strong>水平对齐</strong>
                :xs=左对齐 → md=居中 → lg=右对齐 → xl=两端分散
              </li>
              <li>
                <strong>字段宽度</strong>
                :col.responsive 控制 span(xs=24 占满 / md=6 占 1/4)
              </li>
            </ul>
            当前 XForm 已知限制：el-row / el-col 不自动监听 viewport resize（v3.5 集成中），需
            DevTools 切 viewport 断点 + 刷新页面才能看到 gutter/span 变化。
          </div>
          <ModelPreview :model="model" />
        </div>
      </DemoField>
    </section>

    <ApiTable title="responsive 配置" :items="responsiveItems" anchor="api-responsive" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-responsive {
  &__actions {
    margin-top: 16px;
    display: flex;
    gap: 8px;
  }

  &__state {
    margin-top: 16px;
  }
}
</style>
