import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useTreeData, type TreeNode } from './useTreeData'

describe('useTreeData', () => {
  let tree: ReturnType<typeof useTreeData>
  const treeData: TreeNode[] = [
    {
      id: '1',
      name: '公司',
      children: [
        { id: '1-1', name: '研发部', children: [{ id: '1-1-1', name: '前端组' }] },
        { id: '1-2', name: '市场部' },
      ],
    },
  ]

  beforeEach(() => {
    tree = useTreeData({
      defaultExpandDepth: 1,
      loadChildren: undefined,
      childrenKey: 'children',
      rowKey: 'id',
    })
  })

  it('normalize 注入 _level 字段', () => {
    const normalized = tree.normalize(treeData)
    expect(normalized[0]._level).toBe(0)
    expect(normalized[0].children![0]._level).toBe(1)
    expect(normalized[0].children![0].children![0]._level).toBe(2)
  })

  // v3.5 hotfix-8：注入 _parent 引用，让 useRowDrag 嵌套 splice 能定位 parent.children 数组
  it('normalize 给所有非顶层节点注入 _parent（指向父 children 数组）', () => {
    const normalized = tree.normalize(treeData)
    const root = normalized[0]
    const deptRd = root.children![0]
    const teamFe = deptRd.children![0]
    // 根节点 _parent 不注入（顶层 row 走旧的 resolveTopIndex 路径）
    expect(root._parent).toBeUndefined()
    // 第二层节点 _parent 指向根的 children 数组
    expect(deptRd._parent).toBe(root.children)
    expect(deptRd._parent).toContain(deptRd)
    // 第三层节点 _parent 指向第二层节点的 children 数组
    expect(teamFe._parent).toBe(deptRd.children)
    expect(teamFe._parent).toContain(teamFe)
  })

  it('defaultExpandDepth = 1 时根节点 + 第一层展开', () => {
    tree.normalize(treeData)
    expect(tree.isExpanded('1')).toBe(true)
    expect(tree.isExpanded('1-1')).toBe(true)
    expect(tree.isExpanded('1-1-1')).toBe(false)
  })

  it('defaultExpandDepth = 0 时全部折叠', () => {
    const t = useTreeData({ defaultExpandDepth: 0, childrenKey: 'children', rowKey: 'id' })
    t.normalize(treeData)
    expect(t.isExpanded('1')).toBe(false)
  })

  it('expandAll / collapseAll', () => {
    tree.normalize(treeData)
    tree.expandAll()
    expect(tree.isExpanded('1-1-1')).toBe(true)
    tree.collapseAll()
    expect(tree.isExpanded('1')).toBe(false)
  })

  it('toggle 异步 lazy load 成功', async () => {
    const lazyTree = useTreeData({
      defaultExpandDepth: 0,
      loadChildren: async () => [{ id: 'lazy-1', name: '懒加载子节点' }],
      childrenKey: 'children',
      rowKey: 'id',
    })
    const data: TreeNode[] = [{ id: 'root', name: '根', _hasChildren: true }]
    lazyTree.normalize(data)

    await lazyTree.toggle('root')
    const root = data[0]
    expect(root._loaded).toBe(true)
    expect(root.children).toEqual([
      { id: 'lazy-1', name: '懒加载子节点', _level: 1, _parent: root.children },
    ])
  })

  it('toggle 异步 lazy load 失败保持 collapsed + console.error', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const lazyTree = useTreeData({
      defaultExpandDepth: 0,
      loadChildren: async () => {
        throw new Error('网络错误')
      },
      childrenKey: 'children',
      rowKey: 'id',
    })
    const data: TreeNode[] = [{ id: 'root', name: '根', _hasChildren: true }]
    lazyTree.normalize(data)

    await lazyTree.toggle('root')
    expect(lazyTree.isExpanded('root')).toBe(false)
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('revealKeys 自动展开命中节点的所有祖先', async () => {
    tree.normalize(treeData)
    await tree.revealKeys(new Set(['1-1-1']))
    expect(tree.isExpanded('1')).toBe(true)
    expect(tree.isExpanded('1-1')).toBe(true)
    expect(tree.isExpanded('1-1-1')).toBe(true)
  })

  it('同节点 200ms 防抖（同节点连续 toggle 只触发 1 次 loadChildren）', async () => {
    let loadCount = 0
    const lazyTree = useTreeData({
      defaultExpandDepth: 0,
      loadChildren: async () => {
        loadCount++
        return []
      },
      childrenKey: 'children',
      rowKey: 'id',
    })
    const data: TreeNode[] = [{ id: 'root', _hasChildren: true }]
    lazyTree.normalize(data)

    lazyTree.toggle('root')
    lazyTree.toggle('root')
    lazyTree.toggle('root')
    await new Promise((r) => setTimeout(r, 300))

    expect(loadCount).toBe(1)
  })
})
