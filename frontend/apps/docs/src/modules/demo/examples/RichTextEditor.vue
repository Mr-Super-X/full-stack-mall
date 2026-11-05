<!--
  RichTextEditor 用法总览 —— 基于 WangEditor V5 的高级富文本编辑器

  演示覆盖点：
  ① 基础 v-model 双向绑定 + DOMPurify XSS 防御（粘贴 <script> 会被自动剔除）
  ② 自定义图片上传（基于 axios 的模拟 OSS 上传，1.2s 延迟 + 50% 失败率便于看错误提示）
  ③ 只读模式切换（props readOnly）
  ④ 防循环更新验证（外部按钮 setHtml 后 onChange 应只触发一次——可开 DevTools 看 console）
  ⑤ currentHtml / cleanHtml 实时展示（理解 DOMPurify 过滤了什么）

  路由：/demo/rich-text-editor（import.meta.glob 自动派生）

  验证清单（按顺序操作）：
  ① 看到富文本编辑器 + 工具栏 → 在编辑器里粘贴 `<script>alert(1)</script>` → 下方「清洗后 HTML」标签应该没有 script
  ② 点「选择图片」上传一个图 → 1.2s 后图片出现在编辑器（成功）或 ElMessage 错误提示（失败）
  ③ 勾选「只读模式」→ 编辑器变灰，工具栏禁用
  ④ 点「外部设置 HTML」→ 编辑器内容立刻更新，且控制台只打一次 change 日志（验证防循环）
-->
<script setup lang="ts">
import RichTextEditorSource from '@vv/ui/components/common/RichTextEditor/RichTextEditor.vue?raw'
import DemoField from '../components/DemoField.vue'
import DemoFrame from '../components/DemoFrame.vue'
import ApiTable from '../components/ApiTable.vue'
import { useDocToc } from '../composables/useDocToc'
import { extractApi, type ApiItem, type SlotItem } from '../utils/extractApi'

const bem = createNamespace('demo-rich-text-editor')

// —— 演示 1：基础 v-model ——
const basicHtml = ref<string>(
  '<p>欢迎使用 <strong>RichTextEditor</strong>！试着粘贴一段带 <code>&lt;script&gt;</code> 的 HTML 看看 XSS 防御。</p>'
)

// —— 演示 2：自定义图片上传 ——
/**
 * 基于 axios 的模拟 OSS 上传。
 *
 * 真实场景替换为：
 *   - FormData 上传 + 后端返回 { url: 'https://oss.example.com/xxx.png' }
 *   - 或前端直传 OSS（STS 临时凭证 + postObject）
 */
async function mockUploadApi(file: File): Promise<{ url: string; alt?: string }> {
  // 模拟 1.2s 上传耗时
  await new Promise<void>((resolve) => setTimeout(resolve, 1200))

  // 模拟 50% 失败率，便于演示 ElMessage 错误提示
  if (Math.random() < 0.5) {
    throw new Error('OSS 上传失败（模拟）')
  }

  // 真实场景：await axios.post('/api/upload', formData)
  // 这里用 FileReader + base64 让图片能即时显示（仅用于 demo，生产必须走真上传）
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })

  return { url: dataUrl, alt: file.name }
}

const uploadHtml = ref<string>('')

// —— 演示 3：只读模式 ——
const readOnlyHtml = ref<string>('<p>这是只读内容，不可编辑</p>')
const readOnlyMode = ref<boolean>(true)

// —— 演示 4：防循环更新验证 ——
const cycleHtml = ref<string>('')
const cycleChangeCount = ref<number>(0)

function externalSetHtml(): void {
  cycleChangeCount.value = 0 // 清零计数
  cycleHtml.value = '<p>外部设置：' + new Date().toLocaleTimeString() + '</p>'
}

function onCycleChange(html: string): void {
  cycleChangeCount.value++
  // 真实场景用 ElMessage.success 提示，这里用 console 让 DevTools 看更直观
  console.log(
    '[防循环验证] onChange 触发第',
    cycleChangeCount.value,
    '次，HTML 长度 =',
    html.length
  )
}

// —— 演示 5：XSS 防御可视化（DOMPurify 清洗前 vs 清洗后对比） ——
// ⚠ 设计要点：脏 HTML 不直接灌入 wangEditor——WangEditor 内部 Slate 节点转换对部分 HTML
// （如 <img src="x">、<a>空 href）会异步 reject「Cannot resolve a DOM node from Slate node」，
// 触发 unhandledrejection → Vue errorHandler，污染 console。
// 这里改用「清洗前 vs 清洗后」直接字符串对比演示 XSS 防御，绕开 wangEditor 脆弱点。
import DOMPurify from 'dompurify'

const SANITIZE_DEMO_CONFIG = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form'],
  FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onfocus', 'formaction'],
}

// 源码里不能用 < 字面量（ESLint vue parser 会把 <script 误判为 JSX 元素）
// 用 < 转义 <，> 转义 >，运行结果与真实 HTML payload 一致
const LT = '<'
const GT = '>'
const XSS_PAYLOADS = [
  `${LT}script${GT}alert(1)${LT}/script${GT}`,
  `${LT}img src=x onerror=alert(2)${GT}`,
  `${LT}a href="javascript:alert(3)"${GT}点我${LT}/a${GT}`,
  `${LT}p style="color:red"${GT}正常段落${LT}/p${GT}`,
]

// 「清洗前」累积（点击按钮累加）
const rawHtml = ref<string>('')
// 「清洗后」实时派生（与 SANITIZE_CONFIG 同步；和组件内部保持一致）
// ⚠ style 属性必须放行：字号/颜色/字体等富文本排版依赖内联 style（详见组件 SANITIZE_CONFIG 注释）
const cleanHtml = computed<string>(
  () => DOMPurify.sanitize(rawHtml.value, SANITIZE_DEMO_CONFIG) as string
)

function injectPayload(payload: string): void {
  rawHtml.value += payload
}

// —— 各段源码片段（DemoField :code 用，模板字符串字面量可含 <，不触发 ESLint JSX 检测） ——
const SNIPPET_BASIC = `<RichTextEditor v-model="basicHtml" height="320px" />`

const SNIPPET_UPLOAD = `// 1. 实现 uploadApi（真实场景用 axios 走后端上传接口）
async function uploadApi(file: File): Promise<{ url: string }> {
  const formData = new FormData()
  formData.append('file', file)
  // 业务代码请走 @api/_http 封装的 axios 实例（统一 baseURL/拦截器/token 刷新）
  // /mock/upload：mock 统一前缀（2026-10-26）——该端点暂无 mock 实现，演示环境 404 为预期
  const { data } = await axios.post<{ url: string }>('/mock/upload', formData)
  return { url: data.url }
}

// 2. 把函数传给 RichTextEditor
<RichTextEditor v-model="html" :upload-api="uploadApi" />`

const SNIPPET_READONLY = `<RichTextEditor
  v-model="html"
  :read-only="readOnly"
/>

<el-switch v-model="readOnly" active-text="只读" inactive-text="可编辑" />`

const SNIPPET_CYCLE = `// 关键代码：RichTextEditor 内部 watch 阻断循环 + XSS sanitize
watch(() => props.modelValue, (newHtml) => {
  const editor = editorRef.value
  if (editor == null) return
  // sanitizeHtml 是必经闸门，外部 prop 传入的脏 HTML 也必须过滤
  const safeHtml = sanitizeHtml(newHtml)
  if (safeHtml !== editor.getHtml()) {
    editor.setHtml(safeHtml)
  }
})`

const SNIPPET_XSS = `// emit 前清洗：DOMPurify + 自定义黑名单（watch 链路同样调用 sanitizeHtml）
const cleanHtml = sanitizeHtml(editor.getHtml())
emit('update:modelValue', cleanHtml)`

// —— API 自动提取 + description 字典 merge ——
const api = extractApi(RichTextEditorSource)

const propDescriptions: Record<string, string> = {
  modelValue:
    '双向绑定的 HTML 字符串。prop / emit 双向链路上都经过 DOMPurify 清洗以防 XSS（watch setHtml 前 + onChange emit 前共用 SANITIZE_CONFIG）。',
  height:
    '编辑器高度。支持 "320px" / 数字（按 px 处理）。默认 "300px"。建议 ≥ 300px 避免 WangEditor hoverbar 定位警告。',
  placeholder:
    '占位提示文字。默认 "请输入内容..."。运行时变更不响应（WangEditor V5 无热更新 API），需 v-if 重建。',
  readOnly: '是否只读。true 时工具栏禁用。默认 false。运行时变更不响应，需 v-if 重建。',
  uploadApi:
    '自定义图片上传函数。签名 (file: File) => Promise<{ url, alt? }>。不传则禁用图片上传菜单。',
  toolbarExcludeKeys:
    '工具栏要排除的菜单 key 列表。默认 ["uploadVideo"]。完整 key 见 WangEditor 官方文档。运行时变更不响应（wangEditor V5 无热更新 API）。',
  toolbarKeys:
    '工具栏要包含的菜单 key 列表（白名单模式）。不传时显示 WangEditor 默认全部菜单。与 toolbarExcludeKeys 互斥，toolbarKeys 优先。运行时变更不响应。',
}

const eventDescriptions: Record<string, string> = {
  'update:modelValue': 'v-model 同步事件，emit 清洗后的 HTML。',
}

const slotDescriptions: Record<string, string> = {
  footer: '编辑器底部插入自定义内容（如字数统计、AI 续写按钮等扩展 UI）。',
}

function merge<T extends { name: string }>(
  items: T[],
  descMap: Record<string, string>
): (T & { description: string })[] {
  return items.map((it) => ({ ...it, description: descMap[it.name] ?? '—' }))
}

const propsItems = merge<ApiItem>(api.props, propDescriptions)
const eventsItems = merge<ApiItem>(api.events, eventDescriptions)
const slotsItems = merge<SlotItem & { type: string; default: string; required: boolean }>(
  api.slots.map((s) => ({
    ...s,
    type: s.scoped ? '作用域插槽' : '—',
    default: '—',
    required: false,
  })),
  slotDescriptions
)

const tocItems = [
  { id: 'demo-basic', label: '基础 v-model' },
  { id: 'demo-upload', label: '自定义图片上传' },
  { id: 'demo-readonly', label: '只读模式' },
  { id: 'demo-cycle', label: '防循环更新验证' },
  { id: 'demo-xss', label: 'XSS 防御可视化' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="RichTextEditor 富文本编辑器"
    source="src/components/common/RichTextEditor/RichTextEditor.vue"
    :introductions="[
      '基于 WangEditor V5（@wangeditor/editor-for-vue@5.x）封装的 v-model 富文本编辑器。',
      '内置 DOMPurify XSS 防御（emit 前过滤 <script>/onerror 等危险内容）+ 自定义图片上传 + 防循环更新。',
      'V5 工具栏与编辑区是分离的两个组件，本封装通过 :editor prop 关联，无需手动处理。',
    ]"
  >
    <!-- ① 基础 v-model -->
    <section id="demo-basic">
      <DemoField :code="SNIPPET_BASIC" label="① 基础 v-model + DOMPurify XSS 防御">
        <RichTextEditor v-model="basicHtml" height="320px" />
        <p :class="bem.e('hint')">当前 modelValue（清洗后，对比编辑器里粘贴的内容看差异）</p>
        <pre :class="bem.e('html-preview')">{{ basicHtml }}</pre>
      </DemoField>
    </section>

    <!-- ② 自定义图片上传 -->
    <section id="demo-upload">
      <DemoField :code="SNIPPET_UPLOAD" label="② 自定义图片上传：uploadApi 接管默认 base64">
        <p :class="bem.e('hint')">
          工具栏点「图片」→ 选文件 → 1.2s 后随机成功（图片插入）/失败（ElMessage 错误）
        </p>
        <RichTextEditor v-model="uploadHtml" :upload-api="mockUploadApi" height="320px" />
        <p :class="bem.e('hint')">uploadHtml（清洗后）</p>
        <pre :class="bem.e('html-preview')">{{ uploadHtml }}</pre>
      </DemoField>
    </section>

    <!-- ③ 只读模式 -->
    <section id="demo-readonly">
      <DemoField :code="SNIPPET_READONLY" label="③ 只读模式（readOnly prop）">
        <el-switch v-model="readOnlyMode" active-text="只读" inactive-text="可编辑" />
        <RichTextEditor v-model="readOnlyHtml" :read-only="readOnlyMode" height="320px" />
      </DemoField>
    </section>

    <!-- ④ 防循环更新验证 -->
    <section id="demo-cycle">
      <DemoField :code="SNIPPET_CYCLE" label="④ 防循环更新：外部 setHtml 后 onChange 只触发一次">
        <p :class="bem.e('hint')">
          点下方按钮「外部设置 HTML」→ 编辑器内容更新，DevTools console 应只打一次
          onChange（说明循环被阻断）
        </p>
        <el-button type="primary" @click="externalSetHtml">外部设置 HTML</el-button>
        <RichTextEditor v-model="cycleHtml" height="320px" @update:model-value="onCycleChange" />
        <p :class="bem.e('counter')">onChange 触发次数：{{ cycleChangeCount }}</p>
      </DemoField>
    </section>

    <!-- ⑤ XSS 防御可视化 -->
    <section id="demo-xss">
      <DemoField :code="SNIPPET_XSS" label="⑤ XSS 防御可视化：脏 HTML 不入编辑器，直接对比清洗前后">
        <p :class="bem.e('hint')">
          点击下列 payload，「清洗前」累积原始 HTML，「清洗后」实时展示 DOMPurify 处理结果。
          注意对比：script / onerror / javascript: 等危险内容被剥离；style
          内联样式保留（字号/颜色功能依赖）。
        </p>
        <el-button
          v-for="(payload, i) in XSS_PAYLOADS"
          :key="i"
          size="small"
          :class="bem.e('payload-btn')"
          @click="injectPayload(payload)"
        >
          {{ payload }}
        </el-button>
        <p :class="bem.e('hint')">清洗前（原始累积，可能含 XSS）</p>
        <pre :class="bem.e('html-preview')">{{ rawHtml || '（点击上方按钮注入 payload）' }}</pre>
        <p :class="bem.e('hint')">清洗后（DOMPurify 处理，与组件内部共用同一份配置）</p>
        <pre :class="bem.e('html-preview')">{{ cleanHtml || '（同上）' }}</pre>
      </DemoField>
    </section>

    <!-- API 文档 -->
    <ApiTable title="Props" :items="propsItems" anchor="api-props" />
    <ApiTable title="Events" :items="eventsItems" anchor="api-events" />
    <ApiTable title="Slots" :items="slotsItems" anchor="api-slots" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-rich-text-editor {
  &__hint {
    margin: 8px 0;
    font-size: 13px;
    color: #909399;
    line-height: 1.6;
  }

  &__html-preview {
    margin: 8px 0 0;
    padding: 12px;
    background: #f5f7fa;
    border: 1px solid #ebeef5;
    border-radius: 4px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    color: #606266;
    white-space: pre-wrap;
    word-break: break-all;
  }

  &__payload-btn {
    margin-right: 8px;
    margin-bottom: 8px;
  }

  &__counter {
    margin: 8px 0 0;
    font-size: 13px;
    color: #67c23a;
  }
}
</style>
