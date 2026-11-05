/**
 * Pinia 根配置（auth）。
 *
 * auth 是唯一需要登录态读写的应用（登录/登出入口）：消费 @vv/shared 的
 * user store（login/logout）与 dict store（登录后字典预加载）；
 * auth 自身无 app 私有全局 store（auth 模块私有 store 归 modules/auth/store）。
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
