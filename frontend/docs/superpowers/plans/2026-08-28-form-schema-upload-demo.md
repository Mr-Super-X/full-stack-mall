# form-schema 上传文件 demo 补充计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 form-schema（XForm）组件补充企业真实业务中常见的上传文件使用示例，并同步更新文档与 demo 导航。

**Architecture:** 在 demo 模块新增一个 XFormUpload.vue 示例页，复用既有 DocLayout / DemoFrame / DemoField / ApiTable 组件；通过 XForm 的 `Upload` 组件 + `modelProp: 'fileList'` 绑定 ElUpload 的 file-list，覆盖单文件、多文件、拖拽、图片墙、手动上传、上传前校验、回显等场景。

**Tech Stack:** Vue 3.5 + TypeScript + Element Plus + XForm + Pinia-less demo

---

## Task 1: 新增 XFormUpload.vue 上传示例

**Files:**
- Create: `src/modules/demo/examples/XFormUpload.vue`

- [ ] **Step 1: 创建示例页骨架**

```vue
<script setup lang="ts">
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import XForm from '@/components/form-schema/XForm.vue'
import type { SchemaNode } from '@/components/form-schema/types'
import ApiTable from '../components/ApiTable.vue'
import DemoFrame from '../components/DemoFrame.vue'
import DemoField from '../components/DemoField.vue'
import DocLayout from '../layouts/DocLayout.vue'
import DocToc from '../components/DocToc.vue'
import { uploadItems } from './xform-demos-api'
import xFormSource from './XFormUpload.vue?raw'

const bem = createNamespace('demo-x-form-upload')
</script>
```

- [ ] **Step 2: 编写 7 个上传场景 schema**

场景：
1. 单文件头像上传（action + accept + limit: 1）
2. 多文件附件上传（multiple + limit）
3. 拖拽上传（drag）
4. 图片墙上传（listType: 'picture-card'）
5. 手动上传（auto-upload: false + submit 按钮）
6. 上传前校验（beforeUpload 大小/类型）
7. 已上传文件回显（file-list 默认值）

- [ ] **Step 3: 添加保存/重置/复制 schema 交互**

- [ ] **Step 4: 运行类型检查**

Run: `pnpm type-check`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/demo/examples/XFormUpload.vue
git commit -m "feat(demo): 新增 XFormUpload 上传文件示例"
```

## Task 2: 注册上传 demo 到 sidebar 与 API 表

**Files:**
- Modify: `src/modules/demo/config/sidebar-groups.ts`
- Modify: `src/modules/demo/examples/xform-demos-api.ts`

- [ ] **Step 1: 在 sidebar-groups.ts 添加中文名**

在 `CN_NAMES` 对象中新增：
```ts
XFormUpload: '文件上传',
```

- [ ] **Step 2: 在 xform-demos-api.ts 新增 uploadItems**

```ts
export const uploadItems: XFormApiItem[] = [
  { name: 'component', type: "'Upload'", required: true, description: '声明为 ElUpload 组件' },
  { name: 'modelProp', type: "'fileList'", description: '绑定 ElUpload 的 file-list（默认 modelValue 不适用）' },
  { name: 'props.action', type: 'string', description: '上传地址（可配真实接口或 mock）' },
  { name: 'props.multiple', type: 'boolean', default: 'false', description: '是否允许多选文件' },
  { name: 'props.limit', type: 'number', description: '最大允许上传文件数' },
  { name: 'props.accept', type: 'string', description: '接受的文件类型，如 image/*' },
  { name: 'props.drag', type: 'boolean', default: 'false', description: '是否启用拖拽上传' },
  { name: 'props.listType', type: "'text' | 'picture' | 'picture-card' | 'picture-circle'", default: "'text'", description: '文件列表展示类型' },
  { name: 'props.autoUpload', type: 'boolean', default: 'true', description: 'false 时配合实例方法手动触发上传' },
  { name: 'props.beforeUpload', type: '(rawFile) => boolean | Promise<boolean>', description: '上传前钩子，可拦截大小/格式不符的文件' },
  { name: 'props.fileList / v-model:fileList', type: 'UploadUserFile[]', description: '已上传文件列表，用于回显' },
]
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/demo/config/sidebar-groups.ts src/modules/demo/examples/xform-demos-api.ts
git commit -m "feat(demo): 注册 XFormUpload 导航与 API 速查"
```

## Task 3: 补充上传文档章节

**Files:**
- Modify: `docs/24-XForm使用指南.md`
- Modify: `src/components/form-schema/README.md`

- [ ] **Step 1: 在 docs/24-XForm使用指南.md 新增「上传文件」章节**

在「异步选项」之后插入新章节，内容包含：
- Upload 组件基础用法
- modelProp: 'fileList' 必要性
- 单文件 / 多文件 / 拖拽 / 图片墙示例
- 上传前校验（beforeUpload）
- 手动上传（autoUpload: false）
- 已上传文件回显

- [ ] **Step 2: 在 README.md 默认 props 表格补充 Upload**

在默认 props 表格新增：
```markdown
| `Upload` | 无 | `modelProp: 'fileList'` 绑定 file-list；支持 action/accept/multiple/drag/listType |
```

- [ ] **Step 3: Commit**

```bash
git add docs/24-XForm使用指南.md src/components/form-schema/README.md
git commit -m "docs: 补充 XForm 上传文件使用指南"
```

## 验证清单

- [ ] `pnpm type-check` 通过
- [ ] `pnpm lint` 通过
- [ ] 浏览器访问 `/demo/x-form-upload` 可正常渲染 7 个上传场景
- [ ] sidebar 出现「XFormUpload 文件上传】
- [ ] 文档中 Upload 章节可读
