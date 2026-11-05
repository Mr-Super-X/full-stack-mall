import { describe, it, expect, vi } from 'vitest'
import { debounce, isFunction, findInput } from './_utils'

describe('debounce（trailing edge）', () => {
  it('连续调用只执行最后一次（带 delay）', async () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const handler = debounce(fn, 100)
    handler.call(document.createElement('input'), new Event('input'))
    handler.call(document.createElement('input'), new Event('input'))
    handler.call(document.createElement('input'), new Event('input'))
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('delay 期间新调用重置计时器', async () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const handler = debounce(fn, 100)
    handler.call(document.createElement('input'), new Event('input'))
    vi.advanceTimersByTime(50)
    handler.call(document.createElement('input'), new Event('input'))
    vi.advanceTimersByTime(50)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(50)
    expect(fn).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('透传 this 和 event 参数', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const handler = debounce(fn, 0)
    const el = document.createElement('input')
    const event = new Event('input')
    handler.call(el, event)
    vi.advanceTimersByTime(0)
    expect(fn).toHaveBeenCalledWith(event)
    expect(fn.mock.instances[0]).toBe(el)
    vi.useRealTimers()
  })
})

describe('isFunction（类型守卫）', () => {
  it('函数返回 true', () => {
    expect(isFunction(() => {})).toBe(true)
    expect(isFunction(function named() {})).toBe(true)
  })

  it('非函数返回 false', () => {
    expect(isFunction(null)).toBe(false)
    expect(isFunction(undefined)).toBe(false)
    expect(isFunction(0)).toBe(false)
    expect(isFunction('string')).toBe(false)
    expect(isFunction({})).toBe(false)
    expect(isFunction([])).toBe(false)
  })
})

describe('findInput（BFS 查找 INPUT）', () => {
  it('el 本身就是 INPUT 直接返回', () => {
    const input = document.createElement('input')
    expect(findInput(input)).toBe(input)
  })

  it('null/undefined 返回 null', () => {
    expect(findInput(null)).toBeNull()
  })

  it('el 内部嵌套 INPUT 也能找到', () => {
    const wrapper = document.createElement('div')
    const input = document.createElement('input')
    wrapper.appendChild(input)
    expect(findInput(wrapper)).toBe(input)
  })

  it('多层嵌套：BFS 找到最深层的第一个 INPUT', () => {
    const root = document.createElement('div')
    const mid = document.createElement('div')
    const deep = document.createElement('div')
    const input = document.createElement('input')
    root.appendChild(mid)
    mid.appendChild(deep)
    deep.appendChild(input)
    expect(findInput(root)).toBe(input)
  })

  it('兄弟节点中第一个 INPUT 优先', () => {
    const root = document.createElement('div')
    const first = document.createElement('input')
    const second = document.createElement('input')
    root.appendChild(first)
    root.appendChild(second)
    expect(findInput(root)).toBe(first)
  })

  it('没有 INPUT 元素返回 null', () => {
    const div = document.createElement('div')
    const span = document.createElement('span')
    div.appendChild(span)
    expect(findInput(div)).toBeNull()
  })

  it('只遍历 Element 节点（跳过文本/注释）', () => {
    const div = document.createElement('div')
    div.appendChild(document.createTextNode('text'))
    div.appendChild(document.createComment('comment'))
    const input = document.createElement('input')
    div.appendChild(input)
    expect(findInput(div)).toBe(input)
  })
})
