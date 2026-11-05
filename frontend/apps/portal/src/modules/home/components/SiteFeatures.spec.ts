import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import SiteFeatures from './SiteFeatures.vue'
import { SITE_FEATURES } from '../config/site'

describe('SiteFeatures 产品特性区', () => {
  it('渲染 3 张特性卡（标题 + 描述来自 config）', () => {
    const w = mount(SiteFeatures)
    expect(w.findAll('article')).toHaveLength(3)
    expect(w.text()).toContain(SITE_FEATURES[0].title)
    expect(w.text()).toContain(SITE_FEATURES[0].desc)
  })
})
