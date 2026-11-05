/**
 * ProTableGroupedHeader demo —— 员工信息 mock（按"基础信息/业务信息"分组演示）
 *
 * mock 数据：60 名员工，部门在 研发/产品/设计/运营 间循环
 */
import type { ProTableRequestApi } from '@vv/shared'

interface Employee {
  id: number
  name: string
  email: string
  phone: string
  department: string
  joinDate: string
  salary: number
}

const DEPTS = ['研发', '产品', '设计', '运营']
const ALL_MOCK: Employee[] = Array.from({ length: 60 }, (_, i) => ({
  id: i + 1,
  name: `员工-${i + 1}`,
  email: `user${i + 1}@company.com`,
  phone: `138${String(10000000 + i).slice(-8)}`,
  department: DEPTS[i % 4]!,
  joinDate: `202${i % 7}-${String((i % 9) + 1).padStart(2, '0')}-15`,
  salary: 10000 + (i % 50) * 1000,
}))

export const groupedEmployeesRequestApi: ProTableRequestApi<Employee> = async (params) => {
  await new Promise((r) => setTimeout(r, 300))
  const pageNum = Number(params['pageNum'] ?? 1)
  const pageSize = Number(params['pageSize'] ?? 10)
  const start = (pageNum - 1) * pageSize
  return {
    data: ALL_MOCK.slice(start, start + pageSize),
    total: ALL_MOCK.length,
    pageNum,
    pageSize,
  }
}
