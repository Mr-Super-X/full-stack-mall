/**
 * Vitest 配置工厂 —— 6 app vitest.config.ts 的 test 块单一来源。
 *
 * 背景（2026-10-23 重复性审查）：6 份 vitest.config 的 test 配置段（environment / exclude /
 * root / globals / server.deps.inline / css 六字段）逐字同构，仅两处合法差异：
 *   1. 各 app 头注释（解释本 app 为何不配 coverage 阈值——注释保留在各 app 文件）；
 *   2. admin 独有的 coverage 阈值块（渐进路线图基线 50/48/45/50，作为参数传入而非工厂缺省——
 *      阈值是 admin 自己的冻结基线，其他 app 无此诉求）。
 * 收敛后各 app 只传 appRoot + 同目录 vite.config +（仅 admin）coverage 块。
 *
 * 口径说明（与原 app 逐字注释一致）：element-plus 组件单测依赖 jsdom + css:true +
 * deps.inline（EP 组件经 inline 打进测试进程，否则 ESM 产物在 jsdom 下解析异常）；
 * e2e/** 与 tests/e2e/** 排除在单测外（e2e 由 Playwright 专跑）。
 */
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
// vitest/config 不具名导出 UserConfig——test 字段由 vitest 的 `declare module 'vite'`
// 类型增强挂到 vite 的 UserConfig 上（上方 values import 已拉入增强），类型侧统一从 'vite' 导入
import type { ConfigEnv, UserConfig } from 'vite'

/** coverage 块类型（仅 admin 消费；阈值基线属 app 自有调参，工厂不预设缺省） */
type CoverageOptions = NonNullable<NonNullable<UserConfig['test']>['coverage']>

export interface CreateVitestConfigOptions {
  /** app 根目录（绝对路径，调用方用 fileURLToPath(new URL('.', import.meta.url))） */
  appRoot: string
  /**
   * 同目录 vite.config.ts 的 default export（工厂内部与 test 块 merge，插件/别名全继承）。
   * 2026-10-28 E1 起 createViteConfig 是回调形式（按构建 mode 派生 define），此处同时接受
   * 对象与函数——传函数时以 test 环境 env 求值后再 merge
   */
  viteConfig: UserConfig | ((env: ConfigEnv) => UserConfig)
  /**
   * coverage 配置（可选，仅 admin 传）。admin 阈值 50/48/45/50 是渐进路线图冻结基线
   * （v3.x 阶段；v4.0 目标 70/70/65/70），其他 app 经浏览器人工验收、不设阈值——
   * 传了就会启用覆盖率采集，缺省整体不挂 coverage 段
   */
  coverage?: CoverageOptions
}

export function createVitestConfig({ appRoot, viteConfig, coverage }: CreateVitestConfigOptions) {
  // 回调形式先求值（vitest 环境的 mode='test'；loadEnv 无 .env.test 时落保底值，测试内一律 mock 环境变量）
  const resolved =
    typeof viteConfig === 'function' ? viteConfig({ command: 'serve', mode: 'test' }) : viteConfig
  return mergeConfig(
    // vite UserConfig 与 vitest 增强版 UserConfig 泛型不兼容（原 6 app 各自 cast 的根因），
    // cast 收敛进工厂后，调用方不再各自写 as never
    resolved as never,
    defineConfig({
      test: {
        environment: 'jsdom',
        exclude: [...configDefaults.exclude, 'e2e/**', 'tests/e2e/**'],
        root: appRoot,
        globals: true,
        server: {
          deps: {
            inline: ['element-plus', '@element-plus/icons-vue'],
          },
        },
        css: true,
        ...(coverage ? { coverage } : {}),
      },
    })
  )
}
