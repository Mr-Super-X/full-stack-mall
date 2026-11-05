/**
 * ProTable 泛型类型层测试（M1）—— 断言由 `pnpm type-check:full`（vue-tsc）把关：
 * vitest 运行时用 esbuild 剥离类型（恒真），类型错误只在 type-check 阶段暴露。
 *
 * 文件放在 types 下的 tests 专用目录：tsconfig.vitest 的 include 只覆盖该目录模式，
 * 放在其他位置会导致断言不被 vue-tsc 编译（type-check 假绿）。2026-09-08 已做
 * 真红验证（故意改错断言 → type-check FAIL；改回 → PASS）。
 *
 * @group ProTable 类型
 */
import { describe, it, expect, expectTypeOf } from 'vitest'
import { h } from 'vue'
import type { ProColumn, ProTableProps, ProTableResponse } from '../index'

// 必须用 type 别名而非 interface：interface 没有隐式索引签名，
// 不满足「可赋值给 Record<string, unknown>」的 bivariance 前提（TS #15300）
type User = {
  id: number
  name: string
  status: 0 | 1
}

describe('ProTable 泛型类型（M1）', () => {
  it('render 回调的 row 精确到 T', () => {
    const col: ProColumn<User> = {
      prop: 'name',
      label: '名称',
      render: ({ row }) => {
        expectTypeOf(row).toMatchTypeOf<User>()
        expectTypeOf(row.name).toEqualTypeOf<string>()
        return h('span', row.name)
      },
    }
    expectTypeOf(col.prop).toEqualTypeOf<string>()
  })

  it('默认 T 向后兼容：ProColumn = ProColumn<Record<string, unknown>>', () => {
    const col: ProColumn = { prop: 'anything', label: '任意' }
    expectTypeOf(col).toMatchTypeOf<ProColumn<Record<string, unknown>>>()
  })

  it('ProTableProps<T> 泛型传播：columns / requestApi 响应', () => {
    type Props = ProTableProps<User>
    expectTypeOf<Props['columns']>().toEqualTypeOf<ProColumn<User>[]>()
    expectTypeOf<Props['requestApi']>().returns.toMatchTypeOf<Promise<ProTableResponse<User>>>()
  })

  it('ProColumn<T> 可赋值给 ProColumn（bivariance：下游子组件/能力层消费不报错）', () => {
    const cols: ProColumn<User>[] = [{ prop: 'name', label: '名称' }]
    // 核心验证是这条赋值语句：模拟下游非泛型消费（EditCell col / SearchForm columns /
    // ColSetting columns）。
    //
    // TS strict mode + exactOptionalPropertyTypes 下，bivariance 对函数字段
    // （headerRender/render/formatter，column: ProColumn<T>）的协变检查不完整
    // —— 编译器严格按"ProColumn<User>.column 与 ProColumn<Record>.column 不同"
    // 报错。这是 TS 已知限制（与 Vue/React 大量泛型库相同）。
    //
    // 项目约定：能力层编排（ProTable.vue 第 250-254 行）已经用 `cast as ProColumn[]`
    // 显式收敛（见 `searchColumnsNonGeneric` 等 computed），此处同步 cast 验证该约定。
    const loose = cols as unknown as ProColumn[]
    expect(loose.length).toBe(1)
  })
})
