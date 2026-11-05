<script setup lang="ts">
/**
 * 演示 {{ fn }} 动态脚本（沙箱函数表达式）的五类挂载位
 *
 * 场景：报销审批单 —— 锁定整表只读 / 条件显隐 / 动态文案 / 事件打点 / 权限三态
 *
 * 覆盖功能：
 *   1. 顶层 readonly 表达式："{{ (m) => m.locked === true }}" 锁定后整表 view 化
 *   2. node.on.change 表达式：费用类型选择打日志（白名单 pushLog 可视化沙箱执行）
 *   3. node.reaction.hidden 表达式：选「其他」才显示补充说明（必填同步恢复）
 *   4. node.reaction.label 表达式：币种切换联动金额字段文案
 *   5. node.permission 表达式：admin 编辑 / viewer 只读纯文本
 *   6. expressionFunctions 白名单注入：pushLog / toCurrency 在表达式内直接引用
 */
// BEM 工具由 unplugin-auto-import 全局注入（@utils/bem）
import { ElMessage } from 'element-plus'
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import ApiTable from '../../components/ApiTable.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import { expressionItems, expressionSandboxItems } from './configs/xform-demos-api'
import xFormSource from './XFormExpression.vue?raw'
import ModelPreview from '../../components/ModelPreview.vue'

const { bem, formRef, onReset, copySchema } = useXFormDemo({
  name: 'expression',
  schema: () => schema,
})

// 沙箱执行日志面板的数据源——表达式本身拿不到外部作用域，
// 只能通过白名单函数作为受控出口把信息带出来（这正是演示点）
const sandboxLogs = ref<string[]>([])

// model 必须预声明全部字段：表达式的 m 副本与 reaction 重算都以此为准
// （推断具体形状：模板控制区 v-model 需要标量类型；传给 XForm 时与 Record<string, unknown> 结构兼容）
const model = reactive({
  locked: false,
  role: 'admin',
  title: '',
  feeType: '',
  extraNote: '',
  currency: 'CNY',
  budget: undefined,
  approval: '',
})

const FEE_TYPE_OPTIONS = ['差旅费', '办公用品', '业务招待', '其他'].map((s) => ({
  value: s,
  label: s,
}))

const CURRENCY_OPTIONS = [
  { value: 'CNY', label: '人民币 ¥' },
  { value: 'USD', label: '美元 $' },
]

const schema: SchemaNode = {
  // ① 顶层只读表达式：true 时所有字段降为 view 态纯文本并跳过校验
  readonly: '{{ (m) => m.locked === true }}',
  column: 2,
  row: { gutter: 24 },
  children: [
    {
      component: 'Card',
      props: { header: '基础信息' },
      column: 1,
      children: [
        {
          name: 'title',
          label: '报销事由',
          component: 'Input',
          props: { placeholder: '请输入报销事由', clearable: true },
          rules: [{ required: true, message: '请输入报销事由', trigger: 'blur' }],
        },
        // ② 节点事件表达式：(m, v) 双参占位缺一不可 —— 第二个参数才是 change 的值；
        //    打日志必须走白名单 pushLog（闭包不可见），此即沙箱隔离的副作用出口
        {
          name: 'feeType',
          label: '费用类型',
          component: 'Select',
          props: { placeholder: '请选择费用类型', clearable: true, options: FEE_TYPE_OPTIONS },
          rules: [{ required: true, message: '请选择费用类型', trigger: 'change' }],
          on: {
            change:
              "{{ (m, v) => pushLog('费用类型 → ' + v + '，当前事由：' + (m.title || '未填写')) }}",
          },
        },
        // ③ 反应式显隐表达式：模型依赖自动追踪；隐藏的必填字段不阻塞提交
        {
          name: 'extraNote',
          label: '补充说明',
          component: 'Input',
          props: { placeholder: '选了「其他」才会出现', clearable: true },
          rules: [{ required: true, message: '请补充说明费用用途', trigger: 'blur' }],
          reaction: { hidden: "{{ (m) => m.feeType !== '其他' }}" },
        },
      ],
    },
    {
      component: 'Card',
      props: { header: '金额与审批' },
      column: 1,
      children: [
        {
          name: 'currency',
          label: '币种',
          component: 'Select',
          props: { options: CURRENCY_OPTIONS },
        },
        // ④ 文案反应式 + 白名单格式化：label 随币种实时变化；事件里 toCurrency 演示业务工具注入
        {
          name: 'budget',
          label: '报销金额',
          component: 'InputNumber',
          props: { min: 0, controlsPosition: 'right', placeholder: '请输入金额' },
          rules: [{ required: true, message: '请输入报销金额', trigger: 'blur' }],
          on: { change: "{{ (m, v) => pushLog('金额格式化 → ' + toCurrency(m.currency, v)) }}" },
          reaction: {
            label:
              "{{ (m) => '报销金额（' + (m.currency === 'USD' ? '美元 $' : '人民币 ¥') + '）' }}",
          },
        },
        // ⑤ 权限三态表达式：admin 可编辑；viewer 渲染为只读纯文本（且跳过校验）
        {
          name: 'approval',
          label: '审批意见',
          component: 'Input',
          props: { type: 'textarea', rows: 3, placeholder: '仅 admin 身份可填写审批意见' },
          permission: "{{ (m) => m.role === 'admin' ? 'edit' : 'view' }}",
        },
      ],
    },
  ],
}

/**
 * 白名单函数表（expressionFunctions prop）：编译期注入表达式作用域
 * 注意为模块级注册（多实例共享）——注册名来自可信应用代码，是表达式唯一的受控出口
 */
const expressionFunctions = {
  /** 把沙箱内发生的事写到表单外的日志面板（纯展示型副作用出口） */
  pushLog: (msg: unknown) => {
    const text = String(msg ?? '').trim()
    if (!text) return
    sandboxLogs.value = [...sandboxLogs.value.slice(-19), text]
  },
  /** 按币种格式化金额：示范「业务格式化不必内联进 schema 字符串」的标准姿势 */
  toCurrency: (cur: unknown, n: unknown) =>
    cur === 'USD' ? `$${Number(n ?? 0).toFixed(2)}` : `¥${Number(n ?? 0).toFixed(2)}`,
}

// formRef 由 useXFormDemo 统一提供

async function onValidate() {
  const valid = await formRef.value?.validate()
  if (valid) {
    ElMessage.success('校验通过')
  } else {
    ElMessage.error('校验失败，请检查红字提示')
  }
}

const tocItems = [
  { id: 'demo-expression', label: '五类挂载位演示' },
  { id: 'api-mount-points', label: '挂载位速查' },
  { id: 'api-sandbox-notes', label: '沙箱上下文与边界' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="{{ fn }} 动态脚本（沙箱表达式）"
    source="src/components/form-schema/composables/use-expression.ts"
    :introductions="[
      '{{ }} 是声明式 schema 里嵌入 JS 逻辑的通道：整段字符串被编译为函数，首个入参永远是 model 安全副本，其后才是组件事件参数。',
      '本页一次覆盖五类挂载位：顶层 readonly / node.on 事件 / reaction 显隐与文案 / permission 三态 / expressionFunctions 白名单注入——日志面板可视化了沙箱内的每次执行。',
      '安全边界：model 经深净化副本传入且无法回写真实表单；无参形态 {{ () => xxx }} 合法但收不到任何参数；需要写真实 model 或对接埋点 SDK 时请改用原生函数形式。',
    ]"
  >
    <section id="demo-expression">
      <div :class="bem.e('controls')">
        <el-switch v-model="model.locked" active-text="锁定单据（① 整表只读）" />
        <el-radio-group v-model="model.role">
          <el-radio-button value="admin">管理员 admin</el-radio-button>
          <el-radio-button value="viewer">查看者 viewer</el-radio-button>
        </el-radio-group>
        <span :class="bem.e('hint')">角色切换驱动 ⑤ 审批意见权限</span>
      </div>

      <DemoField label="报销审批单（五类挂载位联动）" :code="xFormSource">
        <XForm
          ref="formRef"
          :schema="schema"
          :model="model"
          :expression-functions="expressionFunctions"
        />
        <div :class="bem.e('actions')">
          <el-button @click="onReset">重置</el-button>
          <el-button type="primary" @click="onValidate">校验</el-button>
          <el-button @click="copySchema">复制 schema</el-button>
        </div>
        <div :class="bem.e('panels')">
          <ModelPreview :model="model" />
          <div :class="bem.e('logs')">
            <div>沙箱执行日志（白名单 pushLog 出口）：</div>
            <pre v-if="sandboxLogs.length">{{ sandboxLogs.join('\n') }}</pre>
            <div v-else :class="bem.e('logs-empty')">
              空态：操作「费用类型 / 报销金额」后这里会显示表达式执行结果
            </div>
          </div>
        </div>
      </DemoField>
    </section>

    <ApiTable title="{{ fn }} 五类挂载位" :items="expressionItems" anchor="api-mount-points" />
    <ApiTable
      title="沙箱上下文与安全边界"
      :items="expressionSandboxItems"
      anchor="api-sandbox-notes"
    />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-expression {
  &__controls {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 16px;
    padding: 12px 16px;
    background: #f5f7fa;
    border-radius: 4px;
  }

  &__hint {
    font-size: 13px;
    color: #909399;
  }

  &__actions {
    margin-top: 16px;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  &__panels {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-top: 16px;

    @media (max-width: 768px) {
      grid-template-columns: 1fr;
    }
  }

  &__logs {
    font-size: 12px;
    color: #909399;

    pre {
      background: #f5f7fa;
      padding: 8px 12px;
      border-radius: 4px;
      font-family: 'Menlo', 'Consolas', monospace;
      overflow-x: auto;
      white-space: pre-wrap;
      margin: 4px 0;
    }
  }

  &__logs-empty {
    padding: 8px 12px;
    background: #fafafa;
    border: 1px dashed #dcdfe6;
    border-radius: 4px;
    margin-top: 4px;
  }
}
</style>
