/**
 * TableHeader 组件单元测试（spec §十测试覆盖矩阵）
 *
 * 覆盖场景：
 * 1) 点击刷新按钮触发 refresh 事件
 * 2) 点击列设置按钮触发 update:colSettingVisible
 * 3) 渲染 tableHeader 和 toolButton 插槽
 * 4) 刷新/全屏/密度 3 个 icon 按钮同属 __actions 容器（v3.5 起密度改为 ElDropdown，
 *    触发器被包一层 wrapper div，故用 closest 断言祖先归属而非直接子元素；
 *    __actions 间距由 flex gap 实现，不再依赖相邻兄弟选择器）
 * 5) 2026-09-18：toolbar 配置渲染（ToolbarRenderer 挂载）+ tableHeader slot 作用域下发 ToolbarCtx
 *
 * @group ProTable 子组件测试
 */
import { describe, it, expect, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { ElDropdown } from 'element-plus' // v3.5：密度下拉 command 事件直发断言（VTU 不渲染 teleport 菜单内容）
import TableHeader from './TableHeader.vue'
import ToolbarRenderer from './ToolbarRenderer.vue'
import type { ToolbarCtx } from '../types'

/** 2026-09-18：toolbarCtx 为必填 prop，构造最小上下文 */
function makeCtx(overrides: Partial<ToolbarCtx> = {}): ToolbarCtx {
  return { selectedRows: [], selectedCount: 0, loading: false, refresh: vi.fn(), ...overrides }
}

function mountHeader(props: Record<string, unknown>, slots?: Record<string, string>) {
  return mount(TableHeader, {
    props: {
      columns: [],
      visibleColumns: [],
      density: 'default',
      colSettingVisible: false,
      toolbarCtx: makeCtx(),
      ...props,
    },
    ...(slots ? { slots } : {}),
  })
}

describe('TableHeader', () => {
  it('点击刷新按钮触发 refresh 事件', async () => {
    const wrapper = mountHeader({})
    await wrapper.find('[data-test="refresh-btn"]').trigger('click')
    expect(wrapper.emitted('refresh')).toBeTruthy()
  })

  it('点击列设置按钮触发 update:colSettingVisible', async () => {
    const wrapper = mountHeader({ columns: [{ prop: 'a', label: 'A' }] })
    await wrapper.find('[data-test="col-setting-btn"]').trigger('click')
    expect(wrapper.emitted('update:colSettingVisible')).toBeTruthy()
  })

  it('渲染 tableHeader 和 toolButton 插槽', () => {
    const wrapper = mountHeader(
      {},
      {
        tableHeader: '<div class="custom-header">MyTable</div>',
        toolButton: '<button class="custom-btn">Export</button>',
      }
    )
    expect(wrapper.find('.custom-header').exists()).toBe(true)
    expect(wrapper.find('.custom-btn').exists()).toBe(true)
  })

  it('v3.5：选择密度菜单项触发 update:density；非法 command 被丢弃', async () => {
    const wrapper = mountHeader({})
    // VTU 不渲染 teleport 菜单内容，直接向 ElDropdown 直发 command 事件（与点击菜单项等价）
    wrapper.findComponent(ElDropdown).vm.$emit('command', 'compact')
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('update:density')?.[0]).toEqual(['compact'])
    // handleDensityCommand 守卫：非三档枚举值静默丢弃（防御未来菜单项误配）
    wrapper.findComponent(ElDropdown).vm.$emit('command', 'not-a-density')
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('update:density')).toHaveLength(1)
  })

  it('刷新/全屏/密度 3 按钮同属 __actions 容器（v3.5 密度改下拉后仍归组）', () => {
    const wrapper = mountHeader({ fullscreen: false })
    const actionsEl = wrapper.find('.vv-pro-table-header__actions')
    expect(actionsEl.exists()).toBe(true)
    // 刷新/全屏：ElTooltip 经 el-only-child 透传，是 __actions 直接子元素
    expect(wrapper.find('[data-test="refresh-btn"]').element.parentElement).toBe(actionsEl.element)
    expect(wrapper.find('[data-test="fullscreen-btn"]').element.parentElement).toBe(
      actionsEl.element
    )
    // 密度：ElDropdown 给触发器包一层 wrapper div，密度按钮非直接子元素，
    // 用 closest 断言祖先归属（flex gap 间距对 wrapper 混合布局免疫）
    const densityWrapper = wrapper.find('[data-test="density-btn"]').element.closest('div')
    expect(densityWrapper?.parentElement).toBe(actionsEl.element)
    // 列设置按钮不在 __actions 组内（组间由 __right gap 分隔）
    expect(wrapper.find('[data-test="col-setting-btn"]').element.parentElement).not.toBe(
      actionsEl.element
    )
  })

  it('2026-09-18：toolbar 配置渲染 ToolbarRenderer，slot 作用域下发 ToolbarCtx', () => {
    setActivePinia(createPinia())
    const wrapper = mountHeader(
      { toolbar: [{ label: '新增', onClick: vi.fn() }] },
      {
        tableHeader:
          '<template #tableHeader="{ selectedCount }"><i class="scope-count">{{ selectedCount }}</i></template>',
      }
    )
    expect(wrapper.findComponent(ToolbarRenderer).exists()).toBe(true)
    expect(wrapper.text()).toContain('新增')
    expect(wrapper.find('.scope-count').text()).toBe('0')
  })

  // ─────────── v3.5 PR1-A：A11y toolbar + 4 个 icon 按钮 aria-label ───────────

  it('v3.5：根 div 加 role="toolbar" + aria-label="表格工具栏"', () => {
    const wrapper = mountHeader({})
    const root = wrapper.find('.vv-pro-table-header')
    expect(root.exists()).toBe(true)
    expect(root.attributes('role')).toBe('toolbar')
    expect(root.attributes('aria-label')).toBe('表格工具栏')
  })

  it('v3.5：刷新按钮 aria-label="刷新表格"', () => {
    const wrapper = mountHeader({})
    expect(wrapper.find('[data-test="refresh-btn"]').attributes('aria-label')).toBe('刷新表格')
  })

  it('v3.5：全屏按钮 aria-label 切换（进入/退出全屏） + aria-pressed', async () => {
    const wrapper = mountHeader({ fullscreen: false })
    expect(wrapper.find('[data-test="fullscreen-btn"]').attributes('aria-label')).toBe('进入全屏')
    // aria-pressed=false
    expect(wrapper.find('[data-test="fullscreen-btn"]').attributes('aria-pressed')).toBe('false')
    // 点击触发 toggleFullscreen（实际切换由编排层 useFullscreen 执行）
    await wrapper.find('[data-test="fullscreen-btn"]').trigger('click')
    expect(wrapper.emitted('toggleFullscreen')).toBeTruthy()
  })

  it('v3.5：列设置按钮 aria-label="打开列设置"', () => {
    const wrapper = mountHeader({ colSettingVisible: false })
    const btn = wrapper.find('[data-test="col-setting-btn"]')
    expect(btn.attributes('aria-label')).toBe('打开列设置')
  })

  it('v3.5：密度触发按钮 aria-label；菜单项带档位 aria-label 且当前项 ✓', async () => {
    const wrapper = mountHeader({ density: 'default' })
    const trigger = wrapper.find('[data-test="density-btn"]')
    expect(trigger.attributes('aria-label')).toBe('切换表格密度')
    // trigger aria-haspopup / aria-expanded 由 EP ElDropdown 自动注入（不手写，避免与 EP 冲突）
    // 点击触发钮展开下拉（EP trigger="click"）；菜单 teleport 到 body 且 jsdom 下 popper DOM
    // 跨用例残留，须用 data-test 限定到本组件实例再查（避免误选中其他测试的菜单项）
    await trigger.trigger('click')
    await wrapper.vm.$nextTick()
    const menu = document.body.querySelector<HTMLElement>('[data-test="density-menu"]')
    expect(menu).not.toBeNull()
    const items = Array.from(menu?.querySelectorAll<HTMLElement>('.el-dropdown-menu__item') ?? [])
    expect(items).toHaveLength(3)
    expect(items[0]?.getAttribute('aria-label')).toBe('切换表格密度为紧凑')
    expect(items[1]?.getAttribute('aria-label')).toBe('切换表格密度为默认')
    expect(items[2]?.getAttribute('aria-label')).toBe('切换表格密度为宽松')
    // 当前密度 default：菜单文本带 ✓ 标记
    expect(items[1]?.textContent).toContain('✓')
    expect(items[0]?.textContent).not.toContain('✓')
  })
})
