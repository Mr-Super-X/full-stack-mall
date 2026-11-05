/**
 * RichTextEditor 类型定义 —— Props / Emits / UploadResult
 *
 * @group 通用组件：RichTextEditor
 */

/**
 * 自定义图片上传返回值（`alt` 可省略，fallback 到 file.name）
 */
export interface UploadResult {
  url: string
  alt?: string
}

/**
 * RichTextEditor Props —— 基于 WangEditor V5 的 v-model 富文本编辑器
 *
 * @see [`./RichTextEditor.vue`](./RichTextEditor.vue) 组件本体
 */
export interface RichTextEditorProps {
  /**
   * 双向绑定的 HTML 内容。
   *
   * ⚠ prop / emit 双向链路上都会经过 DOMPurify 清洗：
   *   - 父组件传入：watch 中 sanitizeHtml(newHtml) 再 setHtml
   *   - 用户输入：onChange 中 sanitizeHtml(editor.getHtml()) 再 emit
   * 两链路共用 SANITIZE_CONFIG，配置漂移风险归零。
   */
  modelValue: string
  /**
   * 编辑器高度，支持 '300px' / 数字（按 px 处理）。
   *
   * ⚠ 不建议 < 300px：WangEditor V5 内部 modal / hoverbar 定位依赖 300px 以上的编辑区高度，
   * 否则会在 console 打印 "Textarea height < 300px. This may be cause modal and hoverbar position error" 警告，
   * 部分快捷交互（如表格菜单弹出位置）会偏离。默认 '300px' 是这个临界值。
   */
  height?: string | number
  /**
   * 占位提示文字。
   *
   * ⚠ 初始化时读取，运行时变更不响应：WangEditor V5 不暴露热更新 placeholder API，
   * 如需动态切换可通过 `<RichTextEditor v-if="show" />` 重建组件。
   */
  placeholder?: string
  /**
   * 是否只读。
   *
   * ⚠ 初始化时读取，运行时变更不响应：同上，需通过 v-if 重建组件实现动态只读切换。
   */
  readOnly?: boolean
  /**
   * 自定义图片上传函数：接收 File 返回 Promise<{ url, alt? }>
   *
   * 不传则禁用图片上传菜单（用户点上传会被 ElMessage 警告）
   */
  uploadApi?: (file: File) => Promise<UploadResult>
  /**
   * 工具栏要排除的菜单 key 列表。
   *
   * 默认 `['uploadVideo']`（本组件只封装图片上传场景）。
   * 完整可用 key 见 https://www.wangeditor.com/v5/toolbar-config.html#excludekeys
   *
   * ⚠ 初始化时读取，运行时变更不响应（同 placeholder 限制）。
   */
  toolbarExcludeKeys?: string[]
  /**
   * 工具栏要包含的菜单 key 列表（白名单模式）。
   *
   * 不传则显示 WangEditor 默认全部菜单。
   * 与 `toolbarExcludeKeys` 互斥，同时设置时 `toolbarKeys` 优先生效。
   *
   * ⚠ 初始化时读取，运行时变更不响应。
   */
  toolbarKeys?: string[]
}

/**
 * RichTextEditor Emits
 *
 * - update:modelValue：v-model 同步事件，emit 的是 DOMPurify 清洗后的 HTML
 */
export type RichTextEditorEmits = {
  /**  v-model 同步：emit 清洗后的 HTML */
  'update:modelValue': [html: string]
}
