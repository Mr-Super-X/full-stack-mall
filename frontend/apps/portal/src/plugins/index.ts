/**
 * 项目插件统一注册入口（portal）——薄封装 + versionCheck 通知注入（试点）。
 *
 * 单源装配逻辑归 @vv/shared 的 createAppPlugins 工厂（P6 下沉：5 app
 * plugins/index.ts 同构收敛）。portal 无 h5 布局（viewport meta 在 index.html
 * 静态声明），工厂缺省不装配 remAdaptation。
 *
 * versionCheck 通知注入（2026-10-28 试点）：prod 缺省不注入 onUpdate 即不启动
 * （无人消费的信号不采集，/autoplan R2-CEO-3）——门户站用户场景注入
 * ElNotification 通知（注入即启用信号），buildId 变化 / ChunkLoadError 兜底
 * 统一提示刷新；间隔保持默认 5min。
 * ElNotification 显式 import + 样式随行（apps 私有文件不受 AutoImport 兜底，
 * 与 @vv/shared http.ts 的 ElMessage 同范式）。
 *
 * @see [`./errorHandler.ts`](./errorHandler.ts) 全局错误处理（薄封装）
 * @see [`./webVitals.ts`](./webVitals.ts) 性能指标采集（薄封装）
 * @group 插件：注册入口
 */
import type { App } from 'vue'
import { ElNotification } from 'element-plus'
import 'element-plus/es/components/notification/style/css'
import { createAppPlugins } from '@vv/shared'

const basePlugins = createAppPlugins()

export default {
  install(app: App): void {
    basePlugins.install(app, {
      versionCheck: {
        onUpdate: ({ source }) => {
          ElNotification({
            title: '系统更新',
            message: source === 'poll' ? '新版本已发布，请刷新页面' : '页面资源已过期，请刷新',
            type: 'info',
            duration: 0, // 不自动关闭，等用户手动刷新
          })
        },
      },
    })
  },
}
