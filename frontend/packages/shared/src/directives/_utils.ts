/**
 * 指令通用工具（debounce + isFunction + findInput）
 *
 * 与具体指令解耦：inputDebounce / buttonDebounce 复用同一套 debounce 工具，
 * 保证项目内防抖/节流行为一致。
 *
 * 注意：debounce 是 trailing edge 实现（最后次触发后 delay 才执行），
 * buttonDebounce 若需 leading edge 行为（首次立即执行），需自己实现。
 *
 * @see [`./inputDebounce.ts`](./inputDebounce.ts) 防抖指令
 * @see [`./buttonDebounce.ts`](./buttonDebounce.ts) 防重指令
 * @group 指令工具
 */

/** 通用事件处理函数类型 */
export type EventHandler = (this: HTMLElement, event: Event) => void

/**
 * 防抖函数工厂
 *
 * @param click 待调用的实际事件处理函数
 * @param timeout 延迟（毫秒）
 * @returns 包装后的 debounced 函数（与 click 签名一致）
 *
 * 行为：trailing edge 防抖——每次调用清除上次的 timer，重新计时，
 *       只在 timeout 内最后一次调用延迟结束才执行 click。
 */
export function debounce(click: EventHandler, timeout: number): EventHandler {
  let timer: ReturnType<typeof setTimeout> | undefined
  return function (this: HTMLElement, event: Event) {
    if (timer) {
      clearTimeout(timer)
      timer = undefined
    }
    timer = setTimeout(() => {
      click.call(this, event)
      timer = undefined
    }, timeout)
  }
}

/**
 * 类型守卫：判断参数是否为函数
 */
export function isFunction(param: unknown): param is (...args: unknown[]) => unknown {
  return Object.prototype.toString.call(param) === '[object Function]'
}

/**
 * BFS 查找元素树中第一个 INPUT 元素。
 *
 * 用途：v-inputDebounce 兼容 Element Plus 等封装组件（如 el-input 内部包了 INPUT）。
 * 直接绑 el 不会触发原生 input 事件，需要找到子 INPUT 才行。
 *
 * @param el 起始元素（通常是 v-inputDebounce 指令绑定的元素）
 * @returns 找到的 INPUT 元素；未找到返回 null
 */
export function findInput(el: Element | null): HTMLInputElement | null {
  if (!el) return null
  const queue: Element[] = [el]
  while (queue.length > 0) {
    const current = queue.shift() as Element
    if (current.tagName === 'INPUT') return current as HTMLInputElement
    // 使用 children（仅 Element 节点），跳过文本/注释节点
    for (const child of Array.from(current.children)) {
      queue.push(child)
    }
  }
  return null
}
