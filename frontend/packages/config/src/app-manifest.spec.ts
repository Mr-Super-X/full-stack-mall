/**
 * app-manifest 读取器单测（P2 应用 manifest 单源）。
 *
 * 用临时目录构造 manifest，覆盖：合法读取、字段校验（kebab/目录一致/端口/必填 NotFound）、
 * 发现+端口升序、重复 port 报错、错误含文件路径。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
// 类型由 app-manifest.d.mts 提供（TS 经 .d.mts 解析 .mjs 导入，无须 @ts-expect-error）
import { readAppManifest, discoverAppManifests } from './app-manifest.mjs'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'app-manifest-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function writeManifest(appName: string, manifest: unknown) {
  const appDir = join(dir, appName)
  mkdirSync(appDir, { recursive: true })
  writeFileSync(join(appDir, 'app.manifest.json'), JSON.stringify(manifest))
}

describe('readAppManifest', () => {
  it('合法 manifest 返回 name/port/requiredRoutes', () => {
    writeManifest('admin', { name: 'admin', port: 5174, requiredRoutes: ['NotFound'] })
    expect(readAppManifest(join(dir, 'admin'))).toEqual({
      name: 'admin',
      port: 5174,
      requiredRoutes: ['NotFound'],
    })
  })
  it('缺 NotFound 报错且含文件路径', () => {
    writeManifest('x', { name: 'x', port: 5200, requiredRoutes: ['Home'] })
    expect(() => readAppManifest(join(dir, 'x'))).toThrow(/NotFound/)
  })
  it('name 与目录不一致报错', () => {
    writeManifest('x', { name: 'y', port: 5200, requiredRoutes: ['NotFound'] })
    expect(() => readAppManifest(join(dir, 'x'))).toThrow(/与目录名/)
  })
  it('appRoot 带末尾分隔符也能取对目录名（fileURLToPath new URL 形态）', () => {
    writeManifest('admin', { name: 'admin', port: 5174, requiredRoutes: ['NotFound'] })
    const withSep = join(dir, 'admin') + (process.platform === 'win32' ? '\\' : '/')
    expect(readAppManifest(withSep).name).toBe('admin')
  })
  it('JSON 语法错报错含文件名', () => {
    const appDir = join(dir, 'x')
    mkdirSync(appDir, { recursive: true })
    writeFileSync(join(appDir, 'app.manifest.json'), '{ bad json')
    expect(() => readAppManifest(appDir)).toThrow(/app\.manifest\.json/)
  })
  it('port 非整数/越界报错', () => {
    writeManifest('x', { name: 'x', port: '5174', requiredRoutes: ['NotFound'] })
    expect(() => readAppManifest(join(dir, 'x'))).toThrow(/port/)
  })
  it('port 为 8080（node 网关占用端口）报错——契约注释承诺的实现补齐（/autoplan E9）', () => {
    writeManifest('x', { name: 'x', port: 8080, requiredRoutes: ['NotFound'] })
    expect(() => readAppManifest(join(dir, 'x'))).toThrow(/8080/)
  })
})

describe('discoverAppManifests', () => {
  it('按 port 升序返回，忽略无 manifest 的目录', () => {
    writeManifest('auth', { name: 'auth', port: 5179, requiredRoutes: ['Login', 'NotFound'] })
    writeManifest('admin', { name: 'admin', port: 5174, requiredRoutes: ['NotFound'] })
    mkdirSync(join(dir, 'empty-dir'), { recursive: true })
    const apps = discoverAppManifests(dir)
    expect(apps.map((a) => a.name)).toEqual(['admin', 'auth'])
  })
  it('重复 port 报错', () => {
    writeManifest('a', { name: 'a', port: 5200, requiredRoutes: ['NotFound'] })
    writeManifest('b', { name: 'b', port: 5200, requiredRoutes: ['NotFound'] })
    expect(() => discoverAppManifests(dir)).toThrow(/重复/)
  })
})
