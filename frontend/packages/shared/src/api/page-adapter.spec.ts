import { describe, it, expect, afterEach } from 'vitest'
import {
  adaptBackendPage,
  buildBackendPageQuery,
  configurePaginationAdapter,
  _getRequestFieldMap,
  _getResponseFieldMap,
  type PageQueryFieldMap,
  type PageResponseFieldMap,
} from './page-adapter'

/**
 * 注意：configurePaginationAdapter 是模块级副作用，会改变 _getRequestFieldMap /
 * _getResponseFieldMap 的返回值。每个 describe 块内根据需要设置/恢复默认配置。
 */
const ORIGINAL_REQUEST = { ..._getRequestFieldMap() }
const ORIGINAL_RESPONSE = { ..._getResponseFieldMap() }

afterEach(() => {
  // 恢复 v2 默认值，避免跨用例污染
  configurePaginationAdapter({
    request: ORIGINAL_REQUEST,
    response: ORIGINAL_RESPONSE,
  })
})

describe('adaptBackendPage（默认 v2 字段）', () => {
  it('records/current/size 映射到 Pagination 字段', () => {
    const raw = {
      records: [{ id: 1 }, { id: 2 }],
      total: 10,
      size: 2,
      current: 3,
    }
    expect(adaptBackendPage(raw)).toEqual({
      list: [{ id: 1 }, { id: 2 }],
      total: 10,
      page: 3,
      pageSize: 2,
    })
  })

  it('空 records 也正确处理', () => {
    expect(adaptBackendPage({ records: [], total: 0, size: 10, current: 1 })).toEqual({
      list: [],
      total: 0,
      page: 1,
      pageSize: 10,
    })
  })

  it('pages 字段被忽略（不影响适配结果）', () => {
    const raw = {
      records: [{ id: 1 }],
      total: 1,
      size: 10,
      current: 1,
      pages: 1,
    }
    const { pages: _ignored, ...rest } = raw
    expect(adaptBackendPage(rest)).toEqual({
      list: [{ id: 1 }],
      total: 1,
      page: 1,
      pageSize: 10,
    })
  })

  it('records 内部对象类型透传（泛型 T）', () => {
    interface Item {
      id: number
      name: string
    }
    const raw = {
      records: [{ id: 1, name: 'a' }],
      total: 1,
      size: 10,
      current: 1,
    }
    const result = adaptBackendPage<Item>(raw)
    expect(result.list[0]?.name).toBe('a')
  })
})

describe('adaptBackendPage（自定义字段映射）', () => {
  it('团队 B 后端：list / page / pageSize / total_records', () => {
    const fieldMap: PageResponseFieldMap = {
      listField: 'list',
      pageField: 'page',
      pageSizeField: 'pageSize',
      totalField: 'total_records',
    }
    const raw = {
      list: [{ id: 1 }],
      page: 2,
      pageSize: 20,
      total_records: 100,
    }
    expect(adaptBackendPage(raw, fieldMap)).toEqual({
      list: [{ id: 1 }],
      total: 100,
      page: 2,
      pageSize: 20,
    })
  })

  it('部分覆盖字段映射：只改 listField，其他走默认', () => {
    const raw = {
      data: [{ id: 1 }],
      records: [{ id: 99 }],
      total: 5,
      size: 10,
      current: 1,
    }
    const result = adaptBackendPage(raw, { listField: 'data' })
    expect(result.list).toEqual([{ id: 1 }])
    expect(result.total).toBe(5)
  })

  it('字段缺失走默认：total 缺失 → 0', () => {
    const raw = {
      records: [{ id: 1 }],
      size: 10,
      current: 1,
    }
    expect(adaptBackendPage(raw).total).toBe(0)
  })

  it('字段缺失走默认：records 缺失 → 空数组', () => {
    const raw = { total: 5, size: 10, current: 1 }
    expect(adaptBackendPage(raw).list).toEqual([])
  })
})

describe('buildBackendPageQuery（默认 v2 字段）', () => {
  it('page/pageSize 映射到 pageIndex/pageSize', () => {
    expect(buildBackendPageQuery({ page: 2, pageSize: 20 })).toEqual({
      pageIndex: 2,
      pageSize: 20,
    })
  })

  it('缺省值：page 默认 1，pageSize 默认 10', () => {
    expect(buildBackendPageQuery({})).toEqual({
      pageIndex: 1,
      pageSize: 10,
    })
  })

  it('只传 page（pageSize 走默认）', () => {
    expect(buildBackendPageQuery({ page: 5 })).toEqual({
      pageIndex: 5,
      pageSize: 10,
    })
  })

  it('只传 pageSize（page 走默认）', () => {
    expect(buildBackendPageQuery({ pageSize: 50 })).toEqual({
      pageIndex: 1,
      pageSize: 50,
    })
  })

  it('page=1 与后端 pageIndex=1 同义（无需 offset）', () => {
    expect(buildBackendPageQuery({ page: 1, pageSize: 10 }).pageIndex).toBe(1)
  })
})

describe('buildBackendPageQuery（自定义字段映射）', () => {
  it('团队 B 后端：pageField=p', () => {
    expect(buildBackendPageQuery({ page: 2, pageSize: 20 }, { pageField: 'p' })).toEqual({
      p: 2,
      pageSize: 20,
    })
  })

  it('团队 C 后端：pageSizeField=size', () => {
    expect(buildBackendPageQuery({ page: 1, pageSize: 50 }, { pageSizeField: 'size' })).toEqual({
      pageIndex: 1,
      size: 50,
    })
  })

  it('团队 D 后端：两个字段都改', () => {
    const fieldMap: PageQueryFieldMap = {
      pageField: 'p',
      pageSizeField: 'limit',
    }
    expect(buildBackendPageQuery({ page: 3, pageSize: 15 }, fieldMap)).toEqual({
      p: 3,
      limit: 15,
    })
  })
})

describe('configurePaginationAdapter（全局配置）', () => {
  it('默认返回 v2 字段映射', () => {
    expect(_getRequestFieldMap()).toEqual({
      pageField: 'pageIndex',
      pageSizeField: 'pageSize',
    })
    expect(_getResponseFieldMap()).toEqual({
      listField: 'records',
      pageField: 'current',
      pageSizeField: 'size',
      totalField: 'total',
    })
  })

  it('覆盖请求字段映射后生效', () => {
    configurePaginationAdapter({ request: { pageField: 'p' } })
    expect(_getRequestFieldMap().pageField).toBe('p')
    // 未覆盖的字段保持默认
    expect(_getRequestFieldMap().pageSizeField).toBe('pageSize')
  })

  it('覆盖响应字段映射后生效', () => {
    configurePaginationAdapter({ response: { listField: 'items' } })
    expect(_getResponseFieldMap().listField).toBe('items')
    expect(_getResponseFieldMap().pageField).toBe('current')
  })

  it('同时覆盖请求和响应字段映射', () => {
    configurePaginationAdapter({
      request: { pageField: 'p', pageSizeField: 'limit' },
      response: { listField: 'items', totalField: 'total_records' },
    })
    expect(_getRequestFieldMap()).toEqual({
      pageField: 'p',
      pageSizeField: 'limit',
    })
    expect(_getResponseFieldMap()).toEqual({
      listField: 'items',
      pageField: 'current',
      pageSizeField: 'size',
      totalField: 'total_records',
    })
  })

  it('配置生效后 buildBackendPageQuery 自动用新映射', () => {
    configurePaginationAdapter({ request: { pageField: 'p' } })
    expect(buildBackendPageQuery({ page: 1, pageSize: 10 })).toEqual({
      p: 1,
      pageSize: 10,
    })
  })

  it('配置生效后 adaptBackendPage 自动用新映射', () => {
    configurePaginationAdapter({ response: { listField: 'items' } })
    expect(adaptBackendPage({ items: [{ id: 1 }], current: 1, size: 10, total: 1 })).toEqual({
      list: [{ id: 1 }],
      page: 1,
      pageSize: 10,
      total: 1,
    })
  })
})
