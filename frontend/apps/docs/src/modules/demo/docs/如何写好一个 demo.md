# 如何写好一个 demo

<!-- cspell:disable xform -->
<!--
  cspell disable xform —— demo 辅助 .ts 文件（xform-api / xform-demos-api /
  xform-props-advanced-schema / xform-props-advanced-snippets / xform-detail-fill-mock）
  按 kebab-case 命名是项目既定约定（CLAUDE.md §1.5 业务代码封装），不应作为拼写错误。
-->

> 本文档位于 `src/modules/demo/docs/`，约定 `src/modules/demo/` 目录下组件示例的编写规范。
> 读完本文后，你应该能独立新增一个自动出现在侧边栏、结构完整、可验证的 demo 页面。
>
> `docs/` 子目录仅存放编写规范、说明类文档；**demo 页面入口仍放在 `examples/`，由路由自动扫描。**

---

## 一、demo 的定位

`demo` 模块不是临时测试页，而是**面向团队的可交互文档**。它的核心目标是：

1. **展示能力**：把组件/引擎的某个能力用最小可运行形式呈现出来。
2. **降低理解成本**：让使用者通过“看得见、点得着”的界面，5 分钟理解原本需要读源码才能明白的逻辑。
3. **充当回归样本**： demo 页面本身随功能演进持续存在，可作为手工回归的入口。

因此，每一个 demo 都要回答三个问题：

- **这是什么能力？**（标题 + 简介）
- **怎么用？**（可交互的示例 + 代码片段）
- **边界/坑在哪？**（对照组、错误提示、API 说明）

---

## 二、目录结构与职责

```text
src/modules/demo/
├── components/          # demo 页面级公共组件（禁止跨模块引用）
│   ├── DemoFrame.vue    # 页面级容器：标题 + 简介 + 主体
│   ├── DemoField.vue    # 单个示例字段：效果 + 代码展开/复制
│   ├── ApiTable.vue     # API 表格
│   ├── ConsoleLogPanel.vue  # 控制台输出面板
│   ├── DocToc.vue       # 右侧目录
│   └── ModelPreview.vue # model JSON 预览
├── composables/         # demo 模块专属 composables
│   ├── useXFormDemo.ts  # XForm 系列 demo 的公共样板
│   ├── useConsoleCapture.ts  # 捕获 console 日志
│   └── useDemoSearch.ts # sidebar 搜索
├── config/
│   └── sidebar-groups.ts  # 分组 + 中文名映射（新增 demo 必改）
├── examples/            # demo 页面入口（自动注册路由）；数量与清单以目录实际为准
│   │                    # （XForm 系列占多数，另有 AsyncState / ErrorBoundary / Dict /
│   │                    # IconUsage / RichTextEditor / StreamRequest / 网络基建 Api* 等）
│   ├── AsyncState.vue
│   ├── ErrorBoundary.vue
│   ├── XForm/             # XForm 系列 demo 的集中目录（含 configs/ + utils/）
│   │   ├── XFormOverview.vue
│   │   ├── XFormBase.vue
│   │   ├── XFormArray.vue
│   │   └── ...（其余 XForm*.vue，数量以目录实际为准）
│   │   ├── configs/       # 纯数据 .ts（API 表格条目、字典、schema、代码片段）— 见 §三、1.1
│   │   └── utils/         # 工具函数 .ts（如 mock 异步接口）— 见 §三、1.1
├── layouts/
│   ├── DocLayout.vue      # 三栏文档布局壳（sidebar / main / toc）
│   ├── DemoDocs.vue       # 路由级布局：固定 DocLayout + RouterView + useDocToc 锚点
│   ├── sidebar-state.ts    # 侧边栏状态模块（自动注册）
│   └── use-sidebar-drag.ts # 侧边栏拖拽 composable（自动注册）
├── routes/
│   └── index.ts           # 自动扫描 examples/，通常无需手动改
├── styles/                # demo 模块全局样式（如 `.mdx-style` 等）
├── utils/                 # demo 模块私有工具（非 XForm 子目录，是模块根级）
│   └── extractApi.ts      # 从 .vue 文件提取 API 表格数据（供 ApiTable 自动填充）
└── docs/                  # 规范与说明类文档
    └── 如何写好一个 demo.md  # 本文档
```

---

## 三、新增 demo 的三步

### 步骤 1：在 `examples/` 下新建入口文件

文件名规则：

- 使用 **PascalCase**（如 `XFormAsyncOptions.vue`）。
- 多单词组件用驼峰，路由会自动转为 kebab-case（如 `XFormAsyncOptions` → `/demo/xform-async-options`；注意 `XForm` 前缀不拆词，是 `xform-` 而非 `x-form-`）。
- 如果示例复杂需要拆分子组件，可用文件夹形式：`examples/XFormAsyncOptions/index.vue`。

> 不需要改 `routes/index.ts`，`import.meta.glob` 会自动扫描。

#### 1.1 目录形式：按组件建子目录

当一个组件的 demo 数量越来越多（>10 个），建议把该组件的 demo 集中到一个**与组件同名的子目录**下，便于长期维护：

```text
examples/
├── AsyncState.vue              ← 通用组件 demo，留在 examples 根
├── ErrorBoundary.vue           ← 通用组件 demo，留在 examples 根
└── XForm/                      ← 组件 XForm 的子目录
    ├── XFormOverview.vue       ← XForm 的「用法总览」（沿用原有 XForm.vue 角色）
    ├── XFormBase.vue           ← 基础用法
    ├── XFormArray.vue          ← 数组节点
    ├── XForm*.vue              ← 其他若干 XForm demo
    ├── configs/                ← 纯数据 .ts（API 表格条目、字典、schema、代码片段）
    │   ├── xform-api.ts        ← XForm 总览的 Props/Events/Slots/方法 API 数据
    │   ├── xform-demos-api.ts  ← 各 demo 私有 API 表格的集合（互引 ./xform-api）
    │   ├── cascader-data.ts    ← 级联静态字典
    │   ├── xform-props-advanced-schema.ts   ← PropsAdvanced demo 用的 schema 段
    │   └── xform-props-advanced-snippets.ts ← PropsAdvanced demo 用的代码片段
    └── utils/                  ← 工具函数 .ts（如 mock 异步接口）
        └── xform-detail-fill-mock.ts        ← fetchOrderDetail / fetchCities 等
```

**派生规则**（`src/modules/demo/routes/index.ts` 内部实现）：

<!-- markdownlint-disable MD060 -->

| 物理文件                               | 派生 component                               | 派生 route name         | path                   |
| -------------------------------------- | -------------------------------------------- | ----------------------- | ---------------------- |
| `examples/AsyncState.vue`              | `AsyncState`（直接剥 `.vue`）                | `DemoAsyncState`        | `async-state`          |
| `examples/XFormAsyncOptions/index.vue` | `XFormAsyncOptions`（取父目录名）            | `DemoXFormAsyncOptions` | `x-form-async-options` |
| `examples/XForm/XFormBase.vue`         | `XFormBase`（直接剥 `.vue`）                 | `DemoXFormBase`         | `x-form-base`          |
| `examples/XForm/index.vue`             | `XForm`（取父目录名，等价于 XForm Overview） | `DemoXForm`             | `x-form`               |
| `examples/XForm/XFormOverview.vue`     | `XFormOverview`（直接剥 `.vue`）             | `DemoXFormOverview`     | `x-form-overview`      |

<!-- markdownlint-enable MD060 -->

要点：

- 子目录文件名建议沿用「`XForm<能力名>`」完整 PascalCase，**不要省略前缀**——保留前缀能让目录扫描派生出的 route name 与历史一致（`DemoXFormBase` 而非 `DemoBase`），免去 sidebar / 白名单的批量修改。
- 组件的「用法总览」页命名为 `XFormOverview.vue`（与「Overview」「index」二选一）。**当前项目使用 `XFormOverview.vue` 而非 `index.vue`**——避免自动派生的 component 名 `XForm` 与已有概览 demo 重名冲突；下表 `examples/XForm/index.vue` 行仅为说明派生规则，不要求实际创建。
- 辅助文件分类管理，按导出性质分到两个子目录：
  - `configs/` —— **纯数据**导出（API 表格条目、字典常量、schema 段、字符串代码片段），如 `xform-api.ts` / `xform-demos-api.ts` / `cascader-data.ts` 等。
  - `utils/` —— **导出函数**的辅助工具（最常见是 mock 异步接口），如 `xform-detail-fill-mock.ts`。
- 辅助文件与 `.vue` 在同一子目录层级，import 路径用**同级相对路径**：
  - `'./configs/xform-xxx'`（data）
  - `'./utils/xform-xxx'`（util）

**新建子目录的步骤**：

1. 在 `examples/` 下创建 `XForm/` 目录（用 `git mv` 一次性搬入已有的 demo，保留历史）。
2. 调整 demo 内部对 `examples/../components/` 等上层目录的 import：

   ```diff
   - import DemoFrame from '../components/DemoFrame.vue'
   + import DemoFrame from '../../components/DemoFrame.vue'
   ```

   （同级 import `'./configs/xform-demos-api'` / `'./utils/xform-xxx'` 不变。）

3. **新建子目录时一并建立 `configs/` 与 `utils/`**（用 `git mv <file> configs/` 或 `utils/` 整理现有散落 .ts）。新加 .ts 时按"导出函数 vs 纯数据"二选一分类。
4. 路由脚本已支持 `examples/*/*.vue` 扫描，**不需要改 `routes/index.ts`**。

### 步骤 2：在 `config/sidebar-groups.ts` 补中文名

```ts
export const CN_NAMES: Record<string, string> = {
  // ... 已有映射
  XFormMyFeature: '我的新能力',
}
```

分组由 `SIDEBAR_GROUPS` 的前缀规则自动归类。例如 `XForm*` 前缀自动进入「XForm 表单引擎」组。

### 步骤 3：启动 dev 验证

```bash
pnpm dev
```

访问 `/demo`，侧边栏应出现新条目，页面能正常渲染。

---

## 四、页面结构规范

每个 demo 页面必须遵循以下骨架：

```vue
<script setup lang="ts">
/**
 * 文件顶部注释：一句话说明本 demo 的目的、场景、验证方法
 */
import XForm from '@/components/form-schema/components/XForm.vue'
import type { SchemaNode } from '@/components/form-schema/types'
import { useXFormDemo } from '../composables/useXFormDemo'
import ApiTable from '../components/ApiTable.vue'
import DemoFrame from '../components/DemoFrame.vue'
import DemoField from '../components/DemoField.vue'
import ModelPreview from '../components/ModelPreview.vue'
import { useDocToc } from '../composables/useDocToc'
import { myFeatureItems } from './xform-demos-api'

const { bem, formRef, onSave, onReset, copySchema } = useXFormDemo({
  name: 'my-feature',
  schema: () => schema,
  model: () => model,
})

const model = reactive<Record<string, unknown>>({
  email: '',
})

const schema: SchemaNode = {
  component: 'Input',
  name: 'email',
  label: '邮箱',
  rules: [{ required: true, message: '邮箱必填', trigger: 'blur' }],
}

const tocItems = [
  { id: 'demo-my-feature', label: '能力演示' },
  { id: 'api-my-feature', label: 'API 说明' },
]

// 注册右侧锚点（路由级布局 DemoDocs.vue 统一渲染 DocToc，页面不自包布局）
useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="XFormMyFeature —— 能力一句话描述"
    source="src/components/form-schema/XForm.vue"
    :introductions="[
      '第一点：这个能力解决什么问题。',
      '第二点：核心用法是什么。',
      '第三点：有什么边界或注意事项。',
    ]"
  >
    <section id="demo-my-feature" :class="bem.b()">
      <DemoField label="基本用法" :code="`<XForm :schema="schema" :model="model" />`">
        <XForm ref="formRef" :schema="schema" :model="model" />
        <div :class="bem.e('actions')">
          <el-button @click="onReset">重置</el-button>
          <el-button type="primary" @click="onSave">提交</el-button>
          <el-button @click="copySchema">复制 schema</el-button>
        </div>
        <ModelPreview :model="model" />
      </DemoField>
    </section>

    <ApiTable title="本能力相关 API" :items="myFeatureItems" anchor="api-my-feature" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-my-feature {
  &__actions {
    margin-top: 16px;
    display: flex;
    gap: 8px;
  }
}
</style>
```

### 4.1 必备元素 checklist

- [ ] 顶部注释说明目的、场景、验证方法。
- [ ] **不要自包 `DocLayout`**（路由级布局 `DemoDocs.vue` 自动包裹所有 demo 页）。
- [ ] 使用 `DemoFrame` 提供标题、source 路径、简介列表。
- [ ] 使用 `DemoField` 包裹每一个可交互示例（每个示例配一段代码）。
- [ ] 使用 `ApiTable` 列出本 demo 专属的 API/字段/配置。
- [ ] 用 `useDocToc(tocItems)` 注册右侧锚点（不写 `<template #toc>`）。
- [ ] 复杂 demo 使用 `ModelPreview` 展示 model 状态。
- [ ] BEM 命名空间与 `createNamespace('demo-x-form-xxx')` 对齐。

---

## 五、指导思想

### 5.1 一个 demo 只讲一件事

不要试图在一个页面里覆盖 5 个能力。每个 demo 聚焦一个**可独立理解**的能力点。如果需要串联多个能力，请单独做一个「端到端业务示例」（参考 `XFormOrderCreate.vue`），并在页面里用表格列出能力覆盖清单和对应独立 demo 的链接。

### 5.2 代码即文档，但文档不能只有代码

- `DemoField` 必须提供 `code` 属性，让用户能看到关键用法。
- `DemoFrame.introductions` 必须用 2-4 句话讲清楚**为什么**、**是什么**、**注意什么**。
- `ApiTable` 必须列出本能力专属的 API，不要复制 XForm 总览文档。

### 5.3 提供对照组，而不是只展示成功路径

好的 demo 会展示：

- **正确用法**
- **常见错误/边界用法**（如 `XFormModelWarn` 展示不传 model、空 model、正常 model 三种形态）
- **失败后的 UI/控制台反馈**

### 5.4 验证方法必须写清楚

在页面顶部注释和 `DemoFrame.introductions` 中写明：

- 用户如何操作？
- 期望看到什么结果？
- 去哪里看错误/日志？

示例：

```text
验证方法：
1. 客户名/电话都留空 → 点保存 → 提示「至少填一个」。
2. 填电话 13800 → blur → 红字「手机号格式不正确」。
3. 打开 DevTools Console 查看场景 1 的 [XForm] 警告。
```

### 5.5 能用界面展示的，就不要让用户开 DevTools

如果 demo 需要观察 console 输出，优先使用 `useConsoleCapture` + `ConsoleLogPanel` 在页面上展示，而不是让用户自己打开 DevTools。

```ts
const { logs, clear } = useConsoleCapture('[XForm]')
```

> `useConsoleCapture` 是同步 hook，必须在 `setup` 函数体**同步执行**，不能放在 `onMounted` 里。

---

## 六、组件使用指南

### 6.1 DemoFrame

```vue
<DemoFrame
  title="页面大标题"
  source="src/components/form-schema/XForm.vue"
  :introductions="['简介要点 1', '简介要点 2']"
>
  <!-- 主体内容 -->
</DemoFrame>
```

- `title`：简短、明确，带组件名前缀。
- `source`：被演示组件的源码路径（仅展示，不跳转）。
- `introductions`：要点列表，每句讲清楚一个信息。

### 6.2 DemoField

```vue
<DemoField label="示例标题" :code="codeString">
  <!-- 交互示例 -->
</DemoField>
```

- 每个示例一个 `DemoField`。
- `code` 推荐用 Vite `?raw` 导入真实源码，或写关键片段。
- 示例之间保持逻辑独立，不要互相依赖状态。

### 6.3 ApiTable

```vue
<ApiTable title="XXX 配置" :items="myItems" anchor="api-my-feature" />
```

items 类型：

```ts
interface ApiItem {
  name: string
  type?: string
  default?: string
  description: string
  required?: boolean
}
```

原则：只列本 demo 涉及的 API，不与总览文档重复。

### 6.4 ModelPreview

```vue
<ModelPreview :model="model" />
```

用于展示当前 model 的 JSON，帮助用户理解数据流。

### 6.5 DocToc（useDocToc 注册）

```ts
// script setup 中 tocItems 定义之后注册一次
useDocToc(tocItems)
```

右侧锚点由路由级布局（`DemoDocs.vue`）统一渲染，页面只负责注册数据（不自包 `DocLayout`、不写 `<template #toc>`）。

`tocItems` 与页面内的 `id` 一一对应：

```ts
const tocItems = [
  { id: 'demo-my-feature', label: '能力演示' },
  { id: 'api-my-feature', label: 'API 说明' },
]
```

---

## 七、API 数据组织

所有 `ApiTable` 的数据统一放在 `examples/xform-demos-api.ts`（或按主题拆分的新文件）。

示例：

```ts
// examples/xform-demos-api.ts
import type { XFormApiItem } from './xform-api'

export const myFeatureItems: XFormApiItem[] = [
  {
    name: 'someField',
    type: 'string',
    required: true,
    description: '字段说明',
  },
  {
    name: 'someOption',
    type: 'boolean',
    default: 'false',
    description: '可选配置说明',
  },
]
```

---

## 八、BEM 与样式规范

所有 `.vue` 文件必须遵循项目 BEM 规范：

```vue
<script setup lang="ts">
const bem = createNamespace('demo-x-form-my-feature')
</script>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-my-feature {
  &__actions {
    margin-top: 16px;
    display: flex;
    gap: 8px;
  }
}
</style>
```

注意：

- `<style>` 不写 `scoped`。
- `createNamespace` 参数用 kebab-case，与 sass 根选择器严格对齐。
- 不要硬编码 `vv-` 前缀。

---

## 九、常见反模式

| 反模式                          | 正确做法                                              |
| ------------------------------- | ----------------------------------------------------- |
| 一个 demo 讲 3 个以上能力       | 拆成多个 demo，或做一个「端到端示例」并链接独立 demo  |
| 只有成功路径，没有边界/错误场景 | 补充对照组和错误反馈说明                              |
| 代码片段与运行示例不一致        | 用 `?raw` 导入真实源码，或手动保持同步                |
| 让用户打开 DevTools 看日志      | 用 `useConsoleCapture` + `ConsoleLogPanel` 在页面展示 |
| API 表格复制总览文档            | 只列本 demo 专属 API                                  |
| 不写验证方法                    | 在顶部注释和 introductions 中写明操作步骤和预期结果   |
| 样式写 `scoped` 或硬编码前缀    | 按 BEM 规范使用 `bem` 工具                            |
| 改完 demo 不跑 dev 验证         | 启动 `pnpm dev` 确认侧边栏、页面、交互正常            |

---

## 十、端到端业务示例的特别约定

如果你要做一个像 `XFormOrderCreate` 这样的「完整业务形态」demo，除了遵守以上规范，还需额外做到：

1. **在标题或简介中说明这是「端到端示例」**。
2. **列出能力覆盖清单**：用表格说明本页面串联了哪些能力，以及对应独立 demo 的路由。
3. **提供验证指引**：把操作步骤写成 `el-collapse` 折叠面板，默认折叠，用户可展开按步骤验证。
4. **展示真实业务状态**：如草稿是否存在、isDirty、订单号等。

---

## 十一、提交前自检

新增或修改 demo 后，逐条确认：

- [ ] `examples/` 下文件命名符合 PascalCase。
- [ ] `config/sidebar-groups.ts` 已添加中文名映射。
- [ ] 侧边栏能正常显示新 demo。
- [ ] 页面无 TS 类型错误（`pnpm type-check`）。
- [ ] 页面无 ESLint 错误（`pnpm lint`）。
- [ ] 所有交互示例可正常运行。
- [ ] 代码片段与运行示例一致。
- [ ] API 表格数据准确、不重复。
- [ ] BEM 命名空间与样式根选择器对齐。
- [ ] 生产构建不会被 demo 污染（`pnpm build` 通过）。

---

## 十二、最小可运行示例

下面是一个最简 demo 完整源码，可作为新增 demo 的模板：

```vue
<script setup lang="ts">
/**
 * XFormHello —— 最小可运行示例模板
 *
 * 验证方法：
 * 1. 进入页面看到邮箱输入框，默认值为 user@example.com。
 * 2. 清空输入框并点提交 → 提示「邮箱必填」。
 * 3. 输入非法邮箱并 blur → 提示「邮箱格式不正确」。
 */
import { reactive } from 'vue'
import XForm from '@/components/form-schema/components/XForm.vue'
import type { SchemaNode } from '@/components/form-schema/types'
import { useXFormDemo } from '../composables/useXFormDemo'
import ApiTable from '../components/ApiTable.vue'
import DemoFrame from '../components/DemoFrame.vue'
import DemoField from '../components/DemoField.vue'
import ModelPreview from '../components/ModelPreview.vue'
import { useDocToc } from '../composables/useDocToc'
import { minimumItems } from './xform-demos-api'

const { bem, formRef, onReset, onSave, copySchema } = useXFormDemo({
  name: 'hello',
  schema: () => schema,
})

const model = reactive<Record<string, unknown>>({})

const schema: SchemaNode = {
  component: 'Input',
  name: 'email',
  label: '邮箱',
  defaultValue: 'user@example.com',
  rules: [
    { required: true, message: '邮箱必填', trigger: 'blur' },
    {
      validator: (_r, v, cb) => {
        const ok = typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
        cb(ok ? undefined : new Error('邮箱格式不正确'))
      },
    },
  ],
}

const tocItems = [
  { id: 'demo-hello', label: '最小示例' },
  { id: 'api-hello', label: '三要素' },
]

// 注册右侧锚点（路由级布局 DemoDocs.vue 统一渲染 DocToc，页面不自包布局）
useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="XFormHello —— 最小可运行示例"
    source="src/components/form-schema/XForm.vue"
    :introductions="[
      'XForm 最简用法：写 schema + 传 model + 渲染。',
      'defaultValue 会在挂载时自动填充到 model。',
      'rules 支持 async-validator 格式。',
    ]"
  >
    <section id="demo-hello" :class="bem.b()">
      <DemoField
        label="最小示例"
        :code="`<XForm ref=&quot;formRef&quot; :schema=&quot;schema&quot; :model=&quot;model&quot; />`"
      >
        <XForm ref="formRef" :schema="schema" :model="model" />
        <div :class="bem.e('actions')">
          <el-button @click="onReset">重置</el-button>
          <el-button type="primary" @click="onSave">提交</el-button>
          <el-button @click="copySchema">复制 schema</el-button>
        </div>
        <ModelPreview :model="model" />
      </DemoField>
    </section>

    <ApiTable title="最小示例三要素" :items="minimumItems" anchor="api-hello" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-hello {
  &__actions {
    margin-top: 16px;
    display: flex;
    gap: 8px;
  }
}
</style>
```

---

## 十三、延伸阅读

- `src/modules/demo/routes/index.ts` —— 路由自动注册逻辑
- `src/modules/demo/config/sidebar-groups.ts` —— 分组与中文名配置
- `src/modules/demo/components/DemoFrame.vue` —— 页面容器实现
- `src/modules/demo/examples/XForm/XFormOrderCreate.vue` —— 端到端业务示例参考
- `src/modules/demo/examples/XForm/XFormModelWarn.vue` —— 对照组 + 控制台捕获参考
- `src/modules/demo/examples/XForm/XFormOverview.vue` —— XForm 用法总览（入口 demo）
- `CLAUDE.md` §3 —— 项目 BEM 编写规范

---

## 修订记录

| 版本   | 日期       | 变更                                                                                                                                                                                                                                                         |
| ------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| v1.0.0 | 2026-09-04 | §二 目录树增加 `styles/`、`utils/extractApi.ts`、`layouts/sidebar-state.ts`、`layouts/use-sidebar-drag.ts`；§三 1.1 派生规则表注明当前实际用 `XFormOverview.vue` 而非 `index.vue`；§三、1.1 configs/ 列表补齐 `xform-api.ts`；§十三 延伸阅读同步 demo 新路径 |
