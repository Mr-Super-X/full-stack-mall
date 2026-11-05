/**
 * DictSelect 组件单测。
 *
 * 覆盖：
 * 1. 渲染：根节点 BEM class、options 数量 = fixture 长度
 * 2. optionBind 字段映射：value / label / disabled 落到 el-option
 * 3. v-model 桥接：modelValue → el-select；el-select update → emit('update:modelValue')
 * 4. $attrs 透传：clearable / filterable / placeholder 落到 el-select
 * 5. 空值 selectBind：modelValue=null/undefined 时不绑 modelValue
 * 6. dictCode 切换 → watch 触发 → 再次 useDict
 *
 * Mock 策略：vi.mock('@vv/shared') 静态替身。
 * DictSelect 内部用 `useDict(props.dictCode)` 拿字典，测试用 dictStore[code].value 直接控制数据。
 *
 * EP 组件策略：直接使用真实 Element Plus 组件 + findComponent。
 * 原因：vitest.config.ts 已 inline: ['element-plus']，EP 在测试环境自动注册，
 * 自定义 stub 会被覆盖。真实 el-select 在 jsdom 下渲染完整结构（dropdown 通过 teleport 渲染，
 * 但组件实例可访问）；通过 findComponent 拿到实例后用 props() / vm.$emit() 验证契约。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import type { Ref } from 'vue'
import { mount } from '@vue/test-utils'
import type { DictItem } from '@vv/shared'

// hoisted：vi.mock 工厂闭包外可访问；vi.fn() 在 hoist 阶段创建
const { dictStore, useDictMock } = vi.hoisted(() => ({
  dictStore: {} as Record<string, Ref<DictItem[]>>,
  useDictMock: vi.fn(),
}))

// 说明符 '@composables/useDict' 经 codemod 收敛为 '@vv/shared' barrel（2026-10-26）——
// 单点 mock 须 importOriginal 展开其余导出（SUT 的 EP 组件依赖 barrel 其它具名）
vi.mock('@vv/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vv/shared')>()
  return { ...actual, useDict: useDictMock }
})

import DictSelect from './DictSelect.vue'

const genderFixture: DictItem[] = [
  { value: '1', label: '男' },
  { value: '2', label: '女', disabled: true },
]

beforeEach(() => {
  // 清空 store + 重设实现
  for (const key of Object.keys(dictStore)) delete dictStore[key]
  useDictMock.mockReset()
  useDictMock.mockImplementation((...codes: string[]) => {
    for (const code of codes) {
      if (!(code in dictStore)) {
        dictStore[code] = ref<DictItem[]>([])
      }
    }
    return dictStore
  })
})

function mountDictSelect(props: Record<string, unknown> = {}) {
  return mount(DictSelect, {
    props: { dictCode: 'gender', ...props },
  })
}

/** 拿到内部 el-select 组件实例 */
function getElSelect(wrapper: ReturnType<typeof mountDictSelect>) {
  return wrapper.findComponent({ name: 'ElSelect' })
}

/** 拿到全部 el-option 组件实例 */
function getElOptions(wrapper: ReturnType<typeof mountDictSelect>) {
  return wrapper.findAllComponents({ name: 'ElOption' })
}

describe('DictSelect', () => {
  describe('渲染', () => {
    it('根节点带 BEM 命名空间 vv-dict-select', () => {
      const wrapper = mountDictSelect()
      // BEM class 通过 :class="bem.b()" 传到 el-select 根节点
      expect(getElSelect(wrapper).classes()).toContain('vv-dict-select')
    })

    it('options 数量等于 fixture 长度', async () => {
      const wrapper = mountDictSelect()
      await nextTick()
      dictStore['gender'].value = genderFixture
      await nextTick()
      expect(getElOptions(wrapper)).toHaveLength(2)
    })

    it('字典为空时：0 个 option，不报错', () => {
      const wrapper = mountDictSelect()
      expect(getElOptions(wrapper)).toHaveLength(0)
    })
  })

  describe('optionBind 字段映射', () => {
    it('option 上正确映射 value / label', async () => {
      const wrapper = mountDictSelect()
      await nextTick()
      dictStore['gender'].value = genderFixture
      await nextTick()
      const options = getElOptions(wrapper)
      expect(options[0]?.props('value')).toBe('1')
      expect(options[0]?.props('label')).toBe('男')
      expect(options[1]?.props('value')).toBe('2')
      expect(options[1]?.props('label')).toBe('女')
    })

    it('disabled 字段映射到 el-option 的 disabled', async () => {
      const wrapper = mountDictSelect()
      await nextTick()
      dictStore['gender'].value = genderFixture
      await nextTick()
      const options = getElOptions(wrapper)
      // 第一个未禁用
      expect(options[0]?.props('disabled')).toBeFalsy()
      // 第二个 disabled:true
      expect(options[1]?.props('disabled')).toBe(true)
    })
  })

  describe('v-model 桥接', () => {
    it('modelValue → 透传到 el-select', async () => {
      const wrapper = mountDictSelect({ modelValue: '1' })
      await nextTick()
      expect(getElSelect(wrapper).props('modelValue')).toBe('1')
    })

    it('el-select emit update:modelValue → 父组件 emit("update:modelValue")', async () => {
      const wrapper = mountDictSelect()
      await nextTick()
      // 直接触发 el-select 的 emit（模拟用户选择 option）
      getElSelect(wrapper).vm.$emit('update:modelValue', '2')
      expect(wrapper.emitted('update:modelValue')).toEqual([['2']])
    })

    it('el-select emit update:modelValue=null → 父组件收到 null（清空场景）', async () => {
      const wrapper = mountDictSelect({ modelValue: '1' })
      await nextTick()
      getElSelect(wrapper).vm.$emit('update:modelValue', null)
      expect(wrapper.emitted('update:modelValue')).toEqual([[null]])
    })
  })

  describe('$attrs 透传', () => {
    it('clearable / filterable / placeholder 落到 el-select', async () => {
      const wrapper = mountDictSelect({
        clearable: true,
        filterable: true,
        placeholder: '请选择',
      })
      await nextTick()
      const elSelect = getElSelect(wrapper)
      expect(elSelect.props('clearable')).toBe(true)
      expect(elSelect.props('filterable')).toBe(true)
      expect(elSelect.props('placeholder')).toBe('请选择')
    })
  })

  describe('空值 selectBind', () => {
    it('modelValue=null 时：el-select 不绑 modelValue 属性（契约保证）', async () => {
      const wrapper = mountDictSelect({ modelValue: null })
      await nextTick()
      // selectBind 契约：null 时不传 modelValue，避免 exactOptionalPropertyTypes 下的 TS2379
      // el-select 此时走默认占位（props('modelValue') === undefined）
      const elSelect = getElSelect(wrapper)
      expect(elSelect.props('modelValue')).toBeUndefined()
    })

    it('modelValue=undefined 时：el-select 走默认占位', async () => {
      const wrapper = mountDictSelect({ modelValue: undefined })
      await nextTick()
      // undefined 与 null 等价（exactOptionalPropertyTypes 下两者都跳过绑定）
      const elSelect = getElSelect(wrapper)
      expect(elSelect.props('modelValue')).toBeUndefined()
    })
  })

  describe('dictCode 切换', () => {
    it('setProps({ dictCode }) → 触发 watch → 再次调用 useDict', async () => {
      const wrapper = mountDictSelect({ dictCode: 'gender' })
      await nextTick()
      expect(useDictMock).toHaveBeenCalledTimes(1)
      expect(useDictMock).toHaveBeenLastCalledWith('gender')

      await wrapper.setProps({ dictCode: 'user_status' })
      await nextTick()
      expect(useDictMock).toHaveBeenCalledTimes(2)
      expect(useDictMock).toHaveBeenLastCalledWith('user_status')
      // 新 code 已加入 dictStore
      expect(dictStore['user_status']).toBeDefined()
    })

    it('dictCode 切换后渲染对应字典数据', async () => {
      const userStatusFixture: DictItem[] = [
        { value: 'active', label: '启用', type: 'success' },
        { value: 'disabled', label: '禁用', type: 'info' },
      ]
      const wrapper = mountDictSelect({ dictCode: 'user_status' })
      await nextTick()
      // 切换后注入数据
      dictStore['user_status'].value = userStatusFixture
      await nextTick()
      const options = getElOptions(wrapper)
      expect(options).toHaveLength(2)
      expect(options[0]?.props('label')).toBe('启用')
    })
  })
})
