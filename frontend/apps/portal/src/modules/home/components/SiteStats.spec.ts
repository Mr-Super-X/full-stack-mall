import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import SiteStats from './SiteStats.vue'
import { SITE_STATS } from '../config/site'

describe('SiteStats 数据指标条', () => {
  it('渲染 4 项指标（数值 + 标签）', () => {
    const w = mount(SiteStats)
    expect(w.findAll('.vv-site-stats__item')).toHaveLength(4)
    expect(w.text()).toContain(SITE_STATS[0].value)
    expect(w.text()).toContain(SITE_STATS[0].label)
  })
})
