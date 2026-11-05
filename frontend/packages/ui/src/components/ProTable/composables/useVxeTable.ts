/**
 * useVxeTable —— vxe-table 引擎适配层（spec 决策 1：动态按需加载）
 *
 * 职责：
 * - 动态 import('vxe-table') + `vxe-table/lib/style.css`，模块级缓存（避免重复加载）
 * - 首次加载成功后在 app 级 install（vxe 内部组件依赖全局注册；WeakSet 保证幂等）
 * - import 失败时抛错（spec §九 #7：上层 catch 后切回 element-plus）
 *
 * v2.1 实装版：在 P5 骨架（dynamic import + 缓存）之上补 CSS 注入与 app 安装。
 *
 * @group ProTable composables
 */
import { getCurrentInstance, type App, type Plugin } from 'vue'

/** vxe-table 模块结构（仅声明用到的部分，避免引入整个类型声明——其类型链依赖未安装的 vxe-pc-ui） */
export interface VxeModule {
  default: {
    install?: (app: App, ...options: unknown[]) => void
    Table: unknown
    Column: unknown
  }
}

let cachedModule: VxeModule | null = null
let loadingPromise: Promise<VxeModule> | null = null
/** 已安装过的 app 集合：同一 app 重复 load（如 reset 后重载）不再二次 install */
const installedApps = new WeakSet<App>()

export interface UseVxeTableReturn {
  /** 加载 vxe-table（首次调用触发 import + CSS 注入 + app 安装，后续返回缓存） */
  loadVxeTable: () => Promise<VxeModule>
  /** vxe-table 是否已加载完成 */
  isLoaded: () => boolean
  /** 清除缓存（卸载时调用） */
  reset: () => void
}

/**
 * 安装 vxe-table 插件到指定 app（幂等）
 *
 * 单独导出以便测试直接验证安装行为，绕过组件上下文。
 *
 * @param app 目标 Vue 应用实例
 * @param mod 已加载的 vxe-table 模块
 */
export function installVxeTable(app: App, mod: VxeModule): void {
  if (installedApps.has(app)) return
  installedApps.add(app)
  app.use(mod.default as unknown as Plugin)
}

export function useVxeTable(): UseVxeTableReturn {
  // setup 阶段一次性捕获 app：loadVxeTable 通常在 onMounted 异步执行，
  // 彼时组件实例上下文已失效，getCurrentInstance() 会返回 null
  const app = getCurrentInstance()?.appContext.app ?? null

  /** 动态加载 vxe-table（spec 决策 1：dynamic import；CSS 与 JS 并行，样式不进首屏 bundle） */
  async function loadVxeTable(): Promise<VxeModule> {
    if (cachedModule) return cachedModule
    if (loadingPromise) return loadingPromise
    loadingPromise = (async () => {
      // vxe-table 动态 import（CLAUDE.md §1.6.1 vxe-table 来源注释：仅动态加载）
      const [mod] = await Promise.all([import('vxe-table'), import('vxe-table/lib/style.css')])
      const vxeModule = mod as unknown as VxeModule
      if (app) {
        installVxeTable(app, vxeModule)
      } else {
        // 非组件上下文（如测试/SSR）无法定位 app：插件不安装则 vxe 组件渲染不出，必须显式告警
        console.warn(
          '[ProTable] useVxeTable 在非组件上下文调用，vxe-table 插件未安装，vxe 引擎可能无法渲染'
        )
      }
      cachedModule = vxeModule
      return vxeModule
    })()
    try {
      return await loadingPromise
    } finally {
      loadingPromise = null
    }
  }

  /** 是否已加载（vxe-table 引擎首次切换后变为 true） */
  function isLoaded(): boolean {
    return cachedModule !== null
  }

  /** 清除模块缓存（spec §九 #7 失败兜底配合 reset 后重试） */
  function reset(): void {
    cachedModule = null
    loadingPromise = null
  }

  return { loadVxeTable, isLoaded, reset }
}
