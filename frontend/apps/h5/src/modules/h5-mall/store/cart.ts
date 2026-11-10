import { defineStore } from 'pinia'
import { ref } from 'vue'

import { h5CartApi } from '../apis/cart'

/**
 * 购物车角标私有 store（模块内跨组件共享：常驻 tabbar 显示条数）。
 *
 * 刷新失败（未登录 401 / 网络异常）保持原值不阻塞 UI——角标是辅助信息，
 * 登录守卫与购物车页自身的错误态才是用户反馈通道。
 */
export const useCartBadgeStore = defineStore('module-h5-mall-cart', () => {
  /** 购物车条目数（tabbar bag 角标；0 不显示） */
  const count = ref(0)

  /** 从后端刷新角标（shell 挂载与每次加购后调用） */
  async function refresh(): Promise<void> {
    try {
      const rows = await h5CartApi.list()
      count.value = rows.length
    } catch {
      // 未登录/网络异常：保持原值（角标不阻塞主流程）
    }
  }

  return { count, refresh }
})
