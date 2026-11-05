/**
 * 动态图标注册表 —— AppDynamicIcon 的运行时查表数据源（纯资产映射，无响应式状态，故不放 composables/）。
 *
 * 借助 unplugin-icons 编译期解析 `virtual:icons/*` 静态导入，组装「name → 组件」映射：
 * 只有登记进本文件的图标会进 bundle（按需打包）；keyof 推导出的字面量联合类型
 * AppIconName 让 vue-tsc 在编译期拦截错误图标名（验收#2）。
 *
 * 新增动态图标 = 加一行 import + 一个表项，无需改动 AppDynamicIcon（详见 docs/39 §新增流程）。
 *
 * ⚠️ vitest 无法解析 virtual:icons 虚拟模块（Icons 插件不在测试管线），
 *    AppDynamicIcon.spec.ts 通过 vi.mock 本模块绕过。
 */
import type { Component } from 'vue'
import EpPlus from 'virtual:icons/ep/plus'
import TablerHome from 'virtual:icons/tabler/home'
import TablerSettings from 'virtual:icons/tabler/settings'
import AppLogo from 'virtual:icons/app/logo'
import AppClose from 'virtual:icons/app/close'

/** 动态图标注册表：key 即 AppDynamicIcon name 的合法取值（集合:图标 语法） */
const registry = {
  'ep:plus': EpPlus,
  'tabler:home': TablerHome,
  'tabler:settings': TablerSettings,
  'app:logo': AppLogo,
  'app:close': AppClose,
} as const

/** 动态图标名联合类型 —— AppDynamicIcon name prop 的类型来源（与注册表 keyof 绑定） */
export type AppIconName = keyof typeof registry

/** 类型守卫：把外部不可信字符串（后端菜单配置等）收窄为 AppIconName */
export function isAppIconName(name: string): name is AppIconName {
  return name in registry
}

/** 按名字解析图标组件；调用方要么经类型层保证 name 合法，要么先过 isAppIconName 守卫 */
export function resolveAppIcon(name: AppIconName): Component {
  return registry[name]
}
