/**
 * ProTable 虚拟滚动 mock 数据（v3.0.1 升级：10 万行 × 10 列含固定列）
 *
 * 数据规模选择依据：
 * - v1 引擎（el-table）在 3000 行流畅、10000 行卡顿
 * - v2 引擎（el-table-v2）目标支持 10 万行 × 10 列，首屏 < 1s，滚动 avgFPS ≥ 100
 *
 * @group ProTable Mock 数据
 */

export interface BigRow {
  /** ID —— 左固定列 */
  id: number
  /** 姓名 */
  name: string
  /** 邮箱 */
  email: string
  /** 部门 —— 左固定列 */
  department: string
  /** 状态：active / inactive */
  status: 'active' | 'inactive'
  /** 评分（用于排序） */
  score: number
  /** 城市 */
  city: string
  /** 入职日期 ISO string */
  joinDate: string
  /** 等级（用于排序） */
  level: number
  /** 备注 */
  remark: string
}

/** 列表请求参数 —— 与 useTable fetchHook 兼容（pageNum / pageSize / keyword / name / orderByColumn / isAsc） */
interface BigDataRequest {
  pageNum?: number
  pageSize?: number
  /** 关键字（name/email 模糊匹配）——虚拟 demo 的隐藏搜索字段 prop */
  keyword?: string
  /** 姓名模糊匹配 —— 搜索表单挂在 name 列时传入（与 keyword 等义，二选一） */
  name?: string
  orderByColumn?: string
  isAsc?: string
}

const DEPARTMENTS = [
  '研发部',
  '产品部',
  '设计部',
  '运营部',
  '市场部',
  '销售部',
  '人事部',
  '财务部',
] as const
const CITIES = [
  '北京',
  '上海',
  '广州',
  '深圳',
  '杭州',
  '成都',
  '武汉',
  '南京',
  '西安',
  '苏州',
] as const
const STATUSES: Array<'active' | 'inactive'> = ['active', 'inactive']

function makeBigRow(i: number): BigRow {
  const id = i + 1
  // 非空断言：i 模 length 永远 ≤ length-1，DEPARTMENTS[i%N] 必返回有效值
  const dept = DEPARTMENTS[i % DEPARTMENTS.length]!
  const city = CITIES[i % CITIES.length]!
  const status = STATUSES[i % STATUSES.length]!
  return {
    id,
    name: `员工-${id.toString().padStart(6, '0')}`,
    email: `user${id}@example.com`,
    department: dept,
    status,
    score: Math.floor(Math.random() * 1000),
    city,
    joinDate: new Date(2020 + (i % 6), i % 12, (i % 28) + 1).toISOString().slice(0, 10),
    level: (i % 10) + 1,
    remark: i % 5 === 0 ? `备注信息-${id}` : '',
  }
}

/** 模块级一次性生成 10 万行（mock 阶段直接全量返回，不分页） */
const ALL_ROWS: BigRow[] = Array.from({ length: 100_000 }, (_, i) => makeBigRow(i))

/** 关键字过滤（keyword 与 name 等义：demo 搜索表单挂在 name 列，传 name 参数） */
function filterByKeyword(rows: BigRow[], keyword?: string): BigRow[] {
  if (!keyword) return rows
  const kw = String(keyword).toLowerCase()
  return rows.filter((r) => r.name.toLowerCase().includes(kw) || r.email.toLowerCase().includes(kw))
}

/** 排序 */
function sortByField(rows: BigRow[], orderBy?: string, isAsc?: string): BigRow[] {
  if (!orderBy || !isAsc) return rows
  // useTable serializeSort 约定 'asc' | 'desc'（D2 决策）；兼容历史 'ascending' 写法
  const asc = isAsc === 'asc' || isAsc === 'ascending'
  return [...rows].sort((a, b) => {
    const av = (a as unknown as Record<string, unknown>)[orderBy]
    const bv = (b as unknown as Record<string, unknown>)[orderBy]
    if (typeof av === 'number' && typeof bv === 'number') {
      return asc ? av - bv : bv - av
    }
    const as = String(av ?? '')
    const bs = String(bv ?? '')
    return asc ? as.localeCompare(bs) : bs.localeCompare(as)
  })
}

/**
 * 虚拟滚动 mock requestApi
 *
 * 虚拟化 demo 特殊语义：
 * - 不分页（pageSize 始终 = 全部行数），让虚拟化引擎自行接管滚动
 * - 业务场景真实分页时由后端处理；这里 mock 阶段直接返回全集
 * - 返回形态按 ProTableRequestApi 约定（data/total/pageNum/pageSize）
 */
/** 调用计数（window 暴露给浏览器调试用） */
let callCount = 0
if (typeof window !== 'undefined') {
  ;(window as unknown as { __bigDataCallCount?: number }).__bigDataCallCount = 0
}

export const bigDataRequestApi = async (
  params: BigDataRequest = {}
): Promise<{ data: BigRow[]; total: number; pageNum: number; pageSize: number }> => {
  callCount++
  if (typeof window !== 'undefined') {
    ;(window as unknown as { __bigDataCallCount?: number }).__bigDataCallCount = callCount
  }

  // 模拟网络延迟 600ms：首次让骨架屏可感知；刷新/搜索/排序的 loading 遮罩也需停留足够久
  await new Promise((resolve) => setTimeout(resolve, 600))

  const filtered = filterByKeyword(ALL_ROWS, params.keyword ?? params.name)
  const sorted = sortByField(filtered, params.orderByColumn, params.isAsc)
  // 虚拟化场景：忽略 pageSize 截断，一次性返回全部（让虚拟滚动引擎管理可见区）
  return {
    data: sorted,
    total: sorted.length,
    pageNum: params.pageNum ?? 1,
    pageSize: sorted.length,
  }
}
