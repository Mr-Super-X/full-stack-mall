/**
 * @vv/ui 根 barrel。
 *
 * 当前唯一聚合出口：createGlobalComponents 工厂（app 入口 `app.use(createGlobalComponents())`）。
 *
 * ⚠️ 宿主前置条件：本包是 workspace 源码直链包（非 npm 发布包），组件样式依赖宿主 scss
 * additionalData 注入 $BEM_PREFIX、弹窗族依赖宿主 auto-import 注入、组件注册依赖宿主
 * unplugin-vue-components 目录扫描——换宿主前必须逐项落实，详见包 README.md「宿主装配契约」。
 *
 * 刻意不聚合：
 * - `./components/**`（组件经 unplugin-vue-components 按目录扫描自动注册，模板零 import；
 *   目录 barrel / 无扩展 .ts 类型消费走 '@components/*' 别名——§1.6.2 既定例外，package.json
 *   exports 通配对目录/无扩展路径 TS 不可解析（2026-10-26 实证）；仅 '.vue' 文件级
 *   （含 ?raw / vi.mock）可包名化 '@vv/ui/components/*.vue'）
 * - `./composables/{useDialog,useConfirm,useLogout}`（AutoImport 按 '@vv/ui/composables/*'
 *   子路径注入；收进根 barrel 会让全局组件注册插件随任意 import 副作用化）
 * - `./assets/**`（样式/图标为构建期资产，经 '@assets/*' 别名或 scss 入口消费）
 *
 * @group 包出口
 */
export * from './global-components.ts'
