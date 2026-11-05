/**
 * Pinia 根配置（big）。
 *
 * big-demo 模块消费 Pinia（useBigDemoStore 模块私有 store，随模块迁入本 app）；
 * 跨模块共享 store 经 @vv/shared barrel re-export（与 admin / docs 同语义）。
 *
 * 实例创建经 @vv/shared 的 createAppPinia（P5 下沉单源：原 6 app 逐字拷贝收敛）。
 *
 * @see `@vv/shared/store` 共享 store 出口
 * @group 状态管理
 */
import { createAppPinia } from '@vv/shared/store'

const pinia = createAppPinia()

export default pinia
// 共享 store re-export（与 admin / docs 同 barrel 语义，消费方经 '@/store' 取用；'@store/*' 过渡态路径已收敛，不再教新用法——2026-10-27 注释审计）
export * from '@vv/shared/store'
