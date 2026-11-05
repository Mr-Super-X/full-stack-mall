/**
 * 文件哈希 Worker：hash-wasm 增量 SHA-256。
 *
 * 分块读取 file.slice(start, end) 逐块喂入增量哈希器——内存占用恒定（单块 4MB 缓冲区），
 * 且不阻塞主线程。完成 / 出错 / 外部 terminate 时由消费方（worker-hasher.ts）负责生命周期。
 *
 * ⚠️ 构建约定：仅允许被 `new Worker(new URL('./hash.worker.ts', import.meta.url))`
 * 形式引用（vite 构建期把本文件打包为独立 Worker chunk）——经 exports 的裸 import
 * 不会触发 worker 插件转换，dev/build 行为将分裂。
 *
 * 消息协议（postMessage 结构化克隆，File 可直接传入）：
 * - 入：MessageEvent<File>
 * - 出：{ type: 'progress', loaded, total } → { type: 'done', hash } | { type: 'error', message }
 */

import { createSHA256 } from 'hash-wasm'

/** 单块读取大小：4MB（增量哈希的喂块粒度，兼顾进度平滑与读取开销） */
const READ_CHUNK_SIZE = 4 * 1024 * 1024

export type HashWorkerOutMessage =
  | { type: 'progress'; loaded: number; total: number }
  | { type: 'done'; hash: string }
  | { type: 'error'; message: string }

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<File>) => void) | null
  postMessage: (msg: HashWorkerOutMessage) => void
}

ctx.onmessage = async (e: MessageEvent<File>) => {
  const file = e.data
  try {
    const hasher = await createSHA256()
    hasher.init()
    let loaded = 0
    while (loaded < file.size) {
      const buf = await file.slice(loaded, loaded + READ_CHUNK_SIZE).arrayBuffer()
      hasher.update(new Uint8Array(buf))
      loaded += buf.byteLength
      ctx.postMessage({ type: 'progress', loaded, total: file.size })
    }
    ctx.postMessage({ type: 'done', hash: hasher.digest('hex') })
  } catch (err) {
    ctx.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}
