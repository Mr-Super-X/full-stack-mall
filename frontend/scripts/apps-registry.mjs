/**
 * App 注册表 —— Monorepo「App 名单」视图
 *
 * P2 起（2026-10-27）：数据单源是各 app 的 app.manifest.json（name/port/requiredRoutes），
 * 本模块经 packages/config 的 discoverAppManifests 同步派生同形 APPS（按 port 升序 = 启动顺序）。
 *
 * 消费方 import 路径与 APPS 形状（{name,port,requiredRoutes}）不变，业务逻辑零改动：
 *   - scripts/dev-gateway.ts（串行拉起顺序）
 *   - scripts/node-gateway.ts 的 buildGatewayRoutes(APPS)（网关路由表单源代码派生）
 *   - playwright.config.ts（app projects baseURL）
 *   - eslint.config.mjs 的 MONOREPO_APPS（boundary-apps-<a> 逐 app 边界规则粒度）
 *   - scripts/check-routes.ts（requiredRoutes B/C 校验名单 + manifest 完整性）
 *
 * 为什么用 .mjs 而不是 .ts：eslint.config.mjs 由 ESLint 直接加载，Node 不带
 * --experimental-strip-types，读不了 .ts；故运行时单源必须是纯 ESM 形态，
 * 类型镜像在 apps-registry.d.mts（改字段时两处同步，现复用 config 包 AppManifest 类型）。
 *
 * 新增 app 的步骤：apps/<name>/ 目录 + app.manifest.json（pnpm new-app 一键生成）——
 * 注册表/网关/ESLint/路由校验自动派生，零手改。端口分配由 manifest 唯一决定。
 */
import { fileURLToPath } from 'node:url'
import { discoverAppManifests } from '../packages/config/src/app-manifest.mjs'

export const APPS = discoverAppManifests(
  fileURLToPath(new URL('../apps/', import.meta.url))
)
