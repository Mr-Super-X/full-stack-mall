/**
 * 简体中文文案。
 *
 * 命名空间约定：
 * - `app.*`：应用元信息（标题、欢迎语等）
 * - `common.*`：通用按钮/动作（确认/取消/重试/加载）
 * - `auth.*`：登录相关
 * - `menu.*`：菜单名
 * - `error.*`：错误码文案
 *
 * 新增业务模块的 i18n key：建议在 `modules/<m>/locales/zh-CN.ts` 单独维护，
 * 通过 `useI18n().merge()` 合并，避免本文件膨胀。
 *
 * @see [`./index.ts`](./index.ts) i18n 入口
 * @see [`./en-US.ts`](./en-US.ts) 英文对照
 * @group 国际化
 */
export default {
  app: { title: '企业中后台管理' },
  common: {
    confirm: '确认',
    cancel: '取消',
    retry: '重试',
    loading: '加载中...',
    empty: '暂无数据',
    routerPushFailed: '路由跳转失败',
    copySuccess: '复制成功',
    copyFailed: '复制失败，请手动复制',
    copyEmpty: '复制内容为空',
  },
  auth: {
    login: '登录',
    logout: '退出',
    logoutConfirm: '确定退出登录吗？',
    logoutConfirmButton: '退出',
    logoutCancelButton: '取消',
    logoutTitle: '提示',
    username: '用户名',
    password: '密码',
    /** Login 页专属键（2026-10-28 i18n 审计接线；username 键为「用户名」，Login 页用「账号」故另立 account） */
    account: '账号',
    accountRequired: '请输入账号',
    accountMin: '账号至少 3 位',
    passwordRequired: '请输入密码',
    passwordMin: '密码至少 6 位',
    rememberMe: '记住我',
    forgotPassword: '忘记密码？',
    loggingIn: '登录中...',
    loginSubmit: '登 录',
    // 「登录成功，正在跳转…」是 65b3c96 易用性修复的刻意文案（存活到整页跳转覆盖白屏间隙）
    loginSuccessRedirect: '登录成功，正在跳转…',
    loginFailed: '登录失败，请重试',
    sessionExpired: '登录已过期，请重新登录',
    showPassword: '显示密码',
    hidePassword: '隐藏密码',
  },
  menu: {
    // home 对应路由 meta.title「仪表盘」（/home 首页），非"首页"字样
    home: '仪表盘',
    user: '用户管理',
    demo: '组件示例',
    workbench: '工作台',
    workbenchHome: '工作台首页',
    workbenchAnalysis: '分析页',
    workbenchMonitor: '监控页',
  },
  error: {
    '403': '无权访问',
    '404': '页面不存在',
    '500': '服务器错误',
    /** HTTP 状态码 toast 文案（http-errors.ts 查表；2026-10-28 i18n 审计激活逻辑层硬编码） */
    http: {
      '400': '请求参数错误',
      '401': '请先登录',
      '403': '无权限访问',
      '404': '资源不存在',
      '500': '服务器错误',
      '502': '网关错误',
      '503': '服务暂不可用',
      '504': '网关超时',
      network: '网络异常，请稍后重试',
      serverFallback: '服务异常，请稍后重试',
      clientFallback: '请求失败，请检查后重试',
    },
    /** 全局网络异常横幅（@vv/ui NetworkBanner）：持续故障聚合展示，替代逐请求 toast 轰炸 */
    networkBanner: {
      title: '网络连接异常，部分功能可能不可用',
      dismiss: '关闭提示',
    },
  },
  /** 布局头部控件文案（default 布局复刻，切换中英文时热更新） */
  header: {
    collapse: '收起导航',
    expand: '展开导航',
    switchLayout: '切换布局',
    switchLanguage: '切换语言',
    darkMode: '切换深色主题',
    layoutSettings: '布局设置',
    layoutSettingsHint: '选择导航布局',
    layoutSidebar: '经典侧栏',
    layoutTop: '顶部导航',
    layoutMixed: '混合布局',
    layoutDual: '双栏布局',
    logout: '退出登录',
    loggingOut: '退出中...',
    closeMenu: '关闭导航菜单',
  },
  /** 多页签文案（default 布局 TagsView） */
  tagsView: {
    scrollLeft: '向左滚动页签',
    scrollRight: '向右滚动页签',
    refresh: '刷新当前页签',
    more: '更多页签操作',
    closeTag: '关闭页签',
    menuRefresh: '刷新',
    menuClose: '关闭',
    menuCloseLeft: '关闭左侧',
    menuCloseRight: '关闭右侧',
    menuCloseOthers: '关闭其他',
    menuCloseAll: '全部关闭',
  },
}
