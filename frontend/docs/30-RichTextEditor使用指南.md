# RichTextEditor 高级富文本编辑器使用指南

> **文档版本**：v1.0.0 | **最后更新**：2026-09-17
> **覆盖范围**：基于 WangEditor V5 的 v-model 富文本编辑器（含 XSS 防御 + 自定义图片上传 + 命令式 API）
> **源码位置**：`packages/ui/src/components/common/RichTextEditor/`

---

## 📋 概述

`RichTextEditor` 是 WangEditor V5 的项目封装，**围绕三个核心痛点** 高频富文本场景做了扩展：

| 痛点                                                                          | 解决方案                                            |
| ----------------------------------------------------------------------------- | --------------------------------------------------- |
| 用户输入脏 HTML 触发 XSS（`<img onerror=...>` / `<a href="javascript:...">`） | DOMPurify 双向 sanitize（prop + emit 共用一份配置） |
| 用户清空内容后 `<p><br></p>` 占位段落让 `rules: 'required'` 误判              | 源头 emit `''`（业务方无须做字符串剥离）            |
| 自定义上传（OSS / 后端存储）拦截默认 base64                                   | `uploadApi` prop + `customUpload` 钩子              |

**依赖**：WangEditor V5 + DOMPurify 3.x + Element Plus（ElMessage 错误提示）。

---

## 1. Props / Emits

### 1.1 Props

| Prop                 | 类型                                                     | 默认值            | 说明                                                                    |
| -------------------- | -------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------- |
| `modelValue`         | `string`                                                 | `''`              | v-model 双向绑定值；输入即清洗                                          |
| `height`             | `string \| number`                                       | `'300px'`         | 编辑区高度（数字按 px 处理）                                            |
| `placeholder`        | `string`                                                 | `'请输入内容...'` | 占位符                                                                  |
| `readOnly`           | `boolean`                                                | `false`           | 是否只读                                                                |
| `uploadApi`          | `(file: File) => Promise<{ url: string; alt?: string }>` | —                 | 自定义图片上传；不传时点击图片按钮 ElMessage 提示「请先配置 uploadApi」 |
| `toolbarExcludeKeys` | `string[]`                                               | `['uploadVideo']` | 排除的工具栏按钮（菜单名数组）                                          |
| `toolbarKeys`        | `string[]`                                               | —                 | 自定义工具栏菜单（优先级高于 excludeKeys）                              |

> **运行时变更不响应**：`uploadApi` / `toolbarExcludeKeys` / `toolbarKeys` 属「初始化一次性 prop」，运行时变更不会触发工具栏重建。如需变更请 `v-if` 重建组件。

### 1.2 Emits

| Event               | 参数              | 说明                                    |
| ------------------- | ----------------- | --------------------------------------- |
| `update:modelValue` | `(value: string)` | v-model 双向绑定；**已 DOMPurify 清洗** |

### 1.3 Slots

| Slot     | 说明                                         |
| -------- | -------------------------------------------- |
| `footer` | 编辑器底部扩展点（字数统计 / AI 续写按钮等） |

---

## 2. 命令式 API（`defineExpose`）

通过 `ref` 获取组件实例调用：

```vue
<script setup lang="ts">
import { ref } from 'vue'
const editorRef = ref()

async function handleClear() {
  editorRef.value?.setHtml('')
}

function handleGetContent() {
  return editorRef.value?.getHtml() ?? ''
}
</script>

<template>
  <RichTextEditor ref="editorRef" v-model="content" :upload-api="uploadApi" />
  <el-button @click="handleClear">清空</el-button>
</template>
```

| 方法            | 签名                       | 说明                                             |
| --------------- | -------------------------- | ------------------------------------------------ |
| `getEditor()`   | `() => IDomEditor \| null` | 访问底层 WangEditor 实例（可调用全部命令式 API） |
| `focus()`       | `() => void`               | 聚焦编辑器                                       |
| `blur()`        | `() => void`               | 失焦                                             |
| `getHtml()`     | `() => string`             | 读取当前 HTML（含 wangEditor 内部占位段落）      |
| `setHtml(html)` | `(html: string) => void`   | 设置 HTML（**内部自动 sanitize**）               |

---

## 3. 关键设计决策（防被「善意重构」破坏）

### 3.1 DOMPurify 双向 sanitize（XSS 防御必读）

```typescript
const SANITIZE_CONFIG = {
  USE_PROFILES: { html: true }, // 等价于白名单 ALLOWED_TAGS / ALLOWED_ATTR
  FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form'],
  FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onfocus', 'formaction'],
} as const
```

**为什么 prop + emit 双向都要 sanitize**：

- `emit` 链路：用户输入 → Editor.onChange → handleChange → sanitize → emit
- `prop` 链路：外部赋值 → watch → syncEditorWithModel → sanitize → setHtml

**只 sanitize emit 是不够的**。API 返回 / 用户粘贴 / 第三方拼接都可能携带 `<img onerror=...>` 进入 modelValue；如不 sanitize 外部链路的 setHtml 入口，浏览器会解析 onerror 并执行。

> **style 属性放行的原因**：富文本编辑器（颜色 / 字号 / 行高）输出大量内联 style；禁用后 wangEditor 菜单功能等于失效。现代浏览器 style 属性无脚本执行能力，行业标准是放行。

### 3.2 视觉为空映射（消费方无须做字符串剥离）

wangEditor V5 编辑器永远保留 `<p><br></p>` 作为光标容器：

- 用户清空 / Backspace 删空 / 加载空默认值 → editor.getHtml() 仍是占位段落
- 消费方写 `rules: 'required'` 会把它当作「已填」，**校验静默失效**

`RichTextEditor` 在 `handleChange` 检测「视觉为空」（剥 HTML + 剥 `&nbsp;` + trim 判空）后主动 `emit('')`，业务方继续用标准 `rules: 'required'` 即可。

### 3.3 防循环更新（6 步链路）

外部 prop 变化触发 watch → setHtml → Editor.onChange → emit → watch 再触发 → **比对 safeHtml === editor.getHtml() 跳过 setHtml**，循环终止。

外部置空（`newHtml === ''`）额外判断：编辑器若已视觉为空则跳过 setHtml（避免与 `isVisualEmpty → emit('')` 形成死循环）。

### 3.4 自定义图片上传

```typescript
const uploadApi = async (file: File) => {
  const form = new FormData()
  form.append('file', file)
  const { data } = await axios.post('/api/upload', form)
  return { url: data.url, alt: file.name }
}
```

拦截默认 base64 → 调用 `props.uploadApi` 走 OSS / 后端存储 → 拿真实 URL 后 `insertFn(url, alt, url)` 插入编辑器。

**错误处理**：上传失败 → ElMessage 提示（区分 `AbortError` / 网络错误 / 业务错误）+ console.error 留详细堆栈，不静默吞错。

---

## 4. 集成示例

### 4.1 表单场景（XForm + RichTextEditor）

```vue
<script setup lang="ts">
import { reactive, ref } from 'vue'
// RichTextEditor 由 unplugin-vue-components 自动注册（@vv/ui 包组件目录），模板免 import

const form = reactive({ content: '' })

const uploadApi = async (file: File) => {
  const form = new FormData()
  form.append('file', file)
  const { data } = await fetch('/api/upload', { method: 'POST', body: form }).then((r) => r.json())
  return { url: data.url, alt: file.name }
}
</script>

<template>
  <RichTextEditor
    v-model="form.content"
    :upload-api="uploadApi"
    height="400px"
    placeholder="请输入文章正文..."
  />
</template>
```

### 4.2 readOnly 场景（详情展示）

```vue
<RichTextEditor v-model="article.content" read-only height="auto" />
```

### 4.3 footer 扩展点

```vue
<RichTextEditor v-model="content">
  <template #footer>
    <span>{{ content.length }} 字符</span>
  </template>
</RichTextEditor>
```

---

## 5. 测试覆盖

| 文件                                                                      | 用例数 | 覆盖范围                                                                                     |
| ------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------- |
| `packages/ui/src/components/common/RichTextEditor/RichTextEditor.spec.ts` | 17     | v-model 双向 + DOMPurify 清洗 + 视觉为空映射 + 防循环 + 命令式 API + onBeforeUnmount destroy |

完整 demo 站：`apps/docs/src/modules/demo/examples/RichTextEditor.vue` 单文件（按 tab 内嵌展示 XSS 防御演示 + 上传演示 + 详情只读模式三类场景），路由 `/demo/rich-text-editor`。

---

## 6. 相关文档

- 组件源码：`packages/ui/src/components/common/RichTextEditor/RichTextEditor.vue`
- 类型导出：`packages/ui/src/components/common/RichTextEditor/types.ts`
- DOMPurify：[github.com/cure53/DOMPurify](https://github.com/cure53/DOMPurify)
- WangEditor V5：[wangeditor.com](https://www.wangeditor.com/v5/)
