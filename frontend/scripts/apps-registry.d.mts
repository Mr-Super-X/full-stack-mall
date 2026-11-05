/**
 * apps-registry.mjs 的类型镜像。
 *
 * P2 起（2026-10-27）注册表数据派生自各 app 的 app.manifest.json（经 config 包
 * discoverAppManifests 同步发现）；RegistryAppEntry 复用 config 包 AppManifest 类型
 * （字段形状单源，本文件不再重复声明）。实现本体仍是 apps-registry.mjs（纯 ESM——
 * eslint.config.mjs 由 ESLint 直接加载、Node 无 --experimental-strip-types，读不了 .ts）。
 */
import type { AppManifest } from '../packages/config/src/app-manifest.d.mts'

/** app 注册表条目：app 名 + dev 端口（app.manifest.json 单源）+ 系统兜底路由名单 */
export type RegistryAppEntry = AppManifest

export const APPS: readonly RegistryAppEntry[]
