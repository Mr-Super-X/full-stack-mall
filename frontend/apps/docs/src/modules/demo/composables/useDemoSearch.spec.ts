/**
 * useDemoSearch 单元测试
 * 覆盖：空 keyword 透传 / 中文名命中 / 组件名大小写不敏感命中 / 跨组 / 空组丢弃 /
 *      全无命中 / 空白等价 / clearKeyword / 折叠快照不被污染
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { effectScope, ref, type EffectScope } from 'vue'
import type { DemoSearchGroup, DemoSearchItem } from './useDemoSearch'
import { useDemoSearch } from './useDemoSearch'

let scope: EffectScope

beforeEach(() => {
  scope = effectScope()
})

afterEach(() => {
  scope.stop()
})

const groups: DemoSearchGroup<DemoSearchItem>[] = [
  {
    title: 'XForm 表单引擎',
    items: [
      { name: 'XForm', label: 'XForm 用法总览', path: '/demo/xform' },
      { name: 'XFormArray', label: 'XFormArray 数组节点', path: '/demo/xform-array' },
    ],
  },
  {
    title: '通用组件',
    items: [{ name: 'AsyncState', label: 'AsyncState 异步状态容器', path: '/demo/async-state' }],
  },
]

function makeSetup() {
  const keyword = ref('')
  const collapsedGroups = ref<Set<string>>(new Set())
  const demoGroups = ref(groups)
  const search = scope.run(() => useDemoSearch({ groups: demoGroups, keyword, collapsedGroups }))!
  return { keyword, collapsedGroups, demoGroups, ...search }
}

describe('useDemoSearch', () => {
  it('空 keyword 时 filteredGroups === 原 groups（结构与顺序不变）', () => {
    const { filteredGroups } = makeSetup()
    expect(filteredGroups.value).toEqual(groups)
  })

  it('中文名命中（如「数组」）', () => {
    const { filteredGroups, keyword } = makeSetup()
    keyword.value = '数组'
    expect(filteredGroups.value.length).toBe(1)
    expect(filteredGroups.value[0]!.items.length).toBe(1)
    expect(filteredGroups.value[0]!.items[0]!.name).toBe('XFormArray')
  })

  it('组件名命中（不区分大小写，当前 fixture 不含 Before → 期望空）', () => {
    const { filteredGroups, keyword } = makeSetup()
    keyword.value = 'BEFORE'
    expect(filteredGroups.value.length).toBe(0)
  })

  it('命中跨组（多个组都有结果时全部保留）', () => {
    const { filteredGroups, keyword } = makeSetup()
    keyword.value = 'X'
    // fixture 中只有 label/name 含 X（不区分大小写）的项命中
    expect(filteredGroups.value.length).toBe(1)
    expect(filteredGroups.value[0]!.items.map((i) => i.name)).toEqual(['XForm', 'XFormArray'])
  })

  it('整组无命中时该组被丢弃', () => {
    const { filteredGroups, keyword } = makeSetup()
    keyword.value = '数组'
    expect(filteredGroups.value.find((g) => g.title === '通用组件')).toBeUndefined()
  })

  it('所有组均无命中 → filteredGroups.length === 0 + isSearchActive === true', () => {
    const { filteredGroups, isSearchActive, keyword } = makeSetup()
    keyword.value = 'zzzzz'
    expect(filteredGroups.value.length).toBe(0)
    expect(isSearchActive.value).toBe(true)
  })

  it('keyword 全空白字符 → 等价于空 keyword', () => {
    const { filteredGroups, isSearchActive, keyword } = makeSetup()
    keyword.value = '   '
    expect(filteredGroups.value.length).toBe(2) // 原 groups 全保留
    expect(isSearchActive.value).toBe(false)
  })

  it('clearKeyword 后 keyword === "" + isSearchActive === false + filteredGroups === 原 groups', () => {
    const { filteredGroups, isSearchActive, keyword, clearKeyword } = makeSetup()
    keyword.value = '数组'
    expect(isSearchActive.value).toBe(true)
    clearKeyword()
    expect(keyword.value).toBe('')
    expect(isSearchActive.value).toBe(false)
    expect(filteredGroups.value.length).toBe(2)
  })

  it('折叠快照不被污染：进入搜索→清空后 collapsedGroups 值与搜索前完全一致', () => {
    const { collapsedGroups, keyword, clearKeyword } = makeSetup()
    collapsedGroups.value = new Set(['通用组件'])
    const before = new Set(collapsedGroups.value)
    keyword.value = '数组'
    // 搜索期间 collapsedGroups 值不变
    expect(collapsedGroups.value).toEqual(before)
    clearKeyword()
    // 清空后 collapsedGroups 值仍不变
    expect(collapsedGroups.value).toEqual(before)
  })

  it('进入搜索时不复制 collapsedGroups 到新 Set（保持外部引用）', () => {
    const { collapsedGroups, keyword } = makeSetup()
    const before = collapsedGroups.value
    keyword.value = '数组'
    expect(collapsedGroups.value).toBe(before)
  })
})
