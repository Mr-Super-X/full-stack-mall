/**
 * 行拖拽 demo —— 待办任务 mock（spec §八.3 / Task 11）
 */
import type { ProTableRequestApi } from '@vv/shared'

interface Task {
  id: string
  title: string
  priority: 'P0' | 'P1' | 'P2' | 'P3'
}

const mockTasks: Task[] = [
  { id: '1', title: '修复登录 bug', priority: 'P0' },
  { id: '2', title: '完善 ProTable 文档', priority: 'P1' },
  { id: '3', title: '开发新组件', priority: 'P2' },
  { id: '4', title: '代码 review', priority: 'P3' },
]

export const tasksRequestApi: ProTableRequestApi = async () => {
  await new Promise((r) => setTimeout(r, 200))
  return {
    data: mockTasks as unknown as Record<string, unknown>[],
    total: mockTasks.length,
    pageNum: 1,
    pageSize: 10,
  }
}
