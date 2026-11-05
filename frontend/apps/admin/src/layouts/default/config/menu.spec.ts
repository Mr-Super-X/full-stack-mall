/**
 * layouts/default 菜单树派生逻辑测试。
 *
 * 为什么用 createRouter 真实实例而非手写 mock 记录：
 * vue-router 5 的 `getRoutes()` 会把 children 平铺进返回列表（index 子路由解析后
 * 与父记录同 path），菜单树的顶层判定依赖这一真实行为——mock 记录无法复现
 * 平铺/解析语义，测试会失去防线意义。
 *
 * @see [`./menu.ts`](./menu.ts) 被测实现
 * @group 布局：Default
 */
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import {
  buildMenuTree,
  filterAffixRoutes,
  firstRoutePath,
  isUrl,
  pathResolve,
  resolveSingleChild,
} from './menu'
import type { MenuNode } from './types'

const Stub = defineComponent({ name: 'Stub', setup: () => () => null })

/** 复刻项目真实路由形态：index 子路由 / 单子项 / 多子项分组 / 排除项 */
function makeRouter(): ReturnType<typeof createRouter> {
  const routes: RouteRecordRaw[] = [
    {
      path: '/home',
      component: Stub,
      children: [
        {
          path: '',
          name: 'Home',
          component: Stub,
          meta: { title: '仪表盘', icon: 'odometer', requiresAuth: true, affix: true },
        },
      ],
    },
    {
      path: '/user',
      component: Stub,
      children: [
        {
          path: 'list',
          name: 'UserList',
          component: Stub,
          meta: { title: '用户管理', icon: 'user', requiresAuth: true },
        },
      ],
    },
    {
      path: '/workbench',
      component: Stub,
      meta: { title: '工作台', titleKey: 'menu.workbench', icon: 'monitor', requiresAuth: true },
      children: [
        {
          path: 'analysis',
          name: 'WorkbenchAnalysis',
          component: Stub,
          meta: { title: '分析页', icon: 'data-analysis', requiresAuth: true },
        },
        {
          path: 'monitor',
          name: 'WorkbenchMonitor',
          component: Stub,
          meta: { title: '监控页', requiresAuth: true },
        },
        {
          path: 'hidden-child',
          name: 'WorkbenchHidden',
          component: Stub,
          meta: { title: '隐藏页', requiresAuth: true, menuVisible: false },
        },
      ],
    },
    // ─── 以下不应出现在菜单 ───
    {
      // P4 起 Login 迁 apps/auth；本例改用 Forbidden 验证"错误页 name 不进菜单"语义
      path: '/403',
      component: Stub,
      children: [
        {
          path: '',
          name: 'Forbidden',
          component: Stub,
          meta: { title: '403', requiresAuth: false },
        },
      ],
    },
    { path: '/404', name: 'NotFound', component: Stub, meta: { title: '404' } },
    {
      path: '/detail',
      component: Stub,
      children: [
        {
          path: ':id',
          name: 'Detail',
          component: Stub,
          meta: { title: '详情', requiresAuth: true },
        },
      ],
    },
  ]
  return createRouter({ history: createMemoryHistory(), routes })
}

describe('isUrl', () => {
  it('识别 http/https/ftp 外链', () => {
    expect(isUrl('https://example.com')).toBe(true)
    expect(isUrl('http://a.b/c')).toBe(true)
    expect(isUrl('ftp://a.b')).toBe(true)
    expect(isUrl('/workbench')).toBe(false)
    expect(isUrl('workbench')).toBe(false)
  })
})

describe('pathResolve', () => {
  it('外链与绝对路径原样返回', () => {
    expect(pathResolve('/user', 'https://a.b')).toBe('https://a.b')
    expect(pathResolve('/user', '/abs')).toBe('/abs')
  })

  it('相对路径拼接到父路径', () => {
    expect(pathResolve('/user', 'list')).toBe('/user/list')
    expect(pathResolve('/user/', 'list')).toBe('/user/list')
  })

  it('空 path（index 子路由）解析为父路径本身，不产生尾斜杠', () => {
    expect(pathResolve('/home', '')).toBe('/home')
    expect(pathResolve('/home/', '')).toBe('/home')
    expect(pathResolve('/', '')).toBe('/')
  })
})

describe('buildMenuTree', () => {
  it('index 子路由（path: ""）只产生一个菜单项，无重复，标题继承子项', () => {
    const tree = buildMenuTree(makeRouter())
    const homeNodes = tree.filter((n) => n.path === '/home')
    expect(homeNodes).toHaveLength(1)
    // 布局父记录无 meta：标题/图标继承自 index 子项（PrimaryNav 直接消费顶层节点 title）
    expect(homeNodes[0]?.title).toBe('仪表盘')
    expect(homeNodes[0]?.icon).toBe('odometer')
    expect(homeNodes[0]?.children?.[0]?.path).toBe('/home')
    expect(homeNodes[0]?.children?.[0]?.title).toBe('仪表盘')
  })

  it('单子项提升：父分组折叠为指向子项路径的单项', () => {
    const tree = buildMenuTree(makeRouter())
    const userNode = tree.find((n) => n.path === '/user')
    expect(userNode).toBeDefined()
    // 单可见子项 → children 仍保留（提升判定由 AppMenu 渲染层消费 resolveSingleChild）
    expect(userNode?.children).toHaveLength(1)
    expect(userNode?.children?.[0]?.path).toBe('/user/list')
    expect(userNode?.children?.[0]?.title).toBe('用户管理')
  })

  it('多子项保留父分组，menuVisible:false 的子项被过滤', () => {
    const tree = buildMenuTree(makeRouter())
    const group = tree.find((n) => n.path === '/workbench')
    expect(group?.title).toBe('工作台')
    expect(group?.icon).toBe('monitor')
    expect(group?.children?.map((c) => c.path)).toEqual([
      '/workbench/analysis',
      '/workbench/monitor',
    ])
  })

  it('排除：错误页 / 动态段路由不进菜单', () => {
    const tree = buildMenuTree(makeRouter())
    const paths = tree.map((n) => n.path)
    expect(paths).not.toContain('/403')
    expect(paths).not.toContain('/404')
    expect(paths).not.toContain('/detail')
    expect(paths).toContain('/home')
    expect(paths).toContain('/user')
    expect(paths).toContain('/workbench')
  })

  it('i18n：titleKey 命中时优先于 title', () => {
    const tree = buildMenuTree(makeRouter(), (key) =>
      key === 'menu.workbench' ? '工作台(i18n)' : key
    )
    const wb = tree.find((n) => n.path === '/workbench')
    expect(wb?.title).toBe('工作台(i18n)')
  })
})

describe('resolveSingleChild', () => {
  const node = (children?: MenuNode[]): MenuNode => ({ path: '/p', title: 'P', children })

  it('恰好一个可见子项 → 提升', () => {
    const child: MenuNode = { path: '/p/c', title: 'C' }
    expect(resolveSingleChild(node([child]))).toEqual({ oneShowingChild: true, onlyChild: child })
  })

  it('无可见子项 → 父项自身作为菜单项', () => {
    expect(resolveSingleChild(node([]))).toEqual({ oneShowingChild: true, onlyChild: node([]) })
  })

  it('多个可见子项 → 保持分组', () => {
    const result = resolveSingleChild(
      node([
        { path: '/p/a', title: 'A' },
        { path: '/p/b', title: 'B' },
      ])
    )
    expect(result.oneShowingChild).toBe(false)
    expect(result.onlyChild).toBeUndefined()
  })
})

describe('filterAffixRoutes', () => {
  it('收集 meta.affix === true 的视图路由', () => {
    const tags = filterAffixRoutes(makeRouter())
    expect(tags).toHaveLength(1)
    expect(tags[0]).toMatchObject({ name: 'Home', path: '/home', title: '仪表盘', affix: true })
  })
})

describe('firstRoutePath', () => {
  it('递归取第一个叶子节点路径', () => {
    const tree: MenuNode = {
      path: '/workbench',
      title: '工作台',
      children: [
        { path: '/workbench/analysis', title: '分析页' },
        { path: '/workbench/monitor', title: '监控页' },
      ],
    }
    expect(firstRoutePath(tree)).toBe('/workbench/analysis')
  })

  it('无 children 时返回自身路径（含外链）', () => {
    expect(firstRoutePath({ path: 'https://a.b', title: '外链' })).toBe('https://a.b')
  })
})
