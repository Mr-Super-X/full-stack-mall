import type { App } from 'vue'
import { autoImport } from '../utils/autoImport.ts'

/**
 * 自动扫描当前目录下所有指令文件并全局注册。
 *
 * 设计要点（参考原内部项目 autoImportGlobalDirectivePlugin.js 实现）：
 * - Vite 适配：import.meta.glob 替代 webpack require.context
 * - 自动跳过 index.ts 自身和下划线开头的内部工具文件（如 _utils.ts）
 * - 自动跳过 .d.ts 类型声明文件
 * - 自动跳过 .spec.ts 单测文件（加载会执行 vi.mock 等 vitest 代码导致运行时崩溃）
 * - 指令文件必须 default export `{ install(app) }`（与项目内现有指令一致）
 * - 业务侧零改动：新增 v-foo.ts 后无需修改本文件
 *
 * 注册的指令（v- 前缀）：
 * - v-inputDebounce:    input 输入防抖（v-inputDebounce:1000="onInput"）
 * - v-buttonDebounce:   button 点击节流防重（v-buttonDebounce:500="onClick"）
 * - v-permission:       占位权限控制（v-permission="['user:edit']"，P2 阶段实装真实逻辑）
 * - v-auth:             完整权限指令（v-auth="'user:view'" / v-auth:any.disabled="['a','b']"）
 *
 * 未来新增指令：直接在 src/directives/ 下添加 v-xxx.ts 即可，
 * 无需在本文件 import，也无需修改 main.ts。
 *
 * @see [`../../utils/autoImport.ts`](../../utils/autoImport.ts) 通用 autoImport 工具
 * @group 指令：自动注册
 */
interface DirectiveModule {
  default: { install: (app: App) => void }
}

// Vite equivalent of webpack require.context：
// 1. 扫描同目录所有 .ts 文件，但显式排除：
//    - !./**/*.spec.ts  单测（避免 vitest 代码在 runtime 加载崩溃）
//    - !./**/*.d.ts    类型声明（无运行时内容，被 glob 误匹配会触发"非标准模块"警告）
//    ⚠️ 关键：filter 在 transform 时机执行，但 import.meta.glob 已先 import
//    必须用 glob 否定模式（! 前缀）才能在加载阶段就跳过这些文件。
// 2. eager 模式：同步导入（Vite 编译时已 inline）
// 3. 泛型指定模块 default export 形状
const modules = import.meta.glob<DirectiveModule>(['./*.ts', '!./**/*.spec.ts', '!./**/*.d.ts'], {
  eager: true,
})

/**
 * Vue 3 插件：注册所有指令到 app。
 */
const install = (app: App): void => {
  autoImport({
    modules,
    filter: (path) =>
      // 自身：递归依赖会导致循环
      path.endsWith('/index.ts') ||
      // 下划线开头：内部工具（如 _utils.ts），非指令
      path.includes('/_'),
    transform: (path, mod) => {
      const plugin = mod.default
      if (plugin && typeof plugin.install === 'function') {
        plugin.install(app)
      } else {
        // 防御：模块不符合约定时打印警告，不中断应用启动
        console.warn(`[directives] 跳过非标准模块：${path}（应 default export { install(app) }）`)
      }
    },
  })
}

// 防御：未来若加新指令，filter 仍兜底跳过 index.ts / _* 等非指令文件；
// 若 transform 触发"非标准模块"警告，说明有 .ts 文件未被 glob 排除模式覆盖，
// 优先考虑扩展 glob 排除（!./**/*.x.ts）而不是放任警告噪音。

export default install
