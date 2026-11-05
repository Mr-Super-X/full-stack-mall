/**
 * 本地同域网关（一体化单命令）：node 网关 :8080 + 串行启动 6 个 app 的 vite dev server。
 *
 * 背景（docs/43 §同域网关）：生产为同域 path 部署（统一登录 cookie 跨 app 漫游），
 * 单 app 以默认 base '/' 起 dev 无法复现；本脚本内置 node 反向代理网关
 * （scripts/node-gateway.ts，零依赖，替代原 docker-compose + nginx 双终端方案）：
 *
 *   pnpm dev:gateway    # 唯一命令：网关 + 6 dev server 前台常驻，Ctrl+C 一并退出
 *   浏览器：http://localhost:8080/（302 → /portal/）
 *
 *   pnpm dev:gateway admin auth   # 子集模式（2026-10-27）：网关 + 仅指定 app，
 *   # 同一入口地址（8080 同源）——日常中后台开发省一半启动时间与内存
 *
 * 子集语义：未指定 app 的网关前缀仍保留路由（代码派生），上游未起时访问即 502
 * （与「单 app dev」语义一致：统一登录全链路必须走网关）；根 302 动态判定——
 * 子集含 portal 跳 /portal/，否则跳子集第一个（避免跳未起 app 落 502）。
 *
 * ⚠️ 串行启动（非并行，2026-10-23 竞态修复）：6 app 共享 @vv/mock 数据源，
 * vite-plugin-mock 用 bundle-require 把 mock 源编译成 _*.bundled_*.mjs 临时文件
 * （落在 mock 源同目录）+ clean-mock-bundled 插件 configureServer 启动时抢删。
 * 并行启动时多进程同时编译同一 mock 源 → cleanup 抢删正在 import 的临时文件 →
 * bundle-require unlink ENOENT → vite-plugin-mock 静默清空 mockData → 该 app 的
 * dev mock 中间件全空（接口 404，实测 auth 踩中，mock 源 19 个 .ts 文件越 500ms 阈值，
 * 见 packages/config/src/clean-mock-bundled.ts 头部事故记录）。
 * 串行（前一个端口就绪再启下一个）彻底消除并发编译窗口。
 *
 * ⚠️ 启动前预清（2026-10-29 登录 404 事故根治）：vite-plugin-mock 的 getMockConfig
 * glob 会匹配 mock 源目录下所有 ts/mjs/js 文件——上次非正常关闭残留的 bundled
 * 临时文件（同为 .mjs）会被当成 mock 源打包，与 clean-mock-bundled 的启动清理
 * 形成窗口竞态 → esbuild 解析已删文件 → 该 app mockData 静默清空（网关 /mock/
 * 只反代 admin，admin 挂 = 全站 mock 404）。main() 启动任何 app 前先无条件清空
 * mock 源目录 bundled 文件——此时无 dev server 在跑，删除绝对安全，从源头消除
 * 触发条件（cleanStaleMockBundled）。
 *
 * 启动顺序：先监听网关 8080（EADDRINUSE 立即报错——不浪费 6 个 dev 启动后才
 * 发现端口冲突），再串行起 dev server。
 *
 * 端口 = packages/config/src/server.ts SERVER_DEFAULTS.port(5174) + 各 app vite.config
 * portOffset；名单与端口单一事实源是 scripts/apps-registry.mjs——本脚本只注入 VITE_BASE，
 * 网关路由表由 scripts/node-gateway.ts 的 buildGatewayRoutes(APPS) 单源代码派生
 * （原 nginx.dev.conf 的 check-gateway-conf 双写校验已随 node 网关方案删除）。
 *
 * 为什么不用 turbo run dev：turbo 不支持 per-app env 注入，而 base 按 app 而异。
 *
 * 用法：pnpm dev:gateway（路由/端口一致性另跑 pnpm check:routes）
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, readdirSync, realpathSync, unlinkSync } from 'node:fs'
import type { Server } from 'node:http'
import { createConnection } from 'node:net'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { APPS } from './apps-registry.mjs'
import { buildGatewayRoutes, createGatewayServer } from './node-gateway.ts'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))

/** 同域网关监听端口（与原 nginx 网关一致 :8080） */
const GATEWAY_PORT = 8080

const children: ChildProcess[] = []

/** 网关 server（main 中赋值；shutdown 时关闭） */
let gateway: Server | null = null

/** 按进程树终止子进程：Windows 下 shell:true 拉起的是 cmd.exe，直接 kill 会孤儿化 vite */
function killTree(child: ChildProcess): void {
  if (child.pid == null) return
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', shell: true })
  } else {
    child.kill('SIGTERM')
  }
}

/** 任一 dev server 异常退出（strictPort 端口冲突 / 编译失败）→ 整组停止，避免半活状态 */
// 幂等守卫（2026-10-28 /autoplan R2-E6）：子进程非零 exit 触发本函数 → killTree
// 又致这些子进程 exit 事件重入——二次 gateway.close() 对已关闭 server 抛
// ERR_SERVER_NOT_RUNNING（退出过程 uncaught exception）
let shuttingDown = false
function shutdown(reason: string): void {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`\n🛑 ${reason}，正在停止网关与 ${children.length} 个 dev server…`)
  gateway?.close()
  for (const child of children) {
    killTree(child)
  }
  // 给进程树终止留出宽限，随后强制退出本脚本
  setTimeout(() => process.exit(0), 2000).unref()
}

/** 探测端口是否已可连接（dev server 就绪信号） */
function waitForPort(port: number, timeoutMs = 20000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const attempt = (): void => {
      const sock = createConnection({ port, host: '127.0.0.1' })
      sock.once('connect', () => {
        sock.end()
        resolve()
      })
      sock.once('error', () => {
        sock.destroy()
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`端口 ${port} 等待超时（${timeoutMs}ms）`))
        } else {
          setTimeout(attempt, 300)
        }
      })
    }
    attempt()
  })
}

/** vite-plugin-mock bundle-require 临时文件硬约束（与 clean-mock-bundled 同源规则） */
const MOCK_BUNDLED_RE = /^_.*\.bundled_.*\.(?:mjs|cjs)$/

/** 递归收集 mockDir 下全部 bundled 临时文件的绝对路径 */
function collectBundledFiles(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      collectBundledFiles(full, acc)
    } else if (entry.isFile() && MOCK_BUNDLED_RE.test(entry.name)) {
      acc.push(full)
    }
  }
  return acc
}

/**
 * 无条件清空 mockDir 下全部 vite-plugin-mock bundled 临时文件，返回删除数。
 *
 * 与 clean-mock-bundled 的差异在调用时机与安全前提：orchestrator 启动任何 dev
 * server 之前调用，此时无进程持有/即将 import 这些文件，故无需 5s mtime 门槛。
 * 根治「残留 bundled 文件被 getMockConfig 的 glob（匹配目录下全部 ts/mjs/js）
 * 拾取为 mock 源 → 启动清理与在飞 glob/esbuild 竞态 → mockData 静默清空」的
 * 确定性触发源（2026-10-29 登录 404 事故，详见文件头注释与
 * packages/config/src/clean-mock-bundled.ts）。
 *
 * @param mockDir @vv/mock 源目录绝对路径（packages/mock/src）
 */
export function cleanStaleMockBundled(mockDir: string): number {
  let removed = 0
  // collectBundledFiles 已按 MOCK_BUNDLED_RE 过滤文件名，这里直接删
  for (const full of collectBundledFiles(mockDir)) {
    try {
      unlinkSync(full)
      removed++
    } catch {
      // 文件可能已被其它进程删掉，吞 ENOENT
    }
  }
  return removed
}

/**
 * 启动单个 app dev（异步）：注入 VITE_BASE=/<app>/ 后 spawn pnpm -C apps/<app> dev，
 * 等待其 dev server 端口就绪后 resolve——保证下一个 app 启动时，本 app 的
 * vite-plugin-mock 已完成 mock 源编译（避免多进程并发编译同一 @vv/mock 源的 cleanup 竞态）。
 *
 * @param extraEnv 追加注入的 env（如 auth 的 VITE_POST_LOGIN_FALLBACK）；undefined 则不注入
 */
async function startApp(
  name: string,
  port: number,
  extraEnv?: Record<string, string>
): Promise<void> {
  // shell:true：Windows 下 pnpm 实为 pnpm.cmd，无 shell 无法解析
  const child = spawn('pnpm', ['-C', `apps/${name}`, 'dev'], {
    cwd: REPO_ROOT,
    env: { ...process.env, VITE_BASE: `/${name}/`, ...extraEnv },
    stdio: 'inherit',
    shell: true,
  })
  child.on('exit', (code, signal) => {
    if (code !== 0 && signal === null) {
      shutdown(`[${name}] dev server 异常退出（exit ${code}，端口 ${port}）`)
    }
  })
  children.push(child)
  await waitForPort(port)
  console.log(`  ✓ [${name}] 就绪 → 网关路径 /${name}/（直查 http://localhost:${port}/${name}/）`)
}

/**
 * 从命令行参数解析 app 子集（未给参数 → 全量）。
 *
 * @param argv process.argv.slice(2)（app 名列表，如 ['admin', 'auth']）
 * @returns 按 APPS 顺序排序的子集（保持注册表顺序，保证输出与网关路由表一致）
 * @throws 传了未知名即抛错——拼写错误（如 admn）静默忽略会让开发者以为起了实际没起
 */
export function resolveAppSubset(argv: string[]): typeof APPS {
  if (argv.length === 0) return APPS
  const known = new Set(APPS.map((a) => a.name))
  const unknown = argv.filter((name) => !known.has(name))
  if (unknown.length > 0) {
    throw new Error(`未知 app 名：${unknown.join(', ')}（可用：${[...known].join(', ')}）`)
  }
  return APPS.filter((a) => argv.includes(a.name))
}

/** 根 302 目标动态判定：子集含 portal 跳 /portal/，否则跳子集第一个（未起 portal 时避免根 502） */
export function resolveRootRedirect(subset: typeof APPS): string {
  // 空子集防御（2026-10-28 /autoplan E8）：当前调用链（resolveAppSubset 对未知名抛错、
  // 至少返回一个已知 app）不会传入空数组——防御未来新调用方传入空集致 subset[0] undefined
  if (subset.length === 0) throw new Error('resolveRootRedirect：空子集无根 302 目标')
  return subset.some((a) => a.name === 'portal') ? '/portal/' : `/${subset[0].name}/`
}

/**
 * 登录 fallback 目标动态判定（语义对齐 resolveRootRedirect）：portal 优先，否则第一个非
 * auth app。dev-gateway 启动 auth 时将其注入 VITE_POST_LOGIN_FALLBACK——Login.vue 在
 * 无 ?redirect= 参数且 referrer 推断失败时消费，子集模式登录成功直达子集内同伴 app
 * （auth+big → /big/；auth+h5 → /h5/）。全量模式同样注入（通常 → /portal/）。
 * 单 auth 子集返回 undefined：不注入 env，前端保持 referrer 推断 + /auth/ 兜底原行为。
 */
export function resolvePostLoginFallback(subset: typeof APPS): string | undefined {
  const target = subset.find((a) => a.name === 'portal') ?? subset.find((a) => a.name !== 'auth')
  return target ? `/${target.name}/` : undefined
}

async function main(): Promise<void> {
  const subset = resolveAppSubset(process.argv.slice(2))
  const rootRedirect = resolveRootRedirect(subset)
  const postLoginFallback = resolvePostLoginFallback(subset)
  const isSubset = subset.length < APPS.length

  // 预清 mock bundled 临时文件必须在任何 dev server 启动前（无 5s 门槛的安全前提），
  // 先于网关监听也无妨：temp 文件随时可再生，即便随后因端口占用退出也无副作用
  const removedBundled = cleanStaleMockBundled(join(REPO_ROOT, 'packages/mock/src'))
  if (removedBundled > 0) {
    console.log(`  🧹 预清 ${removedBundled} 个残留 mock bundled 临时文件（上次非正常关闭遗留）`)
  }

  console.log(
    `🚀 同域网关模式：node 网关 :${GATEWAY_PORT} + 串行启动 ${subset.length} 个 app dev（base=/<app>/，避免共享 mock 源并发编译竞态）…\n`
  )

  // 先监听网关：8080 被占（如旧 docker 网关未关）立即失败，不浪费后续 dev 启动
  // 路由表传 subset（非全量 APPS）：/api/ 与 /mock/ 目标动态选子集内第一个 app
  // （admin 不在子集时不再 502——所有 app 共享同一 @vv/mock 源，mock 中间件等价）
  gateway = createGatewayServer({
    rootRedirect,
    routes: buildGatewayRoutes(subset),
  })
  try {
    await new Promise<void>((resolve, reject) => {
      gateway!.once('error', reject)
      gateway!.listen(GATEWAY_PORT, () => resolve())
    })
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE') {
      console.error(
        `✖ 网关端口 ${GATEWAY_PORT} 被占用——常见占用者：` +
          `\n  ① 生产容器未停：docker compose -f docker-compose.prod.yml down` +
          `\n  ② 旧 dev:gateway 进程残留：Ctrl+C 或重启终端` +
          `\n  ③ 其他进程：netstat -ano | findstr :${GATEWAY_PORT} 查占用者 PID`
      )
      process.exit(1)
    }
    throw err
  }
  console.log(
    `🌐 网关就绪：http://localhost:${GATEWAY_PORT}/（GET / 302 → ${rootRedirect}；/api/ 与 /mock/ → ${subset.some((a) => a.name === 'admin') ? 'admin' : subset[0].name}）\n`
  )
  if (postLoginFallback) {
    console.log(
      `  🔐 auth 登录 fallback → ${postLoginFallback}（VITE_POST_LOGIN_FALLBACK 已注入 auth dev）`
    )
  }

  // 串行：前一个 dev server 端口就绪（mock 编译完成）再启下一个，消除并发编译窗口
  for (const { name, port } of subset) {
    try {
      // 仅 auth 消费 VITE_POST_LOGIN_FALLBACK（resolvePostLoginFallback 语义见函数注释）
      await startApp(
        name,
        port,
        name === 'auth' && postLoginFallback
          ? { VITE_POST_LOGIN_FALLBACK: postLoginFallback }
          : undefined
      )
    } catch (err) {
      shutdown(`[${name}] 启动超时：${err instanceof Error ? err.message : String(err)}`)
      return
    }
  }
  console.log(`\n🎉 全部就绪：经网关 http://localhost:${GATEWAY_PORT}/ 访问（Ctrl+C 一并退出）`)
  if (isSubset) {
    console.log(
      `  ℹ️  子集模式：仅起了 ${subset.map((a) => a.name).join(' / ')}；其余前缀访问返回 502（预期）`
    )
  }
  process.on('SIGINT', () => shutdown('收到 Ctrl+C'))
  process.on('SIGTERM', () => shutdown('收到 SIGTERM'))
}

// CLI 守卫：与 check-* 脚本同一模式——被 import（spec / 工具链）时不触发 main()
// （main 会监听 8080，误执行撞 EADDRINUSE；2026-10-28 E8 由 isTestRun 反模式统一为本模式，
// 顺带移除原注释中「spec 用例只消费纯函数」的 stale 陈述——当时并无 spec 文件）
const invokedDirectly =
  process.argv[1] !== undefined && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  // 用法错误（未知 app 名等）只打 message 后退出码 1——void main() 原形态下
  // 未捕获 rejection 会打印整栈噪声（2026-10-28 /autoplan R2-E6）
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? `✖ ${err.message}` : err)
    process.exit(1)
  })
}
