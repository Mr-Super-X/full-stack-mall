/**
 * Worker 版文件哈希器工厂：返回符合引擎 {@link FileHasher} 契约的函数。
 *
 * 大文件上传的开箱实现（对照 hash.ts 默认 hasher 的两条已知限制——内存峰值与无进度）：
 * hash-wasm 增量 SHA-256 在 Worker 线程分块计算，主线程零阻塞，进度经回调上报。
 * 消费方（apps/*）经 `@api/upload/worker-hasher` 直达，无需自行封装 Worker 生命周期。
 *
 * 生命周期（对照「组件卸载或用户取消时要清理 worker」的要求）：
 * - done / error / abort 任一路径都 terminate worker 并摘掉 abort 监听——
 *   引擎的 pause/cancel 经 signal 触发，reject signal.reason（UploadPausedError /
 *   UploadCancelledError 透传，引擎 catch 分支按类型落终态）
 * - 每次调用新建 Worker（上传是低频操作，无需池化；串行复用反而会留下跨任务状态）
 */

import type { FileHasher } from './types'
import type { HashWorkerOutMessage } from './hash.worker'

export function createWorkerHasher(): FileHasher {
  return (file, { signal, onProgress }) =>
    new Promise<string>((resolve, reject) => {
      // type: 'module' 使 Worker 内 ESM import（hash-wasm）可用；Vite 构建期打包该入口
      const worker = new Worker(new URL('./hash.worker.ts', import.meta.url), {
        type: 'module',
      })

      const cleanup = (): void => {
        worker.terminate()
        signal.removeEventListener('abort', onAbort)
      }
      const onAbort = (): void => {
        cleanup()
        reject(signal.reason)
      }
      // 预检：signal 传入时已 aborted 则 addEventListener 不再触发，promise 会永久悬挂
      // （与 defaultFileHasher 的 throwIfAborted 前置检查对称——公开直达 API 的健壮性）
      if (signal.aborted) {
        onAbort()
        return
      }

      worker.onmessage = (e: MessageEvent<HashWorkerOutMessage>) => {
        const msg = e.data
        if (msg.type === 'progress') {
          onProgress?.(msg.loaded, msg.total)
          return
        }
        cleanup()
        if (msg.type === 'done') resolve(msg.hash)
        else reject(new Error(msg.message))
      }
      worker.onerror = (e: ErrorEvent) => {
        cleanup()
        reject(e.error instanceof Error ? e.error : new Error('hash worker 运行错误'))
      }

      signal.addEventListener('abort', onAbort, { once: true })
      worker.postMessage(file)
    })
}
