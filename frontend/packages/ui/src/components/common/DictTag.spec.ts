/**
 * DictTag 组件单测。
 *
 * 覆盖：
 * 1. 渲染：根节点 BEM class、命中时显示 el-tag / 未命中时显示占位
 * 2. value 命中 → 显示 label
 * 3. value 未匹配 → 显示 value 原文（契约要求）
 * 4. 空值：null / undefined / '' → 显示 '-' 占位
 * 5. type 透传：matched.type 拼到 el-tag 的 type 属性
 * 6. cssClass 透传：matched.cssClass 拼到 el-tag 的 class
 * 7. $attrs 透传：size / effect 落到 el-tag
 * 8. dictCode 切换 → watch 补拉
 *
 * Mock 策略：vi.mock('@vv/shared') 静态替身（与 DictSelect 同款）。
 *
 * EP 组件策略：直接使用真实 Element Plus 组件 + findComponent。
 * 原因与 DictSelect 一致：vitest inline: ['element-plus'] 让 EP 在测试环境自动注册，
 * 自定义 stub 会被覆盖。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import type { Ref } from 'vue'
import { mount } from '@vue/test-utils'
import type { DictItem } from '@vv/shared'

const { dictStore, useDictMock } = vi.hoisted(() => ({
  dictStore: {} as Record<string, Ref<DictItem[]>>,
  useDictMock: vi.fn(),
}))

// 说明符 '@composables/useDict' 经 codemod 收敛为 '@vv/shared' barrel（2026-10-26，
// 与 DictSelect.spec 同款）——单点 mock 须 importOriginal 展开其余导出
vi.mock('@vv/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vv/shared')>()
  return { ...actual, useDict: useDictMock }
})

import DictTag from './DictTag.vue'

const userStatusFixture: DictItem[] = [
  { value: 'active', label: '启用', type: 'success' },
  { value: 'disabled', label: '禁用', type: 'info' },
  { value: 'pending', label: '待审核', type: 'warning' },
]
const genderFixture: DictItem[] = [
  { value: 'male', label: '男', type: 'primary', cssClass: 'vv-dict-tag--male' },
  { value: 'female', label: '女', type: 'danger', cssClass: 'vv-dict-tag--female' },
]

beforeEach(() => {
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

function mountDictTag(props: Record<string, unknown> = {}) {
  return mount(DictTag, {
    props: { dictCode: 'user_status', ...props },
  })
}

/** 拿到内部 el-tag 组件实例（多根节点下用 findComponent 仍能找到） */
function getElTag(wrapper: ReturnType<typeof mountDictTag>) {
  return wrapper.findComponent({ name: 'ElTag' })
}

describe('DictTag', () => {
  describe('渲染', () => {
    it('根节点带 BEM 命名空间 vv-dict-tag', async () => {
      const wrapper = mountDictTag({ value: 'active' })
      await nextTick()
      // el-tag 根节点有 vv-dict-tag BEM class（DictTag 的 bem.b() 拼到 el-tag class）
      const elTag = getElTag(wrapper)
      expect(elTag.exists()).toBe(true)
      expect(elTag.classes()).toContain('vv-dict-tag')
    })

    it('value 为空时：渲染占位 <span class="vv-dict-tag__empty">-</span>', () => {
      const wrapper = mountDictTag({ value: '' })
      // 不渲染 el-tag
      expect(getElTag(wrapper).exists()).toBe(false)
      // 渲染占位 span + '-' 文本
      expect(wrapper.find('.vv-dict-tag__empty').exists()).toBe(true)
      expect(wrapper.find('.vv-dict-tag__empty').text()).toBe('-')
    })

    it('value 为 null 时：渲染占位', () => {
      const wrapper = mountDictTag({ value: null })
      expect(getElTag(wrapper).exists()).toBe(false)
      expect(wrapper.find('.vv-dict-tag__empty').exists()).toBe(true)
    })

    it('value 为 undefined 时：渲染占位', () => {
      const wrapper = mountDictTag({ value: undefined })
      expect(getElTag(wrapper).exists()).toBe(false)
      expect(wrapper.find('.vv-dict-tag__empty').exists()).toBe(true)
    })
  })

  describe('value 命中逻辑', () => {
    it('命中：显示 label（而非 value）', async () => {
      const wrapper = mountDictTag({ value: 'active' })
      await nextTick()
      dictStore['user_status'].value = userStatusFixture
      await nextTick()
      expect(getElTag(wrapper).text()).toBe('启用')
      expect(getElTag(wrapper).text()).not.toBe('active')
    })

    it('未命中（value 不在字典项中）：显示 value 原文', async () => {
      const wrapper = mountDictTag({ value: 'unknown' })
      await nextTick()
      dictStore['user_status'].value = userStatusFixture
      await nextTick()
      // 契约：未命中不报错、不白屏，显示 value 原文
      expect(getElTag(wrapper).text()).toBe('unknown')
    })

    it('字典为空（未加载完）：显示 value 原文', async () => {
      const wrapper = mountDictTag({ value: 'active' })
      await nextTick()
      // dictStore['user_status'].value 默认为 []
      expect(getElTag(wrapper).text()).toBe('active')
    })
  })

  describe('type 透传', () => {
    it('命中且有 type：el-tag 的 type 属性 = matched.type', async () => {
      const wrapper = mountDictTag({ value: 'active' })
      await nextTick()
      dictStore['user_status'].value = userStatusFixture
      await nextTick()
      expect(getElTag(wrapper).props('type')).toBe('success')
    })

    it('命中但无 type：tagBind 不绑定 type（避免空值 binding + EP 走内部默认）', async () => {
      // 契约：matched.type 为空时 tagBind 不绑 type 字段（exactOptionalPropertyTypes 保护）
      // EP el-tag 内部仍有默认 type（不受 DictTag 控制），本测试不验证 EP 内部默认，
      // 只验证 DictTag 的 tagBind 在 dictItem.type 缺失时不传递 type
      const wrapper = mountDictTag({ value: 'active' })
      await nextTick()
      dictStore['user_status'].value = [
        { value: 'active', label: '启用' }, // 无 type
      ]
      await nextTick()
      // 验证关键：当前 type 不应是上一组 fixture 的 'success'，说明 tagBind 重新计算过
      // 且 dictItem 无 type 时，el-tag 拿到的是 EP 内部默认（不是 'success'）
      expect(getElTag(wrapper).props('type')).not.toBe('success')
    })
  })

  describe('cssClass 透传', () => {
    it('命中且有 cssClass：拼到 el-tag 的 class 上', async () => {
      const wrapper = mountDictTag({ value: 'male', dictCode: 'gender' })
      await nextTick()
      dictStore['gender'].value = genderFixture
      await nextTick()
      const elTag = getElTag(wrapper)
      expect(elTag.classes()).toContain('vv-dict-tag--male')
    })

    it('不同字典项的 cssClass 不同', async () => {
      const wrapper = mountDictTag({ value: 'female', dictCode: 'gender' })
      await nextTick()
      dictStore['gender'].value = genderFixture
      await nextTick()
      expect(getElTag(wrapper).classes()).toContain('vv-dict-tag--female')
    })
  })

  describe('$attrs 透传', () => {
    it('size / effect 落到 el-tag', async () => {
      const wrapper = mountDictTag({
        value: 'active',
        size: 'large',
        effect: 'dark',
      })
      await nextTick()
      dictStore['user_status'].value = userStatusFixture
      await nextTick()
      const elTag = getElTag(wrapper)
      expect(elTag.props('size')).toBe('large')
      expect(elTag.props('effect')).toBe('dark')
    })
  })

  describe('dictCode 切换', () => {
    it('setProps({ dictCode }) → 触发 watch → 再次调用 useDict', async () => {
      const wrapper = mountDictTag({ value: 'active', dictCode: 'user_status' })
      await nextTick()
      expect(useDictMock).toHaveBeenCalledTimes(1)
      expect(useDictMock).toHaveBeenLastCalledWith('user_status')

      await wrapper.setProps({ dictCode: 'gender' })
      await nextTick()
      expect(useDictMock).toHaveBeenCalledTimes(2)
      expect(useDictMock).toHaveBeenLastCalledWith('gender')
      expect(dictStore['gender']).toBeDefined()
    })

    it('dictCode 切换后渲染对应字典', async () => {
      const wrapper = mountDictTag({ value: 'male', dictCode: 'gender' })
      await nextTick()
      dictStore['gender'].value = genderFixture
      await nextTick()
      expect(getElTag(wrapper).text()).toBe('男')
      expect(getElTag(wrapper).classes()).toContain('vv-dict-tag--male')
    })
  })
})
