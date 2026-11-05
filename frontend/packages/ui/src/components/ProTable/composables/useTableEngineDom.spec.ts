/**
 * useTableEngineDom 单元测试
 */
import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useTableEngineDom } from './useTableEngineDom'

describe('useTableEngineDom', () => {
  it('proTableEl 为 null 时返回 null', () => {
    const proTableEl = ref(null)
    const { getTbody } = useTableEngineDom({ proTableEl })
    expect(getTbody()).toBeNull()
  })

  it('proTableEl.$el 不存在时返回 null', () => {
    const proTableEl = ref({})
    const { getTbody } = useTableEngineDom({ proTableEl })
    expect(getTbody()).toBeNull()
  })

  it('proTableEl.$el 无 .el-table__body tbody 子元素时返回 null', () => {
    const div = document.createElement('div')
    const proTableEl = ref({ $el: div })
    const { getTbody } = useTableEngineDom({ proTableEl })
    expect(getTbody()).toBeNull()
  })

  it('存在 .el-table__body tbody 子元素时返回该元素', () => {
    const table = document.createElement('div')
    table.className = 'el-table'
    const body = document.createElement('div')
    body.className = 'el-table__body'
    const tbody = document.createElement('tbody')
    body.appendChild(tbody)
    table.appendChild(body)
    document.body.appendChild(table)

    const proTableEl = ref({ $el: table })
    const { getTbody } = useTableEngineDom({ proTableEl })
    expect(getTbody()).toBe(tbody)

    document.body.removeChild(table)
  })
})
