/**
 * 分片规划纯函数：把文件大小切成 {@link ChunkPlan} 数组，供上传引擎与 mock 服务端共用同一套编号语义。
 *
 * 编号约定（与后端协议对齐，改动须同步 mock 服务端）：
 * - partNumber 从 0 开始，与数组索引一致
 * - 末片允许不足 chunkSize（size = end - start）
 *
 * @group 网络基建：分片上传
 */

import type { ChunkPlan } from './types'

/** 默认分片大小：1MB（对齐常见对象存储最小分片粒度；实际值应结合服务端限制与网络环境测试） */
export const DEFAULT_CHUNK_SIZE = 1024 * 1024

/**
 * 归一分片大小：非法值（<=0 / NaN / 非有限）回退 1MB，小数向下取整（对齐 concurrent.ts 的 clamp 风格）。
 * 导出供 uploader 归一配置入参——init 协议的 chunkSize 与切片边界必须用同一归一值，
 * 否则 fractional 配置下 planChunks（内部 floor）与服务端校验（按原值算 expectedChunks）分裂。
 */
export function normalizeChunkSize(chunkSize: number): number {
  if (!Number.isFinite(chunkSize) || chunkSize <= 0) return DEFAULT_CHUNK_SIZE
  return Math.floor(chunkSize)
}

/**
 * 规划全部分片。
 *
 * - 边界：fileSize <= 0 / NaN / 非有限 → 返回 []（空文件不进入上传流程，由服务端 init 校验拒绝）
 * - 纯函数：无 IO，可安全重复调用
 */
export function planChunks(fileSize: number, chunkSize: number): ChunkPlan[] {
  const total = Number.isFinite(fileSize) ? Math.max(0, Math.floor(fileSize)) : 0
  if (total === 0) return []

  const size = normalizeChunkSize(chunkSize)
  const totalChunks = Math.ceil(total / size)
  return Array.from({ length: totalChunks }, (_, partNumber) => {
    const start = partNumber * size
    const end = Math.min(start + size, total)
    return { partNumber, start, end, size: end - start }
  })
}
