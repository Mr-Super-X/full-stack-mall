import { describe, expect, it } from 'vitest'
import { createFallbackRoute } from './fallback.ts'

describe('createFallbackRoute（catch-all 404 兜底，6 app 单源）', () => {
  it('缺省重定向到 /404（catch-all 路径形态）', () => {
    expect(createFallbackRoute()).toEqual({
      path: '/:pathMatch(.*)*',
      redirect: '/404',
    })
  })

  it('支持自定义 404 目标路径（幂等参数化）', () => {
    expect(createFallbackRoute('/not-found')).toEqual({
      path: '/:pathMatch(.*)*',
      redirect: '/not-found',
    })
  })
})
