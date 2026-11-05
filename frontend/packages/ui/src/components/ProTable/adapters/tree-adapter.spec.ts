/**
 * TreeAdapter 单元测试（v3.5 PR1-B Task 1 + Task 2）—— 验证 TreeAdapter 接口契约
 * 与 elementPlusTreeAdapter / vxeTreeAdapter 双引擎实现。
 *
 * @group ProTable adapters 测试
 */
import { describe, it, expect, vi } from 'vitest'
import {
  createElementPlusTreeAdapter,
  createVxeTreeAdapter,
  type TreeAdapter,
} from './tree-adapter'

describe('TreeAdapter (elementPlusTreeAdapter)', () => {
  const adapter = createElementPlusTreeAdapter()

  it('getTreeConfig 返回 el-table treeProps 配置', () => {
    const cfg = adapter.getTreeConfig()
    expect(cfg).toHaveProperty('treeProps')
    // 占位符字段指向不存在的 __pro_table_flat__，避免 el-table 识别真实 children 字段重复渲染
    const tp = cfg['treeProps'] as { children: string; hasChildren: string }
    expect(tp.children).toBe('__pro_table_flat__')
    expect(tp.hasChildren).toBe('__pro_table_flat__')
  })

  it('onExpand / onCollapse / syncExpanded 在 el 下全部 noop', () => {
    // el-table 不需要主动通知：flatData 重算 + :data 引用变化自动重渲染
    // 这些方法调用不应抛错，也不应改变任何状态
    expect(() => adapter.onExpand('k1')).not.toThrow()
    expect(() => adapter.onCollapse('k1')).not.toThrow()
    expect(() => adapter.syncExpanded(['k1'], new Map())).not.toThrow()
  })

  it('getExpandedKeys 在 el 下返回空数组（由 useTreeData 内部 Set 主导）', () => {
    // el-table 不维护引擎侧展开状态：返回空数组由 useTreeData 内部 Set 主导
    expect(adapter.getExpandedKeys()).toEqual([])
  })

  it('hasChildren 基于 _hasChildren 字段判定', () => {
    expect(adapter.hasChildren({ _hasChildren: true })).toBe(true)
    expect(adapter.hasChildren({ _hasChildren: false })).toBe(false)
    expect(adapter.hasChildren({})).toBe(false)
  })

  it('满足 TreeAdapter 接口契约（duck typing 6 方法签名）', () => {
    const a: TreeAdapter = adapter
    expect(typeof a.getTreeConfig).toBe('function')
    expect(typeof a.onExpand).toBe('function')
    expect(typeof a.onCollapse).toBe('function')
    expect(typeof a.getExpandedKeys).toBe('function')
    expect(typeof a.syncExpanded).toBe('function')
    expect(typeof a.hasChildren).toBe('function')
  })
})

describe('TreeAdapter (vxeTreeAdapter)', () => {
  it('getTreeConfig 返回 vxe-table tree-config 协议', () => {
    const adapter = createVxeTreeAdapter(() => null)
    const cfg = adapter.getTreeConfig()
    expect(cfg).toHaveProperty('treeConfig')
    const tc = cfg['treeConfig'] as {
      childrenField: string
      hasChildren: string
      expandAll: boolean
      accordion: boolean
      trigger: string
      indent: number
    }
    // v3.5 hotfix-5：childrenField 从 TREE_PLACEHOLDER 改回真实字段名 'children'——
    // ProTable.vue:685 vxe 引擎 :rows 改回 tableRows（原始嵌套数据），vxe-table
    // 需指向真实 children 字段递归渲染（占位符让它找不到 children → 不渲染）
    expect(tc.childrenField).toBe('children')
    // v3.5 hotfix-4：hasChildren 指向 _hasChildren（useTreeData.normalize 注入的字段），
    // 让 vxe-table 识别父节点并渲染箭头图标（之前 TREE_PLACEHOLDER 导致全部判为叶子节点）
    expect(tc.hasChildren).toBe('_hasChildren')
    expect(tc.expandAll).toBe(false)
    expect(tc.accordion).toBe(false)
    // trigger: 'default'（箭头点击），与 vxe-table v4 默认一致；
    // 原 'cell' 会让 vxe 不渲染展开箭头（v3.5 hotfix-4 修复）
    expect(tc.trigger).toBe('default')
    // v3.5 hotfix-9：indent 置 0 —— 视觉缩进由树列 slot 内联（_level * indentSize）统一控制，
    // 避免与 vxe 内置 padding-left 叠加；内置展开钮同时隐藏（顺序不可控），UI 与 el 同标记
    expect(tc.indent).toBe(0)
  })

  it('onExpand 调 vxe-table setTreeExpand(row, true)', () => {
    const setTreeExpand = vi.fn()
    const adapter = createVxeTreeAdapter(() => ({ setTreeExpand }))
    const row = { id: 'r1' }
    adapter.onExpand('r1', row)
    expect(setTreeExpand).toHaveBeenCalledWith(row, true)
  })

  it('onCollapse 调 vxe-table setTreeExpand(row, false)', () => {
    const setTreeExpand = vi.fn()
    const adapter = createVxeTreeAdapter(() => ({ setTreeExpand }))
    const row = { id: 'r1' }
    adapter.onCollapse('r1', row)
    expect(setTreeExpand).toHaveBeenCalledWith(row, false)
  })

  it('row 缺失时不调用 setTreeExpand（退化等待 syncExpanded 全量回灌）', () => {
    const setTreeExpand = vi.fn()
    const adapter = createVxeTreeAdapter(() => ({ setTreeExpand }))
    adapter.onExpand('r1', undefined)
    expect(setTreeExpand).not.toHaveBeenCalled()
  })

  it('vxe-table 实例为 null 时所有操作安全 noop', () => {
    const adapter = createVxeTreeAdapter(() => null)
    expect(() => adapter.onExpand('k1', { id: 'k1' })).not.toThrow()
    expect(() => adapter.onCollapse('k1', { id: 'k1' })).not.toThrow()
    expect(() => adapter.syncExpanded(['k1'], new Map())).not.toThrow()
  })

  it('syncExpanded 按 rowsByKey 逐行调用 setTreeExpand(true)', () => {
    const setTreeExpand = vi.fn()
    const adapter = createVxeTreeAdapter(() => ({ setTreeExpand }))
    const rowsByKey = new Map<string | number, Record<string, unknown>>([
      ['a', { id: 'a' }],
      ['b', { id: 'b' }],
    ])
    adapter.syncExpanded(['a', 'b', 'missing'], rowsByKey)
    expect(setTreeExpand).toHaveBeenCalledTimes(2)
    expect(setTreeExpand).toHaveBeenNthCalledWith(1, { id: 'a' }, true)
    expect(setTreeExpand).toHaveBeenNthCalledWith(2, { id: 'b' }, true)
  })

  // v3.5 hotfix-10 回归：用户点内联收起按钮 → useTreeData 从 expandedKeys 删除 key →
  // syncExpanded 必须对「不在 keys 里的行」发 setTreeExpand(row, false)。
  // 原实现只遍历 keys 发 true（单边同步）→ vxe-table 内部展开 Map 残留 true → 收起无效。
  // el 引擎无此缺陷（flatData 重算后子行直接从数据消失），故仅 vxe 适配器需要 false 路径
  it('syncExpanded 对不在 keys 中的行调 setTreeExpand(row, false)（hotfix-10：收起链路）', () => {
    const setTreeExpand = vi.fn()
    const adapter = createVxeTreeAdapter(() => ({ setTreeExpand }))
    const rowsByKey = new Map<string | number, Record<string, unknown>>([
      ['a', { id: 'a' }],
      ['b', { id: 'b' }],
    ])
    // 场景：a 展开中，b 刚被用户收起（已从 keys 移除，但 vxe 内部展开 Map 仍残留 true）
    adapter.syncExpanded(['a'], rowsByKey)
    expect(setTreeExpand).toHaveBeenCalledTimes(2)
    expect(setTreeExpand).toHaveBeenCalledWith({ id: 'a' }, true)
    expect(setTreeExpand).toHaveBeenCalledWith({ id: 'b' }, false)
  })

  // v3.5 hotfix-6：syncExpanded 末尾须调 cacheRowMap(true) 重建 vxe-table 行索引。
  // 根因：vxe lazy=true 才走 loadTreeChildren（重建 fullAllDataRowIdData）；
  // 我们用 useTreeData 自管懒加载 → setTreeExpand 不会重建 → 子节点
  // rowRest.level=undefined → row--level-undefined + 缩进 0
  it('syncExpanded 末尾调 cacheRowMap(true) 重建行索引（hotfix-6：vxe 子节点缩进）', () => {
    const setTreeExpand = vi.fn()
    const cacheRowMap = vi.fn()
    const adapter = createVxeTreeAdapter(() => ({ setTreeExpand, cacheRowMap }))
    adapter.syncExpanded([], new Map())
    expect(cacheRowMap).toHaveBeenCalledWith(true)
  })

  it('cacheRowMap 缺失时不抛错（接口可选，向后兼容旧版 vxe）', () => {
    const setTreeExpand = vi.fn()
    const adapter = createVxeTreeAdapter(() => ({ setTreeExpand }))
    expect(() => adapter.syncExpanded([], new Map())).not.toThrow()
  })

  it('getExpandedKeys 返回空数组（vxe 引擎侧展开状态由 useTreeData 主导）', () => {
    const adapter = createVxeTreeAdapter(() => null)
    expect(adapter.getExpandedKeys()).toEqual([])
  })

  it('hasChildren 基于 _hasChildren 字段判定（与 el 同源）', () => {
    const adapter = createVxeTreeAdapter(() => null)
    expect(adapter.hasChildren({ _hasChildren: true })).toBe(true)
    expect(adapter.hasChildren({})).toBe(false)
  })
})
