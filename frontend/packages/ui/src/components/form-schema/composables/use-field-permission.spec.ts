/**
 * useFieldPermission 单元测试
 * 覆盖 resolvePermission + renderViewPlaceholder：
 * - 字符串字面量 'view' / 'edit' / 'hidden'
 * - 函数 (model) => 状态
 * - 函数表达式 '{{ fn }}'
 * - 权限码 + permissionResolver 映射
 * - undefined / null / 非预期值 → 默认 'edit'
 * - view 态占位渲染（undefined / null / '' / boolean / array / 字符串）
 */
import { describe, it, expect, vi } from 'vitest'
import type { SchemaNode } from '../types'
import {
  resolvePermission,
  renderViewPlaceholder,
  type FieldPermission,
} from './use-field-permission'

describe('resolvePermission / 字符串字面量', () => {
  it('"view" → view', () => {
    const node: SchemaNode = { name: 'a', component: 'Input', permission: 'view' }
    expect(resolvePermission(node, { model: () => ({}) })).toBe('view')
  })

  it('"edit" → edit', () => {
    const node: SchemaNode = { name: 'a', component: 'Input', permission: 'edit' }
    expect(resolvePermission(node, { model: () => ({}) })).toBe('edit')
  })

  it('"hidden" → hidden', () => {
    const node: SchemaNode = { name: 'a', component: 'Input', permission: 'hidden' }
    expect(resolvePermission(node, { model: () => ({}) })).toBe('hidden')
  })
})

describe('resolvePermission / 函数', () => {
  it('函数 (model) => 状态', () => {
    const node: SchemaNode = {
      name: 'a',
      component: 'Input',
      permission: (m: Record<string, unknown>) => (m.isAdmin ? 'edit' : 'hidden'),
    }
    expect(resolvePermission(node, { model: () => ({ isAdmin: true }) })).toBe('edit')
    expect(resolvePermission(node, { model: () => ({ isAdmin: false }) })).toBe('hidden')
  })

  it('函数返回 undefined → 默认 edit', () => {
    const node: SchemaNode = {
      name: 'a',
      component: 'Input',
      permission: () => undefined as unknown as FieldPermission,
    }
    expect(resolvePermission(node, { model: () => ({}) })).toBe('edit')
  })

  it('函数返回非预期值 → 原样返回（不强制三态校验）', () => {
    // 当前实现：函数返回什么就返回什么（信任函数返回值），不强制三态校验
    // 这是因为函数权限的语义是"用户已经写好了逻辑"，不需要再做收口
    const node: SchemaNode = {
      name: 'a',
      component: 'Input',
      permission: () => 'invalid' as unknown as FieldPermission,
    }
    expect(resolvePermission(node, { model: () => ({}) })).toBe('invalid')
  })

  it('函数抛错 → 降级 edit + console.error（① 回归：不再冒泡炸掉渲染）', () => {
    // 渲染管线没有 try/catch，权限求值必须在内部消化异常
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const node: SchemaNode = {
      name: 'a',
      component: 'Input',
      permission: () => {
        throw new Error('boom')
      },
    }
    expect(resolvePermission(node, { model: () => ({}) })).toBe('edit')
    expect(spy).toHaveBeenCalledWith(
      '[XForm] permission evaluation failed:',
      expect.anything(),
      expect.any(Error)
    )
    spy.mockRestore()
  })

  it('表达式求值抛错 → 降级 edit + console.error（① 回归）', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const node: SchemaNode = {
      name: 'a',
      component: 'Input',
      permission: '{{ () => { throw new Error("boom") } }}',
    }
    expect(resolvePermission(node, { model: () => ({}) })).toBe('edit')
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('resolvePermission / 函数表达式', () => {
  it("\"{{ (m) => m.flag ? 'edit' : 'hidden' }}\" 解析并求值", () => {
    const node: SchemaNode = {
      name: 'a',
      component: 'Input',
      permission: "{{ (m) => m.flag ? 'edit' : 'hidden' }}",
    }
    expect(resolvePermission(node, { model: () => ({ flag: true }) })).toBe('edit')
    expect(resolvePermission(node, { model: () => ({ flag: false }) })).toBe('hidden')
  })

  it('"{{ ... }}" 返回非预期值 → 默认 edit', () => {
    const node: SchemaNode = {
      name: 'a',
      component: 'Input',
      permission: "{{ () => 'unknown' }}",
    }
    expect(resolvePermission(node, { model: () => ({}) })).toBe('edit')
  })
})

describe('resolvePermission / 权限码 + resolver', () => {
  it('权限码走 resolver 映射', () => {
    const node: SchemaNode = {
      name: 'a',
      component: 'Input',
      permission: 'user.edit',
    }
    const resolver = (perm: string): FieldPermission => {
      if (perm === 'user.edit') return 'edit'
      if (perm === 'user.view') return 'view'
      return 'hidden'
    }
    expect(resolvePermission(node, { model: () => ({}), permissionResolver: resolver })).toBe(
      'edit'
    )
    node.permission = 'user.view'
    expect(resolvePermission(node, { model: () => ({}), permissionResolver: resolver })).toBe(
      'view'
    )
    node.permission = 'user.deleted'
    expect(resolvePermission(node, { model: () => ({}), permissionResolver: resolver })).toBe(
      'hidden'
    )
  })

  it('resolver 返回非三态值 → 默认 edit', () => {
    const node: SchemaNode = {
      name: 'a',
      component: 'Input',
      permission: 'x.y.z',
    }
    const resolver = (): unknown => 'invalid' // 返回非 view/edit/hidden
    expect(
      resolvePermission(node, { model: () => ({}), permissionResolver: resolver as never })
    ).toBe('edit')
  })

  it('权限码走默认 identity（无 resolver）', () => {
    const node: SchemaNode = {
      name: 'a',
      component: 'Input',
      permission: 'view',
    }
    // 无 resolver → identity 函数返回 string "view"，匹配三态
    expect(resolvePermission(node, { model: () => ({}) })).toBe('view')
    node.permission = 'some.code.that.isnt.view.or.edit.or.hidden'
    expect(resolvePermission(node, { model: () => ({}) })).toBe('edit')
  })
})

describe('resolvePermission / undefined 与边界', () => {
  it('permission: undefined → edit（向后兼容）', () => {
    const node: SchemaNode = { name: 'a', component: 'Input' }
    expect(resolvePermission(node, { model: () => ({}) })).toBe('edit')
  })

  it('permission: null → edit', () => {
    const node: SchemaNode = { name: 'a', component: 'Input', permission: null as never }
    expect(resolvePermission(node, { model: () => ({}) })).toBe('edit')
  })

  it('permission 是数字 → 默认 edit', () => {
    const node = { name: 'a', component: 'Input', permission: 42 } as unknown as SchemaNode
    expect(resolvePermission(node, { model: () => ({}) })).toBe('edit')
  })

  it('model 是 undefined 时函数仍能跑（fallback {}）', () => {
    const node: SchemaNode = {
      name: 'a',
      component: 'Input',
      permission: (m: Record<string, unknown>) => (m.x === 'ok' ? 'edit' : 'hidden'),
    }
    expect(resolvePermission(node, { model: () => undefined })).toBe('hidden')
  })
})

describe('renderViewPlaceholder', () => {
  it('node 无 name → ""', () => {
    const node: SchemaNode = { component: 'Input' }
    expect(renderViewPlaceholder(node, { a: 1 })).toBe('')
  })

  it('value: undefined → "—"', () => {
    const node: SchemaNode = { name: 'a', component: 'Input' }
    expect(renderViewPlaceholder(node, {})).toBe('—')
  })

  it('value: null → "—"', () => {
    const node: SchemaNode = { name: 'a', component: 'Input' }
    expect(renderViewPlaceholder(node, { a: null })).toBe('—')
  })

  it('value: "" → "—"', () => {
    const node: SchemaNode = { name: 'a', component: 'Input' }
    expect(renderViewPlaceholder(node, { a: '' })).toBe('—')
  })

  it('value: true → "是"', () => {
    const node: SchemaNode = { name: 'a', component: 'Input' }
    expect(renderViewPlaceholder(node, { a: true })).toBe('是')
  })

  it('value: false → "否"', () => {
    const node: SchemaNode = { name: 'a', component: 'Input' }
    expect(renderViewPlaceholder(node, { a: false })).toBe('否')
  })

  it('value: 数组 → join(", ")', () => {
    const node: SchemaNode = { name: 'tags', component: 'Input' }
    expect(renderViewPlaceholder(node, { tags: ['a', 'b', 'c'] })).toBe('a, b, c')
  })

  it('value: 数字 → 字符串', () => {
    const node: SchemaNode = { name: 'age', component: 'Input' }
    expect(renderViewPlaceholder(node, { age: 18 })).toBe('18')
  })

  it('value: 字符串 → 原样', () => {
    const node: SchemaNode = { name: 'name', component: 'Input' }
    expect(renderViewPlaceholder(node, { name: '张三' })).toBe('张三')
  })

  it('value: undefined model → 返回 "—"', () => {
    const node: SchemaNode = { name: 'a', component: 'Input' }
    expect(renderViewPlaceholder(node, undefined)).toBe('—')
  })

  it('lodash 路径支持（嵌套字段）', () => {
    const node: SchemaNode = { name: 'user.profile.name', component: 'Input' }
    expect(renderViewPlaceholder(node, { user: { profile: { name: '李四' } } })).toBe('李四')
  })
})

describe('resolvePermission / H2：注入 resolveFunctionExpression（实例级沙箱）', () => {
  it('opts.resolveFunctionExpression 注入优先于模块级', () => {
    const node = { component: 'Input', name: 'a', permission: '{{ () => tag() }}' } as SchemaNode
    const result = resolvePermission(node, {
      model: () => ({}),
      // as never 兼容泛型签名：注入解析器任何表达式都返回 () => 'hidden'
      resolveFunctionExpression: () => (() => 'hidden') as never,
    })
    expect(result).toBe('hidden')
  })
})
