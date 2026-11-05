import { describe, it, expect } from 'vitest'
import { VENDOR_CHUNKS } from './vendor-chunks'

// noUncheckedIndexedAccess 下用 find 按名取组（避免位置索引的 undefined 分支）
const byName = (name: string) => VENDOR_CHUNKS.find((c) => c.name === name)

describe('VENDOR_CHUNKS', () => {
  it('包含 vendor-vue / vendor-ui / vendor-charts 三组', () => {
    const names = VENDOR_CHUNKS.map((c) => c.name)
    expect(names).toEqual(['vendor-vue', 'vendor-ui', 'vendor-charts'])
  })

  it('顺序敏感：vue → ui → charts（先匹配先返回）', () => {
    expect(VENDOR_CHUNKS.map((c) => c.name)).toEqual(['vendor-vue', 'vendor-ui', 'vendor-charts'])
  })

  it('vendor-vue 包含 vue / pinia / @vue 三个 pattern', () => {
    expect(byName('vendor-vue')?.patterns).toEqual(['/vue/', '/pinia/', '/@vue/'])
  })

  it('vendor-ui 包含 element-plus / unplugin-vue-components / vant（h5 移动端 UI 库）', () => {
    expect(byName('vendor-ui')?.patterns).toEqual([
      '/element-plus/',
      '/unplugin-vue-components/',
      '/vant/',
    ])
  })

  it('vendor-charts 包含 echarts（echarts 包体大，单拆利于缓存命中）', () => {
    expect(byName('vendor-charts')?.patterns).toEqual(['/echarts/'])
  })
})
