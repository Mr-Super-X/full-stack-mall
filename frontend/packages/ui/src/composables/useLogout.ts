/**
 * 退出登录 composable。
 *
 * 封装 `useConfirm` 二次确认（取消 resolve false，调用方无须 try/catch）+ loading 态 +
 * `store.logout` 调用 + 整页跳统一登录应用（apps/auth）。`Header.vue` 与 `PortalHeader.vue` 复用。
 *
 * v1.14.2 二次确认从 `ElMessageBox.confirm + try/catch` 切换到 `useConfirm`；
 * 切换前后文案（`'确定退出登录吗？'` + `'退出'`/`'取消'` + `type: 'warning'`）完全一致。
 *
 * 跳转职责在此（2026-08-12 改造）：`store.logout` 不再依赖 router 实例，
 * 斩断 `store → router → guards → store` 循环依赖；logout 乐观化后不抛错，
 * 确认后始终跳转登录页。
 *
 * P4 跨应用统一登录协议：不再 `goLogin()`（vue-router push 'Login'——auth 独立后
 * 消费方 app 内无登录路由），改整页 `location.href` 跳 apps/auth 登录页；
 * VITE_AUTH_ORIGIN 由各 app env 注入（本包不硬编码 app 名，缺省 '/auth'）。
 *
 * @see `@vv/shared` store/modules/user —— logout action
 * @see `@vv/shared/auth/redirect` —— 跨应用统一登录协议（redirectToAuthLogin 同源语义）
 * @see [`./useConfirm`](./useConfirm.ts) 二次确认 composable
 * @see [`docs/23-权限设计.md §5.10`](../../../../docs/23-权限设计.md) useLogout 完整契约
 * @group 登出组合式 API
 */

// 包内兄弟 composable 用显式相对导入（@vv/ui 包规范）；
// app 侧消费本文件时 AutoImport 对显式导入的标识符跳过注入
// 弹窗文案走 i18n auth.* 四键（与硬编码逐字对应——2026-10-28 i18n 审计 P0 接线，zh 行为零变化）
import { useI18n } from 'vue-i18n'
import { useConfirm } from './useConfirm.ts'
import { useUserStore, resolveAuthOrigin } from '@vv/shared'

export function useLogout() {
  const { t } = useI18n()
  const userStore = useUserStore()
  const loggingOut = ref(false)

  async function confirmLogout(): Promise<void> {
    // useConfirm 取消时 resolve(false) 而非 reject，故此处无须 try/catch
    const confirmed = await useConfirm({
      content: t('auth.logoutConfirm'),
      title: t('auth.logoutTitle'),
      confirmButtonText: t('auth.logoutConfirmButton'),
      cancelButtonText: t('auth.logoutCancelButton'),
      type: 'warning',
    })
    if (!confirmed) return

    loggingOut.value = true
    try {
      await userStore.logout()
      // 跨应用登出：清会话后整页跳 apps/auth 登录页（跨 app 无共享 router 实例）。
      // 与 redirectToAuthLogin 同 origin 语义，但不带 redirect 回跳参数、不抛中断信号——
      // 登出是终态操作，重登后回 fallback 落地页即可
      window.location.href = `${resolveAuthOrigin()}/login`
    } finally {
      loggingOut.value = false
    }
  }

  return { loggingOut, confirmLogout }
}
