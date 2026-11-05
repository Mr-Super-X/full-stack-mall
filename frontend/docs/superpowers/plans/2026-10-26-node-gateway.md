# node 网关替代 nginx 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **本仓库纪律**：项目规则禁止擅自 `git commit`——本计划**不含任何 commit 步骤**；全部任务完成并验证通过后，由用户决定提交时机与拆分。

**Goal:** 本地开发同域网关从「docker compose + nginx 容器」替换为「零依赖 node 原生反向代理」，`pnpm dev:gateway` 单命令拉起网关 + 6 dev server，删除全部 docker 相关文件。

**Architecture:** 新增 `scripts/node-gateway.ts`（`buildGatewayRoutes`/`resolveRoute` 纯函数 + `createGatewayServer`：HTTP 流式转发 + WS upgrade 透传 + 302 + 502），路由表从 `scripts/apps-registry.mjs` 单源代码派生；改造 `scripts/dev-gateway.ts` 为先监听网关 8080 再串行起 dev；`validatePortWiring` 从 `check-gateway-conf.ts` 迁入 `check-routes.ts`；docker 三件套删除。

**Tech Stack:** Node ≥22 内置 `node:http` / `node:test` / 全局 `WebSocket`（零新依赖，直跑 `--experimental-strip-types`）。

**Spec:** `docs/superpowers/specs/2026-10-26-node-gateway-design.md`（已批准）

---

### Task 1: node-gateway.ts 纯函数（路由表派生 + 前缀匹配）+ 表驱动单测

**Files:**
- Create: `scripts/node-gateway.spec.ts`
- Create: `scripts/node-gateway.ts`

- [ ] **Step 1: 写失败测试（纯函数部分）**

创建 `scripts/node-gateway.spec.ts`：

```ts
/**
 * node-gateway 单测（node:test runner + node ≥22 内置 WebSocket client，零依赖）。
 *
 * 覆盖：路由表派生（buildGatewayRoutes）/ 前缀匹配（resolveRoute）纯函数表驱动，
 * 以及假上游集成 smoke——HTTP 转发 / GET / 302 / 未知前缀 404 / 上游不可达 502 / WS 双向 echo。
 *
 * 运行：pnpm test:gateway（node --test --experimental-strip-types）
 */
import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { test } from 'node:test'

import {
  buildGatewayRoutes,
  createGatewayServer,
  resolveRoute,
  type GatewayRoute,
} from './node-gateway.ts'

// ── 纯函数：路由表派生 ──────────────────────────────────────────

test('buildGatewayRoutes：每 app 一条前缀路由，端口来自注册表', () => {
  const routes = buildGatewayRoutes([
    { name: 'admin', port: 5174 },
    { name: 'auth', port: 5179 },
  ])
  assert.deepEqual(routes, [
    { prefix: '/admin/', target: { host: '127.0.0.1', port: 5174 } },
    { prefix: '/auth/', target: { host: '127.0.0.1', port: 5179 } },
    // /api/ 统一反代 admin（mock 最全：auth/user/menu 三模块），端口不写死
    { prefix: '/api/', target: { host: '127.0.0.1', port: 5174 } },
  ])
})

test('buildGatewayRoutes：缺少 admin 条目时抛错（/api/ 反代目标无法确定）', () => {
  assert.throws(() => buildGatewayRoutes([{ name: 'portal', port: 5176 }]), /admin/)
})

test('resolveRoute：前缀命中、先命中先赢、无尾斜杠不命中', () => {
  const routes: GatewayRoute[] = [
    { prefix: '/admin/', target: { host: '127.0.0.1', port: 5174 } },
    { prefix: '/api/', target: { host: '127.0.0.1', port: 5174 } },
  ]
  assert.equal(resolveRoute('/admin/workbench', routes)?.prefix, '/admin/')
  // 对齐 nginx location /admin/：/admin（无尾斜杠）不命中
  assert.equal(resolveRoute('/admin', routes), undefined)
  assert.equal(resolveRoute('/api/auth/login', routes)?.prefix, '/api/')
  assert.equal(resolveRoute('/nope/', routes), undefined)
})

// ── 集成 smoke 辅助 ─────────────────────────────────────────────

/** 随机端口监听（0 = 内核分配），返回实际端口 */
async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  return (server.address() as AddressInfo).port
}

/** 网关参数样板：单条 /fake/ 路由指向给定上游端口 */
function fakeGatewayOptions(upstreamPort: number) {
  return {
    rootRedirect: '/fake/',
    routes: [{ prefix: '/fake/', target: { host: '127.0.0.1' as const, port: upstreamPort } }],
  }
}
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test --experimental-strip-types scripts/node-gateway.spec.ts`
Expected: FAIL —— `Cannot find module '.../scripts/node-gateway.ts'`（import 失败）

- [ ] **Step 3: 实现纯函数（createGatewayServer 暂为占位）**

创建 `scripts/node-gateway.ts`：

```ts
/**
 * 本地同域网关（node 原生实现，零依赖）——替代原 docker-compose + nginx 方案
 * （设计稿 docs/superpowers/specs/2026-10-26-node-gateway-design.md）。
 *
 * 角色：dev:gateway 的内置反向代理。监听 :8080，按路径前缀把请求原样转发到
 * 6 个 vite dev server（上游 127.0.0.1:5174-5179），保留原始路径前缀是
 * 各 app 以 VITE_BASE=/<app>/ 启动的 vite dev 的生命线（改写前缀即 404）。
 *
 * 路由表由 buildGatewayRoutes(apps-registry) 单源代码派生——消灭原
 * nginx.dev.conf「静态配置无法 import 注册表」的双写漂移面（check-gateway-conf
 * 校验随之删除；端口双写锁死 validatePortWiring 迁入 scripts/check-routes.ts）。
 *
 * 关键语义（与原 nginx.dev.conf 逐条对齐）：
 *   - GET /        → 302 Location: http://{Host}/portal/（Host 含端口，对齐 $http_host）
 *   - /<app>/ 前缀 → 原样路径转发（含 query string），Host 头保留浏览器原值
 *   - /api/        → admin 端口（mock 最全）
 *   - WS upgrade   → 101 回写 + socket 双向 pipe（vite HMR 经网关可用；@vv/config
 *                    server.hmr 已把 clientPort 固定到各 app 端口，HMR 流量多直连，
 *                    本透传保证任何 ws 场景经 8080 均可用）
 *   - 上游不可达   → 502（对齐 nginx Bad Gateway）
 *   - 不设超时     → SSE 流式（docs/13）与 HMR 长连接友好
 *
 * @see ./dev-gateway.ts 消费方（一体化单命令：网关 + 6 dev server）
 */

import {
  createServer,
  request as httpRequest,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http'
import type { Duplex } from 'node:stream'

/** 上游目标（vite dev server） */
export interface GatewayTarget {
  host: string
  port: number
}

/** 一条前缀路由：prefix 前缀的请求原样转发到 target */
export interface GatewayRoute {
  prefix: string
  target: GatewayTarget
}

/** app 注册表条目（结构对齐 scripts/apps-registry.mjs 的 APPS 元素） */
export interface GatewayApp {
  name: string
  port: number
}

export interface GatewayOptions {
  /** 根路径 302 目标（如 '/portal/'） */
  rootRedirect: string
  /** 前缀路由表（buildGatewayRoutes 派生；先命中先赢） */
  routes: GatewayRoute[]
}

/**
 * 从 app 注册表派生网关路由表：每 app 一条 /<name>/ 前缀路由 + /api/ 特殊路由。
 *
 * @param apps 注册表（scripts/apps-registry.mjs 的 APPS）
 * @throws 注册表缺少 admin 时抛错——/api/ 反代目标无法确定，静默兜底会埋 404
 */
export function buildGatewayRoutes(apps: GatewayApp[]): GatewayRoute[] {
  const routes = apps.map((app) => ({
    prefix: `/${app.name}/`,
    target: { host: '127.0.0.1', port: app.port },
  }))
  const admin = apps.find((app) => app.name === 'admin')
  if (!admin) {
    throw new Error('apps-registry 缺少 admin 条目：/api/ 反代目标无法确定')
  }
  routes.push({ prefix: '/api/', target: { host: '127.0.0.1', port: admin.port } })
  return routes
}

/** 前缀匹配（先命中先赢）；无尾斜杠路径（/admin）不命中，对齐 nginx location /admin/ */
export function resolveRoute(pathname: string, routes: GatewayRoute[]): GatewayRoute | undefined {
  return routes.find((route) => pathname.startsWith(route.prefix))
}

/** 追加式 X-Forwarded-For（对齐 nginx proxy_add_x_forwarded_for） */
function forwardedFor(req: IncomingMessage): string {
  const existing = req.headers['x-forwarded-for']
  const client = req.socket.remoteAddress ?? ''
  return existing ? `${existing}, ${client}` : client
}

/**
 * 创建网关 server（不自动 listen——调用方决定监听地址，测试可随机端口）。
 * HTTP 转发 + WS upgrade + GET / 302 + 未知前缀 404 + 上游 502。
 */
export function createGatewayServer(options: GatewayOptions): Server {
  const { routes, rootRedirect } = options

  const server = createServer((req, res) => {
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname

    // 根路径 302：Location 用原始 Host 头（含端口，对齐 nginx $http_host 防丢端口坑）
    if (req.method === 'GET' && pathname === '/') {
      res.writeHead(302, { Location: `http://${req.headers.host ?? 'localhost'}${rootRedirect}` })
      res.end()
      return
    }

    const route = resolveRoute(pathname, routes)
    if (!route) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end(`网关未匹配前缀：${pathname}`)
      return
    }
    proxyHttp(req, res, route.target)
  })

  server.on('upgrade', (req, socket, head) => {
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
    const route = resolveRoute(pathname, routes)
    if (!route) {
      socket.destroy()
      return
    }
    proxyWebSocket(req, socket, head, route.target)
  })

  return server
}

/** HTTP 转发：原样路径（含 query）+ 转发头组；上游不可达 502 */
function proxyHttp(req: IncomingMessage, res: ServerResponse, target: GatewayTarget): void {
  const proxyReq = httpRequest(
    {
      host: target.host,
      port: target.port,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        // 保留浏览器原始 Host（对齐 nginx proxy_set_header Host $host）
        'x-real-ip': req.socket.remoteAddress ?? '',
        'x-forwarded-for': forwardedFor(req),
        'x-forwarded-proto': 'http',
      },
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers)
      proxyRes.pipe(res)
    }
  )
  proxyReq.on('error', (err) => {
    // 响应头已发出（上游断在中途）只能掐断；否则回 502 页
    if (res.headersSent) {
      res.destroy()
      return
    }
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end(`502 Bad Gateway（上游 ${target.host}:${target.port} 不可达：${err.message}）`)
  })
  req.pipe(proxyReq)
}

/**
 * WS 升级转发：向上游发 upgrade 请求，101 响应手工回写客户端 socket 后双向 pipe。
 * 非 101 响应（上游拒绝升级）同样手工回写，保证 client 拿到可读响应。
 */
function proxyWebSocket(
  req: IncomingMessage,
  socket: Duplex,
  head: Buffer,
  target: GatewayTarget
): void {
  const proxyReq = httpRequest({
    host: target.host,
    port: target.port,
    path: req.url,
    method: req.method,
    headers: req.headers,
  })

  const writeRawResponse = (res: IncomingMessage): void => {
    socket.write(`HTTP/1.1 ${res.statusCode} ${res.statusMessage ?? ''}\r\n`)
    for (const [key, value] of Object.entries(res.headers)) {
      if (value === undefined) continue
      socket.write(`${key}: ${Array.isArray(value) ? value.join(', ') : value}\r\n`)
    }
    socket.write('\r\n')
  }

  proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
    writeRawResponse(proxyRes)
    // 握手响应后可能携带的首帧数据先落客户端
    if (proxyHead?.length) socket.write(proxyHead)
    // 双向 pipe；任一侧出错互拆，避免半开连接挂死
    socket.pipe(proxySocket)
    proxySocket.pipe(socket)
    socket.on('error', () => proxySocket.destroy())
    proxySocket.on('error', () => socket.destroy())
  })

  // 上游拒绝升级（非 101）：把响应透传给客户端，而不是静默断连
  proxyReq.on('response', (proxyRes) => {
    writeRawResponse(proxyRes)
    proxyRes.pipe(socket)
  })

  proxyReq.on('error', () => socket.destroy())
  socket.on('error', () => proxyReq.destroy())

  // upgrade 请求的 head（握手后的首帧数据）随请求体发往上游
  if (head?.length) {
    proxyReq.end(head)
  } else {
    proxyReq.end()
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test --experimental-strip-types scripts/node-gateway.spec.ts`
Expected: PASS —— 3 个纯函数测试全过（集成 smoke 测试尚未写入，Task 2/3 追加）

---

### Task 2: createGatewayServer HTTP 集成 smoke（转发 / 302 / 404 / 502）

**Files:**
- Modify: `scripts/node-gateway.spec.ts`（追加集成测试）

- [ ] **Step 1: 追加失败测试**

在 `scripts/node-gateway.spec.ts` 末尾追加：

```ts
// ── 集成 smoke：假上游 echo 经网关 ──────────────────────────────

test('HTTP 转发：路径/query/方法/请求头/body 透传，响应状态与头回传', async () => {
  const upstream = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      res.writeHead(201, { 'x-upstream': 'yes', 'content-type': 'application/json' })
      res.end(
        JSON.stringify({
          method: req.method,
          url: req.url,
          auth: req.headers.authorization,
          fwdProto: req.headers['x-forwarded-proto'],
          body: Buffer.concat(chunks).toString(),
        })
      )
    })
  })
  const upstreamPort = await listen(upstream)

  const gateway = createGatewayServer(fakeGatewayOptions(upstreamPort))
  const gatewayPort = await listen(gateway)

  const res = await fetch(`http://127.0.0.1:${gatewayPort}/fake/echo?q=1`, {
    method: 'POST',
    headers: { authorization: 'Bearer tok' },
    body: 'hello',
  })
  assert.equal(res.status, 201)
  assert.equal(res.headers.get('x-upstream'), 'yes')
  const echoed = (await res.json()) as Record<string, unknown>
  assert.equal(echoed.method, 'POST')
  assert.equal(echoed.url, '/fake/echo?q=1')
  assert.equal(echoed.auth, 'Bearer tok')
  assert.equal(echoed.fwdProto, 'http')
  assert.equal(echoed.body, 'hello')

  gateway.close()
  upstream.close()
})

test('GET / 302 到 rootRedirect，Location 保留 Host 端口', async () => {
  const gateway = createGatewayServer(fakeGatewayOptions(1))
  const port = await listen(gateway)
  const res = await fetch(`http://127.0.0.1:${port}/`, { redirect: 'manual' })
  assert.equal(res.status, 302)
  assert.equal(res.headers.get('location'), `http://127.0.0.1:${port}/fake/`)
  gateway.close()
})

test('未知前缀 404', async () => {
  const gateway = createGatewayServer(fakeGatewayOptions(1))
  const port = await listen(gateway)
  const res = await fetch(`http://127.0.0.1:${port}/nope/`)
  assert.equal(res.status, 404)
  gateway.close()
})

test('上游不可达 502', async () => {
  // 端口 1（tcpmux）几乎必然无监听，且不受本机服务影响
  const gateway = createGatewayServer(fakeGatewayOptions(1))
  const port = await listen(gateway)
  const res = await fetch(`http://127.0.0.1:${port}/fake/x`)
  assert.equal(res.status, 502)
  gateway.close()
})
```

- [ ] **Step 2: 跑测试确认通过**

Run: `node --test --experimental-strip-types scripts/node-gateway.spec.ts`
Expected: PASS —— 7 个测试全过（HTTP 转发/302/404/502 + 3 个纯函数）

---

### Task 3: WS upgrade 透传集成测试

**Files:**
- Modify: `scripts/node-gateway.spec.ts`（追加 WS 测试）

- [ ] **Step 1: 追加失败测试**

在 `scripts/node-gateway.spec.ts` 末尾追加：

```ts
test('WS 升级透传：双向 echo（HMR 场景最小复现）', async () => {
  // 假上游 WS echo：101 后原样回发每条消息帧
  const upstream = createServer()
  upstream.on('upgrade', (req, socket) => {
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n'
    )
    socket.on('data', (chunk: Buffer) => socket.write(chunk))
  })
  const upstreamPort = await listen(upstream)

  const gateway = createGatewayServer(fakeGatewayOptions(upstreamPort))
  const gatewayPort = await listen(gateway)

  const ws = new WebSocket(`ws://127.0.0.1:${gatewayPort}/fake/__vite_hmr`)
  await new Promise<void>((resolve, reject) => {
    ws.onopen = () => resolve()
    ws.onerror = () => reject(new Error('WS 握手失败'))
  })
  const echoed = await new Promise<string>((resolve) => {
    ws.onmessage = (event) => resolve(String(event.data))
    ws.send('ping')
  })
  assert.equal(echoed, 'ping')
  ws.close()
  gateway.close()
  upstream.close()
})
```

- [ ] **Step 2: 跑测试确认通过**

Run: `node --test --experimental-strip-types scripts/node-gateway.spec.ts`
Expected: PASS —— 8 个测试全过

> 注：Task 1 的实现已含完整 WS 处理，本测试是**防护网**而非新驱动实现——若后续有人改动 `proxyWebSocket` 语义即红。这正是「WS 透传是 HMR 生命线」的固化。

---

### Task 4: dev-gateway.ts 一体化集成（网关 + 6 dev server 单命令）

**Files:**
- Modify: `scripts/dev-gateway.ts`

- [ ] **Step 1: 重写文件头注（1-28 行）**

old_string（完整旧头注）：

```
/**
 * 本地同域网关配套：串行启动 6 个 app 的 vite dev server（各自注入 VITE_BASE=/<app>/）。
 *
 * 背景（docs/43 §同域网关）：生产为同域 path 部署（统一登录 cookie 跨 app 漫游），
 * 单 app 以默认 base '/' 起 dev 无法复现；本脚本按 app 注入 base 后拉起全部 dev server，
 * 与 docker-compose 的 nginx 网关（:8080 反代 5174-5179）配套：
 *
 *   终端 1：pnpm dev:gateway   # 6 个 dev server 前台常驻，Ctrl+C 一并退出
 *   终端 2：docker compose up  # nginx 网关
 *   浏览器：http://localhost:8080/（302 → /portal/）
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
 * 端口 = packages/config/src/server.ts SERVER_DEFAULTS.port(5174) + 各 app vite.config
 * portOffset；名单与端口单一事实源是 scripts/apps-registry.mjs——本脚本只注入 VITE_BASE。
 * 新增 app：注册表追加条目 + nginx.dev.conf 补 location 块（check-gateway-conf 校验兜底）。
 *
 * 为什么不用 turbo run dev：turbo 不支持 per-app env 注入，而 base 按 app 而异。
 *
 * 用法：pnpm dev:gateway（配置一致性另跑 pnpm check:gateway-conf）
 */
```

new_string：

```
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
 * ⚠️ 串行启动（非并行，2026-10-23 竞态修复）：6 app 共享 @vv/mock 数据源，
 * vite-plugin-mock 用 bundle-require 把 mock 源编译成 _*.bundled_*.mjs 临时文件
 * （落在 mock 源同目录）+ clean-mock-bundled 插件 configureServer 启动时抢删。
 * 并行启动时多进程同时编译同一 mock 源 → cleanup 抢删正在 import 的临时文件 →
 * bundle-require unlink ENOENT → vite-plugin-mock 静默清空 mockData → 该 app 的
 * dev mock 中间件全空（接口 404，实测 auth 踩中，mock 源 19 个 .ts 文件越 500ms 阈值，
 * 见 packages/config/src/clean-mock-bundled.ts 头部事故记录）。
 * 串行（前一个端口就绪再启下一个）彻底消除并发编译窗口。
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
```

- [ ] **Step 2: import 区追加网关模块（第 30-35 行）**

old_string：

```
import { spawn, type ChildProcess } from 'node:child_process'
import { createConnection } from 'node:net'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { APPS } from './apps-registry.mjs'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
```

new_string：

```
import { spawn, type ChildProcess } from 'node:child_process'
import type { Server } from 'node:http'
import { createConnection } from 'node:net'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { APPS } from './apps-registry.mjs'
import { buildGatewayRoutes, createGatewayServer } from './node-gateway.ts'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))

/** 同域网关监听端口（与原 nginx 网关一致 :8080） */
const GATEWAY_PORT = 8080
```

- [ ] **Step 3: 模块级 gateway 变量 + shutdown 关网关**

old_string：

```
const children: ChildProcess[] = []

/** 按进程树终止子进程：Windows 下 shell:true 拉起的是 cmd.exe，直接 kill 会孤儿化 vite */
```

new_string：

```
const children: ChildProcess[] = []

/** 网关 server（main 中赋值；shutdown 时关闭） */
let gateway: Server | null = null

/** 按进程树终止子进程：Windows 下 shell:true 拉起的是 cmd.exe，直接 kill 会孤儿化 vite */
```

old_string（shutdown 函数体）：

```
function shutdown(reason: string): void {
  console.log(`\n🛑 ${reason}，正在停止 ${children.length} 个 dev server…`)
  for (const child of children) {
    killTree(child)
  }
  // 给进程树终止留出宽限，随后强制退出本脚本
  setTimeout(() => process.exit(0), 2000).unref()
}
```

new_string：

```
function shutdown(reason: string): void {
  console.log(`\n🛑 ${reason}，正在停止网关与 ${children.length} 个 dev server…`)
  gateway?.close()
  for (const child of children) {
    killTree(child)
  }
  // 给进程树终止留出宽限，随后强制退出本脚本
  setTimeout(() => process.exit(0), 2000).unref()
}
```

- [ ] **Step 4: main 流程改造（先监听网关，再串行起 dev）**

old_string：

```
async function main(): Promise<void> {
  console.log(
    `🚀 同域网关模式：串行启动 ${APPS.length} 个 app dev（base=/<app>/，避免共享 mock 源并发编译竞态）…`
  )
  console.log('   网关：docker compose up → http://localhost:8080/（302 → /portal/）\n')
  // 串行：前一个 dev server 端口就绪（mock 编译完成）再启下一个，消除并发编译窗口
  for (const { name, port } of APPS) {
    try {
      await startApp(name, port)
    } catch (err) {
      shutdown(`[${name}] 启动超时：${err instanceof Error ? err.message : String(err)}`)
      return
    }
  }
  console.log(`\n🎉 ${APPS.length} 个 dev server 全部就绪，经网关 http://localhost:8080/ 访问`)
  process.on('SIGINT', () => shutdown('收到 Ctrl+C'))
  process.on('SIGTERM', () => shutdown('收到 SIGTERM'))
}
```

new_string：

```
async function main(): Promise<void> {
  console.log(
    `🚀 同域网关模式：node 网关 :${GATEWAY_PORT} + 串行启动 ${APPS.length} 个 app dev（base=/<app>/，避免共享 mock 源并发编译竞态）…\n`
  )

  // 先监听网关：8080 被占（如旧 docker 网关未关）立即失败，不浪费后续 6 个 dev 启动
  gateway = createGatewayServer({
    rootRedirect: '/portal/',
    routes: buildGatewayRoutes(APPS),
  })
  try {
    await new Promise<void>((resolve, reject) => {
      gateway!.once('error', reject)
      gateway!.listen(GATEWAY_PORT, () => resolve())
    })
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE') {
      console.error(
        `✖ 网关端口 ${GATEWAY_PORT} 被占用：请确认旧 docker 网关已停止（docker compose down），或释放占用进程`
      )
      process.exit(1)
    }
    throw err
  }
  console.log(`🌐 网关就绪：http://localhost:${GATEWAY_PORT}/（/api/ → admin，GET / 302 → /portal/）\n`)

  // 串行：前一个 dev server 端口就绪（mock 编译完成）再启下一个，消除并发编译窗口
  for (const { name, port } of APPS) {
    try {
      await startApp(name, port)
    } catch (err) {
      shutdown(`[${name}] 启动超时：${err instanceof Error ? err.message : String(err)}`)
      return
    }
  }
  console.log(`\n🎉 全部就绪：经网关 http://localhost:${GATEWAY_PORT}/ 访问（Ctrl+C 一并退出）`)
  process.on('SIGINT', () => shutdown('收到 Ctrl+C'))
  process.on('SIGTERM', () => shutdown('收到 SIGTERM'))
}
```

- [ ] **Step 5: 验证脚本语法（不真起 dev）**

Run: `node --experimental-strip-types scripts/dev-gateway.ts` 启动后立即 Ctrl+C（或观察前两条输出）
Expected: 依次打印 `🚀 同域网关模式…`、`🌐 网关就绪：http://localhost:8080/…`、然后 `[admin] 就绪 → …`；Ctrl+C 打印 `🛑 收到 Ctrl+C，正在停止网关与 6 个 dev server…` 后退出

> 完整链路验证在 Task 8；本步确认网关监听 + 进程编排无语法/接线错误即可。

---

### Task 5: check-routes.ts 迁移 validatePortWiring + 删除旧文件

**Files:**
- Modify: `scripts/check-routes.ts`
- Delete: `scripts/check-gateway-conf.ts`
- Delete: `docker-compose.yml`
- Delete: `docker/nginx.dev.conf`（`docker/` 目录随之清空删除）

- [ ] **Step 1: check-routes.ts 头注更新**

old_string：

```
//   - 路由检查收尾时自动复跑网关配置校验（check-gateway-conf 同一函数，CI 单点覆盖）
```

new_string：

```
//   - 路由检查收尾时自动复跑端口双写锁死校验（apps-registry port ↔ vite.config portOffset，CI 单点覆盖）
```

old_string：

```
// 收尾另跑网关校验 + 端口双写锁死（check-gateway-conf 同函数，CI 单点覆盖）
```

new_string：

```
// 收尾另跑端口双写锁死（原 nginx 网关配置校验已随 node 网关方案删除——
// 网关路由表由 scripts/node-gateway.ts 的 buildGatewayRoutes(APPS) 单源代码派生，
// 不存在静态配置第二事实源；端口双写锁死与 nginx 无关故迁入本文件保留）
```

- [ ] **Step 2: import 替换 + 内联 validatePortWiring**

old_string：

```
import { APPS } from './apps-registry.mjs'
import { validateGatewayConf, validatePortWiring } from './check-gateway-conf.ts'
```

new_string：

```
import { APPS } from './apps-registry.mjs'
// SERVER_DEFAULTS.port 是 portOffset 的推导基准（packages/config/src/server.ts 单源），
// 与原 check-gateway-conf.ts 引用同先例（strip-types 直跑可 import ts）
import { SERVER_DEFAULTS } from '../packages/config/src/server.ts'
```

在 `requiredFor` 函数之后追加（原样迁入自 check-gateway-conf.ts，含其文档注释）：

```ts
/**
 * 端口双写锁死：apps-registry.mjs 的绝对 port 与各 app vite.config.ts 的 portOffset
 * 是同一事实的两处手写（port = SERVER_DEFAULTS.port + offset），历史上无任何静态
 * 校验——dev 直启时实际端口与注册表漂移，表现是「某 app 经网关 404 / waitForPort 超时」
 * 且报错现象指向网络层，排查成本高。此处静态锁死，漂移即 CI 红。
 * （2026-10-26 自 scripts/check-gateway-conf.ts 迁入：nginx 网关配置校验随 node 网关
 * 方案删除，本校验与 nginx 无关故保留）
 */
function validatePortWiring(): string[] {
  const errors: string[] = []
  const appsDir = resolve(ROOT, 'apps')
  for (const { name, port } of APPS) {
    const viteConfigPath = join(appsDir, name, 'vite.config.ts')
    if (!existsSync(viteConfigPath)) {
      errors.push(`apps/${name}/vite.config.ts 不存在（注册表登记了该 app 但无 vite 配置）`)
      continue
    }
    const text = readFileSync(viteConfigPath, 'utf-8')
    if (!text.includes('createViteConfig(')) {
      errors.push(
        `apps/${name}/vite.config.ts 未调用 createViteConfig 工厂（无法推导实际 dev 端口）`
      )
      continue
    }
    // 工厂缺省 portOffset = 0（SERVER_DEFAULTS.port 即 admin 实际端口），缺省声明合法
    const offsetMatch = text.match(/portOffset:\s*(\d+)/)
    const actual = SERVER_DEFAULTS.port + (offsetMatch ? Number(offsetMatch[1]) : 0)
    if (actual !== port) {
      errors.push(
        `apps/${name} 端口双写不一致：apps-registry.mjs port=${port}，但 vite.config.ts portOffset=${offsetMatch[1]} → 实际 dev 端口 ${actual}（须同步两处）`
      )
    }
  }
  return errors
}
```

- [ ] **Step 3: 删除网关配置校验块，保留端口双写块**

old_string：

```
// ─── 网关配置校验（同 apps-registry 单源，CI 单点覆盖）──────────
// nginx.dev.conf 是静态配置无法 import 注册表，漏配 location/<port> 只在
// dev:gateway 真机访问时才暴露——此处复跑同一校验函数把漂移前置到 CI 阶段。

console.log('━━━ 网关配置（docker/nginx.dev.conf vs apps-registry）━━━')
const gatewayErrors = validateGatewayConf()
if (gatewayErrors.length === 0) {
  console.log(`✓ 网关 location 名单与端口接线一致（${APPS.length} 个 app）`)
} else {
  for (const message of gatewayErrors) console.error(`✖ ${message}`)
  totalErrors += gatewayErrors.length
}
console.log('')

console.log('━━━ 端口双写锁死（apps-registry.mjs port ↔ vite.config.ts portOffset）━━━')
```

new_string：

```
// ─── 端口双写锁死（apps-registry.mjs port ↔ vite.config.ts portOffset）──────────
// node 网关路由表由 buildGatewayRoutes(APPS) 单源代码派生，无静态配置校验需求；
// 注册表 port 与 vite.config portOffset 仍是两处手写，此处静态锁死，漂移即 CI 红。

console.log('━━━ 端口双写锁死（apps-registry.mjs port ↔ vite.config.ts portOffset）━━━')
```

- [ ] **Step 4: 删除文件**

```bash
rm scripts/check-gateway-conf.ts docker-compose.yml docker/nginx.dev.conf
rmdir docker   # 目录已空（Glob 确认 docker/ 下仅有 nginx.dev.conf）
```

- [ ] **Step 5: 验证门禁**

Run: `pnpm check:routes`
Expected: 6 app 校验块全绿 + `✓ 6 个 app 的注册表端口与 vite.config portOffset 推导一致` + `✓ 所有应用的路由检查通过`；不再出现「网关配置」块

---

### Task 6: package.json + 脚本/配置注释同步

**Files:**
- Modify: `package.json`
- Modify: `scripts/apps-registry.mjs`
- Modify: `packages/config/src/server.ts`
- Modify: `playwright.config.ts`
- Modify: `tests/e2e/gateway/cross-app-roaming.spec.ts`
- Modify: `docs/04-构建与测试工具.md`

- [ ] **Step 1: package.json 删 check:gateway-conf、加 test:gateway**

old_string：

```
    "check:gateway-conf": "node --experimental-strip-types scripts/check-gateway-conf.ts",
```

new_string：（删除该行——注意同时删掉上一行 check:routes 行尾逗号或保留均可，执行时保持 JSON 合法）

old_string：

```
    "test:e2e:install": "playwright install --with-deps chromium",
```

new_string：

```
    "test:e2e:install": "playwright install --with-deps chromium",
    "test:gateway": "node --test --experimental-strip-types scripts/node-gateway.spec.ts",
```

- [ ] **Step 2: apps-registry.mjs 头注重写**

old_string（第 1-20 行完整头注）：

```
/**
 * App 注册表 —— Monorepo「App 名单」单一事实来源
 *
 * 收敛 4 处硬编码（可扩展性审查第一崩点：新增第 7 个 app 原本要手改 4 处且无校验）：
 *   1. scripts/dev-gateway.ts 的 APPS 端口表（dev:gateway 串行拉起顺序）
 *   2. eslint.config.mjs 的 MONOREPO_APPS（boundary-apps-<a> 逐 app 边界规则粒度）
 *   3. scripts/check-routes.ts 的 REQUIRED_BY_APP（系统兜底路由 B/C 校验名单）
 *   4. docker/nginx.dev.conf 的 location /<app>/ 块（静态配置无法 import 本表，
 *      由 scripts/check-gateway-conf.ts 校验对齐，check-routes 汇总阶段自动复跑）
 *
 * 对照组 build-pages.ts / generate-tsconfig-paths.ts 走 readdirSync(apps) 自发现，不引用本表
 * （纯目录枚举、无端口/路由元数据诉求）。
 *
 * 为什么用 .mjs 而不是 .ts：eslint.config.mjs 由 ESLint 直接加载，Node 不带
 * --experimental-strip-types，读不了 .ts；故运行时单源必须是纯 ESM 形态，
 * 类型镜像在 apps-registry.d.mts（改字段时两处同步）。
 *
 * 新增第 7 个 app 的步骤：apps/<name> 目录 + 本表追加一条 + vite.config portOffset +
 * nginx.dev.conf 补 location 块（check-gateway-conf 校验兜底，漏补即红）。
 */
```

new_string：

```
/**
 * App 注册表 —— Monorepo「App 名单」单一事实来源
 *
 * 收敛 3 处硬编码（可扩展性审查第一崩点：新增第 7 个 app 原本要手改多处且无校验；
 * 原第 4 处 docker/nginx.dev.conf 已随 node 网关方案消灭——网关路由表由
 * scripts/node-gateway.ts 的 buildGatewayRoutes(APPS) 单源代码派生，无第二事实源）：
 *   1. scripts/dev-gateway.ts 的 APPS 端口表（dev:gateway 串行拉起顺序）
 *   2. eslint.config.mjs 的 MONOREPO_APPS（boundary-apps-<a> 逐 app 边界规则粒度）
 *   3. scripts/check-routes.ts 的 REQUIRED_BY_APP（系统兜底路由 B/C 校验名单）
 *
 * 端口另有两处代码消费（同 import 本表，非硬编码）：scripts/node-gateway.ts 网关路由表、
 * playwright.config.ts 的 app projects baseURL。
 *
 * 对照组 build-pages.ts / generate-tsconfig-paths.ts 走 readdirSync(apps) 自发现，不引用本表
 * （纯目录枚举、无端口/路由元数据诉求）。
 *
 * 为什么用 .mjs 而不是 .ts：eslint.config.mjs 由 ESLint 直接加载，Node 不带
 * --experimental-strip-types，读不了 .ts；故运行时单源必须是纯 ESM 形态，
 * 类型镜像在 apps-registry.d.mts（改字段时两处同步）。
 *
 * 新增第 7 个 app 的步骤：apps/<name> 目录 + 本表追加一条 + vite.config portOffset
 * 同改（check-routes 端口双写锁死校验兜底，漏改即红）；网关路由表自动派生无需另改。
 */
```

- [ ] **Step 3: packages/config/src/server.ts 的 0.0.0.0 注释**

old_string：

```
  // 显式绑 IPv4 0.0.0.0（非默认 localhost）——供 docker 网关容器反代可达。
  // 背景：docker 同域网关（dev:gateway + docker compose up）容器经 host.docker.internal
  // \ 访问宿主机 dev server；vite 默认绑 localhost（[::1] IPv6 loopback），容器到宿主机
  // IPv4 的入站连接被拒（实测 connection refused）。绑 0.0.0.0 让容器可路由到达。
```

new_string：

```
  // 显式绑 IPv4 0.0.0.0（非默认 localhost）——LAN 真机调试（手机/其他设备访问
  // 电脑 IP:5174-5179 或 :8080 网关）与容器/CI 等非 loopback 入站可达；
  // node 同域网关（scripts/node-gateway.ts）经 127.0.0.1 反代上游亦依赖此监听面。
  // vite 默认绑 localhost（[::1] IPv6 loopback）仅本机可达，不满足上述场景。
```

- [ ] **Step 4: playwright.config.ts 注释更新（3 处）**

old_string：

```
//   - gateway project（:8080 同域网关，docker compose + dev:gateway）只承载真正
//     跨应用漫游用例；无 docker 环境时用例自跳过（e2e 不硬依赖 docker）。
```

new_string：

```
//   - gateway project（:8080 同域网关，pnpm dev:gateway 一体化单命令拉起）只承载真正
//     跨应用漫游用例；网关未启动时用例自跳过（spec 自动探测可达性，e2e 不硬依赖网关）。
```

old_string：

```
// 端口事实源：scripts/apps-registry.mjs（5174-5179，strictPort，check:gateway-conf 锁死）。
```

new_string：

```
// 端口事实源：scripts/apps-registry.mjs（5174-5179，strictPort，check:routes 端口双写锁死）。
```

old_string：

```
      // 跨应用漫游用例（统一登录 + TagsView 守恒）——依赖 :8080 同域网关
      // （docker compose up + pnpm dev:gateway），e2e 不自动拉起 6 个 app，
      // 由 spec 内探测网关可达性后自跳过
```

new_string：

```
      // 跨应用漫游用例（统一登录 + TagsView 守恒）——依赖 :8080 同域网关
      // （pnpm dev:gateway 一体化拉起网关 + 6 dev server），e2e 不自动拉起，
      // 由 spec 内探测网关可达性后自跳过
```

- [ ] **Step 5: cross-app-roaming.spec.ts 注释更新（3 处）**

old_string：

```
 * 覆盖（须 :8080 同域网关，docker compose up + pnpm dev:gateway）：
```

new_string：

```
 * 覆盖（须 :8080 同域网关，pnpm dev:gateway 一体化单命令拉起）：
```

old_string：

```
/** 网关可达性探测（docker 未启动时整个文件的用例跳过） */
```

new_string：

```
/** 网关可达性探测（dev:gateway 未启动时整个文件的用例跳过） */
```

old_string：

```
  testInfo.skip(!(await isGatewayUp()), '同域网关未启动（需 docker compose up + pnpm dev:gateway）')
```

new_string：

```
  testInfo.skip(!(await isGatewayUp()), '同域网关未启动（需 pnpm dev:gateway）')
```

- [ ] **Step 6: docs/04 server.ts 表格行**

old_string：

```
| `config/src/server.ts`               | `SERVER_DEFAULTS`（port `5174` + `strictPort` + host 0.0.0.0 供 docker 网关可达）                                                    |
```

new_string：

```
| `config/src/server.ts`               | `SERVER_DEFAULTS`（port `5174` + `strictPort` + host 0.0.0.0 供 LAN/容器入站与 node 网关反代）                                       |
```

- [ ] **Step 7: 验证**

Run: `pnpm type-check`
Expected: 绿（dev-gateway/check-routes 改动类型无误）

---

### Task 7: 功能文档同步（CLAUDE.md / README / docs/43 / docs/10 / CHANGELOG）

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`
- Modify: `docs/43-Monorepo结构与开发指引.md`
- Modify: `docs/10-新手指引.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: CLAUDE.md — Commands 表**

old_string：

```
| 同域网关 dev（6 app 带 base 并行，配 docker 网关）  | `pnpm dev:gateway`（另终端 `docker compose up` → :8080）                               |
```

new_string：

```
| 同域网关 dev（node 网关 :8080 + 6 app 带 base 单命令） | `pnpm dev:gateway`（唯一命令 → http://localhost:8080）                                  |
```

old_string（check:gateway-conf 行）：

```
| mock 双接线一致性校验（CI 阻断）                    | `pnpm check:mock-wiring`                                                               |
```

new_string：

```
| 网关单测（node:test，HTTP/WS/302/502 smoke）        | `pnpm test:gateway`                                                                    |
| mock 双接线一致性校验（CI 阻断）                    | `pnpm check:mock-wiring`                                                               |
```

- [ ] **Step 2: CLAUDE.md — §2.1 拓扑表 #12 docker/ 行**

old_string：

```
| 12  | `docker/`            | 本地同域网关 nginx 配置（配合根 `docker-compose.yml`，见 docs/43）                                                                |
```

new_string：

```
| 12  | `scripts/node-gateway.ts` | 本地同域网关 node 实现（零依赖反向代理，:8080 反代 5174-5179，路由表自 apps-registry 代码派生，见 docs/43 §6）                  |
```

> 注：表格列宽随行内容自适应，无需手对齐；若序号列错位可顺手把原 12 行后各行序号保持不变（内容替换不影响其他行）。

- [ ] **Step 3: CLAUDE.md — 顶部变更记录（在「最近更新」区最前插入 v3.0.2 条目）**

old_string：

```
> **最近更新**（2026-10-23）：架构审查「别名→包名迁移立场」——新增 §1.6.2 包消费约定
```

new_string：

```
> **最近更新**（2026-10-26）：本地同域网关 node 化——`docker-compose.yml` + `docker/nginx.dev.conf` + `check-gateway-conf` 整体移除，`scripts/node-gateway.ts`（零依赖 node:http 反向代理，路由表自 `apps-registry` 单源代码派生）+ `pnpm dev:gateway` 一体化单命令（网关 :8080 + 6 dev server 同起同退）；`validatePortWiring` 迁入 `check-routes`（端口双写锁死保留，CI 覆盖不变）；新增 `pnpm test:gateway`（node:test HTTP/WS/302/502 smoke）；docs/43 §6 重写
>
> **v3.0.1 及更早**（2026-10-23）：架构审查「别名→包名迁移立场」——新增 §1.6.2 包消费约定
```

（原 `> **最近更新**（2026-10-23）：` 行剩余内容保留在 v3.0.1 条目后。）

- [ ] **Step 4: README — 最近更新行（第 12 行）**

old_string：

```
> - **统一登录协议**：未登录守卫整页跳 `/auth/login?redirect=...`（`VITE_AUTH_ORIGIN` env 注入），cookie 同域漫游；本地经 docker 网关 :8080 复现（`pnpm dev:gateway` + `docker compose up`）
```

new_string：

```
> - **统一登录协议**：未登录守卫整页跳 `/auth/login?redirect=...`（`VITE_AUTH_ORIGIN` env 注入），cookie 同域漫游；本地经 node 网关 :8080 复现（`pnpm dev:gateway` 一体化单命令，零 docker 依赖）
```

- [ ] **Step 5: README — 目录结构 docker/ 行（第 255 行）**

old_string：

```
├── docker/                   # 本地同域网关 nginx 配置（配合根 docker-compose.yml，见 docs/43 §6）
```

new_string：（删除该行——网关实现已归入 scripts/ 行说明；scripts/ 行（第 254 行）原有描述保留）

- [ ] **Step 6: README — 场景表（第 307 行）**

old_string：

```
| 测统一登录跨应用漫游                      | `pnpm dev:gateway` + `docker compose up`                                  | `localhost:8080/admin/`（未登录自动跳 `:8080/auth/login`，登录后回跳） |
```

new_string：

```
| 测统一登录跨应用漫游                      | `pnpm dev:gateway`                                                        | `localhost:8080/admin/`（未登录自动跳 `:8080/auth/login`，登录后回跳） |
```

- [ ] **Step 7: README — 场景表后导语（第 310 行）**

old_string：

```
> 统一登录全链路必须经同域网关 `:8080`（nginx 按 path 分流到对应 app）；详见 [docs/43](docs/43-Monorepo结构与开发指引.md) §5/§6 与 §9 排障。
```

new_string：

```
> 统一登录全链路必须经同域网关 `:8080`（node 网关按 path 前缀分流到对应 app）；详见 [docs/43](docs/43-Monorepo结构与开发指引.md) §5/§6 与 §9 排障。
```

- [ ] **Step 8: README — 常用脚本表（第 320 行）**

old_string：

```
| `pnpm dev:gateway`                 | 同域网关 dev：6 app 以 `VITE_BASE=/<app>/` 并行起（配 `docker compose up` → http://localhost:8080，见 docs/43 §6）    |
```

new_string：

```
| `pnpm dev:gateway`                 | 同域网关 dev（单命令）：node 网关 :8080 + 6 app 以 `VITE_BASE=/<app>/` 串行起（见 docs/43 §6）                        |
```

- [ ] **Step 9: README — 常用脚本表删 check:gateway-conf 行（第 338 行）**

old_string：

```
| `pnpm check:gateway-conf`          | 同域网关 nginx location / proxy_pass 与 apps-registry 端口名单一致性校验（CI 阶段强制，含端口双写锁死）               |
```

new_string：（删除该行；端口双写锁死已并入 `check:routes`——若第 335 行 check:routes 描述无此说明，在该行尾追加「（内含端口双写锁死）」）

- [ ] **Step 10: README — CI/CD 说明（第 687 行）**

old_string：

```
> 一致性 checks 全部由 CI 执行（ci.yml）：check:routes（内含网关 location 校验 + 端口双写锁死）/ check:aliases / check:mock-wiring / check:doc-currency；本地可用同名 script 预跑。
```

new_string：

```
> 一致性 checks 全部由 CI 执行（ci.yml）：check:routes（内含端口双写锁死）/ check:aliases / check:mock-wiring / check:doc-currency；本地可用同名 script 预跑。
```

- [ ] **Step 11: docs/43 — §2 目录树 docker 行（第 26 行）**

old_string：

```
├── docker/ + docker-compose.yml  本地同域网关（见 §6）
```

new_string：（删除该行）

- [ ] **Step 12: docs/43 — §4 新增 app 第 5 步（第 71 行）**

old_string：

```
5. 端口登记两处同改：`portOffset` 与 `scripts/apps-registry.mjs` 的 `port` 字段（注册表是 dev-gateway / check-routes / eslint 边界规则三消费的单源；`check:gateway-conf` 的端口双写锁死会校验 `5174 + portOffset === port`，漏改即红）+ `docker/nginx.dev.conf` 的 location 块（check-gateway-conf 双向校验兜底）
```

new_string：

```
5. 端口登记两处同改：`portOffset` 与 `scripts/apps-registry.mjs` 的 `port` 字段（注册表是 dev-gateway / 网关路由表 / check-routes / eslint 边界规则多消费的单源；`check:routes` 的端口双写锁死会校验 `5174 + portOffset === port`，漏改即红）；node 网关路由表由 `scripts/node-gateway.ts` 的 `buildGatewayRoutes(APPS)` 代码派生，无需另改配置
```

- [ ] **Step 13: docs/43 — §6 整节重写**

old_string（第 93-122 行完整旧节，从 `## 6. 本地同域网关（docker compose）` 到 `**验证**：...` 一行结束）：

```
## 6. 本地同域网关（docker compose）

复现生产「同域 path 部署」：nginx `:8080` 反代宿主机 6 个 vite dev server，浏览器只访问 `localhost:8080`（同 origin），cookie 漫游与重定向协议和生产一致。

```bash
# 终端 1：6 个 app 以 base=/<app>/ 并行起 dev（注入 VITE_BASE；turbo 不支持 per-app env，故用 node 脚本）
pnpm dev:gateway

# 终端 2：起 nginx 网关
docker compose up
```

| 网关路径                        | 反代目标（宿主机）          |
| ------------------------------- | --------------------------- |
| `http://localhost:8080/admin/`  | `host.docker.internal:5174` |
| `http://localhost:8080/docs/`   | `host.docker.internal:5175` |
| `http://localhost:8080/portal/` | `host.docker.internal:5176` |
| `http://localhost:8080/h5/`     | `host.docker.internal:5177` |
| `http://localhost:8080/big/`    | `host.docker.internal:5178` |
| `http://localhost:8080/auth/`   | `host.docker.internal:5179` |
| `http://localhost:8080/`        | 302 → `/portal/`            |

**两个关键语义**（`docker/nginx.dev.conf` 注释同步）：

1. `proxy_pass` 不带 URI 部分 → 保留原始路径前缀（`/admin/xxx` → 5174 的 `/admin/xxx`），与各 app dev 的 `VITE_BASE=/<app>/` 严格对齐；改写前缀 vite dev 404。
2. `Upgrade`/`Connection` 头透传 → vite HMR websocket 经网关可用。

`extra_hosts: host.docker.internal:host-gateway` 为 Linux 兼容；Docker Desktop（Win/Mac）内置该映射，本行 no-op。

**验证**：`curl -I http://localhost:8080/admin/` 与 `http://localhost:8080/auth/login` 均 200（dev 起好后）。
```

new_string：

```
## 6. 本地同域网关（node 一体化，pnpm dev:gateway）

复现生产「同域 path 部署」：零依赖 node 反向代理（`scripts/node-gateway.ts`，`node:http` 原生）监听 `:8080`，按路径前缀反代 6 个 vite dev server（上游 `127.0.0.1:5174-5179`），浏览器只访问 `localhost:8080`（同 origin），cookie 漫游与重定向协议和生产一致。

```bash
pnpm dev:gateway   # 唯一命令：网关 :8080 + 6 个 app 以 base=/<app>/ 串行起，Ctrl+C 一并退出
```

| 网关路径                        | 反代目标（127.0.0.1）       |
| ------------------------------- | --------------------------- |
| `http://localhost:8080/admin/`  | `:5174`                     |
| `http://localhost:8080/docs/`   | `:5175`                     |
| `http://localhost:8080/portal/` | `:5176`                     |
| `http://localhost:8080/h5/`     | `:5177`                     |
| `http://localhost:8080/big/`    | `:5178`                     |
| `http://localhost:8080/auth/`   | `:5179`                     |
| `http://localhost:8080/api/`    | `:5174`（admin mock 最全）  |
| `http://localhost:8080/`        | 302 → `/portal/`（保留端口）|

**三个关键语义**（实现见 `scripts/node-gateway.ts`）：

1. 前缀匹配 + 原样路径转发（`/admin/xxx` → 5174 的 `/admin/xxx`），与各 app dev 的 `VITE_BASE=/<app>/` 严格对齐；路由表由 `buildGatewayRoutes(apps-registry)` 单源代码派生，不存在静态配置第二事实源。
2. WS upgrade 透传（101 回写 + socket 双向 pipe）→ 任何 ws 场景经 8080 可用（注：`@vv/config` `server.hmr` 默认把 clientPort 固定到各 app 自身端口，HMR 流量实际多直连）。
3. 根路径 302 用原始 Host 头（含端口）；上游不可达 502；不设超时（SSE 流式与 HMR 长连接友好）。

**演进史**：原为 `docker compose up`（nginx:alpine 容器，:8080 → host.docker.internal），2026-10-26 起由 node 网关替代并删除——去除 Docker Desktop 依赖与宿主 IP 字面量维护坑；`check-gateway-conf` 校验随之删除，`validatePortWiring`（端口双写锁死）迁入 `check-routes`。

**验证**：`curl -I http://localhost:8080/admin/` 与 `http://localhost:8080/auth/login` 均 200（dev 起好后）。
```

- [ ] **Step 14: docs/43 — §9 前置（第 140 行）**

old_string：

```
> **前置（网关相关场景）**：需 Docker Desktop 已启动。Win/Mac 内置 `host.docker.internal` 映射；Linux 靠 `docker-compose.yml` 的 `extra_hosts: host-gateway`，无需额外配置。
```

new_string：

```
> **前置（网关相关场景）**：需 `pnpm dev:gateway` 在跑（一体化拉起 node 网关 :8080 + 6 dev server）。
```

- [ ] **Step 15: docs/43 — §9.1 端口表与处置（第 144-153 行）**

old_string：

```
`@vv/config` 的 `SERVER_DEFAULTS.strictPort: true`（`packages/config/src/server.ts`）——端口被占用**直接报错退出，不会自动漂移**（漂移会让 docker 网关 location 反代落空，排查困难）。端口表：
```

new_string：

```
`@vv/config` 的 `SERVER_DEFAULTS.strictPort: true`（`packages/config/src/server.ts`）——端口被占用**直接报错退出，不会自动漂移**（漂移会让网关路由表反代落空，排查困难）。端口表：
```

old_string（表格行）：

```
| 8080 | nginx 网关 |      |      |
```

new_string：

```
| 8080 | node 网关  |      |      |
```

old_string（处置段）：

```
处置：先找到占用进程释放（Windows `netstat -ano | findstr 5174`，macOS/Linux `lsof -i:5174`）。确需换端口时**两处同改**：目标 app `vite.config.ts` 的 `portOffset` 与 `scripts/apps-registry.mjs` 的 `port` 字段（`check:gateway-conf` 端口双写锁死校验，漂移即红）+ `docker/nginx.dev.conf` 的 location。
```

new_string：

```
处置：先找到占用进程释放（Windows `netstat -ano | findstr 5174`，macOS/Linux `lsof -i:5174`）。确需换端口时**两处同改**：目标 app `vite.config.ts` 的 `portOffset` 与 `scripts/apps-registry.mjs` 的 `port` 字段（`check:routes` 端口双写锁死校验，漂移即红）；网关路由表由注册表自动派生，无需另改。
```

- [ ] **Step 16: docs/43 — §9.3 网关模式排查（第 163 行）**

old_string：

```
1. **网关模式**：确认请求地址是 `:8080` 而非具体 app 端口——`/api/*` 由 `nginx.dev.conf` 的 `location /api/` 统一反代到 admin（5174，其 mock 最全：auth/user/menu 三模块）；不经网关直连单 app 端口时，由各 app 自己的 vite-plugin-mock 处理（同一 `@vv/mock` 数据源，响应一致）
```

new_string：

```
1. **网关模式**：确认请求地址是 `:8080` 而非具体 app 端口——`/api/*` 由 node 网关路由表统一反代到 admin（5174，其 mock 最全：auth/user/menu 三模块）；不经网关直连单 app 端口时，由各 app 自己的 vite-plugin-mock 处理（同一 `@vv/mock` 数据源，响应一致）
```

- [ ] **Step 17: docs/43 — §9.4 HMR 排查（第 172-173 行）**

old_string：

```
1. app 由 `pnpm dev:gateway` 启动（带 `VITE_BASE=/<app>/`）——直连单 app dev 时同样生效，可用它区分是网关问题还是 vite 自身问题
2. `docker/nginx.dev.conf` 的 `Upgrade` / `Connection` 头透传未被改动（server 级，丢失则 ws 经网关握手失败）
```

new_string：

```
1. app 由 `pnpm dev:gateway` 启动（带 `VITE_BASE=/<app>/`）——直连单 app dev 时同样生效，可用它区分是网关问题还是 vite 自身问题
2. node 网关内置 WS upgrade 透传（`scripts/node-gateway.ts` proxyWebSocket），无需任何配置；若经 8080 的 ws 仍握手失败，看 `dev:gateway` 终端启动日志确认网关已在 :8080 监听
```

- [ ] **Step 18: docs/10 — 路径 B 代码块（第 53-56 行）**

old_string：

```bash
pnpm dev:gateway      # 终端 1：6 个 app 以 base=/<app>/ 并行（5174-5179）
docker compose up     # 终端 2：nginx 同域网关 :8080
```

new_string：

```bash
pnpm dev:gateway      # 一体化：node 网关 :8080 + 6 个 app 以 base=/<app>/ 串行起（5174-5179）
```

- [ ] **Step 19: CHANGELOG — 「未发布」区新增条目**

在 CHANGELOG.md 顶部 `## [未发布]` 区（无则新建）的 `### Added` / `### Removed` 节追加（按现有 CHANGELOG 格式对齐）：

```markdown
### Added

- 本地同域网关 node 化：`scripts/node-gateway.ts` 零依赖反向代理（`node:http` 原生，HTTP 流式转发 + WS upgrade 透传 + GET / 302 + 502），路由表由 `buildGatewayRoutes(apps-registry)` 单源代码派生；新增 `pnpm test:gateway`（node:test，8 用例覆盖路由派生/转发/302/404/502/WS echo）

### Changed

- `pnpm dev:gateway` 一体化单命令：node 网关 :8080 + 6 dev server 同起同退（原需 `docker compose up` 第二终端）；`validatePortWiring`（端口双写锁死）自 `check-gateway-conf` 迁入 `check-routes`，CI 覆盖不变

### Removed

- `docker-compose.yml`、`docker/nginx.dev.conf`（docker/ 目录）、`scripts/check-gateway-conf.ts` 及根 `check:gateway-conf` script——本地开发不再需要 Docker Desktop 与 nginx
```

> 注：CHANGELOG 实际章节标题以文件现状为准（`[未发布]` / `Unreleased`），保持文件内既有格式。

---

### Task 8: 验证闭环

**Files:**
- 无新变更；验证 + 手动验证步骤交付

- [ ] **Step 1: 命令门禁三连**

```bash
pnpm check:routes    # 路由一致性 + 端口双写锁死（迁移后）
pnpm test:gateway    # 网关单测 8 用例
pnpm type-check      # 全仓类型（dev-gateway/check-routes 改动）
```

Expected: 全绿

- [ ] **Step 2: lint**

Run: `pnpm lint`
Expected: 绿（若 scripts/*.spec.ts 触发规则告警，按提示修复；node:test 全局 `WebSocket`/`test` 若为 no-undef 类问题，在 eslint.config.mjs 的 scripts 覆盖段确认 env 配置——现有 scripts 已用 node 全局，大概率无碍）

- [ ] **Step 3: dev:gateway 真实链路验证（交付用户的验收清单）**

```bash
pnpm dev:gateway
```

逐项验证：

1. 启动输出依次：`🚀 同域网关模式…` → `🌐 网关就绪` → 6 个 `✓ [name] 就绪` → `🎉 全部就绪`
2. `curl -I http://localhost:8080/` → 302，`Location: http://localhost:8080/portal/`
3. 浏览器 `http://localhost:8080/admin/` / `/auth/login` / `/docs/` / `/h5/h5-demo` / `/big/big-demo` 均可达（非 502）
4. 统一登录漫游：`/admin` 未登录整页跳 `:8080/auth/login`，`admin/123456` 登录回跳工作台；跳 `/portal/` 无登录按钮
5. HMR：改 `apps/admin/src/modules/workbench/views/index.vue` 任意文本保存 → 浏览器热更新生效
6. `curl -X POST http://localhost:8080/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"123456"}'` → 非 404（mock 经 /api/ 转发 admin 生效）
7. Ctrl+C → `🛑 收到 Ctrl+C，正在停止网关与 6 个 dev server…` 后进程全部退出，`netstat -ano | findstr 8080` 无残留

- [ ] **Step 4: 无残留确认**

```bash
# Grep 全仓 docker/nginx 引用（排除 node_modules / pnpm-lock / 历史文档）
# 期望剩余命中：docs/13（prod 部署示例）、docs/42 与 superpowers 历史稿、README 生产部署模板、CHANGELOG 历史条目
```

- [ ] **Step 5: 交付手动验证步骤（自检清单 §26）**

向用户输出本任务「手动验证关键步骤」（即 Step 3 清单），并附 workspace 写操作清单（§2.5 合规简报）。

---

## 计划自审记录

**Spec 覆盖核对**（spec → 任务）：

| Spec 节 | 覆盖任务 |
|---------|---------|
| §3 架构（一体化/零依赖/单源派生） | Task 1/4（buildGatewayRoutes 派生）、Task 4（一体化） |
| §4 路由与转发语义（302/WS/502/转发头/无超时/前缀匹配） | Task 1（纯函数语义）、Task 2/3（集成测试固化） |
| §5 删除清单 | Task 5（check-gateway-conf/docker）+ Task 6 Step 1（package.json script） |
| §5 修改清单 14 处 | Task 4（dev-gateway）、Task 5（check-routes）、Task 6（registry/server/playwright/e2e/docs04）、Task 7（CLAUDE/README/docs43/docs10/CHANGELOG）、admin config.ts 经核实为 README 生产示例引用**无需改**（spec 清单勘误） |
| §5 新增清单 2 处 | Task 1（node-gateway.ts + spec） |
| §6 不做清单 | 计划中无对应任务（符合） |
| §7 测试策略 | Task 1/2/3（单测+smoke）、Task 5 Step 5（check:routes 门禁） |
| §8 验收标准 | Task 8 Step 1-4 |
| §9 风险（EADDRINUSE 提示） | Task 4 Step 4（错误消息含 docker compose down 提示） |

**占位符扫描**：无 TBD/TODO；所有代码步骤含完整代码。
**类型/签名一致性**：`GatewayRoute{prefix,target}`、`GatewayTarget{host,port}`、`GatewayApp{name,port}`、`GatewayOptions{rootRedirect,routes}`、`buildGatewayRoutes(apps)`、`resolveRoute(pathname,routes)`、`createGatewayServer(options)` 跨 Task 1-4 一致；`fakeGatewayOptions` 返回类型与 `GatewayOptions` 兼容。
