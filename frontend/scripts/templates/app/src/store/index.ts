/**
 * Pinia 根配置（__APP_NAME__）。
 *
 * 实例创建经 @vv/shared 的 createAppPinia（P5 下沉单源：原 6 app 逐字拷贝收敛）。
 * 本 app 无私有 store；跨模块共享 store（app / user / theme / dict）归 @vv/shared。
 *
 * @see `@vv/shared/store` 共享 store 出口
 * @group 状态管理
 */
import { createAppPinia } from '@vv/shared/store'

const pinia = createAppPinia()

export default pinia
// 共享 store re-export（与各 app 同 barrel 语义，消费方经 '@/store' 取用）
export * from '@vv/shared/store'
