/**
 * scanForForbidden 单元测试
 * 覆盖危险标识符扫描：window/document/eval/Function/setTimeout/setInterval/fetch 等
 */
import { describe, it, expect } from 'vitest'
import type { SchemaNode } from '../types'
import { scanForForbidden } from './use-scan-forbidden'

describe('scanForForbidden / 安全扫描', () => {
  it('clean schema → 返回空数组', () => {
    const schema: SchemaNode = {
      name: 'root',
      children: [{ name: 'a', component: 'Input', on: { click: () => console.log('hi') } }],
    }
    expect(scanForForbidden(schema)).toEqual([])
  })

  it('检测 on.click 中的 eval', () => {
    const schema: SchemaNode = {
      name: 'root',
      children: [
        {
          name: 'a',
          component: 'Input',
          on: { click: '() => { eval("alert()") }' },
        },
      ],
    }
    const errors = scanForForbidden(schema)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0]).toMatch(/on\.click.*eval/)
  })

  it('检测 reaction 中的 fetch', () => {
    const schema: SchemaNode = {
      name: 'root',
      reaction: { disabled: '() => { fetch("/api") }' },
    }
    const errors = scanForForbidden(schema)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0]).toMatch(/reaction\.disabled.*fetch/)
  })

  it('检测 directive.value 中的 document', () => {
    const schema: SchemaNode = {
      name: 'root',
      directives: [{ directive: 'v-test', value: '() => document.body' }],
    }
    const errors = scanForForbidden(schema)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0]).toMatch(/directive\.value.*document/)
  })

  it('检测 window/document/eval/Function/Reflect/Proxy 等黑名单关键字', () => {
    const dangerous = [
      'window',
      'document',
      'globalThis',
      'eval',
      'Function',
      'XMLHttpRequest',
      'process',
      'Reflect',
      'Proxy',
      'constructor',
      '__proto__',
      'prototype',
    ]
    for (const kw of dangerous) {
      const schema: SchemaNode = {
        name: 'root',
        on: { click: `() => ${kw}.foo()` },
      }
      const errors = scanForForbidden(schema)
      expect(errors.length, `keyword ${kw}`).toBeGreaterThan(0)
    }
  })

  it('合法关键字不误报', () => {
    const safe = [
      'Window',
      'evaluation',
      'fetch',
      'documents',
      'fetching',
      'processSync',
      'proxyRefs',
    ]
    for (const s of safe) {
      // 注意：'fetch' 在黑名单里，这里跳过。'evaluation' 大小写敏感不命中 word boundary
      if (s === 'fetch') continue
      const schema: SchemaNode = {
        name: 'root',
        on: { click: `() => "${s}"` },
      }
      const errors = scanForForbidden(schema)
      expect(errors, `should not match: ${s}`).toEqual([])
    }
  })

  it('Word boundary 校验：substring 不算黑名单', () => {
    const schema: SchemaNode = {
      name: 'root',
      on: { click: '() => "windowless"' },
    }
    expect(scanForForbidden(schema)).toEqual([])
  })

  it('递归 children 中的危险节点', () => {
    const schema: SchemaNode = {
      name: 'root',
      children: [
        {
          name: 'group',
          component: 'Card',
          children: [
            {
              name: 'deep',
              component: 'Input',
              on: { click: '() => eval("x")' },
            },
          ],
        },
      ],
    }
    const errors = scanForForbidden(schema)
    expect(errors.length).toBeGreaterThan(0)
  })

  it('递归 formItem.slots 中的危险节点', () => {
    const schema: SchemaNode = {
      name: 'root',
      formItem: {
        slots: {
          default: {
            name: 'inSlot',
            on: { click: '() => fetch("/api")' },
          },
        },
      },
    }
    const errors = scanForForbidden(schema)
    expect(errors.length).toBeGreaterThan(0)
  })

  it('递归 slots 中的危险节点', () => {
    const schema: SchemaNode = {
      name: 'root',
      slots: {
        default: {
          name: 'inSlot',
          on: { click: '() => document.title = "x"' },
        },
      },
    }
    const errors = scanForForbidden(schema)
    expect(errors.length).toBeGreaterThan(0)
  })

  it('数组形式 schema 顶层扫描（数组内子节点被检测）', () => {
    const schema: SchemaNode[] = [
      { name: 'a', component: 'Input' },
      { name: 'b', component: 'Input', on: { click: '() => eval("x")' } },
    ]
    const errors = scanForForbidden(schema)
    // 数组内的 b 节点被递归检测到 eval
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0]).toMatch(/b.*eval|eval/)
  })

  it('深度限制（32）：超深嵌套不抛错', () => {
    let node: SchemaNode = { name: 'd0' }
    for (let i = 1; i <= 50; i++) {
      const next: SchemaNode = { name: `d${i}`, children: [node] }
      node = next
    }
    // 不抛错，返回 errors（即使深度未命中 dangerous）
    expect(() => scanForForbidden(node)).not.toThrow()
  })

  it('节点数限制（10000）：超大数组不抛错', () => {
    const nodes: SchemaNode[] = []
    for (let i = 0; i < 15000; i++) {
      nodes.push({ name: `n${i}`, component: 'Input' })
    }
    expect(() => scanForForbidden(nodes)).not.toThrow()
  })

  it('WeakSet 去重：同一节点多次引用不重复报错', () => {
    const inner: SchemaNode = { name: 'inner', on: { click: '() => eval("x")' } }
    const schema: SchemaNode = {
      name: 'root',
      children: [inner, inner, inner],
    }
    const errors = scanForForbidden(schema)
    expect(errors.length).toBe(1)
  })

  it('数组 children 内的 string 节点不扫描（仅对象递归）', () => {
    const schema: SchemaNode = {
      name: 'root',
      children: [
        // children 可以是 string（含表达式），），不应作为 schema 节点递归
        'eval("should not be scanned")' as unknown as SchemaNode,
      ],
    }
    // string 类型节点会被 scanField 跳过（只递归对象）
    expect(() => scanForForbidden(schema)).not.toThrow()
  })

  // ---- H1 回归：扫描覆盖补全 ----

  it('检测 permission 字段的函数表达式（此前漏扫）', () => {
    const errors = scanForForbidden({
      permission: '{{ () => window.alert(1) }}',
    } as unknown as SchemaNode)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0]).toMatch(/permission.*window/)
  })

  it('检测 disabled 字段的函数表达式（此前漏扫）', () => {
    const errors = scanForForbidden({
      disabled: '{{ () => document.cookie }}',
    } as unknown as SchemaNode)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0]).toMatch(/disabled.*document/)
  })

  it('递归扫描 reaction 嵌套对象值（reaction.props.x 逃逸路径）', () => {
    const errors = scanForForbidden({
      reaction: { props: { placeholder: '{{ () => eval("1") }}' } },
    } as unknown as SchemaNode)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0]).toMatch(/reaction\.props\.placeholder.*eval/)
  })

  it('递归扫描数组节点 array.itemSchema 子树（此前漏扫）', () => {
    const errors = scanForForbidden({
      kind: 'array',
      array: {
        itemSchema: { name: 'row', component: 'Input', on: { click: '{{ () => fetch("/x") }}' } },
      },
    } as unknown as SchemaNode)
    expect(errors.length).toBeGreaterThan(0)
  })

  it('新增黑名单关键字：localStorage / sessionStorage / require / import', () => {
    for (const kw of ['localStorage', 'sessionStorage', 'require', 'import']) {
      const errors = scanForForbidden({
        on: { click: `() => ${kw}.foo()` },
      } as unknown as SchemaNode)
      expect(errors.length, `keyword ${kw}`).toBeGreaterThan(0)
    }
  })

  it('常见字段名不误报（model.location / model.open 等）', () => {
    const errors = scanForForbidden({
      on: { click: '{{ (m) => m.location }}' },
      reaction: { label: '{{ (m) => (m.open ? "开" : "关") }}' },
    } as unknown as SchemaNode)
    expect(errors).toEqual([])
  })
})

describe('scanForForbidden / D(#5) hidden/readonly 扫描补齐', () => {
  it('hidden 的 {{ }} 函数表达式命中危险标识符 → 报错（此前漏扫）', () => {
    const schema = {
      name: 'a',
      component: 'Input',
      hidden: '{{ () => window.__hacked }}',
    } as unknown as SchemaNode
    const errors = scanForForbidden(schema)
    expect(errors.some((e) => e.startsWith('hidden:'))).toBe(true)
  })

  it('readonly 的 {{ }} 函数表达式命中危险标识符 → 报错（此前漏扫）', () => {
    const schema = {
      name: 'a',
      component: 'Input',
      readonly: '{{ () => document.__hacked }}',
    } as unknown as SchemaNode
    const errors = scanForForbidden(schema)
    expect(errors.some((e) => e.startsWith('readonly:'))).toBe(true)
  })
})
