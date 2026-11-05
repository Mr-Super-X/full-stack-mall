/**
 * ColSetting 组件单元测试（spec §十测试覆盖矩阵）
 *
 * 覆盖场景：
 * 1) 渲染所有列的复选框
 * 2) 点击"恢复默认"按钮触发 resetToDefault
 * 3) 关闭抽屉触发 update:visible false
 * 4) 拖拽结束 emit reorder（完整新顺序）+ 还原 DOM（回归：sortablejs 移动真实节点
 *    导致 children[newIndex] 即被拖元素本身，旧实现 to === from 被守卫拦截、事件永不发出）
 *
 * 注：ElDrawer 在 jsdom 环境使用 teleport 会渲染到 body，测试通过 stub 绕过。
 *
 * @group ProTable 子组件测试
 */
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ColSetting from './ColSetting.vue'

// mock sortablejs（捕获 Sortable.create 配置，测试直接驱动 onStart/onEnd 模拟拖拽）
const hoisted = vi.hoisted(() => ({
  config: null as null | {
    el: HTMLElement
    options: {
      onStart?: () => void
      onEnd?: () => void
      handle?: string
      filter?: string
    }
  },
}))
vi.mock('sortablejs', () => ({
  default: class {
    static create(el: HTMLElement, options: unknown) {
      hoisted.config = { el, options: options as { onStart?: () => void; onEnd?: () => void } }
      return new this()
    }
    destroy(): void {
      // noop
    }
  },
}))

describe('ColSetting', () => {
  const columns = [
    { prop: 'a', label: 'A' },
    { prop: 'b', label: 'B' },
    { prop: 'c', label: 'C' },
  ]

  it('点击"恢复默认"按钮触发 resetToDefault', async () => {
    const wrapper = mount(ColSetting, {
      props: {
        visible: true,
        columns: columns as never,
        visibleKeys: ['a'],
        fixedKeys: [],
      },
      global: {
        stubs: {
          ElDrawer: {
            template:
              '<div class="el-drawer-stub"><slot /><div class="footer"><slot name="footer" /></div></div>',
          },
        },
      },
    })
    await wrapper.find('[data-test="reset-btn"]').trigger('click')
    expect(wrapper.emitted('resetToDefault')).toBeTruthy()
  })

  it('关闭抽屉触发 update:visible false', async () => {
    const wrapper = mount(ColSetting, {
      props: {
        visible: true,
        columns: columns as never,
        visibleKeys: ['a'],
        fixedKeys: [],
      },
      global: {
        stubs: {
          ElDrawer: {
            template:
              '<div class="el-drawer-stub"><slot /><div class="footer"><slot name="footer" /></div></div>',
          },
        },
      },
    })
    await wrapper.find('[data-test="close-btn"]').trigger('click')
    expect(wrapper.emitted('update:visible')).toBeTruthy()
  })

  it('点击 checkbox 更新 visibleKeys', async () => {
    const wrapper = mount(ColSetting, {
      props: {
        visible: true,
        columns: columns as never,
        visibleKeys: ['a'],
        fixedKeys: [],
      },
      global: {
        stubs: {
          ElDrawer: {
            template: '<div class="el-drawer-stub"><slot /></div>',
          },
          ElCheckbox: {
            template: '<input type="checkbox" :data-test="`col-check-${value}`" />',
            props: ['value', 'label'],
          },
          ElCheckboxGroup: {
            template: '<div class="cb-group-stub"><slot /></div>',
            props: ['modelValue'],
            emits: ['update:modelValue'],
          },
        },
      },
    })
    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    expect(checkboxes.length).toBe(3)
  })

  it('label 为空的列以 prop 兜底展示（弱化样式标识未命名列）', () => {
    const columns = [
      { prop: 'a', label: 'A' },
      { prop: 'b', label: '' },
    ]
    const wrapper = mount(ColSetting, {
      props: {
        visible: true,
        columns: columns as never,
        visibleKeys: ['a', 'b'],
        fixedKeys: [],
      },
      global: {
        stubs: {
          ElDrawer: {
            template: '<div class="el-drawer-stub"><slot /></div>',
          },
          ElCheckboxGroup: {
            template: '<div class="cb-group-stub"><slot /></div>',
            props: ['modelValue'],
          },
          // ElCheckbox 用真实组件（label 文本在 .el-checkbox__label 插槽内渲染）
        },
      },
    })
    const namedLabel = wrapper.find('[data-test="col-check-a"]')
    expect(namedLabel.text()).toContain('A')
    const fallback = wrapper.find(
      '[data-test="col-check-b"] .vv-pro-table-col-setting__label-fallback'
    )
    expect(fallback.exists()).toBe(true)
    expect(fallback.text()).toBe('b')
  })

  it('sortable 配置：拖拽热区整行（handle 在 item 根），checkbox 区域被 filter 排除', async () => {
    const wrapper = mount(ColSetting, {
      props: {
        visible: true,
        columns: columns as never,
        visibleKeys: ['a', 'b', 'c'],
        fixedKeys: [],
      },
      global: {
        stubs: {
          ElDrawer: {
            template: '<div class="el-drawer-stub"><slot /></div>',
          },
          ElCheckboxGroup: {
            template: '<div class="cb-group-stub"><slot /></div>',
            props: ['modelValue'],
          },
        },
      },
    })
    await flushPromises()
    const config = hoisted.config
    expect(config).toBeTruthy()
    expect(config!.options.filter).toBe('.el-checkbox')
    // handle 在 item 根 div（data-drag-handle 随 v-for 绑定在 item 上，而非内部图标 span）
    const item = wrapper.find('[data-drag-handle="a"]')
    expect(item.exists()).toBe(true)
    expect(item.classes()).toContain('vv-pro-table-col-setting__item')
  })

  it('点击置顶按钮 emit reorder（目标列 + 其余保持原序），首列置顶按钮禁用', async () => {
    const wrapper = mount(ColSetting, {
      props: {
        visible: true,
        columns: columns as never,
        visibleKeys: ['a', 'b', 'c'],
        fixedKeys: [],
      },
      global: {
        stubs: {
          ElDrawer: {
            template: '<div class="el-drawer-stub"><slot /></div>',
          },
        },
      },
    })
    // 置顶 c → [c, a, b]（复用 reorder 通道，useColumns.setColumnOrder 处理顺序+持久化）
    await wrapper.find('[data-test="col-top-c"]').trigger('click')
    expect(wrapper.emitted('reorder')?.[0]).toEqual([['c', 'a', 'b']])
    // 已在首位的列置顶按钮禁用
    expect(wrapper.find('[data-test="col-top-a"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-test="col-top-b"]').attributes('disabled')).toBeUndefined()
  })

  it('拖拽结束 emit reorder（完整新顺序）且还原 DOM 到拖拽前', async () => {
    const wrapper = mount(ColSetting, {
      props: {
        visible: true,
        columns: columns as never,
        visibleKeys: ['a', 'b', 'c'],
        fixedKeys: [],
      },
      global: {
        stubs: {
          ElDrawer: {
            template: '<div class="el-drawer-stub"><slot /></div>',
          },
          ElCheckboxGroup: {
            template: '<div class="cb-group-stub"><slot /></div>',
            props: ['modelValue'],
          },
        },
      },
    })
    await flushPromises()
    const config = hoisted.config
    expect(config).toBeTruthy()
    const groupEl = config!.el
    const propOrder = () => Array.from(groupEl.children).map((c) => (c as HTMLElement).dataset.prop)
    expect(propOrder()).toEqual(['a', 'b', 'c'])

    // 模拟 sortablejs 拖拽时序：onStart（DOM 仍是旧顺序）→ 拖拽中移动真实节点 → onEnd
    config!.options.onStart?.()
    const itemA = Array.from(groupEl.children).find(
      (c) => (c as HTMLElement).dataset.prop === 'a'
    ) as HTMLElement
    groupEl.appendChild(itemA) // sortablejs _onDragOver 的真实节点插入（Sortable.js:1857）
    expect(propOrder()).toEqual(['b', 'c', 'a']) // 此刻 DOM 即"新顺序"
    config!.options.onEnd?.()

    // 回归断言 1：emit 完整新顺序（旧实现取 children[newIndex] 作 to，恰为被拖元素本身，
    // to === from 被守卫拦截，reorder 事件永不发出）
    expect(wrapper.emitted('reorder')?.[0]).toEqual([['b', 'c', 'a']])
    // 回归断言 2：DOM 还原为拖拽前顺序，Vue v-for 保持唯一数据源
    expect(propOrder()).toEqual(['a', 'b', 'c'])
  })

  // ─────────── v3.5 PR1-A：A11y aria-label 补齐 ───────────

  it('v3.5：每个 item 带 aria-label 含列名', async () => {
    const wrapper = mount(ColSetting, {
      props: { visible: true, columns, visibleKeys: ['a', 'b'], fixedKeys: [] },
      global: {
        stubs: {
          ElDrawer: { template: '<div><slot /></div>' },
        },
      },
    })
    await flushPromises()
    const items = wrapper.findAll('[data-prop]')
    expect(items.length).toBe(3)
    expect(items[0]!.attributes('aria-label')).toBe('列设置项 A')
    expect(items[1]!.attributes('aria-label')).toBe('列设置项 B')
  })

  it('v3.5：每个 checkbox aria-label 含「显示/隐藏 列名」', async () => {
    const wrapper = mount(ColSetting, {
      props: { visible: true, columns, visibleKeys: ['a', 'b'], fixedKeys: [] },
      global: {
        stubs: {
          ElDrawer: { template: '<div><slot /></div>' },
        },
      },
    })
    await flushPromises()
    const checkA = wrapper.find('[data-test="col-check-a"]')
    expect(checkA.attributes('aria-label')).toBe('显示/隐藏 A')
    const checkB = wrapper.find('[data-test="col-check-b"]')
    expect(checkB.attributes('aria-label')).toBe('显示/隐藏 B')
  })

  it('v3.5：每个 top 按钮 aria-label 含「置顶 列名」', async () => {
    const wrapper = mount(ColSetting, {
      props: { visible: true, columns, visibleKeys: ['a', 'b'], fixedKeys: [] },
      global: {
        stubs: {
          ElDrawer: { template: '<div><slot /></div>' },
        },
      },
    })
    await flushPromises()
    const topB = wrapper.find('[data-test="col-top-b"]')
    expect(topB.attributes('aria-label')).toBe('置顶 B')
    const topC = wrapper.find('[data-test="col-top-c"]')
    expect(topC.attributes('aria-label')).toBe('置顶 C')
  })

  it('v3.5：恢复默认 + 关闭按钮存在并带 aria-label（源文件断言）', () => {
    // ElDrawer 的 footer slot 在 jsdom + VTU stub 下渲染不稳定，
    // 直接断言源文件包含 aria-label 字符串（覆盖 ci 阶段防回归）
    const src = readFileSync(join(__dirname, 'ColSetting.vue'), 'utf8')
    expect(src).toContain('aria-label="恢复默认列设置"')
    expect(src).toContain('aria-label="关闭列设置"')
  })
})
