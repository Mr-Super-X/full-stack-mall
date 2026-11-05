/**
 * ProTable Overview demo 共享 mock（configs 层）。
 *
 * 角色：ProTableOverview 的 dataSource —— 演示 columns 驱动搜索 + 表格 + 多选 + 4 类能力切换。
 * 字段形态刻意贴近真实业务：用户列表（id / name / age / status / role / createdAt）。
 *
 * 字段选择理由：
 * - id / name / age：基础展示列
 * - status (number 1/0/-1)：演示 enum 自动渲染 ElTag（启用/禁用/锁定 三档）
 * - role (string)：演示 search.select 搜索项
 * - createdAt：演示格式化（保留时分秒）
 *
 * @group ProTable demo mock
 */

/** Overview demo 行模型 —— extends Record 满足 ProTable 对行数据的索引签名约束 */
export interface OverviewUserRow extends Record<string, unknown> {
  id: number
  name: string
  age: number
  /** 状态：1 启用 / 0 禁用 / -1 锁定 —— 演示 enum 自动渲染 ElTag */
  status: number
  role: string
  createdAt: string
}

/** 字典：status enum 选项（与 OverviewUserRow.status 字段对应） */
export const STATUS_OPTIONS = [
  { label: '启用', value: 1, tagType: 'success' as const },
  { label: '禁用', value: 0, tagType: 'info' as const },
  { label: '锁定', value: -1, tagType: 'danger' as const },
]

/** 字典：role 选项（演示 search.select 搜索项） */
export const ROLE_OPTIONS = [
  { label: '管理员', value: 'admin' },
  { label: '编辑', value: 'editor' },
  { label: '访客', value: 'guest' },
]

/** 生成全量 mock 数据：固定种子 + 简单循环取模，127 行可控 */
function generateOverviewUsers(total: number): OverviewUserRow[] {
  return Array.from({ length: total }, (_, i) => ({
    id: i + 1,
    name: `用户-${i + 1}`,
    age: 20 + (i % 40),
    status: [1, 1, 1, 0, -1][i % 5]!,
    role: ['admin', 'editor', 'guest'][i % 3]!,
    createdAt: `2026-09-${String((i % 30) + 1).padStart(2, '0')} 10:00:00`,
  }))
}

/** 全量 mock：仅内部供 overviewRequestApi 分页切片，外部不直接消费 */
const OVERVIEW_USERS = generateOverviewUsers(127)

/** 分页 mock：500ms 延迟；支持 name / status / role 三字段过滤（演示 search 项联动） */
export async function overviewRequestApi(params: Record<string, unknown>) {
  await new Promise((resolve) => setTimeout(resolve, 500))
  const { name, status, role, pageNum = 1, pageSize = 10 } = params
  let filtered = OVERVIEW_USERS
  if (typeof name === 'string' && name) {
    filtered = filtered.filter((u) => u.name.includes(name))
  }
  if (status !== undefined && status !== null && status !== '') {
    filtered = filtered.filter((u) => u.status === status)
  }
  if (typeof role === 'string' && role) {
    filtered = filtered.filter((u) => u.role === role)
  }
  const start = (Number(pageNum) - 1) * Number(pageSize)
  return {
    data: filtered.slice(start, start + Number(pageSize)),
    total: filtered.length,
    pageNum: Number(pageNum),
    pageSize: Number(pageSize),
  }
}
