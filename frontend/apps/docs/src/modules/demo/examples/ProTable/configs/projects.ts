/**
 * ProTable v3.1 能力验证 demo 共享 mock（configs 层）。
 *
 * 角色：formatter / 行选择 / autoHeight / statePersist 四个 v3.1 demo 的共用数据源，
 * 字段形态刻意覆盖格式化与容错场景：金额含字符串非法值、布尔 0/1/boolean 混排、
 * 非法日期字符串 —— 供内置 formatter 预设的容错分支验证。
 *
 * 数据请求模拟 500ms 网络延迟 + title 关键字过滤（对应 persist demo 的搜索项）。
 *
 * @group ProTable demo mock
 */

/** v3.1 demo 行模型 —— extends Record 满足 ProTable 对行数据的索引签名约束 */
export interface ProjectRow extends Record<string, unknown> {
  id: number
  title: string
  /** 金额：部分行故意给字符串非法值，验证 amount 预设原样容错 */
  amount: number | string
  /** 进度：0~1 小数，验证 percent 预设 ×100 语义 */
  progress: number
  /** 完成态：布尔 / 0 / 1 混排，验证 boolTag 真值集合 */
  done: boolean | number
  createdAt: string
  shipDate: string
  remindAt: string
  /** 非法日期字符串，验证 dateTime 预设 isValid 守卫 */
  invalidDate: string
}

function generateRows(total: number): ProjectRow[] {
  return Array.from({ length: total }, (_, i) => ({
    id: i + 1,
    title: `项目-${i + 1}`,
    amount: i % 7 === 3 ? 'abc' : 19999.996 + i * 137.5,
    progress: (i % 10) / 10 + 0.0567,
    done: i % 3 === 0 ? true : i % 3 === 1 ? 0 : 1,
    createdAt: `2026-09-${String((i % 28) + 1).padStart(2, '0')} 1${i % 10}:2${i % 6}:0${i % 10}`,
    shipDate: `2026-10-${String((i % 28) + 1).padStart(2, '0')}`,
    remindAt: `08:${String(i % 60).padStart(2, '0')}:00`,
    invalidDate: 'not-a-date',
  }))
}

/** 全量项目台账：仅内部供 projectRequestApi 分页切片，外部不直接消费 */
const PROJECT_ROWS = generateRows(86)

/** 分页 mock：500ms 延迟；支持 title 过滤（statePersist demo 搜索项依赖） */
export async function projectRequestApi(params: Record<string, unknown>) {
  await new Promise((resolve) => setTimeout(resolve, 500))
  const { title, pageNum = 1, pageSize = 10 } = params
  let filtered = PROJECT_ROWS
  if (typeof title === 'string' && title) {
    filtered = filtered.filter((r) => r.title.includes(title))
  }
  const start = (Number(pageNum) - 1) * Number(pageSize)
  return {
    data: filtered.slice(start, start + Number(pageSize)),
    total: filtered.length,
    pageNum: Number(pageNum),
    pageSize: Number(pageSize),
  }
}
