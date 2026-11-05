/**
 * Pinia 根配置（docs）。
 *
 * demo 示例消费 @vv/shared 的 4 个共享 store（app / user / theme / dict，
 * 如 DirectiveAuth 演示 @store/modules/user）；docs 自身无 app 私有 store
 * （tags-view 多页签与 admin 布局强耦合，不随迁）。
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
