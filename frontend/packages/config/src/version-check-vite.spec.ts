import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ResolvedConfig } from 'vite'
import { createVersionPayload, versionCheckVitePlugin } from './version-check-vite'

describe('packages/config version-check-vite — version.json 生成', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'vv-version-check-'))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
    delete process.env.VITE_BUILD_ID
  })

  /** 按 vite 真实调用序模拟：configResolved 存 outDir → closeBundle 写文件。
   *  config 须带 root（R2-E3 起 outDir 锚 config.root 而非 process.cwd()） */
  function runCloseBundle(outDir: string, root = tmpDir): void {
    const plugin = versionCheckVitePlugin()
    expect(plugin.apply).toBe('build')
    // 实现均为不依赖 this 的函数形态；as 剥离 vite 的 ObjectHook / PluginContext 类型（vue-tsc 校验）
    const configResolved = plugin.configResolved as
      ((this: void, config: ResolvedConfig) => void) | undefined
    configResolved?.({ build: { outDir }, root } as unknown as ResolvedConfig)
    const closeBundle = plugin.closeBundle as (this: void) => void
    closeBundle()
  }

  it('closeBundle 往 outDir 写 version.json（schema：buildId + builtAt）', () => {
    runCloseBundle(tmpDir)
    const parsed = JSON.parse(readFileSync(join(tmpDir, 'version.json'), 'utf-8'))
    expect(typeof parsed.buildId).toBe('string')
    expect(parsed.buildId.length).toBeGreaterThan(0)
    expect(typeof parsed.builtAt).toBe('string')
    expect(Number.isNaN(Date.parse(parsed.builtAt))).toBe(false)
  })

  it('相对 outDir 锚 config.root 解析而非 process.cwd()（R2-E3 回归）', () => {
    // root 下预建 dist（模拟构建已产出）；相对 outDir 须落 root/dist 而非 cwd/dist
    mkdirSync(join(tmpDir, 'dist'), { recursive: true })
    runCloseBundle('dist', tmpDir)
    const parsed = JSON.parse(readFileSync(join(tmpDir, 'dist', 'version.json'), 'utf-8'))
    expect(typeof parsed.buildId).toBe('string')
  })

  it('outDir 不存在时 closeBundle 静默跳过（不掩盖原始构建错误，R2-E3）', () => {
    const missing = join(tmpDir, 'no-such-outdir')
    expect(() => runCloseBundle(missing)).not.toThrow()
  })

  it('VITE_BUILD_ID 注入时优先采用（CI 注入 git sha 路径）', () => {
    process.env.VITE_BUILD_ID = 'ci-sha-abc123'
    runCloseBundle(tmpDir)
    const parsed = JSON.parse(readFileSync(join(tmpDir, 'version.json'), 'utf-8'))
    expect(parsed.buildId).toBe('ci-sha-abc123')
  })

  it('createVersionPayload：显式入参优先于环境变量', () => {
    process.env.VITE_BUILD_ID = 'env-sha'
    expect(createVersionPayload('explicit-id').buildId).toBe('explicit-id')
  })

  it('createVersionPayload：未注入时兜底格式非空', () => {
    const payload = createVersionPayload()
    expect(typeof payload.buildId).toBe('string')
    expect(payload.buildId.length).toBeGreaterThan(0)
  })
})
