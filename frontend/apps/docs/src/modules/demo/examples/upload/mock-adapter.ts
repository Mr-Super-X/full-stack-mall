/**
 * UploadAdapter 的 mock 后端实现：把引擎四方法落到真实 XHR。
 *
 * - 全部经 @api/http 的 request<T>()：Network 面板可观察真实请求过程（dev 延迟瀑布可见）
 * - PUT 分片以 Blob 透传（axios 对 Blob 不做 JSON 序列化，mock 服务端 readRawBody 收字节）
 * - onUploadProgress 接 axios 上传进度事件 → 引擎字节级进度（progress.ts 覆盖式语义）
 * - 全部 silent：错误由引擎 catch 归一到状态机，不经全局 toast（error 快照自带文案）
 *
 * 后端替换路径：实现同一 UploadAdapter 契约对接真实服务即可，引擎与页面零改动。
 */

import { request } from '@api/http'
import type {
  CompleteUploadResult,
  InitUploadInput,
  InitUploadResult,
  UploadedPartMeta,
  UploadAdapter,
} from '@api/upload/types'

export function createMockUploadAdapter(): UploadAdapter {
  return {
    init(input: InitUploadInput, signal?: AbortSignal): Promise<InitUploadResult> {
      return request<InitUploadResult>({
        url: '/demo-upload/uploads/init',
        method: 'post',
        data: input,
        // exactOptionalPropertyTypes：signal 可能 undefined，条件展开而非显式传 undefined
        ...(signal ? { signal } : {}),
        silent: true,
      })
    },
    uploadPart(
      uploadId: string,
      chunk: Blob,
      meta: { partNumber: number; totalChunks: number },
      ctx: { signal?: AbortSignal; onProgress?: (loaded: number) => void }
    ): Promise<UploadedPartMeta> {
      return request<UploadedPartMeta>({
        url: `/demo-upload/uploads/${uploadId}/parts/${meta.partNumber}`,
        method: 'put',
        data: chunk,
        headers: { 'Content-Type': 'application/octet-stream' },
        ...(ctx.signal ? { signal: ctx.signal } : {}),
        silent: true,
        // exactOptionalPropertyTypes：未传 onProgress 时不写该键
        ...(ctx.onProgress
          ? { onUploadProgress: (e: { loaded: number }) => ctx.onProgress!(e.loaded) }
          : {}),
      })
    },
    complete(
      uploadId: string,
      parts: readonly UploadedPartMeta[],
      signal?: AbortSignal
    ): Promise<CompleteUploadResult> {
      return request<CompleteUploadResult>({
        url: `/demo-upload/uploads/${uploadId}/complete`,
        method: 'post',
        data: { parts },
        ...(signal ? { signal } : {}),
        silent: true,
      })
    },
    abort(uploadId: string, signal?: AbortSignal): Promise<void> {
      return request<void>({
        url: `/demo-upload/uploads/${uploadId}`,
        method: 'delete',
        ...(signal ? { signal } : {}),
        silent: true,
      })
    },
  }
}
