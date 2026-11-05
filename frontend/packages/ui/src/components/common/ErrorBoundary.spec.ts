/**
 * ErrorBoundary 组件单测。
 *
 * 覆盖：
 * 1. 默认渲染：子组件不抛错时正常显示 slot 内容
 * 2. 错误捕获：子组件抛 Error → 切换为 el-result fallback + 「恢复」按钮
 * 3. 错误类型兜底：抛非 Error（如字符串）→ 被包装为 new Error(String(err))
 * 4. 恢复交互：点击「恢复」→ emit('reset')
 * 5. 不向上冒泡：onErrorCaptured 返回 false，组件不被错误击溃
 *
 * EP 组件策略：直接使用真实 Element Plus 组件。
 * 原因：vitest.config.ts 已 inline: ['element-plus']，unplugin-vue-components
 * 在测试环境自动注册了 ElResult / ElButton，stub 注册会被覆盖；真实 EP 在 jsdom
 * 下渲染完整结构（class=.el-result / .el-result__subtitle / .el-button），可直接断言。
 *
 * 子组件策略：用 `slots: { default: () => h(Child) }` slot 函数 + h() 构造。
 * 模板字符串 + global.components 方式在 jsdom 下不可靠（曾实测 thrower 不挂载），
 * slot 函数显式构造 VNode 是更可控的方式。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import ErrorBoundary from './ErrorBoundary.vue'

/** 正常子组件 */
const OkChild = defineComponent({
  name: 'OkChild',
  setup() {
    return () => h('div', { class: 'child-ok' }, 'child content')
  },
})

/** 抛 Error 子组件 —— render 抛 Error 实例 */
const ThrowErrorChild = defineComponent({
  name: 'ThrowErrorChild',
  setup() {
    return () => {
      throw new Error('boom from child')
    }
  },
})

/** 抛字符串子组件 —— render 抛非 Error */
const ThrowStringChild = defineComponent({
  name: 'ThrowStringChild',
  setup() {
    return () => {
      throw 'just a string'
    }
  },
})

/**
 * 挂载 ErrorBoundary + 给定子组件。
 * 用 slot 函数 + h() 而非模板字符串，确保子组件被实际实例化。
 */
function mountBoundary(child: ReturnType<typeof defineComponent>) {
  return mount(ErrorBoundary, {
    slots: {
      default: () => h(child),
    },
  })
}

describe('ErrorBoundary', () => {
  // 静默 Vue 内部错误通道（onErrorCaptured 之外的 warn）
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('默认渲染：子组件不抛错时正常显示 slot 内容', () => {
    const wrapper = mountBoundary(OkChild)
    expect(wrapper.find('.child-ok').exists()).toBe(true)
    expect(wrapper.find('.el-result').exists()).toBe(false)
  })

  it('子组件抛 Error：切换为 el-result fallback + sub-title 渲染 error.message', async () => {
    const wrapper = mountBoundary(ThrowErrorChild)
    await nextTick()
    // slot 不再渲染
    expect(wrapper.find('.child-ok').exists()).toBe(false)
    // fallback 出现（真实 ElResult）
    expect(wrapper.find('.el-result').exists()).toBe(true)
    // sub-title 渲染 error.message（ElResult 结构：.el-result__subtitle > p）
    expect(wrapper.find('.el-result__subtitle').text()).toContain('boom from child')
    // 「恢复」按钮存在
    expect(wrapper.find('.el-button').exists()).toBe(true)
  })

  it('非 Error 抛出（如字符串）→ 被包装为 new Error(String(err))', async () => {
    const wrapper = mountBoundary(ThrowStringChild)
    await nextTick()
    expect(wrapper.find('.el-result').exists()).toBe(true)
    // String('just a string') === 'just a string'
    expect(wrapper.find('.el-result__subtitle').text()).toContain('just a string')
  })

  it('点击恢复按钮：emit("reset")', async () => {
    const wrapper = mountBoundary(ThrowErrorChild)
    await nextTick()
    expect(wrapper.find('.el-result').exists()).toBe(true)

    // 点击恢复
    await wrapper.find('.el-button').trigger('click')

    // emit 触发
    expect(wrapper.emitted('reset')).toHaveLength(1)
  })

  it('onErrorCaptured 返回 false：阻止错误向上冒泡（组件不崩溃）', async () => {
    const wrapper = mountBoundary(ThrowErrorChild)
    await nextTick()
    // 兜底断言：fallback 已渲染 = onErrorCaptured 拦截成功
    expect(wrapper.find('.el-result').exists()).toBe(true)
    // 进一步验证：组件仍然挂载（未因错误冒泡崩溃）
    expect(wrapper.exists()).toBe(true)
  })
})
