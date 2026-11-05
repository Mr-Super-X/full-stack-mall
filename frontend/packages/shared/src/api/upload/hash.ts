/**
 * 默认文件哈希器：主线程一次性 WebCrypto digest（SHA-256）。
 *
 * ⚠️ 已知限制：内存峰值 = 文件大小，且无法上报读取进度（WebCrypto 无增量 digest API）。
 * 大文件场景务必注入 Worker + 增量哈希实现——apps/docs 的 ApiUpload demo 即注入
 * hash-wasm 增量 Worker（types.ts 的 {@link FileHasher} 契约）。
 *
 * @group 网络基建：分片上传
 */

import type { FileHasher } from './types'

/** 取消即抛：避免大文件 digest 完成后才发现已取消，白算 */
function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw signal.reason
}

/** ArrayBuffer → 小写十六进制 */
function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 默认 hasher：file.arrayBuffer() 全量读取 + crypto.subtle.digest('SHA-256')。
 * 安全上下文（https / localhost）可用；两次 abort 检查覆盖读前与读后。
 */
export const defaultFileHasher: FileHasher = async (file, { signal }) => {
  throwIfAborted(signal)
  const buf = await file.arrayBuffer()
  throwIfAborted(signal)
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return toHex(digest)
}
