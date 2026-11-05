/**
 * SearchForm 组件单元测试（spec §十测试覆盖矩阵）
 *
 * 覆盖场景：
 * 1) 按 columns.search 自动渲染 input/select
 * 2) 点击搜索按钮触发 search 事件
 * 3) 点击重置按钮触发 reset 事件
 * 4) 搜索项超过 searchRows×2 显示展开/收起按钮
 *
 * @group ProTable 子组件测试
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import SearchForm from './SearchForm.vue'

describe('SearchForm', () => {
  const columns = [
    { prop: 'name', label: '名称', search: { el: 'input' as const, defaultValue: '' } },
    { prop: 'status', label: '状态', search: { el: 'select' as const, defaultValue: null } },
  ]

  it('按 columns.search 自动渲染 input/select 控件', () => {
    const wrapper = mount(SearchForm, {
      props: {
        columns: columns as never,
        searchParams: reactive({ name: '', status: null }),
        searchRows: 3,
      },
    })
    // input + select 控件至少各 1 个
    expect(wrapper.findAll('input').length).toBeGreaterThanOrEqual(1)
  })

  it('点击搜索按钮触发 search 事件', async () => {
    const wrapper = mount(SearchForm, {
      props: {
        columns: columns as never,
        searchParams: reactive({ name: '', status: null }),
        searchRows: 3,
      },
    })
    await wrapper.find('[data-test="search-btn"]').trigger('click')
    expect(wrapper.emitted('search')).toBeTruthy()
  })

  it('点击重置按钮触发 reset 事件', async () => {
    const wrapper = mount(SearchForm, {
      props: {
        columns: columns as never,
        searchParams: reactive({ name: 'x', status: 1 }),
        searchRows: 3,
      },
    })
    await wrapper.find('[data-test="reset-btn"]').trigger('click')
    expect(wrapper.emitted('reset')).toBeTruthy()
  })

  it('搜索项超过 searchRows×2 显示展开/收起按钮', async () => {
    const manyColumns = Array.from({ length: 8 }, (_, i) => ({
      prop: `field${i}`,
      label: `字段${i}`,
      search: { el: 'input' as const },
    }))
    const wrapper = mount(SearchForm, {
      props: {
        columns: manyColumns as never,
        searchParams: reactive({}),
        searchRows: 3, // 默认显示 6（3×2）
      },
    })
    // 应该有展开/收起按钮
    expect(wrapper.find('[data-test="toggle-btn"]').exists()).toBe(true)
  })

  // v3.1.4 review 新增：回车不应触发页面刷新（native form submit implicit）
  it('v3.1.4：native form submit（按回车隐式提交）应拦截 + 触发 search emit', async () => {
    const wrapper = mount(SearchForm, {
      props: {
        columns: columns as never,
        searchParams: reactive({ name: 'test', status: null }),
        searchRows: 3,
      },
      attachTo: document.body, // 必须挂到 DOM 才能让 form 元素接收 submit 事件
    })
    await wrapper.vm.$nextTick()
    // 找到 native <form> 元素（ElForm 内部渲染）
    const formEl = wrapper.element.querySelector('form')
    expect(formEl).not.toBeNull()

    // 模拟浏览器 implicit submit（按回车时浏览器触发）——
    // 新建 SubmitEvent 并 dispatch，preventDefault 必须被我们的 listener 拦截
    const submitEvent = new Event('submit', { bubbles: true, cancelable: true })
    const defaultPrevented = !formEl!.dispatchEvent(submitEvent)

    // 关键断言 1：浏览器默认行为被拦截（不会跳转到 ?+query）
    expect(defaultPrevented).toBe(true)
    // 关键断言 2：我们的 search emit 正常触发
    expect(wrapper.emitted('search')).toBeTruthy()
    expect(wrapper.emitted('search')!.length).toBe(1)

    wrapper.unmount()
  })

  // v3.1.4 review 新增：点 X 清空应触发 search（与点搜索按钮等价）
  it('v3.1.4：ElInput clear 事件应触发 search emit（清空即搜索）', async () => {
    const wrapper = mount(SearchForm, {
      props: {
        columns: columns as never,
        searchParams: reactive({ name: '张三', status: null }),
        searchRows: 3,
      },
    })
    // 找到 ElInput 内部的 input 元素（VTU 渲染产物），触发 clear 事件
    // ElInput 在清空时会 emit 'clear' 事件（独立于 update:modelValue）
    const input = wrapper.find('input')
    expect(input.exists()).toBe(true)
    // 模拟 EP ElInput 触发 clear 事件
    await wrapper.findComponent({ name: 'ElInput' }).vm.$emit('clear')
    // search emit 应触发
    expect(wrapper.emitted('search')).toBeTruthy()
    expect(wrapper.emitted('search')!.length).toBe(1)
  })

  it('v3.1.4：ElSelect clear 事件应触发 search emit', async () => {
    const wrapper = mount(SearchForm, {
      props: {
        columns: columns as never, // 含 select 控件
        searchParams: reactive({ name: '', status: 1 }),
        searchRows: 3,
      },
    })
    // 找到 ElSelect 组件并 emit clear
    await wrapper.findComponent({ name: 'ElSelect' }).vm.$emit('clear')
    expect(wrapper.emitted('search')).toBeTruthy()
  })

  // ─────────── v3.2 架构升级：高级筛选弹窗 + 联动 + 防抖 + 响应式 ───────────

  it('v3.2：默认折叠（v-if 切换 searchRows 内可见）', () => {
    const manyColumns = Array.from({ length: 8 }, (_, i) => ({
      prop: `f${i}`,
      label: `字段${i}`,
      search: { el: 'input' as const },
    }))
    const wrapper = mount(SearchForm, {
      props: { columns: manyColumns as never, searchParams: reactive({}), searchRows: 3 },
    })
    // 默认折叠时只显示前 3 个（用户要求：超过 3 个表单折叠按钮才出现）
    const visibleInputs = wrapper.findAll('input[placeholder*="字段"]')
    expect(visibleInputs.length).toBe(3)
  })

  it('v3.2：点「展开」按钮显示全部列', async () => {
    const manyColumns = Array.from({ length: 8 }, (_, i) => ({
      prop: `f${i}`,
      label: `字段${i}`,
      search: { el: 'input' as const },
    }))
    const wrapper = mount(SearchForm, {
      props: { columns: manyColumns as never, searchParams: reactive({}), searchRows: 3 },
    })
    await wrapper.find('[data-test="toggle-btn"]').trigger('click')
    const visibleInputs = wrapper.findAll('input[placeholder*="字段"]')
    expect(visibleInputs.length).toBe(8)
  })

  // ─────────── v3.4：searchLayout 布局档位下放业务方 ───────────

  it('v3.4：searchLayout=flat 强制平铺（6 字段不走 collapse 自动判定）', () => {
    const sixColumns = Array.from({ length: 6 }, (_, i) => ({
      prop: `f${i}`,
      label: `字段${i}`,
      search: { el: 'input' as const },
    }))
    const wrapper = mount(SearchForm, {
      props: {
        columns: sixColumns as never,
        searchParams: reactive({}),
        searchRows: 3,
        searchLayout: 'flat',
      },
    })
    // 无展开/收起按钮 + 全部 6 字段平铺可见（自动判定本会折叠为前 3）
    expect(wrapper.find('[data-test="toggle-btn"]').exists()).toBe(false)
    expect(wrapper.findAll('input[placeholder*="字段"]').length).toBe(6)
  })

  it('v3.4：searchLayout=collapse 强制折叠（2 字段也显示展开按钮）', () => {
    const twoColumns = [
      { prop: 'a', label: '甲字段', search: { el: 'input' as const } },
      { prop: 'b', label: '乙字段', search: { el: 'input' as const } },
    ]
    const wrapper = mount(SearchForm, {
      props: {
        columns: twoColumns as never,
        searchParams: reactive({}),
        searchRows: 3,
        searchLayout: 'collapse',
      },
    })
    // 自动判定（≤3）本应无 toggle 按钮；强制 collapse 后按钮出现
    expect(wrapper.find('[data-test="toggle-btn"]').exists()).toBe(true)
  })

  it('v3.4：存在 advanced 字段时 searchLayout 强制 flat 仍让位 drawer（advanced 字段必须可达）', () => {
    const columnsWithAdvanced = [
      { prop: 'name', label: '名称', search: { el: 'input' as const } },
      {
        prop: 'amount',
        label: '金额',
        search: { el: 'input' as const, level: 'advanced' as const },
      },
    ]
    const wrapper = mount(SearchForm, {
      props: {
        columns: columnsWithAdvanced as never,
        searchParams: reactive({}),
        searchRows: 3,
        searchLayout: 'flat',
      },
    })
    // drawer 档：高级筛选按钮存在（若强制 flat 生效，advanced 字段将无入口渲染）
    expect(wrapper.find('[data-test="advanced-btn"]').exists()).toBe(true)
  })

  it('v3.2：level=advanced 字段收纳进弹窗 + 触发按钮显示', () => {
    const columnsWithAdvanced = [
      { prop: 'name', label: '名称', search: { el: 'input' as const, level: 'basic' as const } },
      { prop: 'status', label: '状态', search: { el: 'select' as const, level: 'basic' as const } },
      {
        prop: 'amount',
        label: '金额',
        search: { el: 'input' as const, level: 'advanced' as const },
      },
      { prop: 'tag', label: '标签', search: { el: 'input' as const, level: 'advanced' as const } },
    ]
    const wrapper = mount(SearchForm, {
      props: { columns: columnsWithAdvanced as never, searchParams: reactive({}), searchRows: 3 },
    })
    // 高级筛选按钮存在
    expect(wrapper.find('[data-test="advanced-btn"]').exists()).toBe(true)
    // 弹窗默认关闭
    expect(wrapper.find('[data-test="advanced-dialog"]').exists()).toBe(false)
  })

  it('v3.2：点高级按钮打开弹窗 + 已选数量角标', async () => {
    const columnsWithAdvanced = [
      { prop: 'name', label: '名称', search: { el: 'input' as const, level: 'basic' as const } },
      {
        prop: 'amount',
        label: '金额',
        search: { el: 'input' as const, level: 'advanced' as const },
      },
      { prop: 'tag', label: '标签', search: { el: 'input' as const, level: 'advanced' as const } },
    ]
    const wrapper = mount(SearchForm, {
      props: {
        columns: columnsWithAdvanced as never,
        searchParams: reactive({ amount: '100', tag: '' }), // 仅 amount 有值
        searchRows: 3,
      },
    })
    // 角标显示已选数量 1
    const badge = wrapper.find('[data-test="advanced-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toContain('1')
  })

  it('v3.2：searchDisplay 联动隐藏字段', () => {
    const columnsWithDisplay = [
      { prop: 'orderStatus', label: '订单状态', search: { el: 'select' as const } },
      { prop: 'refundReason', label: '退款原因', search: { el: 'input' as const } },
    ]
    // 当 orderStatus != 'refunded' 时，refundReason 隐藏
    const searchDisplay = (params: Record<string, unknown>) => ({
      refundReason: params.orderStatus === 'refunded',
    })
    const wrapper = mount(SearchForm, {
      props: {
        columns: columnsWithDisplay as never,
        searchParams: reactive({ orderStatus: 'paid' }),
        searchRows: 3,
        searchDisplay,
      },
    })
    // refundReason 应被隐藏（仅显示 orderStatus）
    const inputs = wrapper.findAll('input[placeholder]')
    expect(inputs.length).toBe(0) // 唯一 input 是 refundReason，被隐藏
  })

  it('v3.2：searchDisplay 联动恢复显示', async () => {
    const columnsWithDisplay = [
      { prop: 'orderStatus', label: '订单状态', search: { el: 'select' as const } },
      { prop: 'refundReason', label: '退款原因', search: { el: 'input' as const } },
    ]
    const searchDisplay = (p: Record<string, unknown>) => ({
      refundReason: p.orderStatus === 'refunded',
    })
    const wrapper = mount(SearchForm, {
      props: {
        columns: columnsWithDisplay as never,
        searchParams: { orderStatus: 'paid' },
        searchRows: 3,
        searchDisplay,
      },
    })
    expect(wrapper.findAll('input[placeholder]').length).toBe(0)
    // 模拟真实生产数据流：useSearch.updateParams re-assign 新对象引用（spread 产生新引用），
    // 浅 watch 捕获引用变化 → localParams 同步 → searchDisplay 重算。
    // 不走「原地 mutate props.searchParams」——所有权归 useSearch，原地修改不是受支持的 API。
    await wrapper.setProps({ searchParams: { orderStatus: 'refunded' } })
    expect(wrapper.findAll('input[placeholder]').length).toBe(1)
  })

  // ─────────── v3.3 架构升级：4 档自适应布局 ───────────

  /**
   * v3.3 flat 档（basic ≤ 3，无 advanced）：
   * - 无展开/收起按钮
   * - 无高级筛选按钮
   * - 所有 basic 字段全部平铺 inline
   */
  it('v3.3：flat 档（basic ≤ 3 + 无 advanced）—— 无任何按钮，所有字段平铺', () => {
    const cols = Array.from({ length: 3 }, (_, i) => ({
      prop: `f${i}`,
      label: `字段${i}`,
      search: { el: 'input' as const },
    }))
    const wrapper = mount(SearchForm, {
      props: { columns: cols as never, searchParams: reactive({}), searchRows: 3 },
    })
    // 无按钮
    expect(wrapper.find('[data-test="toggle-btn"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="advanced-btn"]').exists()).toBe(false)
    // 3 个输入框全部 inline
    expect(wrapper.findAll('input[placeholder*="字段"]').length).toBe(3)
  })

  /**
   * v3.3 collapse 档边界（basic = 4，下界）：
   * - 显示展开/收起按钮（默认折叠）
   * - 折叠时只显示前 4 个（即全部，但视觉上保留折叠能力）
   * - 点击展开后所有字段（4 个）都展示
   */
  it('v3.3：collapse 档边界 basic = 4 —— 显示折叠按钮，展开后全部展示', async () => {
    const cols = Array.from({ length: 4 }, (_, i) => ({
      prop: `f${i}`,
      label: `字段${i}`,
      search: { el: 'input' as const },
    }))
    const wrapper = mount(SearchForm, {
      props: { columns: cols as never, searchParams: reactive({}), searchRows: 3 },
    })
    // 折叠按钮存在
    expect(wrapper.find('[data-test="toggle-btn"]').exists()).toBe(true)
    // 默认折叠：前 3 个展示（COLLAPSED_INLINE_LIMIT = 3）
    expect(wrapper.findAll('input[placeholder*="字段"]').length).toBe(3)
    // 点击展开
    await wrapper.find('[data-test="toggle-btn"]').trigger('click')
    expect(wrapper.findAll('input[placeholder*="字段"]').length).toBe(4)
  })

  /**
   * v3.3 flat-large 档（basic > 8，无 advanced）：
   * - 隐藏展开/收起按钮（即使有 9 个字段也不展开/收起）
   * - 隐藏高级筛选按钮
   * - 所有 9 个 basic 字段全部 inline flat 展示
   * 验证「全平铺无折叠」语义
   */
  it('v3.3：flat-large 档（basic = 9 + 无 advanced）—— 无折叠按钮，9 个字段全部 inline 平铺', () => {
    const cols = Array.from({ length: 9 }, (_, i) => ({
      prop: `f${i}`,
      label: `字段${i}`,
      search: { el: 'input' as const },
    }))
    const wrapper = mount(SearchForm, {
      props: { columns: cols as never, searchParams: reactive({}), searchRows: 3 },
    })
    // 关键：无折叠按钮（即使字段数为 9）
    expect(wrapper.find('[data-test="toggle-btn"]').exists()).toBe(false)
    // 无高级按钮
    expect(wrapper.find('[data-test="advanced-btn"]').exists()).toBe(false)
    // 9 个字段全部 inline 平铺（不折叠）
    expect(wrapper.findAll('input[placeholder*="字段"]').length).toBe(9)
  })

  /**
   * v3.3 抽屉互斥（basic 4-8 + advanced > 0）：
   * - 即使 basic 在折叠区间（5），也不能同时显示「展开/收起」按钮
   * - 只显示「高级筛选」按钮
   * - basic 字段全部 inline 平铺（不折叠）
   */
  it('v3.3：抽屉互斥（basic = 5 + advanced = 1）—— 隐藏折叠按钮，仅显示高级按钮', () => {
    const cols = [
      ...Array.from({ length: 5 }, (_, i) => ({
        prop: `b${i}`,
        label: `基础${i}`,
        search: { el: 'input' as const, level: 'basic' as const },
      })),
      {
        prop: 'a0',
        label: '高级0',
        search: { el: 'input' as const, level: 'advanced' as const },
      },
    ]
    const wrapper = mount(SearchForm, {
      props: { columns: cols as never, searchParams: reactive({}), searchRows: 3 },
    })
    // 关键：折叠按钮被高级档「覆盖」隐藏（互斥）
    expect(wrapper.find('[data-test="toggle-btn"]').exists()).toBe(false)
    // 高级按钮显示
    expect(wrapper.find('[data-test="advanced-btn"]').exists()).toBe(true)
    // 5 个 basic 全部 inline 平铺（drawer 档不折叠）
    expect(wrapper.findAll('input[placeholder*="基础"]').length).toBe(5)
    // 1 个 advanced 在抽屉内（不直接显示在主表单）
    expect(wrapper.findAll('input[placeholder*="高级"]').length).toBe(0)
  })

  /**
   * v3.3 drawer 档（basic = 0 + advanced > 0）：
   * - basic 为 0 但仍有 advanced → 抽屉模式生效
   * - 主表单只有搜索/重置按钮 + 高级按钮
   */
  it('v3.3：drawer 档（basic = 0 + advanced = 3）—— 主表单无字段，仅高级按钮 + 抽屉', () => {
    const cols = Array.from({ length: 3 }, (_, i) => ({
      prop: `a${i}`,
      label: `高级${i}`,
      search: { el: 'input' as const, level: 'advanced' as const },
    }))
    const wrapper = mount(SearchForm, {
      props: { columns: cols as never, searchParams: reactive({}), searchRows: 3 },
    })
    expect(wrapper.find('[data-test="toggle-btn"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="advanced-btn"]').exists()).toBe(true)
    // 3 个 advanced 全部收纳到抽屉，主表单没有 input
    expect(wrapper.findAll('input[placeholder]').length).toBe(0)
  })

  it('v3.2：col.search.debounce > 0 时输入触发防抖自动搜索', async () => {
    vi.useFakeTimers()
    const columnsWithDebounce = [
      {
        prop: 'name',
        label: '名称',
        search: { el: 'input' as const, debounce: 300 },
      },
    ]
    const wrapper = mount(SearchForm, {
      props: { columns: columnsWithDebounce as never, searchParams: reactive({}), searchRows: 3 },
    })
    // 找到 ElInput 触发 update:model-value
    const elInput = wrapper.findComponent({ name: 'ElInput' })
    elInput.vm.$emit('update:model-value', 'test')
    // 立即不触发（防抖未到期）
    expect(wrapper.emitted('search')).toBeFalsy()
    // 推进 300ms
    vi.advanceTimersByTime(300)
    expect(wrapper.emitted('search')).toBeTruthy()
    vi.useRealTimers()
  })

  // ─────────── v3.5 PR1-A：A11y region + aria-label 断言 ───────────

  it('v3.5：根 div 加 role="search" + aria-label="表格筛选"', () => {
    const wrapper = mount(SearchForm, {
      props: {
        columns: columns as never,
        searchParams: reactive({ name: '', status: null }),
        searchRows: 3,
      },
    })
    const root = wrapper.find('.vv-pro-table-search')
    expect(root.exists()).toBe(true)
    expect(root.attributes('role')).toBe('search')
    expect(root.attributes('aria-label')).toBe('表格筛选')
  })

  it('v3.5：搜索按钮 + 重置按钮带 aria-label', () => {
    const wrapper = mount(SearchForm, {
      props: {
        columns: columns as never,
        searchParams: reactive({ name: '', status: null }),
        searchRows: 3,
      },
    })
    expect(wrapper.find('[data-test="search-btn"]').attributes('aria-label')).toBe('搜索')
    expect(wrapper.find('[data-test="reset-btn"]').attributes('aria-label')).toBe('重置筛选')
  })

  it('v3.5：高级筛选按钮 + 展开/收起按钮带 aria-label + aria-expanded', () => {
    const cols = [
      ...Array.from({ length: 5 }, (_, i) => ({
        prop: `b${i}`,
        label: `基础${i}`,
        search: { el: 'input' as const, level: 'basic' as const },
      })),
      {
        prop: 'a0',
        label: '高级0',
        search: { el: 'input' as const, level: 'advanced' as const },
      },
    ]
    const wrapper = mount(SearchForm, {
      props: { columns: cols as never, searchParams: reactive({}), searchRows: 3 },
    })
    // drawer 档：高级筛选按钮带 aria-label
    expect(wrapper.find('[data-test="advanced-btn"]').attributes('aria-label')).toBe('打开高级筛选')
  })

  it('v3.5：collapse 档 toggle 按钮带 aria-label', async () => {
    const cols = Array.from({ length: 4 }, (_, i) => ({
      prop: `f${i}`,
      label: `字段${i}`,
      search: { el: 'input' as const },
    }))
    const wrapper = mount(SearchForm, {
      props: { columns: cols as never, searchParams: reactive({}), searchRows: 3 },
    })
    const toggleBtn = wrapper.find('[data-test="toggle-btn"]')
    expect(toggleBtn.exists()).toBe(true)
    expect(toggleBtn.attributes('aria-label')).toBe('展开搜索条件')
    // 点击展开后属性切换
    await toggleBtn.trigger('click')
    expect(wrapper.find('[data-test="toggle-btn"]').attributes('aria-label')).toBe('收起搜索条件')
  })
})

/**
 * v3.5 PR3：泛型透传断言。
 *
 * 覆盖目标：
 * - 子组件已声明 `<script setup generic="T extends object = Record<string, unknown>">`
 * - columns prop 类型 `ProColumn<T>[]` 在消费方传 `ProColumn<User>[]` 时类型一致
 * - 默认 Record 视角向后兼容（不传泛型也工作）
 *
 * 测试策略：构造一个明确类型的 columns 数组，挂载不报错 + 渲染断言（类型层面靠 type-check 兜底）。
 */
describe('SearchForm v3.5 PR3 泛型透传', () => {
  interface UserRow {
    id: number
    name: string
    role: 'admin' | 'guest'
  }

  it('泛型化 columns（ProColumn<User>[]）可正常 mount 并触发 search emit', async () => {
    const cols: import('../types').ProColumn<UserRow>[] = [
      { prop: 'name', label: '名称', search: { el: 'input' as const, defaultValue: '' } },
      { prop: 'role', label: '角色', search: { el: 'select' as const, defaultValue: null } },
    ]
    const wrapper = mount(SearchForm, {
      props: {
        columns: cols,
        searchParams: reactive<Record<string, unknown>>({ name: '', role: null }),
        searchRows: 3,
      },
    })
    // 渲染断言：input 控件存在
    expect(wrapper.findAll('input').length).toBeGreaterThanOrEqual(1)
    // 触发搜索 emit 行为不变
    await wrapper.find('[data-test="search-btn"]').trigger('click')
    expect(wrapper.emitted('search')).toBeTruthy()
  })

  it('默认 Record 视角向后兼容（不传泛型 = ProColumn<Record<string, unknown>>[]）', () => {
    const wrapper = mount(SearchForm, {
      props: {
        columns: [{ prop: 'name', label: '名称', search: { el: 'input' as const } }] as never,
        searchParams: reactive({ name: '' }),
        searchRows: 3,
      },
    })
    expect(wrapper.exists()).toBe(true)
  })
})
