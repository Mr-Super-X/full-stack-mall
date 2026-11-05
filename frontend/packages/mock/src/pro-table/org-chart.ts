/**
 * 树形数据 demo —— 组织架构 mock（spec §八.3 / Task 9）
 *
 * 4 层组织：公司 → 部门 → 小组 → 员工，懒加载模拟。
 * 注意：
 * - 使用 useTreeData 约定的 `_hasChildren` 字段（而非业务侧的 `hasChildren`）
 * - loadChildren 返回深拷贝（JSON.parse(JSON.stringify(...))）避免 normalize 多次触发时共享同一 children 引用 → Vue v-for Duplicate keys 警告
 */
import type { ProTableRequestApi } from '@vv/shared'

interface OrgNode extends Record<string, unknown> {
  id: string
  name: string
  _hasChildren?: boolean
  children?: OrgNode[]
}

const companyData: OrgNode[] = [{ id: 'company', name: '示例公司', _hasChildren: true }]

const mockChildren: Record<string, OrgNode[]> = {
  company: [
    { id: 'dept-rd', name: '研发部', _hasChildren: true },
    { id: 'dept-mkt', name: '市场部', _hasChildren: true },
  ],
  'dept-rd': [
    { id: 'team-fe', name: '前端组', _hasChildren: true },
    { id: 'team-be', name: '后端组', _hasChildren: false },
  ],
  'team-fe': [
    { id: 'emp-1', name: '张三', _hasChildren: false },
    { id: 'emp-2', name: '李四', _hasChildren: false },
  ],
  'dept-mkt': [{ id: 'emp-3', name: '王五', _hasChildren: false }],
}

export const orgChartRequestApi: ProTableRequestApi = async () => {
  await new Promise((r) => setTimeout(r, 200))
  return {
    data: companyData as unknown as Record<string, unknown>[],
    total: 1,
    pageNum: 1,
    pageSize: 10,
  }
}

export const loadOrgChildren = async (row: OrgNode) => {
  await new Promise((r) => setTimeout(r, 200))
  // 深拷贝避免 normalize 多次触发时共享同一 children 引用 → Vue v-for Duplicate keys
  return JSON.parse(JSON.stringify(mockChildren[row.id] ?? [])) as OrgNode[]
}
