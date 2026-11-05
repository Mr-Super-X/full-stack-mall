<!--
  RichTextEditor —— 基于 WangEditor V5 的高级富文本编辑器
  设计：v-model 双向绑定（DOMPurify 在 prop/emit 双向链路上清洗）+ 防循环更新 + uploadApi 自定义图片上传 + onBeforeUnmount 调 destroy
  V5 工具栏与编辑区分离：Toolbar 通过 :editor 接收 Editor 实例建立关联

  优化点（相对原版本）：
  - 抽离 syncEditorWithModel / safeSetHtml / getUploadErrorMessage 三个内联函数，去掉 watch 回调的 25 行嵌套
  - toolbarConfig / editorConfig 升级为 computed，支持响应 prop 变化
  - 新增 toolbarExcludeKeys / toolbarKeys props，提升可扩展性
  - 新增 #footer slot，为消费方提供扩展点
  - defineExpose 暴露 getEditor / focus / blur / getHtml / setHtml 命令式 API
  - watch 加 flush: 'post'，与 Editor 内部 Slate 数据同步更可靠
  - 显式保存 stopWatcher，onBeforeUnmount 中先 stop 再 destroy  @see https://www.wangeditor.com/v5/
  @see https://github.com/cure53/DOMPurify
  @group 富文本编辑器
-->
<script setup lang="ts">
/**
 * RichTextEditor —— 基于 WangEditor V5 封装的 v-model 富文本编辑器
 *
 * 核心能力：
 * - v-model 双向绑定（emit 前 + watch setHtml 前共用同一份 DOMPurify 清洗配置）
 * - 防循环更新：watch 内比对「safeHtml === editor.getHtml()」阻断 setHtml → onChange → emit 死循环
 * - uploadApi 自定义图片上传（拦截默认 base64，走 OSS/后端存储）
 * - onBeforeUnmount 必须 destroy，否则编辑器 DOM 监听器泄漏 + 路由切换报 "Cannot read properties of null"
 *
 * 命令式 API：通过 ref 访问组件，调用 getEditor() / focus() / getHtml() / setHtml()
 *
 * @see [`./types.ts`](./types.ts) Props / Emits 类型
 * @group 通用组件：RichTextEditor
 */
import { computed, onBeforeUnmount, shallowRef, watch } from 'vue'
import { ElMessage } from 'element-plus'
import DOMPurify from 'dompurify'
// @ts-expect-error - @wangeditor/editor-for-vue@5.1.12 的 package.json exports 字段缺 "types" 条件，
// 导致 vue-tsc 找不到 dist/src/index.d.ts。运行时由 vite 用 module 字段解析 esm.js 不受影响。
// 待上游修复或本项目提 PR 加 paths 配置后移除此注释。
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'
import { type IDomEditor, type IEditorConfig, type IToolbarConfig } from '@wangeditor/editor'
import '@wangeditor/editor/dist/css/style.css'
import type { RichTextEditorEmits, RichTextEditorProps } from './types'

defineOptions({ name: 'RichTextEditor' })

const props = withDefaults(defineProps<RichTextEditorProps>(), {
  height: '300px',
  placeholder: '请输入内容...',
  readOnly: false,
  // uploadApi 不设默认：exactOptionalPropertyTypes 下 undefined 不能赋值给可选 prop，
  // 保持 undefined 让消费方通过 `if (!props.uploadApi)` 判定即可
  // toolbarExcludeKeys 数组/对象用工厂函数返回，避免所有实例共享同一引用
  toolbarExcludeKeys: () => ['uploadVideo'],
})
const emit = defineEmits<RichTextEditorEmits>()

// BEM 命名空间：vv-rich-text-editor / __toolbar / __editor / __footer
// createNamespace 由 unplugin-auto-import 全局注入，详见 vite.config.ts AutoImport.imports
const bem = createNamespace('rich-text-editor')

/**
 * DOMPurify 清洗配置（统一入口，watch 和 handleChange 共用避免配置漂移）
 *
 * 设计：
 * - USE_PROFILES.html 等价于 ALLOWED_TAGS / ALLOWED_ATTR 的 HTML5 白名单（保留 a/p/img/strong 等富文本标签）
 * - FORBID_TAGS 黑名单：style（⚠ 是「标签」非「属性」——<style> 可 @import 远程 CSS 造成视觉欺骗，
 *   远程 CSS 的唯一入口在此封死）、script/iframe/object/embed/form（XSS 经典入口）
 * - FORBID_ATTR 黑名单：全套 on* 事件属性 + formaction
 * - ⚠ 不放行 style「属性」会废掉字号/字体/行高/颜色/背景色——wangEditor 这些菜单全部输出内联 style，
 *   禁用后 sanitize 剥掉 style + watch 的 setHtml 回写会把刚应用的样式立刻抹掉（用户视角=功能不生效）。
 *   style 属性在现代浏览器无脚本执行能力（expression/behavior 均为 IE 古董），放行是富文本编辑器行业标准。
 *
 * ⚠ 教训：之前只在 handleChange（emit 链路）调用 sanitize，但 watch（外部 prop 链路）未调用，
 * 导致 `<img onerror=...>` / `<a href="javascript:...">` 等通过 props.modelValue 直接 setHtml 进入编辑器 DOM，
 * 浏览器解析并执行，XSS 防御失效。两个入口必须共用同一份 sanitize 配置。
 */
const SANITIZE_CONFIG = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form'],
  FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onfocus', 'formaction'],
} as Parameters<typeof DOMPurify.sanitize>[1]

/** DOMPurify 清洗入口：watch 和 handleChange 共用，杜绝配置漂移 */
function sanitizeHtml(html: string): string {
  // DOMPurify 3.x 类型声明在某些 DOM lib 配置下会返回 TrustedHTML | string，
  // 这里业务始终按 string 处理——用 String() 兜底，SSR 环境也不会炸
  return String(DOMPurify.sanitize(html, SANITIZE_CONFIG))
}

/**
 * HTML 「视觉为空」判定：去掉所有 HTML 标签 + &nbsp; + trim 后无可见字符。
 *
 * wangEditor V5 编辑器永远保留一个空段落（<p><br></p>）作为光标容器——
 * 用户清空内容 / 连续 Backspace 把段落内容删空 / 加载默认值后立即删空，
 * editor.getHtml() 都会返回这个占位段落，消费方用 `rules: 'required'` 校验
 * 会把它当作「已填」。
 *
 * 业务语义：「视觉为空」等价于「用户看到的是空白」，v-model 应映射为 ''
 * 让 async-validator 的 required 规则能正确工作。组件内部完成此映射，
 * 消费方只需写 `rules: 'required'` 无须关心 wangEditor 内部数据形态。
 */
function isVisualEmpty(html: string): boolean {
  return !String(html ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, '')
    .trim()
}

/**
 * setHtml 错误兜底：WangEditor 内部 setHtml 可能 reject（如 demo 里的 `<img src="x">` 触发
 * 「Cannot resolve a DOM node from Slate node: {"text":""}」），unhandledrejection 会冒泡到
 * 全局 errorHandler → 整个页面被错误页覆盖。这里统一 catch 静默处理：
 * XSS 防御已经在 sanitize 完成，setHtml 失败不影响安全。
 *
 * 抽离为独立函数（DRY）：watch 内两个分支原本各自写 try/catch，现统一调用此处。
 */
function safeSetHtml(editor: IDomEditor, html: string): void {
  try {
    editor.setHtml(html)
  } catch (err) {
    console.error('[RichTextEditor] setHtml failed:', err)
  }
}

/**
 * 自定义上传错误信息归一化：区分 AbortError / 网络错误 / 业务错误，给用户更精准反馈。
 *
 * 防御性编程 §10：catch 块非空且有差异化日志/提示。
 */
function getUploadErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === 'AbortError') return '图片上传已取消'
    if (err.message.includes('NetworkError') || err.message.includes('Failed to fetch')) {
      return '网络异常，上传失败，请检查网络后重试'
    }
  }
  return '图片上传失败，请稍后再试'
}

/**
 * Editor 实例用 shallowRef 而非 ref（vue 底层 API）：WangEditor 内部维护 Slate 数据结构 + DOM 节点，
 * 深响应化会拖慢渲染且无业务收益。
 */
const editorRef = shallowRef<IDomEditor | null>(null)

// 工具栏配置：toolbarKeys 优先于 toolbarExcludeKeys；
// 都不传时退化为默认排除 'uploadVideo'（兼容原行为）
// 升级为 computed：未来如放开「初始化一次性 prop」限制，可零成本支持运行时变更
const toolbarConfig = computed<Partial<IToolbarConfig>>(() => {
  if (props.toolbarKeys?.length) {
    return { toolbarKeys: props.toolbarKeys }
  }
  return { excludeKeys: props.toolbarExcludeKeys ?? [] }
})

// 编辑区高度转 CSS：'300px' 原样 / 数字按 px 处理
// 抽成 computed 是为了模板不写复杂表达式（项目「模板层不写复杂表达式」规范）
const heightCss = computed<string>(() =>
  typeof props.height === 'number' ? `${props.height}px` : props.height
)

// 编辑器配置：placeholder / readOnly + MENU_CONF['uploadImage']
// 注意 onChange / onCreated 等回调**不能**放在 defaultConfig 里，
// Editor 内部会主动抛 "请使用 @onChange 事件，不要放在 props 中" 错误（详见 editor-for-vue 源码）
const editorConfig = computed<Partial<IEditorConfig>>(() => ({
  placeholder: props.placeholder,
  readOnly: props.readOnly,
  MENU_CONF: {
    uploadImage: {
      // 上传超时 5s（默认 30s 对富文本内联图片过长）
      timeout: 5 * 1000,
      /**
       * 拦截默认 base64 上传：调用 props.uploadApi 走 OSS/后端存储，
       * 拿到真实 URL 后 insertFn 插入编辑器。
       *
       * customUpload 与 defaultConfig.onChange 等「回调放在 props」的检查一样，
       * 是 WangEditor 故意设计的「状态来源单一化」机制——避免同一生命周期有多入口。
       * 这里 customUpload 是注册在 uploadImage 菜单的「子回调」，Editor 不会拦截。
       */
      customUpload: async (
        file: File,
        insertFn: (src: string, alt: string, href: string) => void
      ): Promise<void> => {
        // 通过 props 闭包而非 getter：uploadApi 是初始化一次性 prop（types.ts 已标注），
        // 运行时变更不响应，无须 watch
        const uploadApi = props.uploadApi
        if (!uploadApi) {
          // 开发者向配置警告（非终端用户文案）——按 i18n 豁免惯例不翻译（同 Vue/React 自身
          // dev warning 固定语言的行业惯例）；ElMessage 中文拦截规则（2026-10-30 评估）因
          // config-protection 钩子未落地，豁免靠 code review 约定 + 本注释声明
          ElMessage.warning('请先配置 uploadApi 以启用图片上传')
          return
        }
        try {
          const { url, alt } = await uploadApi(file)
          // insertFn 三参：图片 URL、alt 文本、链接 URL
          // 这里把 href 也指向图片地址，方便用户点击查看原图
          insertFn(url, alt ?? file.name, url)
        } catch (err) {
          // 上传失败给用户明确反馈（不静默吞错，遵循 §防御性编程 强约束）
          ElMessage.error(getUploadErrorMessage(err))
          // 控制台留详细堆栈便于排查
          console.error('[RichTextEditor] uploadImage failed:', err)
        }
      },
    },
  },
}))

/** Editor 实例创建完成：缓存到 ref 供 setHtml / destroy / getHtml 使用 */
const handleCreated = (editor: IDomEditor): void => {
  editorRef.value = editor
}

/**
 * onChange 回调：编辑器内容变化 → 取 HTML → DOMPurify 清洗 → emit 给父组件。
 *
 * 关键设计：必须绕过 Editor 内部的 update:modelValue 通路。
 * Editor 内部 onChange 会 emit('update:modelValue', editorHtml)，但 emit 的是**未清洗**的 HTML，
 * 如果父组件直接 v-model，modelValue 会被脏数据污染，XSS 防御失效。
 *
 * 所以我们不监听 @update:model-value，只监听 @on-change，自己清洗后再 emit。
 *
 * 空内容映射：wangEditor V5 永远输出 <p><br></p> 占位段落，消费方用 `rules: 'required'`
 * 校验会误识别为「已填」。此处检测「视觉为空」后主动 emit ''，让 v-model 反映业务语义。
 * @see isVisualEmpty 详细机制
 */
const handleChange = (editor: IDomEditor): void => {
  const rawHtml = editor.getHtml()
  if (isVisualEmpty(rawHtml)) {
    emit('update:modelValue', '')
    return
  }
  const cleanHtml = sanitizeHtml(rawHtml)
  emit('update:modelValue', cleanHtml)
}

/**
 * 把外部 prop 的 HTML 同步到编辑器内部。
 *
 * 防循环原理：
 *   1. 用户输入 → Editor.onChange → handleChange → emit('update:modelValue', cleanHtml)
 *   2. props.modelValue 变为 cleanHtml → watch 触发 → syncEditorWithModel
 *   3. cleanHtml !== editor.getHtml()（编辑器内部是脏 HTML）→ safeSetHtml(safeHtml)
 *   4. Editor 再次触发 onChange → handleChange → emit 同样 safeHtml
 *   5. props.modelValue 还是 safeHtml → watch 触发 → syncEditorWithModel
 *   6. safeHtml === editor.getHtml()（此时编辑器已被 setHtml 清洗过）→ **跳过 setHtml**，循环终止
 *
 * 不加这个判断会导致：setHtml → onChange → emit → watch → setHtml ... 的死循环。
 *
 * 外部置空（newHtml 为 ''）：wangEditor setHtml('') 后内部仍保留 <p><br></p> 光标容器，
 * editor.getHtml() 不会被同步成 ''——若按既有比较逻辑会出现死循环（safeHtml '' !== getHtml() '<p><br></p>）。
 * 此处用 isVisualEmpty 二次判断：编辑器已经是「视觉为空」状态就跳过 setHtml，避免循环。
 *
 * ⚠ 必传 safeHtml 而非 newHtml：外部 prop 传入的 HTML 可能是脏数据（API 返回 / 用户粘贴 / 第三方拼接），
 * 直接 setHtml 会让 onerror/javascript: 等进入 DOM 并被浏览器执行。sanitize 是必经闸门。
 *
 * 抽离为独立函数（相对原版本）：让 watch 回调从 25 行降到 1 行，集中防循环/视觉为空/setHtml 三分支。
 */
function syncEditorWithModel(newHtml: string | undefined): void {
  const editor = editorRef.value
  if (editor == null) return
  const safeHtml = sanitizeHtml(newHtml ?? '')
  if (isVisualEmpty(newHtml ?? '')) {
    // 外部置空场景：编辑器若已视觉为空则跳过 setHtml（避免与 isVisualEmpty emit('') 形成 setHtml 循环）；
    // 若编辑器仍有内容则执行 setHtml('') 清空（reset / 加载空默认值场景）。
    if (isVisualEmpty(editor.getHtml())) return
    safeSetHtml(editor, safeHtml)
    return
  }
  if (safeHtml === editor.getHtml()) return
  safeSetHtml(editor, safeHtml)
}

/**
 * watch props.modelValue：仅在「外部值 ≠ 编辑器当前 HTML」时 setHtml。
 *
 * flush: 'post'：让 watch 在 DOM 更新周期之后触发，与 Editor 内部 setHtml/onChange 同步更可靠，
 * 避免在组件渲染前同步导致 editor.getHtml() 返回旧值的边缘时序问题。
 */
const stopWatcher = watch(
  () => props.modelValue,
  (newHtml) => syncEditorWithModel(newHtml),
  { flush: 'post' }
)

/**
 * 组件卸载：先 stop watcher，再 destroy 编辑器。
 *
 * 不 destroy 的后果：
 *   - 编辑器实例内的 toolbar/编辑区 DOM 监听器不会释放，造成内存泄漏
 *   - 路由切换时旧编辑器仍在监听 onChange，控制台报 "Cannot read properties of null"
 */
onBeforeUnmount(() => {
  stopWatcher()
  const editor = editorRef.value
  if (editor == null) return
  editor.destroy()
  editorRef.value = null
})

/**
 * 暴露命令式 API 给父组件
 *
 * - getEditor：访问底层 IDomEditor，可调用 WangEditor 全部命令式方法（如 insertText / focus / getSelectionText）
 * - focus / blur：聚焦/失焦编辑器
 * - getHtml / setHtml：与 v-model 等价的命令式接口
 *
 * 父组件示例：通过 ref 获取实例后调用命令式 API（如 getEditor / focus / setHtml）。
 */
defineExpose({
  getEditor: (): IDomEditor | null => editorRef.value,
  focus: (): void => editorRef.value?.focus(),
  blur: (): void => editorRef.value?.blur(),
  getHtml: (): string => editorRef.value?.getHtml() ?? '',
  setHtml: (html: string): void => {
    const editor = editorRef.value
    if (editor == null) return
    safeSetHtml(editor, sanitizeHtml(html))
  },
})
</script>

<template>
  <div :class="bem.b()">
    <!--
      Toolbar：V5 工具栏与编辑区是分离的两个组件，通过 :editor 把 Editor 实例传给 Toolbar 建立关联
      注意：Toolbar 自身 watch editor prop（immediate:true），所以传 null 时不会报错
    -->
    <Toolbar
      :editor="editorRef"
      :default-config="toolbarConfig"
      :mode="'default'"
      :class="bem.e('toolbar')"
    />
    <!--
      Editor：只传 :default-html 用于初始内容，**不传 :model-value** 避免 Editor 内部
      直接 emit 未清洗 HTML 覆盖我们的 v-model；同步逻辑由上面的 watch 接管
    -->
    <Editor
      :default-html="modelValue"
      :default-config="editorConfig"
      :mode="'default'"
      :class="bem.e('editor')"
      :style="{ height: heightCss }"
      @on-created="handleCreated"
      @on-change="handleChange"
    />
    <!-- 扩展点：编辑器底部插入自定义内容（如字数统计、AI 续写按钮） -->
    <div v-if="$slots.footer" :class="bem.e('footer')">
      <slot name="footer" />
    </div>
  </div>
</template>

<style lang="scss">
// BEM 根选择器与 createNamespace('rich-text-editor') 严格对齐
// 详见 §3 BEM 规范：非 scoped 样式 + .#{$BEM_PREFIX}- 前缀
.#{$BEM_PREFIX}-rich-text-editor {
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  overflow: hidden;
  background: var(--el-bg-color);

  &__toolbar {
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  &__editor {
    overflow-y: auto;

    // 覆盖 wangEditor 默认占位符颜色（与 EP 风格一致）
    .w-e-text-placeholder {
      color: var(--el-text-color-placeholder);
    }

    // 覆盖项目 reset.css 对字重/字形的全局重置（`*{font-weight:normal;font-style:normal}`）——
    // 否则 wangEditor 加粗/斜体命令 HTML 变化但视觉无变化。
    //
    // ⚠ 为什么必须连 [data-slate-string] 一起命中：WangEditor V5 基于 Slate，
    // 叶子文本渲染结构是 <strong><span data-slate-string>文本</span></strong>，
    // 可见文本在内层 span 上；而 `*` 重置对 span 是指定值，优先于从 strong
    // 继承来的样式——只恢复 strong/b 包裹层压不住内层 span（实测 span 字重 400）。
    // text-decoration 无需同理处理：该属性按规范会贯穿内联后代，u/s 视觉天然生效。
    b,
    strong,
    b [data-slate-string],
    strong [data-slate-string] {
      font-weight: bold;
    }
    i,
    em,
    i [data-slate-string],
    em [data-slate-string] {
      font-style: italic;
    }
    u {
      text-decoration: underline;
    }
    s,
    del {
      text-decoration: line-through;
    }
  }

  &__footer {
    border-top: 1px solid var(--el-border-color-lighter);
    padding: 8px 12px;
    background: var(--el-fill-color-lighter);
    font-size: 13px;
    color: var(--el-text-color-regular);
  }
}
</style>
