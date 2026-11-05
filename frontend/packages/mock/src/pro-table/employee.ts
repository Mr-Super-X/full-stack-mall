/**
 * 行内编辑 demo —— 员工列表 mock（spec §八.3）
 *
 * mock 数据：5 名员工，工资 1.2w~8w，其中钱七工资 8w 触发业务超限校验。
 */
import type { ProTableRequestApi } from '@vv/shared'

interface Employee {
  id: string
  name: string
  dept: string
  salary: number
  hiredAt: string
}

const mockData: Employee[] = [
  { id: '1', name: '张三', dept: '研发部', salary: 18000, hiredAt: '2024-03-15' },
  { id: '2', name: '李四', dept: '研发部', salary: 25000, hiredAt: '2023-07-01' },
  { id: '3', name: '王五', dept: '市场部', salary: 15000, hiredAt: '2025-01-10' },
  { id: '4', name: '赵六', dept: '市场部', salary: 12000, hiredAt: '2025-06-20' },
  { id: '5', name: '钱七', dept: '人事部', salary: 80000, hiredAt: '2022-11-05' }, // 触发工资超限
]

export const employeeRequestApi: ProTableRequestApi = async () => {
  await new Promise((r) => setTimeout(r, 200))
  return {
    data: mockData as unknown as Record<string, unknown>[],
    total: mockData.length,
    pageNum: 1,
    pageSize: 10,
  }
}
