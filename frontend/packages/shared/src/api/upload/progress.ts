/**
 * 字节级上传进度追踪器。
 *
 * 设计动机（对照"按已完成分片计数"的坑）：单个大分片上传期间，分片计数式进度会长时间
 * 不动。本追踪器按「已传输字节」计算——每个进行中分片的实时已传字节（axios onUploadProgress
 * 语义）也计入分子。
 *
 * 重试语义：覆盖式记录。axios 重传某分片时 loaded 从 0 重新上涨，setLoaded 直接覆盖旧值，
 * 无需显式清零——旧进度自然被替换，避免把失败尝试的已传字节永久计入。
 *
 * @group 网络基建：分片上传
 */

export class UploadProgressTracker {
  /** 已确认完成的分片字节累计 */
  private completedBytes = 0
  /** 进行中分片的实时已传字节（partNumber → loaded） */
  private readonly inflight = new Map<number, number>()

  constructor(private readonly totalBytes: number) {}

  /**
   * 记录某分片已传字节（覆盖式）。
   * 只在分片进行中有效——markDone 之后的迟到回调不应再写入（防把已完成分片顶回进行中）。
   */
  setLoaded(partNumber: number, loaded: number): void {
    if (!this.inflight.has(partNumber)) return
    this.inflight.set(partNumber, Math.max(0, loaded))
  }

  /**
   * 开启某分片的进行中记录：task 启动即调用（初始 0），
   * 使 setLoaded 的迟到回调守卫（has 判定）生效。
   */
  beginPart(partNumber: number): void {
    this.inflight.set(partNumber, 0)
  }

  /** 分片确认完成：移除进行中记录，字节计入 completed */
  markDone(partNumber: number, size: number): void {
    this.inflight.delete(partNumber)
    this.completedBytes += size
  }

  /** 分片失败 / 中止：移除进行中记录，避免脏字节残留在分子 */
  clearPart(partNumber: number): void {
    this.inflight.delete(partNumber)
  }

  /** 进行中分片编号列表（snapshot 的 runningParts 数据源） */
  get runningParts(): number[] {
    return [...this.inflight.keys()]
  }

  /** 0~1 总进度；totalBytes <= 0 时恒 1（防 NaN） */
  get progress(): number {
    if (this.totalBytes <= 0) return 1
    let inflightBytes = 0
    this.inflight.forEach((loaded) => {
      inflightBytes += loaded
    })
    return Math.min(1, (this.completedBytes + inflightBytes) / this.totalBytes)
  }
}
