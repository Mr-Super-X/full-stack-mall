import type { MockMethod } from 'vite-plugin-mock'
// 类型挂钩（2026-10-28，docs/22 §2 约定）：菜单响应与 @vv/shared api 层
// RemoteMenuItem 绑定——改契约时编译器即时报错（import type 编译期擦除无运行时依赖）
import type { RemoteMenuItem } from '@vv/shared'

// 注意：mock response 必须是**同步函数**。详见 mock/auth.ts 顶部注释。

/**
 * 远程菜单 mock：与 @vv/shared api/modules/menu 的 RemoteMenuItem[] 契约一致。
 *
 * 覆盖 3 种典型场景：
 *   1. 单级菜单（Workbench）—— 顶层页面，admin 登录后落地页（P3-1 起；
 *      原 Home/官网仪表盘已独立为 apps/portal，admin 不再有 Home 路由，
 *      name 无本地路由对应会被 convertItem 跳过 + warn）
 *   2. 单级菜单（UserList）—— 顶层业务页 + 权限码
 *   3. 隐藏菜单（Reports）—— 后端 hidden:true 转换后，前端 meta.visible:false
 *
 * 多级菜单（嵌套 children）场景已注释保留（参考块），实际未启用——
 * 启用前需在 src/modules/ 下新增对应业务模块（如 orders/）并注册路由，
 * 否则 COMPONENT_REGISTRY 查不到 name → src/router/remote.ts:172 触发 warn。
 *
 * 路由守卫在 remote 模式下会调此接口拉菜单并 router.addRoute() 注入。
 * 拉到的 JSON 由 src/router/remote.ts:34 的 RemoteMenuItemSchema（zod）运行时校验；
 * 校验失败时守卫 console.warn + 逐项校验兜底（容错优先），不影响菜单加载。
 *
 * 字段说明详见 @vv/shared api/modules/menu 中的 RemoteMenuItem 接口注释
 * （JSDoc 原引 src/router/types.ts 为单应用时代路径，2026-10-28 审计修正）。
 */
export default [
  {
    url: '/mock/menu',
    method: 'get',
    timeout: 200,
    response: () => ({
      code: 200,
      message: 'ok',
      data: [
        // 1. 顶层页面（Workbench：P3-1 起 admin 落地页）
        {
          name: 'Workbench',
          path: '/workbench',
          meta: { title: '工作台', icon: 'odometer' },
        },
        // 2. 顶层业务页（带权限码）
        {
          name: 'UserList',
          path: '/user/list',
          meta: {
            title: '用户管理',
            icon: 'user',
            permissions: ['user:view'],
          },
        },
        // 3. 隐藏菜单（hidden: true → meta.visible: false）
        {
          name: 'Reports',
          path: '/reports',
          meta: {
            title: '运营报表',
            icon: 'data-analysis',
            permissions: ['reports:view'],
            hidden: true, // 转换后守卫拦截直访，菜单也不渲染
          },
        },
      ] satisfies RemoteMenuItem[],
    }),
  },
] as MockMethod[]
