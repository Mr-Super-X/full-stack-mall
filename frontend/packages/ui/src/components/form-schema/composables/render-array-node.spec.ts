/**
 * renderArrayNode / rewriteNamePath 单元测试
 * 覆盖：
 * - 子节点 name 路径前缀化（prefix.sep.name）
 * - 数组/字符串/null/undefined 输入
 * - 嵌套 children / formItem.slots / slots
 * - name 缺失时保持空
 */
import { describe, it, expect, vi } from 'vitest'
import { h, type VNode } from 'vue'
import type { SchemaNode } from '../types'
import { rewriteNamePath } from './array-row-key'
import { renderArrayNode } from './render-array-node'

describe('rewriteNamePath / 基本', () => {
  it('单节点 name 前缀化', () => {
    const input: SchemaNode = { name: 'qty', component: 'Input' }
    const out = rewriteNamePath(input, 'items[0]', '.') as SchemaNode
    expect(out.name).toBe('items[0].qty')
    // 不修改原对象
    expect(input.name).toBe('qty')
  })

  it('自定义 sep 字符', () => {
    const input: SchemaNode = { name: 'qty', component: 'Input' }
    const out = rewriteNamePath(input, 'items[0]', '_') as SchemaNode
    expect(out.name).toBe('items[0]_qty')
  })

  it('name 缺失 → 保持空', () => {
    const input: SchemaNode = { component: 'Input' }
    const out = rewriteNamePath(input, 'items[0]', '.') as SchemaNode
    expect(out.name).toBeUndefined()
  })

  it('null / undefined → 原样返回', () => {
    expect(rewriteNamePath(undefined, 'p', '.')).toBeUndefined()
    // 源码类型签名不允许 null，但运行时支持 —— 显式断言
    expect(rewriteNamePath(null as never, 'p', '.')).toBeNull()
  })

  it('string 节点 → 原样返回', () => {
    expect(rewriteNamePath('hello', 'p', '.')).toBe('hello')
  })
})

describe('rewriteNamePath / 数组', () => {
  it('数组每个元素 name 都被前缀化', () => {
    const input: SchemaNode[] = [
      { name: 'a', component: 'Input' },
      { name: 'b', component: 'Input' },
    ]
    const out = rewriteNamePath(input, 'items[0]', '.') as SchemaNode[]
    expect(out).toHaveLength(2)
    expect(out[0]?.name).toBe('items[0].a')
    expect(out[1]?.name).toBe('items[0].b')
  })

  it('空数组 → 空数组', () => {
    const out = rewriteNamePath([], 'p', '.')
    expect(out).toEqual([])
  })
})

describe('rewriteNamePath / 嵌套 children', () => {
  it('嵌套 children 也会被递归前缀化', () => {
    const input: SchemaNode = {
      name: 'group',
      component: 'Card',
      children: [
        { name: 'inner', component: 'Input' },
        {
          name: 'nested',
          component: 'Input',
          children: [{ name: 'deep', component: 'Input' }],
        },
      ],
    }
    const out = rewriteNamePath(input, 'items[0]', '.') as SchemaNode
    const children = out.children as SchemaNode[]
    expect(children[0]?.name).toBe('items[0].inner')
    expect((children[1]?.children as SchemaNode[])[0]?.name).toBe('items[0].deep')
  })

  it('formItem.slots 也会被递归', () => {
    const input: SchemaNode = {
      name: 'root',
      formItem: {
        slots: {
          default: {
            name: 'inSlot',
            component: 'Input',
          },
        },
      },
    }
    const out = rewriteNamePath(input, 'items[0]', '.') as SchemaNode
    const slot = (out.formItem as { slots: { default: SchemaNode } }).slots.default
    expect(slot.name).toBe('items[0].inSlot')
  })
})

describe('rewriteNamePath / 属性保持', () => {
  it('保留其他属性（component、rules 等）', () => {
    const input: SchemaNode = {
      name: 'qty',
      component: 'Input',
      rules: [{ required: true, message: 'err' }],
    }
    const out = rewriteNamePath(input, 'items[0]', '.') as SchemaNode
    expect(out.component).toBe('Input')
    expect(out.rules).toEqual([{ required: true, message: 'err' }])
  })

  it('不修改原节点对象（深拷贝）', () => {
    const input: SchemaNode = { name: 'qty', component: 'Input' }
    const out = rewriteNamePath(input, 'items[0]', '.') as SchemaNode
    expect(input.name).toBe('qty')
    expect(out).not.toBe(input)
  })
})

describe('renderArrayNode / 行 key 稳定性（H8 回归）', () => {
  function makeOpts(model: Record<string, unknown>) {
    return {
      model,
      render: () => h('div'),
      arrayActions: {
        addItem: () => {},
        removeItem: () => {},
        moveItem: () => {},
      },
    } as never
  }

  function collectKeys(vnode: VNode | undefined, prefix: string): unknown[] {
    // 结构无关的遍历：native 元素与组件的 children 规范化形态不同（数组 / slot 对象），
    // 递归收集所有指定前缀的 key，避免依赖具体嵌套层级
    const keys: unknown[] = []
    const walk = (v: unknown): void => {
      if (!v || typeof v !== 'object') return
      if (Array.isArray(v)) {
        v.forEach(walk)
        return
      }
      const o = v as VNode
      if (typeof o.key === 'string' && o.key.startsWith(prefix)) keys.push(o.key)
      const ch = (o as unknown as Record<string, unknown>).children
      if (Array.isArray(ch)) ch.forEach(walk)
      else if (ch && typeof ch === 'object') {
        for (const slot of Object.values(ch)) {
          walk(typeof slot === 'function' ? (slot as () => unknown)() : slot)
        }
      }
    }
    walk(vnode)
    return keys
  }

  const rowKeys = (v: VNode | undefined): unknown[] => collectKeys(v, 'array-items-')

  const makeNode = (): SchemaNode =>
    ({
      name: 'items',
      kind: 'array',
      array: { itemSchema: { name: 'qty', component: 'Input' } },
    }) as SchemaNode

  it('删除首行后剩余行保持原 key（按行对象身份而非 index）', () => {
    const rowA = { qty: 1 }
    const rowB = { qty: 2 }
    const rowC = { qty: 3 }
    const model: Record<string, unknown> = { items: [rowA, rowB, rowC] }
    const before = rowKeys(renderArrayNode(makeNode(), makeOpts(model)))
    expect(before).toHaveLength(3)
    // 删除首行：rowB/rowC 的 index 从 1,2 变为 0,1 —— index key 会全部重挂载，对象身份 key 不变
    ;(model.items as unknown[]).splice(0, 1)
    const after = rowKeys(renderArrayNode(makeNode(), makeOpts(model)))
    expect(after).toEqual([before[1], before[2]])
  })

  it('移动行后 key 随行对象走（不随位置走）', () => {
    const rowA = { qty: 1 }
    const rowB = { qty: 2 }
    const model: Record<string, unknown> = { items: [rowA, rowB] }
    const before = rowKeys(renderArrayNode(makeNode(), makeOpts(model)))
    ;(model.items as unknown[]).reverse()
    const after = rowKeys(renderArrayNode(makeNode(), makeOpts(model)))
    expect(after).toEqual([before[1], before[0]])
  })

  it('删除首行后行内节点获得身份派生 key（keyPrefix 注入 itemSchema 子树）', () => {
    // renderArrayNode 的 render 回调收到的节点：name 是位置路径，key 是行身份路径
    const rowA = { qty: 1 }
    const rowB = { qty: 2 }
    const model: Record<string, unknown> = { items: [rowA, rowB] }
    const seen: Array<{ name: string | undefined; key: string | number | undefined }> = []
    const opts = {
      model,
      render: (n: SchemaNode) => {
        seen.push({ name: n.name, key: n.key })
        return h('div')
      },
      arrayActions: { addItem: () => {}, removeItem: () => {}, moveItem: () => {} },
    } as never
    // 行渲染在 slot 函数里是惰性的，先走一遍 key 收集强制求值
    rowKeys(renderArrayNode(makeNode(), opts))
    // OPT-5：key 后缀从单调递增计数器改为 crypto.randomUUID() 短码（hex）
    expect(seen[0]).toEqual({
      name: 'items[0].qty',
      key: expect.stringMatching(/^items#r[0-9a-f]+\.qty$/),
    })
    expect(seen[1]).toEqual({
      name: 'items[1].qty',
      key: expect.stringMatching(/^items#r[0-9a-f]+\.qty$/),
    })
    expect(seen[0]!.key).not.toBe(seen[1]!.key)
  })

  it('rewriteNamePath 的 keyPrefix 派生稳定 key，用户显式 key 优先', () => {
    const input: SchemaNode = {
      name: 'qty',
      component: 'Input',
      children: [{ name: 'sub', component: 'Input', key: 'user-key' } as SchemaNode],
    }
    const out = rewriteNamePath(input, 'items[0]', '.', 'items#r9') as SchemaNode
    expect(out.name).toBe('items[0].qty')
    expect(out.key).toBe('items#r9.qty')
    const child = (out.children as SchemaNode[])[0]!
    expect(child.name).toBe('items[0].sub')
    expect(child.key).toBe('user-key') // 用户显式 key 不被覆盖
  })

  it('rewriteNamePath 不传 keyPrefix 时不设置 key（向后兼容）', () => {
    const out = rewriteNamePath({ name: 'qty', component: 'Input' }, 'items[0]', '.') as SchemaNode
    expect(out.name).toBe('items[0].qty')
    expect(out.key).toBeUndefined()
  })
})

describe('renderArrayNode / 拖拽排序（P2-3 回归）', () => {
  function makeOpts(model: Record<string, unknown>) {
    return {
      model,
      render: () => h('div'),
      arrayActions: { addItem: () => {}, removeItem: () => {}, moveItem: () => {} },
    } as never
  }

  function collectRows(vnode: VNode | undefined): VNode[] {
    const rows: VNode[] = []
    const walk = (v: unknown): void => {
      if (!v || typeof v !== 'object') return
      if (Array.isArray(v)) {
        v.forEach(walk)
        return
      }
      const o = v as VNode
      const cls = (o.props as Record<string, unknown> | undefined)?.class
      if (typeof cls === 'string' && cls.endsWith('__row')) rows.push(o)
      const ch = (o as unknown as Record<string, unknown>).children
      if (Array.isArray(ch)) ch.forEach(walk)
      else if (ch && typeof ch === 'object') {
        for (const slot of Object.values(ch)) {
          walk(typeof slot === 'function' ? (slot as () => unknown)() : slot)
        }
      }
    }
    walk(vnode)
    return rows
  }

  const makeDndNode = (draggable?: boolean): SchemaNode =>
    ({
      name: 'items',
      kind: 'array',
      array: {
        ...(draggable !== undefined ? { draggable } : {}),
        itemSchema: { name: 'qty', component: 'Input' },
      },
    }) as SchemaNode

  it('draggable 未配置 → 行无拖拽属性（默认行为不变）', () => {
    const model: Record<string, unknown> = { items: [{ qty: 1 }] }
    const rows = collectRows(renderArrayNode(makeDndNode(), makeOpts(model)))
    expect(rows).toHaveLength(1)
    expect((rows[0]!.props as Record<string, unknown>).draggable).toBeUndefined()
  })

  it('draggable: true → 行挂 draggable=true 且 drop 调 moveItem(from, to)', () => {
    const moveItem = vi.fn()
    const model: Record<string, unknown> = { items: [{ qty: 1 }, { qty: 2 }] }
    const opts = {
      model,
      render: () => h('div'),
      arrayActions: { addItem: () => {}, removeItem: () => {}, moveItem },
    } as never
    const rows = collectRows(renderArrayNode(makeDndNode(true), opts))
    expect(rows).toHaveLength(2)
    const rowProps = rows[1]!.props as Record<string, unknown>
    expect(rowProps.draggable).toBe(true)
    // 模拟从第 1 行（index 0）拖到第 2 行（index 1）
    const preventDefault = vi.fn()
    ;(rowProps.onDrop as (e: unknown) => void)({
      preventDefault,
      dataTransfer: { getData: () => '0' },
    })
    expect(preventDefault).toHaveBeenCalled()
    expect(moveItem).toHaveBeenCalledWith('items', 0, 1)
  })

  it('drop 到自身位置 → 不触发 moveItem', () => {
    const moveItem = vi.fn()
    const model: Record<string, unknown> = { items: [{ qty: 1 }, { qty: 2 }] }
    const opts = {
      model,
      render: () => h('div'),
      arrayActions: { addItem: () => {}, removeItem: () => {}, moveItem },
    } as never
    const rows = collectRows(renderArrayNode(makeDndNode(true), opts))
    const rowProps = rows[1]!.props as Record<string, unknown>
    ;(rowProps.onDrop as (e: unknown) => void)({
      preventDefault: () => {},
      dataTransfer: { getData: () => '1' }, // from === 目标 index
    })
    expect(moveItem).not.toHaveBeenCalled()
  })
})

describe('renderArrayNode / 行级 reaction 生命周期（A5）', () => {
  /**
   * 行渲染在 vnode slot 内惰性执行 —— 结构无关遍历强制求值（与文件内 collectKeys 同款）
   */
  function forceRows(vnode: VNode | undefined): void {
    const walk = (v: unknown): void => {
      if (!v || typeof v !== 'object') return
      if (Array.isArray(v)) {
        v.forEach(walk)
        return
      }
      const ch = (v as unknown as Record<string, unknown>).children
      if (Array.isArray(ch)) ch.forEach(walk)
      else if (ch && typeof ch === 'object') {
        for (const slot of Object.values(ch)) {
          walk(typeof slot === 'function' ? (slot as () => unknown)() : slot)
        }
      }
    }
    walk(vnode)
  }

  function makeReactionNode(itemSchema: SchemaNode): SchemaNode {
    return {
      name: 'items',
      kind: 'array',
      component: 'div',
      array: { itemSchema },
    } as SchemaNode
  }

  function makeBucketOpts(model: Record<string, unknown>, bucket: Map<string, unknown>) {
    return {
      model,
      render: () => h('div'),
      arrayActions: {
        addItem: () => {},
        removeItem: () => {},
        moveItem: () => {},
      },
      rowReactionStoppers: bucket,
    } as never
  }

  it('配置未变（同 rowKey + 同 index + 同 itemSchema 引用）重渲染 → 复用 watcher，不重复注册', () => {
    let evalCount = 0
    const itemSchema: SchemaNode = {
      name: 'qty',
      component: 'Input',
      reaction: {
        disabled: (m: Record<string, unknown>) => {
          evalCount++
          return m.lock === true
        },
      },
    } as SchemaNode
    const node = makeReactionNode(itemSchema)
    const model: Record<string, unknown> = { lock: false, items: [{ qty: 1 }] }
    const bucket = new Map<string, unknown>()
    const opts = makeBucketOpts(model, bucket)

    forceRows(renderArrayNode(node, opts))
    expect(evalCount).toBe(1) // 首次注册 sync 策略立即求值
    expect(bucket.size).toBe(1)
    const firstEntry = [...bucket.values()][0]

    forceRows(renderArrayNode(node, opts))
    // A5：复用已注册 watcher —— 不重复注册则求值次数不增、桶内条目引用不变（非停旧换新）
    expect(evalCount).toBe(1)
    expect(bucket.size).toBe(1)
    expect([...bucket.values()][0]).toBe(firstEntry)
  })

  it('itemSchema 引用变化（schema 替换）→ 停旧 watcher + 重注册新条目', () => {
    let evalCount = 0
    const mkItem = (): SchemaNode =>
      ({
        name: 'qty',
        component: 'Input',
        reaction: {
          disabled: () => {
            evalCount++
            return false
          },
        },
      }) as SchemaNode
    const node1 = makeReactionNode(mkItem())
    const node2 = makeReactionNode(mkItem()) // 新 itemSchema 引用（模拟 schema 替换后重渲）
    const model: Record<string, unknown> = { items: [{ qty: 1 }] }
    const bucket = new Map<string, unknown>()
    const opts1 = makeBucketOpts(model, bucket)
    const opts2 = makeBucketOpts(model, bucket)

    forceRows(renderArrayNode(node1, opts1))
    expect(evalCount).toBe(1)
    const firstEntry = [...bucket.values()][0]

    forceRows(renderArrayNode(node2, opts2))
    expect(evalCount).toBe(2) // 重注册 → sync 立即再求值
    expect(bucket.size).toBe(1)
    expect([...bucket.values()][0]).not.toBe(firstEntry) // 停旧换新
  })

  it('行移动（index 变化）→ 两行的 name 前缀都变，全部重注册', () => {
    let evalCount = 0
    const itemSchema: SchemaNode = {
      name: 'qty',
      component: 'Input',
      reaction: {
        disabled: () => {
          evalCount++
          return false
        },
      },
    } as SchemaNode
    const node = makeReactionNode(itemSchema)
    const rowA = { qty: 1 }
    const rowB = { qty: 2 }
    const model: Record<string, unknown> = { items: [rowA, rowB] }
    const bucket = new Map<string, unknown>()
    const opts = makeBucketOpts(model, bucket)

    forceRows(renderArrayNode(node, opts))
    expect(evalCount).toBe(2) // 两行各注册各求值一次
    const firstEntryA = [...bucket.values()][0]

    ;(model.items as unknown[]).reverse() // rowB: index 1→0，rowA: 0→1
    forceRows(renderArrayNode(node, opts))
    expect(evalCount).toBe(4) // index 变化 → 全部重注册
    expect(bucket.size).toBe(2)
    expect([...bucket.values()][0]).not.toBe(firstEntryA)
  })

  it('删除行 → 该行 watcher 经 stale 清理停止，桶只留现存行（原行为保持）', () => {
    let evalCount = 0
    const itemSchema: SchemaNode = {
      name: 'qty',
      component: 'Input',
      reaction: {
        disabled: () => {
          evalCount++
          return false
        },
      },
    } as SchemaNode
    const node = makeReactionNode(itemSchema)
    const rowA = { qty: 1 }
    const rowB = { qty: 2 }
    const model: Record<string, unknown> = { items: [rowA, rowB] }
    const bucket = new Map<string, unknown>()
    const opts = makeBucketOpts(model, bucket)

    forceRows(renderArrayNode(node, opts))
    expect(bucket.size).toBe(2)
    expect(evalCount).toBe(2) // 两行各注册求值一次

    ;(model.items as unknown[]).splice(0, 1) // 删除 rowA
    forceRows(renderArrayNode(node, opts))
    expect(bucket.size).toBe(1) // rowA 的 entry 被清
    // 被删行不重注册；幸存行 rowB 因 index 1→0 变化重注册一次（2 + 1）
    expect(evalCount).toBe(3)
  })

  it('注入桶透传：渲染复用 opts.rowReactionStoppers（不经模块级退回桶）', () => {
    const itemSchema: SchemaNode = {
      name: 'qty',
      component: 'Input',
      reaction: { disabled: () => false },
    } as SchemaNode
    const node = makeReactionNode(itemSchema)
    const model: Record<string, unknown> = { items: [{ qty: 1 }] }
    const bucketA = new Map<string, unknown>()
    const bucketB = new Map<string, unknown>()

    forceRows(renderArrayNode(node, makeBucketOpts(model, bucketA)))
    forceRows(renderArrayNode(node, makeBucketOpts(model, bucketB)))

    // 两个独立桶各存一份 —— 若走模块级共享桶，第二次渲染会因同 rowKey 命中而复用（bucketA  size 不变已证）
    expect(bucketA.size).toBe(1)
    expect(bucketB.size).toBe(1)
  })
})
