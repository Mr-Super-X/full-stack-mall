/**
 * useDocToc 单元测试
 * 覆盖：注册写入 currentDocToc / scope 停止清空（页面卸载语义）/
 *      引用守卫（新页已注册时旧 scope 停止不清空）/ 连续注册后者胜出
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { effectScope, type EffectScope } from 'vue'
import { currentDocToc, useDocToc } from './useDocToc'

let scope: EffectScope

beforeEach(() => {
  scope = effectScope()
})

afterEach(() => {
  scope.stop()
  currentDocToc.value = []
})

const items = [{ id: 'demo-basic', label: '基础用法' }]

describe('useDocToc', () => {
  it('注册后 currentDocToc 即为本页锚点', () => {
    scope.run(() => useDocToc(items))
    expect(currentDocToc.value).toBe(items)
  })

  it('scope 停止（页面卸载）后清空锚点', () => {
    scope.run(() => useDocToc(items))
    scope.stop()
    expect(currentDocToc.value).toEqual([])
  })

  it('引用守卫：旧 scope 停止时 currentDocToc 已被新页占用则不清空', () => {
    scope.run(() => useDocToc(items))
    const scopeB = effectScope()
    const itemsB = [{ id: 'b', label: 'B' }]
    scopeB.run(() => useDocToc(itemsB))
    scope.stop() // 模拟旧页卸载晚于新页挂载的时序
    expect(currentDocToc.value).toBe(itemsB)
    scopeB.stop()
    expect(currentDocToc.value).toEqual([])
  })

  it('连续注册后者胜出（切路由只显示最新页的锚点）', () => {
    scope.run(() => useDocToc([{ id: 'a', label: 'A' }]))
    scope.run(() => useDocToc(items))
    expect(currentDocToc.value).toBe(items)
  })
})
