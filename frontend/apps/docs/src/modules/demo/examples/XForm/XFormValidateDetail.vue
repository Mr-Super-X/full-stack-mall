<script setup lang="ts">
/**
 * 演示 validateDetail() 详细返回结构 —— 与 validate() 只返回 boolean 的对比
 *
 * 场景：用户注册表单（用户名 + 邮箱 + 密码 + 确认密码），故意触发多种校验失败：
 *   1. 用户名 / 邮箱 / 密码留空 → 必填红字
 *   2. 邮箱填非邮箱格式 → 邮箱格式红字
 *   3. 密码和确认密码不一致 → 跨字段红字（crossValidator）
 *
 * 提交时同时调用两个方法并把结果并列展示：
 *   - validate() 只返回 boolean（true = 全部通过；false = 有错）
 *   - validateDetail() 返回 { isValid, errors: [{ keyPath, message }] }
 *
 * 关键差异（@see @vv/ui/components/form-schema/types/xform.ts ValidateResult）：
 *   - validate() —— 适合「提交按钮 loading / disabled」「是否允许下一步」快速判断
 *   - validateDetail() —— 适合「错误详情汇总弹窗」「自定义错误面板」「调试日志」场景
 *   - keyPath 是 (string | number)[]：字符串 = 字段名，number = 数组下标
 *     → 可拼 lodash 路径 string 展示，也可直接喂给 setFieldError(path.join('.'), message)
 */
import { ElMessage } from 'element-plus'
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import ApiTable from '../../components/ApiTable.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import { validateDetailItems } from './configs/xform-demos-api'
import xFormSource from './XFormValidateDetail.vue?raw'
import ModelPreview from '../../components/ModelPreview.vue'

const { bem, formRef, onReset, copySchema } = useXFormDemo({
  name: 'validate-detail',
  schema: () => schema,
  model: () => model,
})

const schema: SchemaNode = {
  column: 2,
  row: { gutter: 24 },
  children: [
    {
      label: '用户名',
      name: 'username',
      component: 'Input',
      rules: [{ required: true, message: '用户名必填', trigger: 'blur' }],
      props: { placeholder: '请输入用户名', clearable: true },
    },
    {
      label: '邮箱',
      name: 'email',
      component: 'Input',
      rules: [
        { required: true, message: '邮箱必填', trigger: 'blur' },
        { type: 'email', message: '邮箱格式不正确', trigger: 'blur' },
      ],
      props: { placeholder: 'name@example.com', clearable: true },
    },
    {
      label: '密码',
      name: 'password',
      component: 'Input',
      props: { type: 'password', placeholder: '请输入密码', clearable: true },
      rules: [{ required: true, message: '密码必填', trigger: 'blur' }],
    },
    {
      label: '确认密码',
      name: 'passwordConfirm',
      component: 'Input',
      props: { type: 'password', placeholder: '再次输入密码', clearable: true },
      rules: [
        { required: true, message: '确认密码必填', trigger: 'blur' },
        // 跨字段：两次密码不一致时红字（用 crossValidator 走 validateDetail 路径）
        {
          dependsOn: ['password'],
          crossValidator: (value: unknown, password: unknown) =>
            value === password || '两次密码不一致',
          trigger: 'blur',
        },
      ],
    },
    // 数组字段：用于演示 keyPath 包含数字索引（如 ['phones', 0, 'number']）
    {
      label: '联系电话（数组）',
      name: 'phones',
      component: 'Input',
      // schema 写法：用 props 提示数组语义，运行时仍是字符串字段；validateDetail 路径按数组项校验
      props: { placeholder: '演示数组 keyPath：实际场景用 xArray 节点' },
    },
  ],
}

const model = reactive<Record<string, unknown>>({
  username: '',
  email: '',
  password: '',
  passwordConfirm: '',
  phones: ['', ''],
})

// ---- validateDetail 返回值结构（与 types/xform.ts ValidateResult 对齐） ----
interface ValidateError {
  keyPath: (string | number)[]
  message: string
}
interface ValidateDetailResult {
  isValid: boolean
  errors: ValidateError[]
}

// 运行时状态：null = 未提交；boolean = validate() 返回值；object = validateDetail() 返回值
const validateBool = ref<boolean | null>(null)
const validateResult = ref<ValidateDetailResult | null>(null)

/** 提交时同时调用两个方法，对比返回结构差异 */
async function onSave() {
  if (!formRef.value) return
  // ① validate() —— 只返回 boolean；true = 全部通过；false = 有错
  const valid = await formRef.value.validate()
  validateBool.value = valid
  // ② validateDetail() —— 返回完整结构（含 keyPath + message）
  const detail = await formRef.value.validateDetail()
  validateResult.value = detail
  if (!valid) {
    ElMessage.error(`校验失败：${detail.errors.length} 项错误（详见下方错误面板）`)
  } else {
    ElMessage.success('校验通过')
  }
}

/** 清空错误展示，方便用户对比下一次提交结果 */
function clearResult() {
  validateBool.value = null
  validateResult.value = null
}

/** keyPath 数组 → lodash 路径字符串（用于展示） */
function keyPathToString(keyPath: (string | number)[]): string {
  return keyPath.join('.')
}

const tocItems = [
  { id: 'demo-validate-detail', label: 'validateDetail 演示' },
  { id: 'demo-compare-validate', label: '与 validate 对比' },
  { id: 'demo-keypath-array', label: '数组字段 keyPath（含数字索引）' },
  { id: 'api-validate-detail', label: 'API' },
]

useDocToc(tocItems)

// 数组字段 keyPath 结构示例：用于「演示 keyPath 含 [i] 数字索引」对照面板
const keyPathArrayExample = `// 示例：嵌套数组的 validateDetail().errors 结构
[
  {
    keyPath: ['orders', 0, 'items', 1, 'product'],
    // ↑ 字符串 = 字段名；数字 = 数组下标
    message: '请选择商品',
  },
  {
    keyPath: ['orders', 1, 'orderNo'],
    message: '请输入订单号',
  },
]`
</script>

<template>
  <DemoFrame
    title="validateDetail 详细返回 —— 与 validate 对比"
    source="src/components/form-schema/XForm.vue"
    :introductions="[
      'validate() 只返回 boolean（true = 全部通过；false = 有错），适合「提交按钮 loading/disabled」快速判断。',
      'validateDetail() 返回完整结构 { isValid, errors: [{ keyPath, message }] }，适合「错误详情展示 / 自定义错误面板 / 调试日志」场景。',
      'keyPath 是 (string | number)[] 数组：字符串 = 字段名，number = 数组下标；可用于 setFieldError(keyPath.join(\'.\'), message) 或在 UI 上 highlight 对应字段。',
    ]"
  >
    <section id="demo-validate-detail">
      <DemoField label="注册表单（4 字段 + 跨字段）" :code="xFormSource">
        <XForm ref="formRef" :schema="schema" :model="model" />
        <div :class="bem.e('actions')">
          <el-button @click="onReset">重置</el-button>
          <el-button type="primary" @click="onSave">
            提交（同时调 validate + validateDetail）
          </el-button>
          <el-button @click="copySchema">复制 schema</el-button>
          <el-button @click="clearResult">清空结果</el-button>
        </div>
        <ModelPreview :model="model" />
      </DemoField>
    </section>

    <section id="demo-compare-validate" :class="bem.e('section')">
      <div :class="bem.e('section-title')">与 validate() 返回值对比</div>

      <div :class="bem.e('compare')">
        <!-- ① validate() 返回值 -->
        <div :class="bem.e('compare-card')">
          <div :class="bem.e('compare-label')">① validate() —— boolean</div>
          <div :class="bem.e('compare-value')">
            <template v-if="validateBool === null">
              <span :class="bem.e('placeholder')">（点击「提交」触发校验）</span>
            </template>
            <template v-else>
              <div>
                返回值:
                <code :class="bem.e('compare-code')">{{ validateBool }}</code>
              </div>
              <div :class="bem.e('compare-hint')">
                {{ validateBool ? '✅ 全部通过（详细错误见右侧）' : '❌ 有错误（具体错误见右侧）' }}
              </div>
            </template>
          </div>
        </div>

        <!-- ② validateDetail() 返回值 -->
        <div :class="bem.e('compare-card')">
          <div :class="bem.e('compare-label')">② validateDetail() —— ValidateResult</div>
          <div :class="bem.e('compare-value')">
            <template v-if="validateResult === null">
              <span :class="bem.e('placeholder')">（点击「提交」触发校验）</span>
            </template>
            <template v-else>
              <div :class="bem.e('detail-summary')">
                isValid:
                <code :class="bem.e('compare-code')">{{ validateResult.isValid }}</code>
                · 错误数:
                <code :class="bem.e('compare-code')">{{ validateResult.errors.length }}</code>
              </div>

              <div v-if="validateResult.errors.length > 0" :class="bem.e('error-list')">
                <div :class="bem.e('error-title')">
                  校验失败 {{ validateResult.errors.length }} 项
                </div>
                <div
                  v-for="(err, idx) in validateResult.errors"
                  :key="idx"
                  :class="bem.e('error-item')"
                >
                  <span :class="bem.e('error-index')">#{{ idx + 1 }}</span>
                  <span :class="bem.e('error-path')">{{ keyPathToString(err.keyPath) }}</span>
                  <span :class="bem.e('error-sep')">→</span>
                  <span :class="bem.e('error-message')">{{ err.message }}</span>
                </div>
              </div>

              <div v-else :class="bem.e('success-msg')">✅ 无错误（errors 数组为空）</div>
            </template>
          </div>
        </div>
      </div>
    </section>

    <ApiTable
      title="validate() / validateDetail() API"
      :items="validateDetailItems"
      anchor="api-validate-detail"
    />

    <!-- 数组字段的 keyPath 演示：展示 keyPath 含数字索引 [i] 的结构 -->
    <section id="demo-keypath-array">
      <DemoField label="数组字段的 keyPath（含数字索引）" :code="keyPathArrayExample">
        <p :class="bem.e('keypath-intro')">
          当字段位于数组节点（xArray / 嵌套 array）内时，
          <code>validateDetail()</code>
          返回的
          <code>errors[].keyPath</code>
          数组会包含数字下标，而非字符串。例如：
          <code>['orders', 0, 'items', 1, 'product']</code>
          表示「orders 数组第 0 行的 items 数组第 1 项的 product 字段」。 string = 字段名，number =
          数组下标 —— 可用于：
          <code>setFieldError(keyPath.join('.'), message)</code>
          或在 UI 上 highlight 对应字段。
        </p>
        <p :class="bem.e('keypath-hint')">
          本 demo 注册表单故意留空触发校验后，右侧错误面板会展示完整的 keyPath 数组 （含字段名 +
          嵌套结构）；若需演示纯数组下标场景，请切换到
          <code>/demo/xform-nested-array</code>
          （嵌套 array 验证失败时 keyPath 含两层 [i]）。
        </p>
      </DemoField>
    </section>
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-validate-detail {
  &__actions {
    margin-top: 16px;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  &__section {
    margin-top: 24px;
  }

  &__section-title {
    font-size: 14px;
    font-weight: 600;
    color: #303133;
    margin-bottom: 12px;
  }

  &__compare {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 16px;
  }

  &__compare-card {
    border: 1px solid #e4e7ed;
    border-radius: 4px;
    padding: 12px;
    background: #fafbfc;
  }

  &__compare-label {
    font-size: 12px;
    font-weight: 600;
    color: #606266;
    margin-bottom: 8px;
    font-family: monospace;
  }

  &__compare-value {
    font-size: 13px;
    color: #303133;
    min-height: 40px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__compare-code {
    font-family: monospace;
    background: #fff;
    padding: 2px 6px;
    border-radius: 3px;
    border: 1px solid #ebeef5;
  }

  &__compare-hint {
    font-size: 12px;
    color: #909399;
  }

  &__placeholder {
    color: #c0c4cc;
    font-style: italic;
  }

  &__detail-summary {
    font-size: 13px;
    color: #303133;
    margin-bottom: 8px;
  }

  &__error-list {
    border: 1px solid #fbc4c4;
    background: #fef0f0;
    border-radius: 4px;
    padding: 12px;
  }

  &__error-title {
    font-size: 13px;
    font-weight: 600;
    color: #f56c6c;
    margin-bottom: 8px;
  }

  &__error-item {
    padding: 4px 0;
    display: flex;
    align-items: baseline;
    gap: 6px;
    font-size: 12px;
    color: #606266;
  }

  &__error-index {
    color: #909399;
    font-family: monospace;
    min-width: 24px;
  }

  &__error-path {
    font-family: monospace;
    background: #fff;
    padding: 1px 6px;
    border-radius: 3px;
    border: 1px solid #fde2e2;
    color: #f56c6c;
    font-weight: 600;
  }

  &__error-sep {
    color: #c0c4cc;
  }

  &__error-message {
    color: #303133;
  }

  &__success-msg {
    color: #67c23a;
    font-size: 13px;
  }

  // 数组 keyPath 演示段：解释为何 keyPath 含 [i] 数字索引
  &__keypath-intro,
  &__keypath-hint {
    margin: 8px 0;
    font-size: 13px;
    line-height: 1.6;
    color: var(--el-text-color-regular);
  }

  &__keypath-hint {
    color: var(--el-text-color-secondary);
  }
}
</style>
