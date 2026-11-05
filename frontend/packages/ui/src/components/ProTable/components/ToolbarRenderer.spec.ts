/**
 * ToolbarRenderer 组件单元测试（spec 2026-09-18 §3.5 测试矩阵）
 *
 * 覆盖场景：
 * 1) 按配置渲染直出按钮（label / 数量）
 * 2) perm 权限过滤（string / string[] AND 语义 / 无权限剔除）
 * 3) hidden 布尔与 ctx 函数形态（selectedCount 联动）
 * 4) disabled 布尔与 ctx 函数形态（按钮 disabled 属性）
 * 5) confirm 调用链：确定执行 onClick，取消不执行（mock useConfirm）
 * 6) 折叠截断：超出 maxVisible 收进「更多」dropdown，command 触发 onClick
 * 7) children 拍平参与折叠计数 + 子级 perm 过滤
 * 8) 多 primary warn 一次
 * 9) onClick 接收 ctx（编排层聚合的上下文原样透传）
 *
 * useConfirm 走 vi.mock（关注点分离：本组件只测「调没调/返回值分支」）；
 * useAuth 走真实 pinia（setActivePinia + permissions state 直写）。
 *
 * @group ProTable 子组件测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { ElDropdown } from 'element-plus'
import ToolbarRenderer from './ToolbarRenderer.vue'
import type { ToolbarAction, ToolbarCtx } from '../types'
import { useUserStore } from '@vv/shared'
import { useConfirm } from '../../../composables/useConfirm.ts'

vi.mock('@/composables/useConfirm', () => ({ useConfirm: vi.fn() }))

const confirmMock = vi.mocked(useConfirm)

/** 构造 ctx（selectedRows 用空数组默认值，按需覆盖） */
function makeCtx(overrides: Partial<ToolbarCtx> = {}): ToolbarCtx {
  return { selectedRows: [], selectedCount: 0, loading: false, refresh: vi.fn(), ...overrides }
}

/** 简洁 action 工厂 */
function makeAction(overrides: Partial<ToolbarAction> = {}): ToolbarAction {
  return { label: '按钮', onClick: vi.fn(), ...overrides }
}

function mountRenderer(actions: ToolbarAction[], ctx = makeCtx(), maxVisible?: number) {
  return mount(ToolbarRenderer, {
    props: { actions, ctx, ...(maxVisible !== undefined ? { maxVisible } : {}) },
  })
}

describe('ToolbarRenderer', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    confirmMock.mockReset()
  })

  it('按配置渲染直出按钮', () => {
    const wrapper = mountRenderer([makeAction({ label: '新增' }), makeAction({ label: '导出' })])
    const buttons = wrapper.findAll('button')
    expect(buttons.some((b) => b.text().includes('新增'))).toBe(true)
    expect(buttons.some((b) => b.text().includes('导出'))).toBe(true)
  })

  it('perm 过滤：无权限不渲染，有权限渲染（AND 数组需全部满足）', () => {
    useUserStore().permissions = ['user:add']
    const wrapper = mountRenderer([
      makeAction({ label: '有权限', perm: 'user:add' }),
      makeAction({ label: '无权限', perm: 'user:delete' }),
      makeAction({ label: '数组部分满足', perm: ['user:add', 'user:delete'] }),
      makeAction({ label: '数组全满足', perm: ['user:add'] }),
    ])
    const text = wrapper.text()
    expect(text).toContain('有权限')
    expect(text).not.toContain('无权限')
    expect(text).not.toContain('数组部分满足')
    expect(text).toContain('数组全满足')
  })

  it('hidden 支持布尔与 ctx 函数（selectedCount 联动）', () => {
    const wrapper = mountRenderer(
      [
        makeAction({ label: '布尔隐藏', hidden: true }),
        makeAction({ label: '函数隐藏', hidden: ({ selectedCount }) => selectedCount === 0 }),
        makeAction({ label: '函数显示', hidden: ({ selectedCount }) => selectedCount > 0 }),
      ],
      makeCtx({ selectedCount: 0 })
    )
    const text = wrapper.text()
    expect(text).not.toContain('布尔隐藏')
    expect(text).not.toContain('函数隐藏')
    expect(text).toContain('函数显示')
  })

  it('disabled 支持 ctx 函数：selectedCount=0 时批量按钮禁用', () => {
    const wrapper = mountRenderer(
      [makeAction({ label: '批量删除', disabled: ({ selectedCount }) => selectedCount === 0 })],
      makeCtx({ selectedCount: 0 })
    )
    const btn = wrapper.find('button')
    expect(btn.attributes('disabled')).toBeDefined()
  })

  it('confirm：确定执行 onClick，取消不执行', async () => {
    const onClick = vi.fn()
    // 第一次确定、第二次取消
    confirmMock.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    const actions = [makeAction({ label: '删除', confirm: '确定删除吗？', onClick })]

    const wrapper1 = mountRenderer(actions)
    await wrapper1.find('button').trigger('click')
    expect(confirmMock).toHaveBeenCalledWith('确定删除吗？')
    expect(onClick).toHaveBeenCalledTimes(1)

    const wrapper2 = mountRenderer(actions)
    await wrapper2.find('button').trigger('click')
    expect(onClick).toHaveBeenCalledTimes(1) // 取消后仍只调用 1 次
  })

  it('折叠截断：超出 maxVisible 收进「更多」，command 触发 onClick', async () => {
    const onOverflowClick = vi.fn()
    const wrapper = mountRenderer(
      [
        makeAction({ label: 'A' }),
        makeAction({ label: 'B' }),
        makeAction({ label: 'C', onClick: onOverflowClick }),
      ],
      makeCtx(),
      2
    )
    // 直出 2 个 + 「更多」1 个
    expect(wrapper.findAll('button')).toHaveLength(3)
    expect(wrapper.text()).toContain('更多')
    // dropdown 内容在 teleported popper 中（VTU mount 不渲染 teleport 内容），
    // 直接经 ElDropdown 的 command 事件模拟溢出项点击
    const dropdown = wrapper.findComponent(ElDropdown)
    const overflowAction = (wrapper.props('actions') as ToolbarAction[])[2]
    dropdown.vm.$emit('command', overflowAction)
    await wrapper.vm.$nextTick()
    expect(onOverflowClick).toHaveBeenCalledTimes(1)
  })

  it('children 拍平参与折叠计数，子级 perm 独立过滤', () => {
    useUserStore().permissions = ['user:add']
    const wrapper = mountRenderer(
      [
        makeAction({
          label: '父',
          children: [
            makeAction({ label: '子有权限', perm: 'user:add' }),
            makeAction({ label: '子无权限', perm: 'user:delete' }),
          ],
        }),
      ],
      makeCtx()
    )
    const text = wrapper.text()
    // 父 + 拍平子项（无权限子项剔除）
    expect(text).toContain('父')
    expect(text).toContain('子有权限')
    expect(text).not.toContain('子无权限')
  })

  it('多个 primary 时 warn 一次', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mountRenderer([
      makeAction({ label: 'A', type: 'primary' }),
      makeAction({ label: 'B', type: 'primary' }),
    ])
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy.mock.calls[0]?.[0]).toContain('primary')
    warnSpy.mockRestore()
  })

  it('onClick 接收 ctx 原样透传', async () => {
    const onClick = vi.fn()
    const ctx = makeCtx({ selectedCount: 2, selectedRows: [{ id: 1 }, { id: 2 }] })
    const wrapper = mountRenderer([makeAction({ onClick })], ctx)
    await wrapper.find('button').trigger('click')
    expect(onClick).toHaveBeenCalledWith(ctx)
  })
})
