/**
 * Vite 插件：自动清理 vite-plugin-mock 在 mock/ 目录生成的 bundled 临时文件
 *
 * 背景：vite-plugin-mock@3.x 内部通过 bundle-require 把 mock 源文件打包成
 * `_xxx.bundled_<timestamp>_<random>.mjs` 后再执行；这些临时文件按
 * `getOutputFile` 规则落到与源 mock 文件同目录（mock/），每次启动 / mock 变更
 * 都会生成新的带时间戳的副本，长期累积污染工作区。
 *
 * 竞争事故记录（2026-10-20，df9f19c 触雷）：bundle-require import 临时文件后
 * 执行无容错的 fs.unlink（bundle-require@4.2.1 dist/index.js:172）；旧实现用
 * fs.watch 对新生成文件延迟 500ms 删除，mock/ 第 19 个文件（mockProdServer.ts）
 * 使并发 bundle 窗口越过 500ms 阈值 → 清理插件抢删 → bundle-require unlink
 * ENOENT → vite-plugin-mock getMockConfig 的 Promise.all reject → catch 静默
 * 清空 mockData → dev mock 中间件全空（接口返回 index.html / 404）。
 *
 * 清理策略（方案 B 修订，用户已批准 2026-10-20）：
 * 1. 启动时（configureServer）一次性清空已有 bundled 文件
 * 2. dev 会话期间临时文件保留（.gitignore:43-44 兜底屏蔽提交），
 *    server 关闭时 closeBundle 统一清理
 *
 * 设计决策：撤销 watch 即时删除层是为彻底消除「并发删除 vs bundle-require
 * import」竞争窗口，非临时方案——只要存在运行时抢删，文件数/磁盘时序就可能
 * 再次越过任何固定延迟阈值。
 *
 * 根治边界（2026-10-28 /autoplan T-1 调研结论，防未来重提）：
 * - bundle 输出目录/文件名（_<name>.bundled_<random>.mjs）由 vite-plugin-mock 内部
 *   getOutputFile 写死，无配置可改——「按 app 隔离 bundle 目录」需 patch-package，拒；
 * - configPath 单文件模式把 bundle 从 19 次/进程降到 1 次，但 watch 只盯单文件——
 *   mock 子文件热更新失效（每日高频操作），为启动期低频竞态牺牲它不值，拒；
 * - 预构建产物化 = 自研 mock 插件，拒。
 * 现状组合（5s mtime 门槛 + dev:gateway 串行 + pnpm dev 文档标记）已是代价/收益最优。
 * 残留窗口仅剩「单进程 import→unlink 序列 >5s 的极端卡顿」——可感知（接口 404）、
 * 有明确 workaround（重启该 app dev），docs/43 §9.3 已载。
 *
 * mockDir 入参（P1-1 包化修正）：bundled 文件落在 mock 源文件同目录，而 dev 的
 * cwd 是各 app 目录（apps/<app>），cwd 相对解析必错——P0-2 迁移后本插件曾因
 * resolve(cwd, 'mock') 指向 apps/admin/mock（不存在）而静默空转。改为由工厂
 * 显式传入 mockPath（vite-plugin-mock 同款解析结果），默认值仅保向后兼容。
 *
 * 安全：
 * - 只匹配传入的 mockDir（含子目录，如 mock/pro-table/），不影响其它位置
 * - 文件名硬约束 `_*.bundled_*.mjs` / `_*.bundled_*.cjs`，与 vite-plugin-mock
 *   自身 `ignored` 规则一致，不会误删真实 mock 文件
 */
import { existsSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { Plugin } from 'vite'

const BUNDLED_RE = /^_.*\.bundled_.*\.(?:mjs|cjs)$/

/** 递归收集 mock 目录下所有 bundled 临时文件的绝对路径 */
function collectBundledFiles(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    // 目录递归下探；文件按 BUNDLED_RE 硬约束过滤，与 vite-plugin-mock 自身规则一致
    if (entry.isDirectory()) {
      collectBundledFiles(full, acc)
    } else if (entry.isFile() && BUNDLED_RE.test(entry.name)) {
      acc.push(full)
    }
  }
  return acc
}

export function cleanMockBundled(mockDir: string = resolve(process.cwd(), 'mock')): Plugin {
  // mtime 门槛（毫秒）：只删创建时间早于该值的 bundled 文件，跳过「在飞」的（其他并行
  // dev server 进程正要 import 的）——根治 `pnpm dev`（turbo 并行 6 app 共享同一 mock 源）
  // 的启动竞态（A 进程 cleanupOnce 抢删 B 进程正在 import 的 bundled → B 的 mockData 静默清空
  // → 接口 404）。dev:gateway 串行不涉此竞态，但 mtime 门槛对两条入口都安全（在飞文件本就不该删）。
  const STALE_AGE_MS = 5000

  function cleanupOnce(): void {
    const now = Date.now()
    for (const full of collectBundledFiles(mockDir)) {
      try {
        // 只删「陈旧」文件（创建超 STALE_AGE_MS）；在飞文件（mtime 新）跳过，留给其持有者
        const { birthtimeMs } = statSync(full)
        if (now - birthtimeMs < STALE_AGE_MS) continue
        unlinkSync(full)
      } catch {
        // 文件可能已被其它进程 / 上面循环删掉，吞 ENOENT
      }
    }
  }

  return {
    name: 'vv:clean-mock-bundled',
    apply: 'serve',
    configureServer() {
      cleanupOnce()
    },
    closeBundle() {
      cleanupOnce()
    },
  }
}
