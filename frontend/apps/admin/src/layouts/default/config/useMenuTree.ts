/**
 * Default 布局菜单数据派生与主导航选择（布局壳 useMenuTree）。
 *
 * 抽离 index.vue 的动机同 useMenuResizing：布局壳行数逼近硬上限，而"菜单树 /
 * 激活顶层模块 / 二级菜单 / 主导航跳转"是与 menu.ts 纯函数配套的内聚逻辑，
 * 模板消费方只关心派生结果，不关心 route/router/i18n 的组装细节。
 *
 * @see [`./menu.ts`](./menu.ts) buildMenuTree / firstRoutePath / isUrl 纯函数
 * @see [`../index.vue`](../index.vue) 布局壳消费方（四模式菜单渲染）
 * @group 布局：Default
 */
import { useI18n } from 'vue-i18n'
import type { MenuNode } from './types'
import { buildMenuTree, firstRoutePath, isUrl } from './menu'

/** 布局壳菜单树：全量树 + 当前激活顶层模块 + 其二级子菜单 + 主导航跳转 */
export function useMenuTree() {
  const route = useRoute()
  const { router } = useAppRouter()
  const { t } = useI18n()

  /** 全量菜单树（各业务模块顶层路由） */
  const menuTree = computed(() => buildMenuTree(router, t))

  /** 当前路由所属的顶层模块节点（mixed/dual 的二级菜单与主导航激活态） */
  const activePrimary = computed<MenuNode | undefined>(() => {
    const path = route.path
    return menuTree.value.find(
      (node) => !isUrl(node.path) && (path === node.path || path.startsWith(`${node.path}/`))
    )
  })

  /** mixed/dual 模式的二级侧栏菜单 = 当前顶层模块的子菜单 */
  const secondaryNodes = computed<MenuNode[]>(() => activePrimary.value?.children ?? [])

  /** 主导航点击：跳转该模块第一个可见叶子页（外链新窗口打开） */
  function selectPrimary(node: MenuNode) {
    const path = firstRoutePath(node)
    if (isUrl(path)) {
      window.open(path, '_blank', 'noopener,noreferrer')
    } else {
      router.push(path)
    }
  }

  return { menuTree, activePrimary, secondaryNodes, selectPrimary }
}
