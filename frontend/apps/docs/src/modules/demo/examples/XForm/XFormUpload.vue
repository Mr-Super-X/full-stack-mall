<script setup lang="tsx">
/**
 * XForm 文件上传场景 demo
 *
 * 覆盖企业真实业务中 7 类常见上传需求：
 * 1. 单文件头像上传（limit: 1 + accept image/*）
 * 2. 多文件附件上传（multiple + limit）
 * 3. 拖拽上传（drag）
 * 4. 图片墙上传（listType: picture-card）
 * 5. 手动上传（autoUpload: false，随表单提交）
 * 6. 上传前校验（beforeUpload 大小 / 类型）
 * 7. 已上传文件回显（fileList 默认值）
 *
 * 外加 3 类"产品觉得默认样式不好、需要定制"的自定义方案：
 * 8. 类名覆盖默认注入（不写 slots，只改外观）
 * 9. slots.default 完全接管触发区
 * 10. slots.file 自定义已上传项渲染 —— 同时给出 JSX 与 h() 两种等价写法
 *
 * script 块是 lang="tsx" 而非 lang="ts"：场景 10 的 JSX 写法需要它。
 * 前置条件是 eslint.config.mjs 的 withVueTs 已声明 scriptLangs: ['ts', 'tsx']。
 */
import { h } from 'vue'
import { ElMessage, ElIcon, ElButton } from 'element-plus'
import { UploadFilled, Document } from '@element-plus/icons-vue'
import type { UploadRawFile, UploadUserFile, UploadRequestOptions } from 'element-plus'
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import ApiTable from '../../components/ApiTable.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import { uploadItems } from './configs/xform-demos-api'
import xFormSource from './XFormUpload.vue?raw'
import ModelPreview from '../../components/ModelPreview.vue'

const { formRef, bem, copySchema } = useXFormDemo({
  name: 'upload',
  schema: () => schema,
  model: () => model,
})

// onSave / onReset 由 useXFormDemo 标准实现 + 自定义 JSON dump
async function onSave() {
  if (!formRef.value) return
  const valid = await formRef.value.validate()
  if (valid) {
    ElMessage.success('保存成功')
  } else {
    ElMessage.error('校验失败，请检查字段')
  }
}

function onReset() {
  formRef.value?.resetFields()
}

function onSaveCustom() {
  ElMessage.success('定制表单数据已更新（详见下方预览）')
}

/** mock 上传：本地模拟成功，避免 demo 依赖真实后端 */
function mockUpload(options: UploadRequestOptions): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const blobUrl = URL.createObjectURL(options.file)
      options.onSuccess?.({ url: blobUrl })
      ElMessage.success(`${options.file.name} 上传成功`)
      resolve()
    }, 600)
  })
}

/** 上传前校验：仅允许 JPG/PNG 且小于 2MB */
function beforeUploadCheck(rawFile: UploadRawFile): boolean {
  const isImage = ['image/jpeg', 'image/png'].includes(rawFile.type)
  const isLt2M = rawFile.size / 1024 / 1024 < 2
  if (!isImage) ElMessage.error('只接受 JPG/PNG 图片')
  if (!isLt2M) ElMessage.error('图片大小不能超过 2MB')
  return isImage && isLt2M
}

const schema: SchemaNode = {
  row: { gutter: 24 },
  children: [
    {
      label: '头像',
      name: 'avatar',
      col: { span: 12 },
      component: 'Upload',
      // ElUpload 的 v-model 属性是 file-list，必须显式声明
      modelProp: 'fileList',
      props: {
        action: '#',
        accept: 'image/*',
        limit: 1,
        listType: 'picture-card',
        httpRequest: mockUpload,
      },
      slots: {
        tip: '建议上传 1:1 正方形图片，单文件限制。',
      },
    },
    {
      label: '附件列表',
      name: 'attachments',
      col: { span: 12 },
      component: 'Upload',
      modelProp: 'fileList',
      props: {
        action: '#',
        multiple: true,
        limit: 5,
        httpRequest: mockUpload,
      },
      slots: {
        tip: '最多上传 5 个文件，支持多选。',
      },
    },
    {
      label: '拖拽上传',
      name: 'dragFiles',
      col: { span: 12 },
      component: 'Upload',
      modelProp: 'fileList',
      props: {
        action: '#',
        drag: true,
        multiple: true,
        accept: '.pdf,.doc,.docx',
        httpRequest: mockUpload,
      },
    },
    {
      label: '商品图片墙',
      name: 'productImages',
      col: { span: 12 },
      component: 'Upload',
      modelProp: 'fileList',
      props: {
        action: '#',
        listType: 'picture-card',
        multiple: true,
        limit: 6,
        accept: 'image/*',
        httpRequest: mockUpload,
      },
    },
    {
      label: '手动上传（随表单提交）',
      name: 'manualFiles',
      col: { span: 12 },
      component: 'Upload',
      modelProp: 'fileList',
      props: {
        action: '#',
        autoUpload: false,
        multiple: true,
        httpRequest: mockUpload,
      },
      slots: {
        tip: 'autoUpload: false，选择文件后不会自动上传，点击保存时随表单一起提交。',
      },
    },
    {
      label: '上传前校验',
      name: 'checkedFiles',
      col: { span: 12 },
      component: 'Upload',
      modelProp: 'fileList',
      props: {
        action: '#',
        multiple: true,
        accept: 'image/*',
        beforeUpload: beforeUploadCheck,
        httpRequest: mockUpload,
      },
      slots: {
        tip: '仅允许 JPG/PNG，单文件 ≤ 2MB。',
      },
    },
    {
      label: '已上传文件回显',
      name: 'prefillFiles',
      col: { span: 24 },
      component: 'Upload',
      modelProp: 'fileList',
      props: {
        action: '#',
        multiple: true,
        httpRequest: mockUpload,
      },
      slots: {
        tip: '表单加载时 fileList 已预置服务端返回的文件，可直接展示/删除/追加。',
      },
    },
  ],
}

const model = reactive<Record<string, unknown>>({
  avatar: [],
  attachments: [],
  dragFiles: [],
  productImages: [],
  manualFiles: [],
  checkedFiles: [],
  // 模拟从接口回显的已上传文件
  prefillFiles: [
    {
      name: 'contract-2026.pdf',
      url: '#',
      status: 'success',
    } as UploadUserFile,
    {
      name: 'invoice-001.png',
      url: 'https://picsum.photos/id/101/200/200',
      status: 'success',
    } as UploadUserFile,
  ],
})

function formatFileSize(size: number | undefined): string {
  if (size === undefined) return '未知大小'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(2)} MB`
}

function removeCustomFile(field: 'contractFiles' | 'quotationFiles', target: UploadUserFile) {
  const list = customModel[field] as UploadUserFile[]
  customModel[field] = list.filter((f) => f !== target)
}

/**
 * 场景 10 的自定义列表项 —— JSX 写法。
 *
 * ElUpload 的 slots.file 只替换 li 内部内容，li 外壳与 hover 动作条仍由 Element Plus 渲染，
 * 因此删除按钮要自己接 —— 内置的 ✕ 已被本插槽覆盖掉。
 *
 * 写 JSX 需注意（与 React 的差异）：
 * - 属性写 class / onClick，不是 className；写错不报错但样式静默失效
 * - JSX 里的组件不走 unplugin-vue-components 按需注入（那只覆盖 template），必须显式 import
 * - 参数只能保持 scope?: Record<string, unknown>：写成 ({ file }: { file: UploadUserFile })
 *   会因可选性不匹配而无法赋值给 SlotRenderFn
 */
function renderFileItemJsx(scope?: Record<string, unknown>) {
  const file = scope?.file as UploadUserFile | undefined
  if (!file) return null
  return (
    <div class={bem.e('file-item')}>
      <ElIcon class={bem.e('file-icon')}>
        <Document />
      </ElIcon>
      <span class={bem.e('file-name')}>{file.name}</span>
      <span class={bem.e('file-size')}>{formatFileSize(file.size)}</span>
      <ElButton
        link
        type="danger"
        size="small"
        onClick={() => removeCustomFile('contractFiles', file)}
      >
        移除
      </ElButton>
    </div>
  )
}

/**
 * 场景 10 的自定义列表项 —— h() 写法，与 renderFileItemJsx 渲染结果完全等价。
 * 两份都保留为可运行代码（而非注释掉一份），便于对照选型：
 * 分支/循环多时 JSX 更易读，结构扁平时 h() 少一层语法转换、也不需要 lang="tsx"。
 */
function renderFileItemH(scope?: Record<string, unknown>) {
  const file = scope?.file as UploadUserFile | undefined
  if (!file) return null
  return h('div', { class: bem.e('file-item') }, [
    h(ElIcon, { class: bem.e('file-icon') }, { default: () => h(Document) }),
    h('span', { class: bem.e('file-name') }, file.name),
    h('span', { class: bem.e('file-size') }, formatFileSize(file.size)),
    h(
      ElButton,
      {
        link: true,
        type: 'danger',
        size: 'small',
        onClick: () => removeCustomFile('quotationFiles', file),
      },
      { default: () => '移除' }
    ),
  ])
}

const customSchema: SchemaNode = {
  row: { gutter: 24 },
  children: [
    // 8. 类名覆盖：schema 不写 slots.default，保留引擎注入的图标 + 文案，只改外观。
    //    formItem.props.class 透传到 el-form-item 根节点，把覆盖范围锁在本字段内，
    //    不会污染页面上其他 Upload（如上方第 3 个「拖拽上传」字段）
    {
      label: '品牌色拖拽区',
      name: 'brandedFiles',
      col: { span: 12 },
      component: 'Upload',
      modelProp: 'fileList',
      formItem: { props: { class: bem.e('branded') } },
      props: {
        action: '#',
        drag: true,
        multiple: true,
        httpRequest: mockUpload,
      },
      slots: {
        tip: '默认注入的图标与文案原样保留，仅靠 vv-x-form__upload-* 类名改外观。',
      },
    },
    // 9. slots.default 完全接管触发区（component 可直接传组件对象，无需 XForm.components 注册）
    {
      label: '营业执照',
      name: 'licenseFiles',
      col: { span: 12 },
      component: 'Upload',
      modelProp: 'fileList',
      props: {
        action: '#',
        accept: 'image/*',
        limit: 1,
        beforeUpload: beforeUploadCheck,
        httpRequest: mockUpload,
      },
      slots: {
        default: {
          component: 'div',
          props: { class: bem.e('license-trigger') },
          children: [
            { component: ElIcon, children: { component: UploadFilled } },
            {
              component: 'div',
              props: { class: bem.e('license-title') },
              children: '点击上传营业执照',
            },
            {
              component: 'div',
              props: { class: bem.e('license-hint') },
              children: 'JPG / PNG，单文件 ≤ 2MB',
            },
          ],
        },
      },
    },
    // 10. slots.file 自定义已上传项（scoped slot：ElUpload 转发 { file, index }）
    //     两个字段的渲染结果完全一致，只是一个用 JSX、一个用 h()，供写法对照
    {
      label: '合同附件（JSX 写法）',
      name: 'contractFiles',
      col: { span: 12 },
      component: 'Upload',
      modelProp: 'fileList',
      props: {
        action: '#',
        multiple: true,
        httpRequest: mockUpload,
      },
      slots: {
        file: renderFileItemJsx,
        tip: '列表项由 JSX 渲染（需 script 块 lang="tsx"）。',
      },
    },
    {
      label: '报价单附件（h() 写法）',
      name: 'quotationFiles',
      col: { span: 12 },
      component: 'Upload',
      modelProp: 'fileList',
      props: {
        action: '#',
        multiple: true,
        httpRequest: mockUpload,
      },
      slots: {
        file: renderFileItemH,
        tip: '同样的列表项由 h() 渲染，不依赖 lang="tsx"。',
      },
    },
  ],
}

const customModel = reactive<Record<string, unknown>>({
  brandedFiles: [],
  licenseFiles: [],
  contractFiles: [
    {
      name: '框架协议-2026.pdf',
      url: '#',
      status: 'success',
      size: 245_760,
    } as UploadUserFile,
  ],
  quotationFiles: [
    {
      name: '报价单-Q3.xlsx',
      url: '#',
      status: 'success',
      size: 51_200,
    } as UploadUserFile,
  ],
})

const tocItems = [
  { id: 'demo-upload', label: '上传场景演示' },
  { id: 'demo-upload-custom', label: '自定义样式方案' },
  { id: 'api-upload', label: 'Upload 字段配置' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="文件上传（7 个企业常见场景）"
    source="src/components/form-schema/XForm.vue"
    :introductions="[
      'XForm 的 Upload 组件对应 Element Plus ElUpload。',
      '关键：ElUpload 的 v-model 属性是 file-list，所以节点必须配置 modelProp: \'fileList\'，否则双向绑定不生效。',
      '本页覆盖单文件头像、多文件附件、拖拽上传、图片墙、手动上传、上传前校验、已上传文件回显。',
      '所有上传均走 httpRequest 模拟接口，demo 无需真实后端即可看到上传成功效果。',
      '触发区默认由 XForm 按类型注入（picture-card → Plus 图标、drag → 云朵图标 + 文案、其余 → 「点击上传」按钮）；产品要定制时用下方三种方案覆盖。',
    ]"
  >
    <!-- 先看这个引导卡：上传场景较多，新人易迷失 -->
    <div :class="bem.e('start-here')">
      <strong>👀 先看这个——上传场景按推荐顺序浏览</strong>
      <p>
        <strong>① 头像 / 附件列表</strong>
        （必看） —— 掌握 modelProp: 'fileList' + httpRequest mock 的最小模式
      </p>
      <p>
        <strong>② 拖拽 / 图片墙 / 手动上传 / 上传前校验</strong>
        （进阶） —— 各场景独立 props 配置
      </p>
      <p>
        <strong>③ 定制三方案</strong>
        （高级） —— 类名覆盖 / slots.default 接管触发区 / slots.file 自定义列表项（JSX vs h() 对照）
      </p>
    </div>

    <section id="demo-upload">
      <DemoField label="上传场景集合" :code="xFormSource">
        <XForm ref="formRef" :schema="schema" :model="model" />
        <div :class="bem.e('actions')">
          <el-button @click="onReset">重置</el-button>
          <el-button type="primary" @click="onSave">保存</el-button>
          <el-button @click="copySchema">复制 schema</el-button>
        </div>
        <ModelPreview :model="model" />
      </DemoField>
    </section>

    <section id="demo-upload-custom">
      <DemoField
        label="自定义样式三方案（类名覆盖 / 自定义触发区 / 自定义列表项）"
        :code="xFormSource"
      >
        <XForm :schema="customSchema" :model="customModel" />
        <div :class="bem.e('actions')">
          <el-button type="primary" @click="onSaveCustom">查看定制表单数据</el-button>
        </div>
        <ModelPreview :model="customModel" />
      </DemoField>
    </section>

    <ApiTable title="Upload 字段配置" :items="uploadItems" anchor="api-upload" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-upload {
  &__actions {
    margin-top: 16px;
    display: flex;
    gap: 8px;
  }

  // 「先看这个」引导卡样式
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

  // 方案 8：只覆盖类名，不碰 schema —— 作用域由 formItem.props.class 锁定在本字段
  &__branded {
    .el-upload-dragger {
      border: 1px solid var(--el-color-primary-light-5);
      border-radius: 12px;
      background: linear-gradient(
        160deg,
        var(--el-color-primary-light-9),
        var(--el-fill-color-blank)
      );
      transition:
        border-color 0.2s,
        box-shadow 0.2s;

      &:hover {
        border-color: var(--el-color-primary);
        box-shadow: 0 4px 16px rgb(64 158 255 / 18%);
      }
    }

    .#{$BEM_PREFIX}-x-form__upload-icon--drag {
      font-size: 42px;
      color: var(--el-color-primary);
    }

    .#{$BEM_PREFIX}-x-form__upload-text {
      font-weight: 600;
      color: var(--el-color-primary-dark-2);
    }
  }

  // 方案 9：slots.default 接管触发区后，外观完全由这里决定
  &__license-trigger {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    width: 100%;
    padding: 20px 16px;
    border: 1px dashed var(--el-border-color);
    border-radius: 8px;
    color: var(--el-text-color-secondary);
    transition:
      border-color 0.2s,
      color 0.2s;

    &:hover {
      border-color: var(--el-color-primary);
      color: var(--el-color-primary);
    }

    .el-icon {
      font-size: 28px;
    }
  }

  &__license-title {
    font-size: 14px;
    font-weight: 600;
  }

  &__license-hint {
    font-size: 12px;
    color: var(--el-text-color-placeholder);
  }

  // 方案 10：slots.file 自定义列表项
  &__file-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 8px;
    border-radius: 6px;
    background: var(--el-fill-color-light);
  }

  &__file-icon {
    color: var(--el-color-primary);
  }

  &__file-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__file-size {
    flex-shrink: 0;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
}
</style>
