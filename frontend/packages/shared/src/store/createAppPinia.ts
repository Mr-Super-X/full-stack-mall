/**
 * Pinia 实例工厂（@vv/shared 单源）。
 *
 * 文件角色：「createPinia() + use(piniaPluginPersistedstate)」装配序列的跨 app 单源实现。
 *
 * 下沉原因（P5）：原 6 个 app 的 store/index.ts 逐字重复同一装配段——插件增删或顺序
 * 调整需同步 6 处（拷贝漂移风险），收敛为工厂统一装配；各 app 仍保留自己的 store
 * barrel re-export（app 私有 store 有差异，如 admin 的 tags-view 不在此列）。
 *
 * @group 状态管理
 */
import { createPinia } from 'pinia'
import type { Pinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'

/**
 * 创建已挂载持久化插件的 Pinia 实例。
 *
 * 业务承诺：返回实例可直接 `app.use(pinia)`；各 store 的 `persist` 选项由本工厂
 * 挂载的 pinia-plugin-persistedstate 统一兑现（新 app 不再手写装配段）。
 */
export function createAppPinia(): Pinia {
  const pinia = createPinia()
  pinia.use(piniaPluginPersistedstate)
  return pinia
}
