/**
 * RichTextEditor 单元测试 —— 聚焦本组件的封装契约：
 * v-model 双向清洗（DOMPurify）、watch 防循环、卸载 destroy、uploadApi 接管上传
 *
 * 不测 wangEditor 真实实例：jsdom 不完整支持 Selection/Range/MutationObserver，
 * 真实编辑器初始化不确定（项目 memory：wangEditor V5 toolbar 依赖 selectionchange，
 * 程序化 Selection API 不触发）。因此 stub 掉 Editor/Toolbar，用 fake editor 驱动本组件逻辑。
 */
import { mount, type VueWrapper } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IDomEditor } from '@wangeditor/editor'
import { ElMessage } from 'element-plus'
import RichTextEditor from './RichTextEditor.vue'
import type { RichTextEditorProps, UploadResult } from './types'

/**
 * fake editor —— 只实现本组件触碰的 3 个方法。
 * 用 vi.hoisted 提升：vi.mock 工厂在文件顶部执行时就要引用它。
 */
const fakeEditor = vi.hoisted(() => ({
  getHtml: vi.fn((): string => ''),
  setHtml: vi.fn(),
  destroy: vi.fn(),
}))

// stub 必须在 vi.mock 工厂内部定义（mock 会被提升到文件顶部，引用外层顶层变量会 TDZ 报错）
vi.mock('@wangeditor/editor-for-vue', async () => {
  const { defineComponent, h, onMounted } = await import('vue')
  const EditorStub = defineComponent({
    name: 'EditorStub',
    props: {
      defaultHtml: { type: String, default: '' },
      defaultConfig: { type: Object, default: () => ({}) },
      mode: { type: String, default: 'default' },
    },
    emits: ['onCreated', 'onChange'],
    setup(_props, { emit }) {
      // onCreated 把 fake editor 交给组件（handleCreated 缓存到 editorRef）
      onMounted(() => emit('onCreated', fakeEditor as unknown as IDomEditor))
      return () => h('div', { class: 'editor-stub' })
    },
  })
  const ToolbarStub = defineComponent({
    name: 'ToolbarStub',
    setup() {
      return () => h('div', { class: 'toolbar-stub' })
    },
  })
  return { Editor: EditorStub, Toolbar: ToolbarStub }
})

// ElMessage 在 jsdom 里创建真实 DOM 节点，mock 成 spy 专注断言调用
vi.mock('element-plus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('element-plus')>()
  return {
    ...actual,
    ElMessage: { warning: vi.fn(), error: vi.fn() },
  }
})

function mountEditor(props: Partial<RichTextEditorProps> = {}) {
  return mount(RichTextEditor, {
    props: { modelValue: '<p>初始</p>', ...props },
    global: { stubs: { transition: false } },
  })
}

/** 从 Editor stub 的 defaultConfig 里取 uploadImage.customUpload（组件内部注册的钩子） */
function getCustomUpload(wrapper: VueWrapper) {
  const editorStub = wrapper.findComponent({ name: 'EditorStub' })
  const config = editorStub.props('defaultConfig') as {
    MENU_CONF: { uploadImage: { customUpload: (...args: unknown[]) => Promise<void> } }
  }
  return config.MENU_CONF.uploadImage.customUpload
}

describe('RichTextEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fakeEditor.getHtml.mockReturnValue('<p>编辑器当前</p>')
  })

  it('挂载渲染 toolbar + editor 容器，初始内容走 default-html', () => {
    const wrapper = mountEditor({ modelValue: '<p>hello</p>' })

    expect(wrapper.find('.vv-rich-text-editor').exists()).toBe(true)
    expect(wrapper.find('.toolbar-stub').exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'EditorStub' }).props('defaultHtml')).toBe('<p>hello</p>')
  })

  it('onChange 时 emit DOMPurify 清洗后的 HTML（script 被剔除）', async () => {
    const wrapper = mountEditor()
    fakeEditor.getHtml.mockReturnValue('<p>安全</p><script>alert(1)</script>')

    wrapper.findComponent({ name: 'EditorStub' }).vm.$emit('onChange', fakeEditor)
    await wrapper.vm.$nextTick()

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toHaveLength(1)
    expect(emitted?.[0]?.[0]).toContain('<p>安全</p>')
    expect(emitted?.[0]?.[0]).not.toContain('script')
  })

  it('外部 prop 变化且与编辑器当前 HTML 不同 → setHtml(sanitize 后内容)', async () => {
    const wrapper = mountEditor()
    // 编辑器内部是"脏 HTML"，与外部值不同 → 触发回写
    fakeEditor.getHtml.mockReturnValue('<p>旧内容</p>')

    await wrapper.setProps({ modelValue: '<script>x</script><p>新内容</p>' })

    expect(fakeEditor.setHtml).toHaveBeenCalledTimes(1)
    expect(fakeEditor.setHtml).toHaveBeenCalledWith('<p>新内容</p>')
  })

  it('防循环：外部值 sanitize 后 === 编辑器当前 HTML → 不重复 setHtml', async () => {
    const wrapper = mountEditor()
    // 模拟编辑器已被 setHtml 清洗过的状态（editor.getHtml 返回干净 HTML）
    fakeEditor.getHtml.mockReturnValue('<p>同内容</p>')

    await wrapper.setProps({ modelValue: '<p>同内容</p>' })

    expect(fakeEditor.setHtml).not.toHaveBeenCalled()
  })

  it('onChange 视觉为空（wangEditor 占位段落 <p><br></p>）→ emit 空字符串', async () => {
    // wangEditor V5 编辑器清空后 getHtml() 永远返回 <p><br></p> 占位段落作为光标容器。
    // 业务方用 rules:'required' 校验时，<p><br></p> 会被误识别为「已填」——此处映射为 ''
    const wrapper = mountEditor()
    fakeEditor.getHtml.mockReturnValue('<p><br></p>')

    wrapper.findComponent({ name: 'EditorStub' }).vm.$emit('onChange', fakeEditor)
    await wrapper.vm.$nextTick()

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toHaveLength(1)
    expect(emitted?.[0]?.[0]).toBe('')
  })

  it('onChange 内容仅含 &nbsp; / <br> 占位符 → emit 空字符串', async () => {
    // 边界：用户连续输入空格或 Backspace 删到只剩 &nbsp; 占位——同样视为「视觉为空」
    const wrapper = mountEditor()
    fakeEditor.getHtml.mockReturnValue('<p>&nbsp;&nbsp;&nbsp;</p>')

    wrapper.findComponent({ name: 'EditorStub' }).vm.$emit('onChange', fakeEditor)
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('update:modelValue')?.[0]?.[0]).toBe('')
  })

  it("外部 prop 置空 + 编辑器当前非空 → setHtml('') 清空", async () => {
    // reset / 加载空默认值场景：父组件 modelValue 变 ''，编辑器内仍有旧内容需要清空
    const wrapper = mountEditor({ modelValue: '<p>已有内容</p>' })
    fakeEditor.getHtml.mockReturnValue('<p>编辑器旧内容</p>')

    await wrapper.setProps({ modelValue: '' })

    expect(fakeEditor.setHtml).toHaveBeenCalledTimes(1)
    expect(fakeEditor.setHtml).toHaveBeenCalledWith('')
  })

  it('外部 prop 置空 + 编辑器已视觉为空 → 跳过 setHtml（防循环）', async () => {
    // 编辑器内部已是 <p><br></p> 占位段落 → isVisualEmpty(editor.getHtml()) 为 true，
    // 无需再次 setHtml('')（setHtml 后 getHtml() 仍可能是占位段落，会与 isVisualEmpty emit('') 形成循环）
    const wrapper = mountEditor({ modelValue: '<p>初始</p>' })
    fakeEditor.getHtml.mockReturnValue('<p><br></p>')

    await wrapper.setProps({ modelValue: '' })

    expect(fakeEditor.setHtml).not.toHaveBeenCalled()
  })

  it('上传成功：customUpload 调 uploadApi 后 insertFn 插入返回的 url/alt/href', async () => {
    const uploadApi = vi.fn<(file: File) => Promise<UploadResult>>().mockResolvedValue({
      url: 'https://oss.example.com/a.png',
      alt: '截图',
    })
    const wrapper = mountEditor({ uploadApi })
    const insertFn = vi.fn()

    const customUpload = getCustomUpload(wrapper)
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    await customUpload(file, insertFn)

    expect(uploadApi).toHaveBeenCalledWith(file)
    // insertFn 三参：src / alt / href——href 复用图片地址便于点击查看原图
    expect(insertFn).toHaveBeenCalledWith(
      'https://oss.example.com/a.png',
      '截图',
      'https://oss.example.com/a.png'
    )
    expect(ElMessage.error).not.toHaveBeenCalled()
  })

  it('未传 uploadApi：customUpload 警告并 return，insertFn 不被调用', async () => {
    const wrapper = mountEditor()
    const insertFn = vi.fn()

    const customUpload = getCustomUpload(wrapper)
    await customUpload(new File(['x'], 'a.png'), insertFn)

    expect(ElMessage.warning).toHaveBeenCalledTimes(1)
    expect(insertFn).not.toHaveBeenCalled()
  })

  it('上传失败：customUpload catch 后 ElMessage.error，insertFn 不被调用', async () => {
    const uploadApi = vi
      .fn<(file: File) => Promise<UploadResult>>()
      .mockRejectedValue(new Error('OSS 上传失败（模拟）'))
    const wrapper = mountEditor({ uploadApi })
    const insertFn = vi.fn()

    const customUpload = getCustomUpload(wrapper)
    await customUpload(new File(['x'], 'a.png'), insertFn)

    expect(ElMessage.error).toHaveBeenCalledTimes(1)
    expect(insertFn).not.toHaveBeenCalled()
  })

  it('卸载时 destroy 编辑器，释放 DOM 监听器', () => {
    const wrapper = mountEditor()

    wrapper.unmount()

    expect(fakeEditor.destroy).toHaveBeenCalledTimes(1)
  })

  // ===== defineExpose 命令式 API =====

  it('getEditor() 返回底层 IDomEditor 实例', () => {
    const wrapper = mountEditor()

    const vm = wrapper.vm as unknown as {
      getEditor: () => unknown
    }

    expect(vm.getEditor()).toBe(fakeEditor)
  })

  it('focus() / blur() 调用底层 editor API', () => {
    // fake editor 注入 focus/blur 桩以便断言
    const focusSpy = vi.fn()
    const blurSpy = vi.fn()
    const wrapper = mountEditor()
    fakeEditor.focus = focusSpy
    fakeEditor.blur = blurSpy

    const vm = wrapper.vm as unknown as {
      focus: () => void
      blur: () => void
    }

    vm.focus()
    vm.blur()

    expect(focusSpy).toHaveBeenCalledTimes(1)
    expect(blurSpy).toHaveBeenCalledTimes(1)
  })

  it('getHtml() 返回编辑器当前 HTML（editor 未就绪时降级为空串）', () => {
    const wrapper = mountEditor()
    fakeEditor.getHtml.mockReturnValue('<p>当前内容</p>')

    const vm = wrapper.vm as unknown as { getHtml: () => string }

    expect(vm.getHtml()).toBe('<p>当前内容</p>')
  })

  it('setHtml() 走 DOMPurify 清洗后调用底层 setHtml', () => {
    // 暴露的 setHtml 走 sanitize 闸门，防止脏 HTML 直接进入编辑器 DOM
    const wrapper = mountEditor()

    const vm = wrapper.vm as unknown as { setHtml: (html: string) => void }
    vm.setHtml('<script>x</script><p>新内容</p>')

    expect(fakeEditor.setHtml).toHaveBeenCalledWith('<p>新内容</p>')
  })

  it('unmount 后命令式 API 安全降级（不抛错）', () => {
    // editorRef.value 在 onBeforeUnmount 中已被置 null，
    // 调用暴露的命令式 API 不应崩，应通过可选链短路
    const wrapper = mountEditor()
    wrapper.unmount()

    const vm = wrapper.vm as unknown as {
      focus: () => void
      blur: () => void
      getHtml: () => string
      setHtml: (html: string) => void
    }

    expect(() => vm.focus()).not.toThrow()
    expect(() => vm.blur()).not.toThrow()
    expect(vm.getHtml()).toBe('')
    expect(() => vm.setHtml('<p>x</p>')).not.toThrow()
  })
})
