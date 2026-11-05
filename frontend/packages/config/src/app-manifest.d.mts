/**
 * app-manifest.mjs 的类型镜像（与 apps-registry.d.mts 同先例——实现是 .mjs，
 * 类型声明独立 .d.mts 供 TS 消费；改字段时两处同步）。
 */
export interface AppManifest {
  name: string
  port: number
  requiredRoutes: string[]
}

export function readAppManifest(appDir: string): AppManifest
export function discoverAppManifests(appsDir: string): AppManifest[]
