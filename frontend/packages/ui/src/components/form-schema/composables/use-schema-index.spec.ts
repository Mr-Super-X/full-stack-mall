/**
 * useSchemaIndex 单元测试
 * 覆盖：
 * - byName / fieldNames / allNames DFS 顺序
 * - ignore 字段过滤
 * - name + key 兜底
 * - array.itemSchema 跨字段规则提取
 * - formItem.slots 跨字段规则提取
 * - reverseIndex / dependsOnMap 推导
 * - schema 整体替换重建
 */
import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import type { SchemaNode } from '../types'
import { useSchemaIndex } from './use-schema-index'
import { buildIndex } from './use-schema-index.builder'

describe('useSchemaIndex.builder / buildIndex', () => {
  it('基本字段：byName / fieldNames / allNames 一致', () => {
    const schema: SchemaNode = {
      children: [
        { name: 'a', component: 'Input' },
        { name: 'b', component: 'Input' },
      ],
    }
    const idx = buildIndex(schema)
    expect(idx.byName.get('a')?.component).toBe('Input')
    expect(idx.byName.get('b')?.component).toBe('Input')
    expect(idx.fieldNames).toEqual(['a', 'b'])
    expect(idx.allNames).toEqual(['a', 'b'])
  })

  it('ignore 字段：fieldNames 排除，allNames 包含', () => {
    const schema: SchemaNode = {
      children: [
        { name: 'a', component: 'Input' },
        { name: 'b', component: 'Input', ignore: true },
      ],
    }
    const idx = buildIndex(schema)
    expect(idx.fieldNames).toEqual(['a'])
    expect(idx.allNames).toEqual(['a', 'b'])
  })

  it('name 缺失用 key 兜底', () => {
    const schema: SchemaNode = {
      children: [
        { name: 'a', component: 'Input' },
        { component: 'Input', key: 'no-name' },
      ],
    }
    const idx = buildIndex(schema)
    expect(idx.allNames).toEqual(['a', 'no-name'])
  })

  it('跨字段规则：crossRules / reverseIndex / dependsOnMap', () => {
    const schema: SchemaNode = {
      children: [
        { name: 'startDate', component: 'DatePicker' },
        {
          name: 'endDate',
          component: 'DatePicker',
          rules: [
            {
              crossValidator: (_v: unknown, start: unknown) => (start ? true : 'err'),
              dependsOn: 'startDate',
            },
          ],
        },
        {
          name: 'passwordConfirm',
          component: 'Input',
          rules: [
            {
              crossValidator: (v: unknown, p: unknown) => (v === p ? true : 'err'),
              dependsOn: 'password',
            },
          ],
        },
      ],
    }
    const idx = buildIndex(schema)
    expect(idx.crossRules.get('endDate')?.length).toBe(1)
    expect(idx.crossRules.get('passwordConfirm')?.length).toBe(1)
    expect(idx.reverseIndex.get('startDate')).toEqual(['endDate'])
    expect(idx.reverseIndex.get('password')).toEqual(['passwordConfirm'])
    expect(idx.dependsOnMap.get('endDate')).toEqual(['startDate'])
    expect(idx.dependsOnMap.get('passwordConfirm')).toEqual(['password'])
  })

  it('array.itemSchema 中的跨字段规则被提取', () => {
    const schema: SchemaNode = {
      name: 'items',
      kind: 'array',
      array: {
        itemSchema: {
          name: 'subField',
          rules: [
            {
              crossValidator: (_v: unknown, dep: unknown) => (dep ? true : 'err'),
              dependsOn: 'parentField',
            },
          ],
        },
      },
    }
    const idx = buildIndex(schema)
    expect(idx.crossRules.get('subField')?.length).toBe(1)
    expect(idx.reverseIndex.get('parentField')).toEqual(['subField'])
  })

  it('formItem.slots 中的跨字段规则被提取', () => {
    const schema: SchemaNode = {
      component: 'Input',
      formItem: {
        slots: {
          default: {
            name: 'slotField',
            rules: [
              {
                crossValidator: (_v: unknown, dep: unknown) => (dep ? true : 'err'),
                dependsOn: 'depField',
              },
            ],
          },
        },
      },
    }
    const idx = buildIndex(schema)
    expect(idx.crossRules.get('slotField')?.length).toBe(1)
    expect(idx.reverseIndex.get('depField')).toEqual(['slotField'])
  })

  it('dependsOn 是数组时正确拆解', () => {
    const schema: SchemaNode = {
      children: [
        {
          name: 'target',
          component: 'Input',
          rules: [
            {
              crossValidator: (_v: unknown, a: unknown, b: unknown) => (a && b ? true : 'err'),
              dependsOn: ['a', 'b'],
            },
          ],
        },
      ],
    }
    const idx = buildIndex(schema)
    expect(idx.dependsOnMap.get('target')).toEqual(['a', 'b'])
    expect(idx.reverseIndex.get('a')).toEqual(['target'])
    expect(idx.reverseIndex.get('b')).toEqual(['target'])
  })

  it('trigger=manual 的规则不进入 reverseIndex（仅供 validateForm 用）', () => {
    const schema: SchemaNode = {
      children: [
        {
          name: 'target',
          component: 'Input',
          rules: [
            {
              crossValidator: () => true as const,
              dependsOn: 'a',
              trigger: 'manual',
            },
          ],
        },
      ],
    }
    const idx = buildIndex(schema)
    expect(idx.reverseIndex.get('a')).toBeUndefined()
  })

  it('non-cross 规则不进入 crossRules', () => {
    const schema: SchemaNode = {
      children: [{ name: 'a', component: 'Input', rules: [{ required: true }] }],
    }
    const idx = buildIndex(schema)
    expect(idx.crossRules.size).toBe(0)
  })

  it('空 schema 返回空索引', () => {
    const idx = buildIndex(undefined)
    expect(idx.byName.size).toBe(0)
    expect(idx.fieldNames).toEqual([])
    expect(idx.allNames).toEqual([])
    expect(idx.crossRules.size).toBe(0)
  })

  it('DFS 顺序：嵌套 children 按出现顺序', () => {
    const schema: SchemaNode = {
      children: [
        {
          name: 'group1',
          component: 'Card',
          children: [
            { name: 'a', component: 'Input' },
            { name: 'b', component: 'Input' },
          ],
        },
        { name: 'c', component: 'Input' },
      ],
    }
    const idx = buildIndex(schema)
    expect(idx.fieldNames).toEqual(['group1', 'a', 'b', 'c'])
  })

  it('根节点有 name 时也作为字段（与原 getNames 一致）', () => {
    const schema: SchemaNode = {
      name: 'root',
      children: [{ name: 'a', component: 'Input' }],
    }
    const idx = buildIndex(schema)
    // 与 XForm 原 getNames 行为一致：name 字段都进 fieldNames，根节点 name 也算
    expect(idx.fieldNames).toEqual(['root', 'a'])
  })
})

describe('useSchemaIndex / 响应式重建', () => {
  it('schema 整体替换时索引重建', async () => {
    const schemaRef = ref<SchemaNode>({
      children: [{ name: 'a', component: 'Input' }],
    })
    const idx = useSchemaIndex(() => schemaRef.value)
    expect(idx.fieldNames.value).toEqual(['a'])

    schemaRef.value = {
      children: [
        { name: 'x', component: 'Input' },
        { name: 'y', component: 'Input' },
      ],
    }
    // Vue watch 是同步触发后异步刷新
    await Promise.resolve()
    expect(idx.fieldNames.value).toEqual(['x', 'y'])
  })

  it('getFieldNames(includeIgnore) 返回对应数组引用', () => {
    const schemaRef = ref<SchemaNode>({
      children: [
        { name: 'a', component: 'Input' },
        { name: 'b', component: 'Input', ignore: true },
      ],
    })
    const idx = useSchemaIndex(() => schemaRef.value)
    expect(idx.getFieldNames(false)).toEqual(['a'])
    expect(idx.getFieldNames(true)).toEqual(['a', 'b'])
    // 调用多次返回同一引用（O(1) 复用）
    expect(idx.getFieldNames(false)).toBe(idx.fieldNames.value)
  })

  it('reindex() 手动重建（节点深改场景）', () => {
    const schemaRef = ref<SchemaNode>({
      children: [{ name: 'a', component: 'Input' }],
    })
    const idx = useSchemaIndex(() => schemaRef.value)
    expect(idx.fieldNames.value).toEqual(['a'])

    // 局部修改：不重新赋 schemaRef.value，reactiveSchema 不感知
    const children = schemaRef.value.children
    if (Array.isArray(children) && children[0]) {
      ;(children[0] as { name: string }).name = 'changed'
    }
    // 但 reindex() 强制重建
    idx.reindex()
    expect(idx.fieldNames.value).toEqual(['changed'])
  })

  it('根节点有 name 时也作为字段（与原 getNames 一致）', () => {
    const schemaRef = ref<SchemaNode>({
      name: 'root',
      children: [{ name: 'a', component: 'Input' }],
    })
    const idx = useSchemaIndex(() => schemaRef.value)
    // 与原 getNames 行为一致：name 字段都进 fieldNames，根节点 name 也算
    expect(idx.fieldNames.value).toEqual(['root', 'a'])
  })
})

describe('buildIndex / dependsOnMap 同 target 多 cross rule（⑤ 回归）', () => {
  it('同一 target 的多条 cross rule 的 deps 合并去重，不被后者覆盖', () => {
    const schema: SchemaNode = {
      children: [
        {
          name: 'c',
          component: 'Input',
          rules: [
            { dependsOn: ['a'], crossValidator: () => true },
            { dependsOn: ['b'], crossValidator: () => true },
          ],
        },
      ],
    }
    const idx = buildIndex(schema)
    expect(idx.dependsOnMap.get('c')).toEqual(['a', 'b'])
    expect(idx.crossRules.get('c')).toHaveLength(2)
  })
})
