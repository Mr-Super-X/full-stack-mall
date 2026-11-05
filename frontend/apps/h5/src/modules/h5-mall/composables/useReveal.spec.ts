import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'

import { useReveal } from './useReveal'

/** 可手动触发回调的 IntersectionObserver mock（记录实例便于断言） */
class MockIO {
  static instances: MockIO[] = []
  readonly cb: IntersectionObserverCallback
  readonly observed = new Set<Element>()

  constructor(cb: IntersectionObserverCallback) {
    this.cb = cb
    MockIO.instances.push(this)
  }

  observe(el: Element): void {
    this.observed.add(el)
  }

  unobserve(el: Element): void {
    this.observed.delete(el)
  }

  disconnect(): void {
    this.observed.clear()
  }

  /** 模拟 el 进入视口 */
  intersect(el: Element): void {
    this.cb([{ isIntersecting: true, target: el } as IntersectionObserverEntry], this as never)
  }
}

function mountHost(): ReturnType<typeof mount> {
  const Host = defineComponent({
    setup() {
      const root = ref<HTMLElement | null>(null)
      useReveal(root)
      return { root }
    },
    render() {
      return h('div', { ref: 'root' }, [
        h('section', { class: 'rv' }, 'A'),
        h('section', { class: 'rv' }, 'B'),
      ])
    },
  })
  return mount(Host)
}

afterEach(() => {
  vi.unstubAllGlobals()
  MockIO.instances = []
})

describe('useReveal', () => {
  it('环境无 IntersectionObserver 时直接全部可见（jsdom 降级路径）', async () => {
    // jsdom 无 IntersectionObserver，且本用例不 stub → 走降级分支
    const w = mountHost()
    await nextTick()
    expect(w.findAll('.rv').every((el) => el.classes().includes('in'))).toBe(true)
    expect(MockIO.instances.length).toBe(0)
  })

  it('有 IO 时进入视口才加 .in，且仅触发一次（unobserve）', async () => {
    vi.stubGlobal('IntersectionObserver', MockIO)
    const w = mountHost()
    await nextTick()

    const io = MockIO.instances[0]!
    const [a, b] = w.findAll('.rv')
    expect(a!.classes()).not.toContain('in')

    io.intersect(a!.element)
    expect(a!.classes()).toContain('in')
    expect(io.observed.has(a!.element)).toBe(false) // 已 unobserve
    expect(b!.classes()).not.toContain('in')
  })

  it('prefers-reduced-motion 开启时不走 IO，直接全部可见', async () => {
    vi.stubGlobal('IntersectionObserver', MockIO)
    vi.stubGlobal(
      'matchMedia',
      vi
        .fn()
        .mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })
    )
    const w = mountHost()
    await nextTick()
    expect(w.findAll('.rv').every((el) => el.classes().includes('in'))).toBe(true)
    expect(MockIO.instances.length).toBe(0)
  })

  it('卸载时 disconnect 清理观察器', async () => {
    vi.stubGlobal('IntersectionObserver', MockIO)
    const w = mountHost()
    await nextTick()
    const io = MockIO.instances[0]!
    expect(io.observed.size).toBe(2)

    w.unmount()
    expect(io.observed.size).toBe(0)
  })
})
