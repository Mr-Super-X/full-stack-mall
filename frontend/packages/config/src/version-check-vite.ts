/**
 * Vite 插件：构建期生成 version.json（版本检测插件的构建侧，@vv/config 单源）。
 *
 * 文件角色：versionCheck runtime 插件（packages/shared/src/plugins/versionCheck.ts）
 * 的构建侧配套——runtime 定时轮询 version.json 比对 buildId，本插件在 build 的
 * closeBundle 钩子往 outDir（与 index.html 同级）写该文件。
 *
 * 设计要点：
 *   - apply: 'build' —— dev serve 不触发（HMR 即热更新，dev server 无 version.json；
 *     runtime 侧 dev 默认也不启动轮询，enabled 强制开启时 fetch 404 静默跳过）
 *   - buildId 来源优先级：显式入参 > process.env.VITE_BUILD_ID（CI 注入 git sha
 *     可追溯）> 兜底 `Date.now().toString(36) + random`（本地构建唯一）
 *   - 不经 rollup asset pipeline（assetFileNames 会把 .json 归 assets/）——
 *     closeBundle 直接 writeFileSync 到 outDir 根，保证与 index.html 同级的固定 URL
 *
 * @see [`packages/shared/src/plugins/versionCheck.ts`](../../shared/src/plugins/versionCheck.ts) runtime 轮询消费方
 * @group 插件：版本检测（构建侧）
 */
import { existsSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin, ResolvedConfig } from 'vite'

/** version.json 载荷（runtime parseVersionPayload 消费同 schema） */
export interface VersionPayload {
  buildId: string
  builtAt: string
}

/**
 * 构造 version.json 载荷。纯函数独立导出供测试直调（hook 装配只是包装）。
 *
 * @param explicitBuildId - 显式 buildId（最高优先级，测试/特殊构建用）
 * @returns buildId + ISO 时间戳
 */
export function createVersionPayload(explicitBuildId?: string): VersionPayload {
  return {
    buildId:
      explicitBuildId ??
      process.env.VITE_BUILD_ID ??
      `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    builtAt: new Date().toISOString(),
  }
}

/**
 * 创建 version-check vite 插件：closeBundle 时把 version.json 写到 outDir 根。
 *
 * @example createViteConfig 内装配（工厂单点，6 app 零改动）
 */
export function versionCheckVitePlugin(): Plugin {
  let outDir = 'dist'

  return {
    name: 'vv:version-check',
    apply: 'build',
    configResolved(config: ResolvedConfig) {
      // config.build.outDir 可能相对——必须锚 config.root（vite 自身的解析锚点），
      // 不能锚 process.cwd()（2026-10-28 /autoplan R2-E3）：经 `pnpm -C` / turbo
      // 入口时 cwd 恰等于 appRoot 无差异，但仓库根直跑 `vite build -c apps/x/...`
      // 会把 version.json 写进错误目录而产物正常——版本检测静默失效。
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      // outDir 不存在 = 构建未产出（构建已失败）——静默跳过，不用 ENOENT
      // 二次报错掩盖原始构建错误（2026-10-28 /autoplan R2-E3）
      if (!existsSync(outDir)) return
      const payload = createVersionPayload()
      writeFileSync(resolve(outDir, 'version.json'), JSON.stringify(payload, null, 2))
    },
  }
}
