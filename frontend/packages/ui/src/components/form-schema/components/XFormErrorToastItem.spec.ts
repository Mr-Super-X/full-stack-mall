/**
 * XFormErrorToastItem 单元测试
 *
 * 覆盖：
 * - props.event 透传到模板渲染（code / message / source）
 * - 严重性图标：error → ✕ / warn → ⚠ / info → ℹ
 * - 详情列表（details）渲染：field / message / value
 * - 字段列表（fields）渲染（当 details 为空时）
 * - 关闭按钮 click → emit('dismiss', id)
 * - 关闭按钮 aria-label 含 code
 * - 严重性 class 切换：error / warn / info → 边框色样式
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import XFormErrorToastItem from './XFormErrorToastItem.vue'
import type { FormErrorEvent } from '../composables/use-form-error-bus'

function makeEvent(overrides?: Partial<FormErrorEvent>): FormErrorEvent {
  return {
    id: 'evt-1',
    code: 'TEST_CODE',
    message: '这是一条测试消息',
    severity: 'error',
    source: 'useTest',
    timestamp: Date.now(),
    dismissed: false,
    ...overrides,
  }
}

describe('XFormErrorToastItem', () => {
  it('渲染基本字段：code / message / source', () => {
    const wrapper = mount(XFormErrorToastItem, {
      props: { event: makeEvent() },
    })
    expect(wrapper.text()).toContain('TEST_CODE')
    expect(wrapper.text()).toContain('这是一条测试消息')
    expect(wrapper.text()).toContain('@useTest')
  })

  it('无 source 时不渲染 @ 标记', () => {
    const event = makeEvent()
    delete event.source
    const wrapper = mount(XFormErrorToastItem, {
      props: { event },
    })
    expect(wrapper.text()).not.toContain('@')
  })

  describe('严重性图标', () => {
    it('error 严重性 → ✕ 图标', () => {
      const wrapper = mount(XFormErrorToastItem, {
        props: { event: makeEvent({ severity: 'error' }) },
      })
      expect(wrapper.text()).toContain('✕')
    })

    it('warn 严重性 → ⚠ 图标', () => {
      const wrapper = mount(XFormErrorToastItem, {
        props: { event: makeEvent({ severity: 'warn' }) },
      })
      expect(wrapper.text()).toContain('⚠')
    })

    it('info 严重性 → ℹ 图标', () => {
      const wrapper = mount(XFormErrorToastItem, {
        props: { event: makeEvent({ severity: 'info' }) },
      })
      expect(wrapper.text()).toContain('ℹ')
    })
  })

  describe('严重性 class', () => {
    it('error 严重性 → 含 error class', () => {
      const wrapper = mount(XFormErrorToastItem, {
        props: { event: makeEvent({ severity: 'error' }) },
      })
      const classList = wrapper.classes()
      // module CSS 通过 $style 注入到 class
      // 至少有一个类包含 error 标识
      expect(classList.some((c) => c.toLowerCase().includes('error'))).toBe(true)
    })

    it('warn 严重性 → 含 warn class', () => {
      const wrapper = mount(XFormErrorToastItem, {
        props: { event: makeEvent({ severity: 'warn' }) },
      })
      const classList = wrapper.classes()
      expect(classList.some((c) => c.toLowerCase().includes('warn'))).toBe(true)
    })

    it('info 严重性 → 含 info class', () => {
      const wrapper = mount(XFormErrorToastItem, {
        props: { event: makeEvent({ severity: 'info' }) },
      })
      const classList = wrapper.classes()
      expect(classList.some((c) => c.toLowerCase().includes('info'))).toBe(true)
    })
  })

  describe('详情列表（details）', () => {
    it('有 details 时渲染详情列表', () => {
      const wrapper = mount(XFormErrorToastItem, {
        props: {
          event: makeEvent({
            details: [
              { field: 'email', message: '邮箱已被占用', value: 'a@b.com' },
              { field: 'phone', message: '手机号格式错误' },
            ],
          }),
        },
      })
      expect(wrapper.text()).toContain('email')
      expect(wrapper.text()).toContain('邮箱已被占用')
      expect(wrapper.text()).toContain('phone')
      expect(wrapper.text()).toContain('手机号格式错误')
    })

    it('value 为 undefined 时不显示值', () => {
      const wrapper = mount(XFormErrorToastItem, {
        props: {
          event: makeEvent({
            details: [{ field: 'email', message: '邮箱已被占用' }],
          }),
        },
      })
      // 详情行不应有 = 符号（value 缺失时省略）
      expect(wrapper.text()).not.toContain('=')
    })

    it('value 为字符串时显示 = 字符串值', () => {
      const wrapper = mount(XFormErrorToastItem, {
        props: {
          event: makeEvent({
            details: [{ field: 'email', message: '邮箱已被占用', value: 'a@b.com' }],
          }),
        },
      })
      expect(wrapper.text()).toContain('= a@b.com')
    })

    it('value 为 null 时显示 "null"', () => {
      const wrapper = mount(XFormErrorToastItem, {
        props: {
          event: makeEvent({
            details: [{ field: 'x', message: 'm', value: null }],
          }),
        },
      })
      expect(wrapper.text()).toContain('= null')
    })

    it('value 为长字符串时截断到 24 字符 + …', () => {
      const longValue = 'a'.repeat(50)
      const wrapper = mount(XFormErrorToastItem, {
        props: {
          event: makeEvent({
            details: [{ field: 'x', message: 'm', value: longValue }],
          }),
        },
      })
      expect(wrapper.text()).toContain('a'.repeat(24) + '…')
    })

    it('value 为数组时 JSON.stringify + 截断', () => {
      const wrapper = mount(XFormErrorToastItem, {
        props: {
          event: makeEvent({
            details: [
              {
                field: 'tags',
                message: 'm',
                value: ['alpha', 'beta', 'gamma'],
              },
            ],
          }),
        },
      })
      expect(wrapper.text()).toContain('["alpha","beta","gamma"]')
    })

    it('value 不可序列化（循环引用）→ 显示 [unserializable] 且 toast 不崩溃', () => {
      // 循环引用：JSON.stringify 会抛 TypeError
      // 修复前 :title 属性无 try/catch 导致整 toast 渲染崩溃
      const circular: Record<string, unknown> = {}
      circular.self = circular
      const wrapper = mount(XFormErrorToastItem, {
        props: {
          event: makeEvent({
            details: [{ field: 'x', message: 'm', value: circular }],
          }),
        },
      })
      expect(wrapper.text()).toContain('[unserializable]')
    })

    it('value tooltip 在循环引用时也用 [unserializable]（修复前会抛错）', () => {
      const circular: Record<string, unknown> = {}
      circular.self = circular
      const wrapper = mount(XFormErrorToastItem, {
        props: {
          event: makeEvent({
            details: [{ field: 'x', message: 'm', value: circular }],
          }),
        },
      })
      const span = wrapper.find('span[title^="字段当前值"]')
      expect(span.exists()).toBe(true)
      expect(span.attributes('title')).toBe('字段当前值：[unserializable]')
    })

    it('value tooltip 含完整 JSON.stringify（截断前）', () => {
      const wrapper = mount(XFormErrorToastItem, {
        props: {
          event: makeEvent({
            details: [{ field: 'x', message: 'm', value: 'a@b.com' }],
          }),
        },
      })
      const span = wrapper.find('span[title^="字段当前值"]')
      expect(span.exists()).toBe(true)
      expect(span.attributes('title')).toBe('字段当前值："a@b.com"')
    })
  })

  describe('字段列表（fields，无 details 时）', () => {
    it('只有 fields（无 details）→ 渲染字段列表', () => {
      const wrapper = mount(XFormErrorToastItem, {
        props: {
          event: makeEvent({
            fields: ['email', 'phone'],
          }),
        },
      })
      expect(wrapper.text()).toContain('字段：')
      expect(wrapper.text()).toContain('email')
      expect(wrapper.text()).toContain('phone')
    })

    it('fields 与 details 同时存在 → details 优先（fields 不渲染）', () => {
      const wrapper = mount(XFormErrorToastItem, {
        props: {
          event: makeEvent({
            details: [{ field: 'email', message: 'err' }],
            fields: ['phone'],
          }),
        },
      })
      expect(wrapper.text()).toContain('email')
      expect(wrapper.text()).toContain('err')
      expect(wrapper.text()).not.toContain('字段：')
    })
  })

  describe('用户语义分层（F3）', () => {
    it('有 userMessage 时标题主体显示 userMessage 而非 message', () => {
      const wrapper = mount(XFormErrorToastItem, {
        props: {
          event: makeEvent({
            message: 'EL_FORM_VALIDATION_FAILED: el-form.validate() rejected',
            userMessage: '表单校验未通过，请检查标红字段',
          }),
        },
      })
      expect(wrapper.text()).toContain('表单校验未通过，请检查标红字段')
      // dev 语义 message 被 userMessage 遮蔽（不重复出现在正文）
      expect(wrapper.text()).not.toContain('el-form.validate() rejected')
    })

    it('无 userMessage 时标题主体退回 message', () => {
      const wrapper = mount(XFormErrorToastItem, {
        props: { event: makeEvent({ message: '只有 dev 语义消息' }) },
      })
      expect(wrapper.text()).toContain('只有 dev 语义消息')
    })
  })

  describe('关闭按钮', () => {
    it('点击关闭按钮 → emit dismiss 事件 + 传 id', async () => {
      const wrapper = mount(XFormErrorToastItem, {
        props: { event: makeEvent({ id: 'evt-42' }) },
      })
      await wrapper.find('button').trigger('click')
      expect(wrapper.emitted('dismiss')).toBeTruthy()
      expect(wrapper.emitted('dismiss')?.[0]).toEqual(['evt-42'])
    })

    it('关闭按钮 aria-label 含 code（无障碍）', () => {
      const wrapper = mount(XFormErrorToastItem, {
        props: { event: makeEvent({ code: 'CROSS_FAILED' }) },
      })
      const btn = wrapper.find('button')
      expect(btn.attributes('aria-label')).toBe('关闭 CROSS_FAILED')
    })
  })
})
