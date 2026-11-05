/**
 * XFormErrorToast 单元测试
 *
 * 覆盖：
 * - enabled=false → 不渲染
 * - events 空数组 → 不渲染
 * - 默认渲染：Teleport 到 body + 渲染 XFormErrorToastItem
 * - 过滤 dismissed=true 的事件
 * - dismiss 事件转发：XFormErrorToastItem emit → XFormErrorToast emit
 * - role/aria-live 无障碍属性
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import XFormErrorToast from './XFormErrorToast.vue'
import type { FormErrorEvent } from '../composables/use-form-error-bus'

function makeEvent(overrides?: Partial<FormErrorEvent>): FormErrorEvent {
  return {
    id: 'evt-' + Math.random().toString(36).slice(2, 8),
    code: 'TEST_CODE',
    message: 'test message',
    severity: 'error',
    timestamp: Date.now(),
    dismissed: false,
    ...overrides,
  }
}

function makeWrapper(props: { events: FormErrorEvent[]; enabled: boolean }) {
  const wrapper = mount(XFormErrorToast, {
    props,
    attachTo: document.body,
    // VTU 默认 stub transition-group —— 解除 stub 才能真实渲染 ul[role="alert"]
    // 并驱动 enter/leave 过渡类名（F4 TransitionGroup 改造的前提）
    global: { stubs: { 'transition-group': false } },
  })
  const findInBody = (selector: string) => document.body.querySelector(selector)
  const bodyText = () => document.body.textContent ?? ''
  return { wrapper, findInBody, bodyText }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('XFormErrorToast', () => {
  it('enabled=false → 不渲染', () => {
    const { findInBody } = makeWrapper({
      events: [makeEvent()],
      enabled: false,
    })
    expect(findInBody('ul[role="alert"]')).toBeNull()
  })

  it('events 空数组 → 不渲染', () => {
    const { findInBody } = makeWrapper({
      events: [],
      enabled: true,
    })
    expect(findInBody('ul[role="alert"]')).toBeNull()
  })

  it('enabled + events → 渲染 ul 列表 + role/aria-live 属性', () => {
    const { findInBody } = makeWrapper({
      events: [makeEvent({ code: 'CROSS_FAILED' })],
      enabled: true,
    })
    const ul = findInBody('ul[role="alert"]')
    expect(ul).not.toBeNull()
    expect(ul?.getAttribute('aria-live')).toBe('polite')
  })

  it('渲染每个事件为 toast 项', () => {
    const { bodyText } = makeWrapper({
      events: [
        makeEvent({ code: 'CODE_A', message: 'message A' }),
        makeEvent({ code: 'CODE_B', message: 'message B' }),
      ],
      enabled: true,
    })
    expect(bodyText()).toContain('CODE_A')
    expect(bodyText()).toContain('message A')
    expect(bodyText()).toContain('CODE_B')
    expect(bodyText()).toContain('message B')
  })

  it('过滤 dismissed=true 的事件', () => {
    const { bodyText } = makeWrapper({
      events: [
        makeEvent({ code: 'VISIBLE', message: 'should show' }),
        makeEvent({ code: 'HIDDEN', message: 'should hide', dismissed: true }),
      ],
      enabled: true,
    })
    expect(bodyText()).toContain('VISIBLE')
    expect(bodyText()).not.toContain('HIDDEN')
  })

  it('XFormErrorToastItem emit("dismiss", id) → XFormErrorToast emit("dismiss", id)', async () => {
    const { wrapper, findInBody } = makeWrapper({
      events: [makeEvent({ id: 'evt-99', code: 'X' })],
      enabled: true,
    })
    // 找到子组件的关闭按钮（aria-label="关闭 X"）
    const closeBtn = findInBody('button[aria-label="关闭 X"]') as HTMLElement
    expect(closeBtn).not.toBeNull()
    closeBtn.click()
    await wrapper.vm.$nextTick?.()
    expect(wrapper.emitted('dismiss')).toBeTruthy()
    expect(wrapper.emitted('dismiss')?.[0]).toEqual(['evt-99'])
  })

  it('所有事件 dismissed=true → ul 存在但无 li 子元素', () => {
    const { findInBody } = makeWrapper({
      events: [makeEvent({ dismissed: true }), makeEvent({ dismissed: true })],
      enabled: true,
    })
    // v-if="events.length > 0" 是基于 events 数组长度（非过滤后），所以 ul 仍渲染
    // 但 v-for 过滤后无 children
    const ul = findInBody('ul[role="alert"]')
    expect(ul).not.toBeNull()
    expect(ul?.querySelectorAll('li').length).toBe(0)
  })

  describe('超量聚合卡片（F4）', () => {
    it('可见 toast 超过 3 条 → 第 4 条起聚合为「还有 N 条错误」卡片', () => {
      const { findInBody, bodyText } = makeWrapper({
        events: [
          makeEvent({ code: 'A', message: 'm1' }),
          makeEvent({ code: 'B', message: 'm2' }),
          makeEvent({ code: 'C', message: 'm3' }),
          makeEvent({ code: 'D', message: 'm4' }),
          makeEvent({ code: 'E', message: 'm5' }),
        ],
        enabled: true,
      })
      // 前 3 条直接渲染
      const ul = findInBody('ul[role="alert"]')
      expect(ul?.querySelectorAll('li')).toHaveLength(4) // 3 toast + 1 聚合卡
      expect(bodyText()).toContain('还有 2 条错误')
      expect(bodyText()).toContain('共 5 条')
    })

    it('可见 toast ≤ 3 条 → 无聚合卡', () => {
      const { findInBody } = makeWrapper({
        events: [
          makeEvent({ code: 'A', message: 'm1' }),
          makeEvent({ code: 'B', message: 'm2' }),
          makeEvent({ code: 'C', message: 'm3' }),
        ],
        enabled: true,
      })
      expect(findInBody('ul[role="alert"]')?.querySelectorAll('li')).toHaveLength(3)
    })

    it('点击「全部关闭」→ emit dismissAll', async () => {
      const { wrapper } = makeWrapper({
        events: [
          makeEvent({ code: 'A' }),
          makeEvent({ code: 'B' }),
          makeEvent({ code: 'C' }),
          makeEvent({ code: 'D' }),
        ],
        enabled: true,
      })
      const btn = Array.from(document.body.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('全部关闭')
      ) as HTMLElement
      expect(btn).toBeDefined()
      btn.click()
      await wrapper.vm.$nextTick?.()
      expect(wrapper.emitted('dismissAll')).toBeTruthy()
    })
  })

  describe('自动消失（F4）', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('新 toast 7s 后自动 emit dismiss（无需用户点 ×）', () => {
      const { wrapper } = makeWrapper({
        events: [makeEvent({ id: 'evt-auto', code: 'AUTO' })],
        enabled: true,
      })
      expect(wrapper.emitted('dismiss')).toBeUndefined()
      vi.advanceTimersByTime(7_000)
      expect(wrapper.emitted('dismiss')?.[0]).toEqual(['evt-auto'])
    })

    it('6.9s 内不自动 dismiss（时序边界）', () => {
      const { wrapper } = makeWrapper({
        events: [makeEvent({ id: 'evt-wait', code: 'WAIT' })],
        enabled: true,
      })
      vi.advanceTimersByTime(6_900)
      expect(wrapper.emitted('dismiss')).toBeUndefined()
    })
  })
})
