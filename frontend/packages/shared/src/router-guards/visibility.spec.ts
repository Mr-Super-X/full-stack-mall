import { describe, it, expect } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'
import { checkVisibility } from './visibility'

const route = (visible?: boolean) => ({ meta: { visible } }) as unknown as RouteLocationNormalized

describe('checkVisibility', () => {
  it('meta.visible === false 时跳 /404', () => {
    expect(checkVisibility(route(false))).toEqual({ path: '/404' })
  })

  it('meta.visible === true 时放行', () => {
    expect(checkVisibility(route(true))).toBeNull()
  })

  it('meta.visible 缺失时放行（默认可见）', () => {
    expect(checkVisibility(route(undefined))).toBeNull()
  })
})
