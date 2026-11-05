import type { PortalNavItem } from './types'

/**
 * 顶部锚点导航配置（企业官网）。
 *
 * key 与各区块元素 id 一一对应（SiteHero/SiteFeatures/SiteStats/SiteAbout 根元素）。
 * 增删区块时需同步三处：home 视图对应组件的根元素 id、本配置、页脚锚点链接（modules/home/config/site.ts）。
 * 注意：页脚链接措辞刻意与顶栏不同（顶栏短词「产品/数据/关于」vs 页脚长尾「产品特性/数据指标/关于我们」），
 * 两套文案各自归属各自 config，勿为「统一」而强行合并。
 *
 * @see [`./types.ts`](./types.ts) PortalNavItem 类型定义
 * @see [`../components/PortalNav.vue`](../components/PortalNav.vue) 渲染消费方
 * @group 布局：Portal
 */
export const PORTAL_NAV: PortalNavItem[] = [
  { key: 'hero', label: '首页', anchor: '#hero' },
  { key: 'features', label: '产品', anchor: '#features' },
  { key: 'stats', label: '数据', anchor: '#stats' },
  { key: 'about', label: '关于', anchor: '#about' },
]
