/**
 * useSearch composable 单元测试（spec §十测试覆盖矩阵）
 *
 * 覆盖场景：
 * 1) 初始化填 defaultValue + initParam
 * 2) reset() 恢复 defaultValue + 清空用户输入
 * 3) serializeParams 剔除 undefined/null/''，保留 0/false（附录 A #10）
 * 4) getParams 返回当前 searchParams 快照
 * 5) setSearchParams 替换表单值 + 触发 fetchHook + 回到第 1 页
 *
 * @group ProTable composables 测试
 */
import { describe, it, expect, vi } from 'vitest'
import { useSearch } from './useSearch'

describe('useSearch', () => {
  const makeProps = () =>
    ({
      columns: [
        { prop: 'name', label: '名称', search: { el: 'input', defaultValue: '' } },
        { prop: 'status', label: '状态', search: { el: 'select', defaultValue: null } },
      ],
      initParam: { tenantId: 't1' },
    }) as never

  it('初始化时填入 defaultValue + initParam', () => {
    const search = useSearch({ props: makeProps() })
    expect(search.searchParams.value).toEqual({ tenantId: 't1', name: '', status: null })
  })

  it('reset() 恢复 defaultValue + 清空用户输入', async () => {
    const search = useSearch({ props: makeProps() })
    search.searchParams.value.name = '张三'
    await search.reset()
    expect(search.searchParams.value).toEqual({ tenantId: 't1', name: '', status: null })
  })

  it('serializeParams 剔除 undefined / null / 空字符串（保留 0/false）', () => {
    const search = useSearch({ props: makeProps() })
    const out = search.serializeParams({
      a: 1,
      b: 0,
      c: false,
      d: '',
      e: null,
      f: undefined,
      g: 'x',
    })
    expect(out).toEqual({ a: 1, b: 0, c: false, g: 'x' })
  })

  it('getParams 返回当前 searchParams 快照', () => {
    const search = useSearch({ props: makeProps() })
    expect(search.getParams()).toEqual({ tenantId: 't1', name: '', status: null })
  })

  it('setSearchParams 替换表单值', async () => {
    const fetchHook = vi.fn()
    const search = useSearch({ props: makeProps(), fetchHook })
    await search.setSearchParams({ name: '李四', status: 1 })
    expect(search.searchParams.value).toEqual({ name: '李四', status: 1, tenantId: 't1' })
    expect(fetchHook).toHaveBeenCalled()
  })

  it('updateParams 纯写参数且不触发 fetchHook（H2 修复：输入与请求解耦）', () => {
    const fetchHook = vi.fn()
    const search = useSearch({ props: makeProps(), fetchHook })
    search.updateParams({ name: '王五' })
    expect(search.searchParams.value).toEqual({ name: '王五', status: null, tenantId: 't1' })
    expect(fetchHook).not.toHaveBeenCalled()
  })

  // review R1 回归：initParam 与搜索列同名时不再被 defaultValue ?? null 静默覆盖
  it('initParam 与搜索列同名时覆盖 defaultValue（修复静默丢失缺陷）', () => {
    const search = useSearch({
      props: {
        columns: [
          { prop: 'name', label: '名称', search: { el: 'input', defaultValue: '' } },
          { prop: 'status', label: '状态', search: { el: 'select' } }, // 无 defaultValue
        ],
        initParam: { status: 'paid', tenantId: 't1' },
      } as never,
    })
    // 修复前：status 被改写为 null，经 serializeParams 剔除后永久丢失
    expect(search.searchParams.value).toEqual({ name: '', status: 'paid', tenantId: 't1' })
    expect(search.serializeParams(search.searchParams.value)).toEqual({
      status: 'paid',
      tenantId: 't1',
    })
  })

  it('reset() 时无 defaultValue 的字段回退恢复 initParam 同名键', async () => {
    const search = useSearch({
      props: {
        columns: [
          { prop: 'name', label: '名称', search: { el: 'input', defaultValue: '' } },
          { prop: 'status', label: '状态', search: { el: 'select' } }, // 无 defaultValue
        ],
        initParam: { status: 'paid' },
      } as never,
    })
    search.updateParams({ status: 'shipped' })
    await search.reset()
    // 修复前 reset 恢复 null（initParam 丢失）；修复后回退到 initParam 值
    expect(search.searchParams.value).toEqual({ name: '', status: 'paid' })
  })
})
