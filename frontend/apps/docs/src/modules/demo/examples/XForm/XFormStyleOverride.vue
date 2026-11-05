<script setup lang="ts">
/**
 * XForm 样式覆盖 demo
 *
 * 覆盖 element-plus 默认外观的 6 个真实业务场景 + 一张钩子清单表。
 * 每个场景用独立 XForm 实例 + class 锁定作用域，互不污染；钩子清单表覆盖
 * XForm 自有钩子 + Element Plus 高频可覆盖类名 + CSS 主题变量三类。
 *
 * 落地方式：新建本文件，路由 / sidebar 由 import.meta.glob + sidebar-groups.ts
 * CN_NAMES 自动派生，**不需要改 routes/index.ts**。
 */
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import xFormSource from './XFormStyleOverride.vue?raw'

const { bem } = useXFormDemo({
  name: 'style-override',
  schema: () => compactSchema,
})

// 6 个独立 model（互不干扰）
const compactModel = reactive<Record<string, unknown>>({
  username: '',
  email: '',
  role: '',
  date: '',
})
const brandModel = reactive<Record<string, unknown>>({
  email: '',
  password: '',
  note: '',
  highlight: '重要字段',
})
const errorStableModel = reactive<Record<string, unknown>>({
  a: '',
  b: '',
  c: '',
})
const readonlyModel = reactive<Record<string, unknown>>({
  name: '张三',
  dept: '技术部 / 前端组',
  joinDate: '2024-03-15',
  email: 'zhangsan@example.com',
  salary: '￥18,000',
})
const arrayModel = reactive<Record<string, unknown>>({
  team: [
    { name: '张三', level: 'P5' },
    { name: '李四', level: 'P6' },
  ],
})
const themeModel = reactive<Record<string, unknown>>({
  title: '订单标题',
  desc: '订单描述',
  date: '',
})

// 6 个独立 schema
const compactSchema: SchemaNode = {
  row: { gutter: 16 },
  children: [
    { label: '用户名', name: 'username', component: 'Input', col: { span: 12 } },
    { label: '邮箱', name: 'email', component: 'Input', col: { span: 12 } },
    { label: '角色', name: 'role', component: 'Select', col: { span: 12 } },
    { label: '入职日期', name: 'date', component: 'DatePicker', col: { span: 12 } },
  ],
}

const brandSchema: SchemaNode = {
  row: { gutter: 16 },
  children: [
    { label: '邮箱', name: 'email', component: 'Input', col: { span: 12 } },
    { label: '密码', name: 'password', component: 'InputPassword', col: { span: 12 } },
    { label: '备注', name: 'note', component: 'InputTextArea', col: { span: 24 } },
    // 演示字段级作用域：formItem.props.class 锁住「重要字段」单独染色
    {
      label: '重要字段',
      name: 'highlight',
      component: 'Input',
      col: { span: 24 },
      formItem: { props: { class: bem.e('brand-field-special') } },
    },
  ],
}

const errorStableSchema: SchemaNode = {
  children: [
    {
      label: '必填 A',
      name: 'a',
      component: 'Input',
      rules: [{ required: true, message: 'A 必填' }],
    },
    {
      label: '必填 B',
      name: 'b',
      component: 'Input',
      rules: [{ required: true, message: 'B 必填' }],
    },
    {
      label: '必填 C',
      name: 'c',
      component: 'Input',
      rules: [{ required: true, message: 'C 必填' }],
    },
  ],
}

const readonlySchema: SchemaNode = {
  children: [
    { label: '姓名', name: 'name', component: 'Input', col: { span: 12 }, permission: 'view' },
    { label: '部门', name: 'dept', component: 'Input', col: { span: 12 }, permission: 'view' },
    {
      label: '入职日期',
      name: 'joinDate',
      component: 'Input',
      col: { span: 12 },
      permission: 'view',
    },
    { label: '邮箱', name: 'email', component: 'Input', col: { span: 12 }, permission: 'view' },
    { label: '薪资', name: 'salary', component: 'Input', col: { span: 24 }, permission: 'view' },
  ],
}

const arraySchema: SchemaNode = {
  children: [
    {
      name: 'team',
      label: '团队成员',
      kind: 'array',
      array: {
        itemSchema: {
          row: { gutter: 8 },
          // 行内字段：渲染在 array-node__row 里，每行复用这一份 schema
          children: [
            { label: '姓名', name: 'name', component: 'Input' },
            { label: '级别', name: 'level', component: 'Input' },
          ],
        },
      },
    },
  ],
}

const themeSchema: SchemaNode = {
  row: { gutter: 16 },
  children: [
    { label: '标题', name: 'title', component: 'Input', col: { span: 24 } },
    { label: '描述', name: 'desc', component: 'InputTextArea', col: { span: 24 } },
    { label: '截止日期', name: 'date', component: 'DatePicker', col: { span: 24 } },
  ],
}

const tocItems = [
  { id: 'demo-compact', label: '紧凑表单' },
  { id: 'demo-brand', label: '品牌化' },
  { id: 'demo-error-stable', label: '错误提示不抖动' },
  { id: 'demo-readonly', label: '只读态' },
  { id: 'demo-array', label: '数组节点' },
  { id: 'demo-theme', label: '主题色覆盖' },
  { id: 'hook-cheatsheet', label: '钩子清单' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="XForm 样式覆盖（6 个真实场景 + 钩子清单）"
    source="src/components/form-schema/XForm.vue"
    :introductions="[
      'element-plus 默认外观与品牌色 / 业务密度 / 异常处理常常不一致，本页演示如何针对 XForm 做样式定制。',
      '每个场景用一个独立 XForm 实例 + class 锁作用域，互不污染；通过 formItem.props.class 还可锁单字段。',
      '最后一节是「可覆盖钩子清单」表，覆盖 XForm 自有钩子、Element Plus 高频类、CSS 主题变量三类。',
    ]"
  >
    <!-- 先看这个引导卡：6 个场景，新人易迷失 -->
    <div :class="bem.e('start-here')">
      <strong>👀 先看这个——样式覆盖场景按推荐顺序浏览</strong>
      <p>
        <strong>① 紧凑表单 + 品牌化</strong>
        （必看） —— 掌握 :class 透传作用域 + 字段级 formItem.props.class 隔离
      </p>
      <p>
        <strong>② 错误提示不抖动 + 只读态</strong>
        （进阶） —— 占位高度预留 / permission: 'view' 纯文本展示
      </p>
      <p>
        <strong>③ 数组节点 + 主题色</strong>
        （高级） —— 行卡片化 / CSS 变量覆盖全局主色
      </p>
      <p>
        <strong>末尾「可覆盖钩子清单」</strong>
        —— 高/中/低三档稳定性分级，决定升级风险
      </p>
    </div>

    <!-- 场景 1：紧凑表单 -->
    <section id="demo-compact">
      <DemoField label="场景 1 紧凑表单（label 宽 / 控件高 / 行间距压缩）" :code="xFormSource">
        <XForm :schema="compactSchema" :model="compactModel" :class="bem.e('compact')" />
      </DemoField>
    </section>

    <!-- 场景 2：品牌化 -->
    <section id="demo-brand">
      <DemoField label="场景 2 品牌化（圆角 / focus 色 / 必填星号位置）" :code="xFormSource">
        <XForm :schema="brandSchema" :model="brandModel" :class="bem.e('brand')" />
      </DemoField>
    </section>

    <!-- 场景 3：错误提示不抖动 -->
    <section id="demo-error-stable">
      <DemoField label="场景 3 错误提示不抖动（绝对定位改为预留占位高度）" :code="xFormSource">
        <XForm
          :schema="errorStableSchema"
          :model="errorStableModel"
          :class="bem.e('error-stable')"
        />
        <p :class="bem.e('hint')">
          试试在三个字段都填值、再分别清空 —— 报错时布局不跳动，提交按钮不跟着抖动。
        </p>
      </DemoField>
    </section>

    <!-- 场景 4：只读态 -->
    <section id="demo-readonly">
      <DemoField
        label="场景 4 只读态 / 视图态（permission: 'view' 纯文本展示）"
        :code="xFormSource"
      >
        <XForm :schema="readonlySchema" :model="readonlyModel" :class="bem.e('readonly')" />
      </DemoField>
    </section>

    <!-- 场景 5：数组节点 -->
    <section id="demo-array">
      <DemoField label="场景 5 数组节点定制（行卡片化 + 表头高亮）" :code="xFormSource">
        <XForm :schema="arraySchema" :model="arrayModel" :class="bem.e('array')" />
      </DemoField>
    </section>

    <!-- 场景 6：主题色 -->
    <section id="demo-theme">
      <DemoField label="场景 6 主题色覆盖（CSS 变量：--el-color-primary 等）" :code="xFormSource">
        <XForm :schema="themeSchema" :model="themeModel" :class="bem.e('theme')" />
      </DemoField>
    </section>

    <!-- 钩子清单表 -->
    <section id="hook-cheatsheet">
      <h2 :class="bem.e('cheatsheet-title')">可覆盖钩子清单</h2>
      <p :class="bem.e('cheatsheet-hint')">
        选择器按稳定性分三档：高 = 项目自有，不随第三方变动；中 = Element Plus 类，升级 element-plus
        大版本可能变动；低 = element-plus CSS 变量，理论上稳定但版本间可能微调。
      </p>
      <div :class="bem.e('cheatsheet-wrap')">
        <table :class="bem.e('cheatsheet-table')">
          <thead>
            <tr>
              <th>选择器 / 变量</th>
              <th>作用域</th>
              <th>稳定</th>
              <th>适用场景</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>.vv-x-form</code></td>
              <td>XForm 根节点</td>
              <td>高</td>
              <td>表单整体品牌化（通过 &lt;XForm class&gt; 透传）</td>
            </tr>
            <tr>
              <td><code>.vv-x-form__upload-icon[--picture-card/--drag]</code></td>
              <td>Upload 触发图标</td>
              <td>高</td>
              <td>Upload 触发图标染色 / 尺寸定制</td>
            </tr>
            <tr>
              <td><code>.vv-x-form__upload-text</code></td>
              <td>drag Upload 文案</td>
              <td>高</td>
              <td>drag 区域文案样式</td>
            </tr>
            <tr>
              <td><code>.vv-x-form__upload-button</code></td>
              <td>Upload 兜底按钮</td>
              <td>高</td>
              <td>text/picture 模式兜底按钮样式</td>
            </tr>
            <tr>
              <td><code>.x-form-view-field / __label / __value</code></td>
              <td>只读态字段</td>
              <td>高（未走 BEM）</td>
              <td>只读详情页 / 审批页（钩子本身稳定但类名是裸名）</td>
            </tr>
            <tr>
              <td><code>.array-node / __row / __header / __title / __body / __empty</code></td>
              <td>数组节点</td>
              <td>高（未走 BEM）</td>
              <td>数组节点卡片化 / 行高亮</td>
            </tr>
            <tr>
              <td><code>.el-form-item</code></td>
              <td>form-item 容器</td>
              <td>中</td>
              <td>label 与控件的垂直间距、行高</td>
            </tr>
            <tr>
              <td><code>.el-form-item__label</code></td>
              <td>label 文本</td>
              <td>中</td>
              <td>label 颜色、宽度、对齐</td>
            </tr>
            <tr>
              <td><code>.el-form-item__label::before</code></td>
              <td>必填星号</td>
              <td>中</td>
              <td>必填星号颜色、位置（移到右侧 / 改色）</td>
            </tr>
            <tr>
              <td><code>.el-form-item__content</code></td>
              <td>form-item 内容区</td>
              <td>中</td>
              <td>占位高度（防抖动）、对齐</td>
            </tr>
            <tr>
              <td><code>.el-form-item__error</code></td>
              <td>错误提示文本</td>
              <td>中</td>
              <td>错误颜色、字号、定位方式</td>
            </tr>
            <tr>
              <td><code>.el-input__wrapper</code></td>
              <td>Input 容器</td>
              <td>中</td>
              <td>圆角、阴影、focus 高亮</td>
            </tr>
            <tr>
              <td><code>.el-button</code></td>
              <td>Button 容器</td>
              <td>中</td>
              <td>按钮圆角、尺寸</td>
            </tr>
            <tr>
              <td><code>.el-checkbox / .el-radio</code></td>
              <td>选择控件</td>
              <td>中</td>
              <td>复选框 / 单选框颜色</td>
            </tr>
            <tr>
              <td><code>--el-color-primary</code></td>
              <td>全局主题色</td>
              <td>低</td>
              <td>设计系统接入，全局品牌色</td>
            </tr>
            <tr>
              <td><code>--el-color-primary-light-3/5/7/8/9</code></td>
              <td>主色浅色阶</td>
              <td>低</td>
              <td>背景 / 边框浅色</td>
            </tr>
            <tr>
              <td><code>--el-color-success / warning / danger / info</code></td>
              <td>语义色</td>
              <td>低</td>
              <td>校验通过 / 警告 / 错误 / 中性态颜色</td>
            </tr>
            <tr>
              <td><code>--el-text-color-primary / regular / secondary / placeholder</code></td>
              <td>文字层级色</td>
              <td>低</td>
              <td>文字层级、对比度</td>
            </tr>
            <tr>
              <td><code>--el-border-color / radius</code></td>
              <td>边框与圆角</td>
              <td>低</td>
              <td>边框色、整体圆角基调</td>
            </tr>
            <tr>
              <td><code>--el-component-size</code></td>
              <td>控件尺寸档位</td>
              <td>低</td>
              <td>大型 / 默认 / 小型控件切换</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-style-override {
  // 场景 1：紧凑表单 —— label-width 收窄、行间距压缩、控件高度收紧
  &__compact {
    .el-form-item {
      margin-bottom: 12px;
    }

    .el-form-item__label {
      width: 64px;
      color: var(--el-text-color-secondary);
    }

    .el-input__wrapper,
    .el-select__wrapper,
    .el-date-editor {
      padding: 2px 8px;
      min-height: 28px;
    }
  }

  // 场景 2：品牌化 —— 圆角、focus 高亮色、必填星号移到 label 右侧
  &__brand {
    .el-form-item__label {
      color: #7c3aed;
    }

    .el-input__wrapper {
      border-radius: 6px;
      box-shadow: 0 0 0 1px #e9e4fd inset;

      &.is-focus {
        box-shadow:
          0 0 0 1px #7c3aed inset,
          0 0 0 3px rgb(124 58 237 / 12%);
      }
    }

    // 必填星号移到右侧（element-plus 默认在左）
    .el-form-item.is-required .el-form-item__label::before {
      margin-left: 4px;
    }
  }

  // 字段级作用域示范：「重要字段」独立染色，红色边框 + 浅红背景
  // 这个 class 通过 formItem.props.class 挂在 el-form-item 上，无需 wrapper
  &__brand-field-special {
    .el-input__wrapper {
      box-shadow: 0 0 0 1px #fca5a5 inset;
      background: #fef2f2;

      &.is-focus {
        box-shadow:
          0 0 0 1px #ef4444 inset,
          0 0 0 3px rgb(239 68 68 / 12%);
      }
    }

    .el-form-item__label {
      color: #b91c1c;
    }
  }

  // 场景 3：错误提示不抖动 —— form-item 预留固定占位高度
  &__error-stable {
    .el-form-item {
      margin-bottom: 16px;
    }

    .el-form-item__content {
      min-height: 32px;
    }

    // 错误提示绝对定位改为相对定位，占位固定不顶动布局
    .el-form-item__error {
      position: relative;
      top: 4px;
      padding-top: 0;
    }
  }

  &__hint {
    margin-top: 12px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  // 场景 4：只读态 —— x-form-view-field 是裸类名（未走 BEM），demo 如实标注
  &__readonly {
    .x-form-view-field {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      background: var(--el-fill-color-light);
      border-radius: 4px;
    }

    .x-form-view-field__label {
      color: var(--el-text-color-secondary);
      font-size: 13px;
    }

    .x-form-view-field__value {
      color: var(--el-text-color-primary);
      font-weight: 500;
    }
  }

  // 场景 5：数组节点 —— array-node 是裸类名（未走 BEM）
  &__array {
    .array-node {
      border: 1px solid var(--el-border-color-lighter);
      border-radius: 8px;
      overflow: hidden;
    }

    .array-node__header {
      background: linear-gradient(135deg, #f5f3ff, #ede9fe);
      padding: 12px 16px;
      border-bottom: 1px solid var(--el-border-color-lighter);
    }

    .array-node__title {
      font-weight: 600;
      color: #7c3aed;
    }

    .array-node__row {
      border-top: 1px dashed var(--el-border-color-lighter);

      &:first-child {
        border-top: none;
      }
    }

    .array-node__row-body {
      padding: 12px 16px;
    }

    .array-node__empty {
      padding: 24px 16px;
      text-align: center;
      color: var(--el-text-color-placeholder);
    }
  }

  // 场景 6：主题色覆盖 —— CSS 变量，影响所有用 --el-color-primary* 的子组件
  &__theme {
    --el-color-primary: #14b8a6;
    --el-color-primary-light-3: #5eead4;
    --el-color-primary-light-5: #99f6e0;
    --el-color-primary-light-7: #ccfbf1;
    --el-color-primary-light-8: #e6fffb;
    --el-color-primary-light-9: #f0fdfa;
    --el-color-primary-dark-2: #0f766e;

    border-left: 3px solid var(--el-color-primary);
    padding-left: 16px;
  }

  // 钩子清单表
  &__start-here {
    display: block;
    margin-bottom: 20px;
    padding: 12px 16px;
    background: linear-gradient(90deg, #ecf5ff, #f0f9ff);
    border-left: 4px solid var(--el-color-primary);
    border-radius: 4px;
    color: var(--el-text-color-regular);

    > strong {
      display: block;
      color: var(--el-color-primary);
      font-size: 14px;
      margin-bottom: 8px;
    }

    p {
      margin: 4px 0;
      line-height: 1.7;
    }

    strong {
      color: var(--el-color-primary);
    }
  }

  &__cheatsheet-title {
    margin-top: 32px;
    margin-bottom: 8px;
    font-size: 18px;
    font-weight: 600;
  }

  &__cheatsheet-hint {
    margin-bottom: 16px;
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  &__cheatsheet-wrap {
    overflow-x: auto;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
  }

  &__cheatsheet-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;

    th,
    td {
      padding: 8px 12px;
      text-align: left;
      border-bottom: 1px solid var(--el-border-color-lighter);
      vertical-align: top;
    }

    thead th {
      background: var(--el-fill-color-light);
      font-weight: 600;
      color: var(--el-text-color-regular);
    }

    tbody tr:last-child td {
      border-bottom: none;
    }

    code {
      padding: 1px 6px;
      background: var(--el-fill-color-light);
      border-radius: 3px;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
      font-size: 12px;
      color: #c7254e;
    }
  }
}
</style>
