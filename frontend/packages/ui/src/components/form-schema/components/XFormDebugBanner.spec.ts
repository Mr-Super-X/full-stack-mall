/**
 * XFormDebugBanner 单元测试
 *
 * 覆盖：
 * - visible 条件：dismissed=true 或 total=0 → 不渲染
 * - total = validateErrors.length + forbiddenErrors.length
 * - validateErrors 渲染：keyPath.join('.') + message
 * - keyPath 空数组 → 显示 '(root)'
 * - forbiddenErrors 渲染：直接显示字符串
 * - 折叠/展开：collapsed 切换（默认展开）
 * - 关闭：dismissed=true 后整个 banner 消失
 */
import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import XFormDebugBanner from './XFormDebugBanner.vue'

function makeWrapper(props: {
  validateErrors: Array<{ keyPath: (string | number)[]; message: string }>
  forbiddenErrors: string[]
}) {
  // Teleport to="body" 需要 attachTo 才能渲染到 DOM
  const wrapper = mount(XFormDebugBanner, { props, attachTo: document.body })
  // 全局查询 helper：因为 Teleport 后内容在 document.body，wrapper.find 查不到
  const findInBody = (selector: string) => document.body.querySelector(selector)
  const bodyText = () => document.body.textContent ?? ''
  return { wrapper, findInBody, bodyText }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('XFormDebugBanner', () => {
  it('无错误 → 不渲染（visible=false）', () => {
    const { findInBody } = makeWrapper({ validateErrors: [], forbiddenErrors: [] })
    expect(findInBody('[role="alert"]')).toBeNull()
  })

  it('有 validateErrors → 渲染面板 + 显示计数', () => {
    const { bodyText } = makeWrapper({
      validateErrors: [{ keyPath: ['email'], message: '未知组件名' }],
      forbiddenErrors: [],
    })
    expect(bodyText()).toContain('XForm 调试面板')
    expect(bodyText()).toContain('1 项问题')
  })

  it('validateErrors 渲染：keyPath + message', () => {
    const { bodyText } = makeWrapper({
      validateErrors: [
        { keyPath: ['email'], message: '未知组件名' },
        { keyPath: ['nested', 'field'], message: '另一错' },
      ],
      forbiddenErrors: [],
    })
    expect(bodyText()).toContain('email')
    expect(bodyText()).toContain('未知组件名')
    expect(bodyText()).toContain('nested.field')
    expect(bodyText()).toContain('另一错')
  })

  it('keyPath 空数组 → 显示 (root)', () => {
    const { bodyText } = makeWrapper({
      validateErrors: [{ keyPath: [], message: '根级错误' }],
      forbiddenErrors: [],
    })
    expect(bodyText()).toContain('(root)')
    expect(bodyText()).toContain('根级错误')
  })

  it('forbiddenErrors 渲染：直接显示字符串', () => {
    const { bodyText } = makeWrapper({
      validateErrors: [],
      forbiddenErrors: ['window', 'document'],
    })
    expect(bodyText()).toContain('window')
    expect(bodyText()).toContain('document')
    expect(bodyText()).toContain('2 项问题')
  })

  it('混合 validateErrors + forbiddenErrors → total 累加', () => {
    const { bodyText } = makeWrapper({
      validateErrors: [{ keyPath: ['a'], message: 'm1' }],
      forbiddenErrors: ['window', 'document'],
    })
    expect(bodyText()).toContain('3 项问题')
  })

  it('点击「收起」按钮 → 切换为 FAB 浮动按钮', async () => {
    const { wrapper, findInBody, bodyText } = makeWrapper({
      validateErrors: [{ keyPath: ['x'], message: 'm' }],
      forbiddenErrors: [],
    })
    expect(findInBody('[role="alert"]')).not.toBeNull()
    // 找到「收起」按钮（Teleport 后元素在 body）
    const collapseBtn = Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('收起')
    )
    expect(collapseBtn).toBeDefined()
    await collapseBtn!.click()
    await wrapper.vm.$nextTick?.()
    // 收起后面板消失，FAB 出现
    expect(findInBody('[role="alert"]')).toBeNull()
    expect(bodyText()).toContain('⚠')
  })

  it('FAB 含 total 数 + 点击展开', async () => {
    const { wrapper, findInBody } = makeWrapper({
      validateErrors: [{ keyPath: ['x'], message: 'm' }],
      forbiddenErrors: ['a'],
    })
    // 先收起
    const collapseBtn = Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('收起')
    )
    await collapseBtn!.click()
    await wrapper.vm.$nextTick?.()
    const fab = findInBody('button[aria-label*="XForm 调试面板"]') as HTMLElement
    expect(fab).not.toBeNull()
    expect(fab.textContent).toContain('2')

    // 点击 FAB 展开
    fab.click()
    await wrapper.vm.$nextTick?.()
    expect(findInBody('[role="alert"]')).not.toBeNull()
  })

  it('keyPath 数字段序列化为 EP 风格 [n] 下标（F5，与 async-validator 报错格式对齐）', () => {
    const { bodyText } = makeWrapper({
      validateErrors: [{ keyPath: ['items', 0, 'name'], message: '必填' }],
      forbiddenErrors: [],
    })
    expect(bodyText()).toContain('items[0].name')
    expect(bodyText()).toContain('必填')
  })

  it('点击错误项 → emit locate（EP 风格路径，供 scrollToField 定位）', async () => {
    const { wrapper } = makeWrapper({
      validateErrors: [{ keyPath: ['items', 2, 'phone'], message: '格式错误' }],
      forbiddenErrors: [],
    })
    const item = document.body.querySelector('[role="button"]') as HTMLElement
    expect(item).not.toBeNull()
    item.click()
    await wrapper.vm.$nextTick?.()
    expect(wrapper.emitted('locate')).toBeTruthy()
    expect(wrapper.emitted('locate')?.[0]).toEqual(['items[2].phone'])
  })

  it('头部含「复制全部」按钮（jsdom 无 clipboard API，仅断言入口存在）', () => {
    makeWrapper({
      validateErrors: [{ keyPath: ['email'], message: '未知组件名' }],
      forbiddenErrors: [],
    })
    const copyBtn = Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('复制全部')
    )
    expect(copyBtn).toBeDefined()
  })

  it('点击关闭（×）→ dismissed=true → 整个 banner 消失', async () => {
    const { wrapper, findInBody } = makeWrapper({
      validateErrors: [{ keyPath: ['x'], message: 'm' }],
      forbiddenErrors: [],
    })
    const closeBtn = findInBody('button[aria-label="关闭"]') as HTMLElement
    expect(closeBtn).not.toBeNull()
    closeBtn.click()
    await wrapper.vm.$nextTick?.()
    expect(findInBody('[role="alert"]')).toBeNull()
    expect(findInBody('button[aria-label*="XForm 调试面板"]')).toBeNull()
  })

  it('关闭后再点 FAB 不显示（dismissed=true 持久）', async () => {
    const { wrapper, findInBody } = makeWrapper({
      validateErrors: [{ keyPath: ['x'], message: 'm' }],
      forbiddenErrors: [],
    })
    const closeBtn = findInBody('button[aria-label="关闭"]') as HTMLElement
    closeBtn.click()
    await wrapper.vm.$nextTick?.()
    // 整个 banner 隐藏，FAB 也不显示
    expect(findInBody('[role="alert"]')).toBeNull()
  })
})
