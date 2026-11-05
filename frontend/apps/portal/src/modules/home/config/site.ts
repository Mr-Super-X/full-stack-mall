/**
 * 企业门户官网 —— 站点文案与数据单源。
 *
 * 设计：
 * - 所有区块（Hero/特性/数据/关于/页脚）的文案集中于此，组件只读渲染，不硬编码字符串
 * - 全静态：无请求、无 i18n（官网单语言，YAGNI；路由 meta.titleKey 走既有 i18n 不受影响）
 * - `as const` 保证消费方不能意外改写
 * - 品牌名与 `src/layouts/portal/components/PortalHeader.vue` 的字标有意双源：
 *   §1.2 模块边界禁止 layouts 引用 modules/ 内容，改品牌需同步两处（见该组件品牌区注释）
 *
 * @see [`../views/index.vue`](../views/index.vue) 官网页面组合
 * @see [`../../../layouts/portal/components/PortalHeader.vue`](../../../layouts/portal/components/PortalHeader.vue) 品牌字标（双源另一处）
 * @group 业务模块：Home
 */

/** 品牌标识（页脚消费；顶栏字标因模块边界有意双源，见文件头说明） */
export const SITE_BRAND = {
  name: '企业门户',
  /** 页脚品牌行英文小字 */
  nameEn: 'ENTERPRISE PORTAL',
  slogan: '让数据成为企业增长的引擎',
} as const

/** Hero 首屏（id=hero） */
export const SITE_HERO = {
  /** 眉题：全大写小字 */
  kicker: 'CLOUD DATA PLATFORM',
  /** 主标题两行（模板用 <br> 连接） */
  titleLines: ['让数据成为', '企业增长的引擎'] as const,
  subtitle: '一站式云端数据平台，助力企业快速构建智能应用，释放数据的全部价值。',
  /** 主按钮：跳统一登录（P4 起整页跳 apps/auth；项目无注册页，免费试用 = 登录后开通） */
  primaryCta: { label: '免费试用' },
  /** 次按钮：同为登录（预约演示由登录后流程承接） */
  secondaryCta: { label: '预约演示' },
} as const

/** 产品特性（id=features，3 卡；icon 为组件内静态 tabler 标签，见 SiteFeatures.vue） */
export const SITE_FEATURES = [
  {
    title: '实时分析引擎',
    desc: '毫秒级查询响应，支撑百万级 QPS 的实时看板与即席分析。',
  },
  {
    title: '企业级安全',
    desc: '端到端加密与细粒度权限管控，满足合规审计要求。',
  },
  {
    title: '云原生架构',
    desc: '弹性伸缩、开箱即用，分钟级完成集群部署与扩缩容。',
  },
] as const

/** 特性区眉题（id=features 的 eyebrow；全大写小字，品牌族 pill 呈现） */
export const SITE_FEATURES_EYEBROW = 'CAPABILITIES'

/** 特性区区块标题（id=features 的 h2；与卡片数据分离因消费位置不同） */
export const SITE_FEATURES_HEADING = '产品能力'

/** 数据指标（id=stats；静态数字——刻意不做滚动计数，KISS） */
export const SITE_STATS = [
  { value: '99.99%', label: '服务可用性' },
  { value: '10ms', label: '平均查询延迟' },
  { value: '5000+', label: '服务企业客户' },
  { value: '100万+', label: '日均处理请求' },
] as const

/** 关于与联系（id=about） */
export const SITE_ABOUT = {
  heading: '关于我们',
  /** 公司简介段落 */
  paragraphs: [
    '我们成立于 2016 年，专注于云端数据平台的研发与服务，帮助企业把复杂的数据基础设施化繁为简。',
    '我们相信数据是企业的核心资产，而优秀的平台能让每一位工程师都轻松驾驭它。',
  ] as const,
  contacts: [
    { label: '商务合作', value: 'hello@example.com' },
    { label: '公司地址', value: '北京市海淀区中关村创业大街 1 号' },
    { label: '服务热线', value: '400-888-0000' },
  ] as const,
} as const

/** 页脚 */
export const SITE_FOOTER = {
  /** 链接组：全部指向页内锚点，无死链 */
  links: [
    { label: '产品特性', anchor: '#features' },
    { label: '数据指标', anchor: '#stats' },
    { label: '关于我们', anchor: '#about' },
  ] as const,
  /** ICP 备案占位（虚构） */
  icp: '京ICP备2026000000号-1',
} as const
