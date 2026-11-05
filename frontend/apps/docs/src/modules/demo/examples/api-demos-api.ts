/**
 * 网络基建 API demo 的 ApiTable 数据源（四个页面共享，按主题拆分对齐 XForm configs 惯例）。
 * 纯数据导出，与 apps/docs/src/modules/demo/examples/*.vue 同级 import。
 */

/** ApiConcurrent.vue —— runConcurrent 及配套类型 */
export const concurrentApiItems = [
  {
    name: 'runConcurrent(items, task, options?)',
    type: '<T, R>(items, (item, index) => Promise<R>, ConcurrentOptions) => Promise<ConcurrentTaskResult<R>[]>',
    description: 'worker-pool 并发调度：按索引顺序领取任务，结果数组与输入保序对齐',
  },
  {
    name: 'options.limit',
    type: 'number',
    default: '3',
    description: '最大并发数；<1 / NaN / 非有限数归一为 1，小数向下取整',
  },
  {
    name: 'options.signal',
    type: 'AbortSignal',
    description: '取消：关闭闸门（未领取任务不再执行），整体 reject AbortError',
  },
  {
    name: 'options.retry / retryDelay',
    type: 'number',
    default: '0 / 300',
    description: '单任务重试次数与首次重试延迟（复用 withRetry，4xx 不重试）',
  },
  {
    name: 'options.onProgress',
    type: '(settled, total) => void',
    description: '每个任务 settle 后回调，累计 1..total；回调异常会传播中断队列',
  },
  {
    name: 'ConcurrentTaskResult',
    type: '{ status, value?, reason?, index }',
    description: '可辨识联合：fulfilled 带 value / rejected 带 reason，index 保序依据',
  },
]

/** ApiRetry.vue —— withRetry 及配套 */
export const retryApiItems = [
  {
    name: 'withRetry(fn, opts?)',
    type: '<T>(() => Promise<T>, RetryOptions) => Promise<T>',
    description: '指数退避重试包装：第 n 次重试延迟 = baseDelay * backoff^(n-1)',
  },
  {
    name: 'opts.retries',
    type: 'number',
    default: '2',
    description: '额外重试次数（不含首次调用）',
  },
  {
    name: 'opts.baseDelay / backoff',
    type: 'number',
    default: '300 / 2',
    description: '首次重试延迟与退避基数',
  },
  {
    name: 'opts.shouldRetry',
    type: '(err, attempt) => boolean',
    description:
      '默认策略：4xx ApiError 与主动取消（canceled）不重试，网络错误 / 5xx / 无 status 业务码重试',
  },
  {
    name: 'isIdempotent(method, config?)',
    type: '(string, { idempotent?: boolean }) => boolean',
    description: 'GET/HEAD/OPTIONS 默认幂等；config.idempotent 可强制开关',
  },
]

/** ApiMerge.vue —— withMerge 及配套 */
export const mergeApiItems = [
  {
    name: 'withMerge(fn, options?)',
    type: '(fn, MergeOptions) => (config) => Promise',
    description: '时间窗内同 key 请求共享同一 Promise（默认窗口 50ms，从首个请求 settle 起算）',
  },
  {
    name: 'options.windowMs',
    type: 'number',
    default: '50',
    description: '合并窗口毫秒数；窗口内失败结果同样被共享（缓存失败语义）',
  },
  {
    name: 'options.methods',
    type: 'ReadonlySet<string> | string[]',
    default: "['get','head']",
    description: '允许合并的方法白名单；写操作默认不合并，避免掩盖真实失败链路',
  },
  {
    name: 'config.merge',
    type: "'auto' | 'never' | number",
    description: '单次 directive：auto 走默认白名单，never 关闭，number 强制窗口毫秒数',
  },
  {
    name: 'mergeKey(config)',
    type: '(MergeableConfig) => string | null',
    description:
      'method + url + params + data 归一化；Date 按时间戳；FormData/Blob/URLSearchParams/循环引用返回 null（不合并）',
  },
  {
    name: '调用方 signal',
    type: 'AbortSignal',
    description: '经 linkAbort 与本地控制器两路链接：任一中止都会中断底层请求',
  },
]

/** ApiUpload.vue —— 分片上传引擎（uploader/chunk/progress） */
export const uploadApiItems = [
  {
    name: 'createUploader(config)',
    type: '(UploaderConfig) => Uploader',
    description:
      '上传编排引擎：hashing→checking→uploading→merging→done 状态机，组合 runConcurrent + withRetry',
  },
  {
    name: 'config.adapter',
    type: 'UploadAdapter',
    description:
      '后端适配器契约：init / uploadPart / complete / abort 四方法，业务页面不感知后端细节',
  },
  {
    name: 'config.chunkSize / concurrency / partRetry',
    type: 'number',
    default: '1MB / 3 / 2',
    description: '分片字节数（非法值归一 1MB）/ 并发分片数 / 单分片失败重试次数',
  },
  {
    name: 'config.hashFile',
    type: 'FileHasher',
    description:
      '可注入哈希器：引擎自带 createWorkerHasher()（hash-wasm 增量 Worker，大文件推荐）；默认主线程 WebCrypto 兜底',
  },
  {
    name: 'uploader.upload(file)',
    type: '(File) => Promise<CompleteUploadResult>',
    description:
      '启动/恢复上传：paused / error 后重入安全（init 按 fileHash 幂等，已收分片自动跳过）；运行期间重入抛错',
  },
  {
    name: 'uploader.pause() / cancel()',
    type: '() => void / () => Promise<void>',
    description:
      '暂停：AbortController 中止在途请求，服务端分片保留可续传；取消：中止 + adapter.abort 清理服务端',
  },
  {
    name: 'uploader.subscribe(listener)',
    type: '(UploaderSnapshot) => () => void',
    description:
      '快照订阅：state / progress（按已传输字节）/ doneParts / runningParts / failedParts / error',
  },
  {
    name: 'planChunks(fileSize, chunkSize)',
    type: '(number, number) => ChunkPlan[]',
    description: '分片规划纯函数：partNumber 从 0 开始，末片允许不足 chunkSize',
  },
  {
    name: 'UploadProgressTracker',
    type: 'class',
    description: '字节级进度：进行中分片实时已传计入分子，覆盖式更新天然支持重试清零',
  },
]
