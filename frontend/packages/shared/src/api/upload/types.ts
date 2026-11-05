/**
 * 分片上传引擎的类型契约：状态机、分片计划、后端适配器与进度快照。
 *
 * 分层定位：
 * - 本目录（`@api/upload`）是业务无关的编排引擎，组合 `runConcurrent`（并发闸门）
 *   与 `withRetry`（单分片退避重试），消费方只需实现 {@link UploadAdapter} 即可
 *   对接任意后端（S3 风格分片 / 自建服务 / mock）
 * - 哈希可注入：默认实现走主线程 WebCrypto 一次性 digest，大文件应注入 Web Worker
 *   实现（apps/docs 的 ApiUpload demo 即注入 hash-wasm 增量 Worker）
 *
 * @group 网络基建：分片上传
 */

/** 上传生命周期状态机（含暂停子态）。迁移规则见 uploader.ts 头注。 */
export type UploadState =
  | 'idle'
  /** 计算文件哈希中（默认主线程 / 注入 Worker） */
  | 'hashing'
  /** init：询问服务端已收分片（断点续传事实源） */
  | 'checking'
  /** 并发上传缺失分片中 */
  | 'uploading'
  /** complete：服务端合并分片中 */
  | 'merging'
  /** 完成，持有最终文件地址 */
  | 'done'
  /** 失败（分片重试耗尽 / init / complete 阶段出错），可重跑 */
  | 'error'
  /** 已取消：在途请求中止 + 服务端 session 清理 */
  | 'cancelled'
  /** 暂停：在途请求已中止，已完成分片保留，可 resume 续传 */
  | 'paused'

/** 单个分片的规划信息（纯派生数据，planChunks 产出） */
export interface ChunkPlan {
  /** 分片编号，从 0 开始（与数组索引对齐） */
  partNumber: number
  /** 文件内起始偏移（字节，含） */
  start: number
  /** 文件内结束偏移（字节，不含）；size = end - start */
  end: number
  /** 本分片字节数；末片允许不足 chunkSize */
  size: number
}

/** init 请求入参（POST /uploads/init 的协议形状） */
export interface InitUploadInput {
  fileName: string
  fileSize: number
  fileHash: string
  chunkSize: number
  totalChunks: number
}

/** init 响应：uploadId + 服务端已收到的分片（含 ETag） */
export interface InitUploadResult {
  uploadId: string
  /**
   * 服务端已收到的分片。携带 ETag 的设计动机：断点续传时 complete 需要全部分片的
   * ETag 列表，若 init 只回编号，客户端就得自行持久历史 ETag——刷新后无从恢复。
   */
  uploadedParts: UploadedPartMeta[]
}

/** 分片上传成功的回执：编号 + ETag（服务端对分片字节的校验值） */
export interface UploadedPartMeta {
  partNumber: number
  etag: string
}

/** complete 响应：最终文件信息 */
export interface CompleteUploadResult {
  fileUrl: string
  /** 服务端侧文件标识（demo mock 用 fileUrl 派生） */
  fileId: string
  size: number
}

/**
 * 后端适配器契约：init / uploadPart / complete / abort 四方法。
 *
 * 引擎只与本接口交互，业务页面不关心后端接口细节——替换真实后端
 * 只需换一个 adapter 实现（demo 见 apps/docs/.../upload/mock-adapter.ts）。
 *
 * @see [`BACKEND.md`](./BACKEND.md) 后端接口指导文档（协议基线 / 校验清单 / 幂等语义 / curl 验收）
 */
export interface UploadAdapter {
  /**
   * 初始化上传会话：服务端按 fileHash 去重——同哈希已有 active session 则复用
   * 并返回其 uploadId 与已收分片（断点续传的关键语义）。
   */
  init(input: InitUploadInput, signal?: AbortSignal): Promise<InitUploadResult>
  /**
   * 上传单个分片。重复上传同一分片必须幂等（服务端按内容校验，一致则返同 ETag）。
   * @param ctx.onProgress 已传输字节回调（axios onUploadProgress 语义），
   *   引擎据此做字节级进度；重试时由引擎覆盖清零
   */
  uploadPart(
    uploadId: string,
    chunk: Blob,
    meta: { partNumber: number; totalChunks: number },
    ctx: { signal?: AbortSignal; onProgress?: (loaded: number) => void }
  ): Promise<UploadedPartMeta>
  /** 通知服务端合并；parts 按 partNumber 升序 */
  complete(
    uploadId: string,
    parts: readonly UploadedPartMeta[],
    signal?: AbortSignal
  ): Promise<CompleteUploadResult>
  /** 取消/清理上传任务（DELETE /uploads/:uploadId） */
  abort(uploadId: string, signal?: AbortSignal): Promise<void>
}

/**
 * 文件哈希器（可注入）：接收 File 与取消信号，返回十六进制哈希串。
 * @param ctx.onProgress 已读取字节回调（增量哈希库可报进度；一次性实现可不调用）
 */
export type FileHasher = (
  file: File,
  ctx: { signal: AbortSignal; onProgress?: (loaded: number, total: number) => void }
) => Promise<string>

/** createUploader 配置 */
export interface UploaderConfig {
  /** 后端适配器（必须） */
  adapter: UploadAdapter
  /** 分片字节数，默认 1MB；非法值（<=0/NaN/非有限）归一 1MB */
  chunkSize?: number
  /** 并发分片数，默认 3；透传 runConcurrent.limit（其内部再 clamp） */
  concurrency?: number
  /** 单分片失败重试次数（不含首次），默认 2；透传 runConcurrent.retry */
  partRetry?: number
  /** 覆盖默认哈希实现（默认见 hash.ts，大文件务必注入 Worker 版） */
  hashFile?: FileHasher
}

/** 只读快照：subscribe 回调与 UI 渲染的数据源 */
export interface UploaderSnapshot {
  state: UploadState
  /** 0~1 总进度（按已传输字节，非分片计数） */
  progress: number
  uploadId: string | null
  fileUrl: string | null
  fileName: string | null
  fileSize: number
  fileHash: string | null
  /** 已确认完成的分片编号（服务端已收 ∪ 本地成功） */
  doneParts: readonly number[]
  /** 正在进行中的分片编号（格子 running 态；字节进度数据源） */
  runningParts: readonly number[]
  /** 本轮重试耗尽的分片编号（error 态下页面可提示单独重试） */
  failedParts: readonly number[]
  error: string | null
}

/** 快照订阅监听器 */
export type UploaderListener = (snap: UploaderSnapshot) => void

/**
 * 上传句柄：createUploader 返回值。
 * - upload(file)：启动 / 恢复（paused / error 态重跑即续传——init 幂等，已收分片自动跳过）
 * - pause()：中止在途请求，状态置 paused；已传分片保留在服务端
 * - cancel()：中止在途请求并通知服务端清理（adapter.abort）
 */
export interface Uploader {
  upload(file: File): Promise<CompleteUploadResult>
  pause(): void
  cancel(): Promise<void>
  snapshot(): UploaderSnapshot
  subscribe(listener: UploaderListener): () => void
}
