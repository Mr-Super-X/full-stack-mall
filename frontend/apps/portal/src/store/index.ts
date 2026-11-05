/**
 * Pinia 根配置（portal）。
 *
 * PortalHeader 消费 @vv/shared 的 user store（登录/用户双态头部）；
 * portal 自身无 app 私有 store（home 模块为纯静态展示页，无业务状态）。
 *
 * 实例创建经 @vv/shared 的 createAppPinia（P5 下沉单源：原 6 app 逐字拷贝收敛）。
 *
 * @see `@vv/shared/store` 共享 store 出口
 * @group 状态管理
 */
import { createAppPinia } from '@vv/shared/store'

const pinia = createAppPinia()

export default pinia
// 共享 store re-export（与 admin 同 barrel 语义，消费方经 '@/store' 取用；'@store/*' 过渡态路径已收敛，不再教新用法——2026-10-27 注释审计）
export * from '@vv/shared/store'
