/**
 * planChunks 边界与规划正确性。
 */
import { describe, expect, it } from 'vitest'
import { planChunks } from './chunk'

describe('planChunks', () => {
  it('整除：大小均等的分片，编号从 0 开始', () => {
    const plan = planChunks(10, 2)
    expect(plan).toEqual([
      { partNumber: 0, start: 0, end: 2, size: 2 },
      { partNumber: 1, start: 2, end: 4, size: 2 },
      { partNumber: 2, start: 4, end: 6, size: 2 },
      { partNumber: 3, start: 6, end: 8, size: 2 },
      { partNumber: 4, start: 8, end: 10, size: 2 },
    ])
  })

  it('末片不足：末片 size = 余数，end = fileSize', () => {
    const plan = planChunks(10, 3)
    expect(plan).toHaveLength(4)
    expect(plan[3]).toEqual({ partNumber: 3, start: 9, end: 10, size: 1 })
  })

  it('fileSize 小于 chunkSize：单分片', () => {
    expect(planChunks(5, 1024)).toEqual([{ partNumber: 0, start: 0, end: 5, size: 5 }])
  })

  it('非法 fileSize（0 / 负数 / NaN）→ 空数组', () => {
    expect(planChunks(0, 1024)).toEqual([])
    expect(planChunks(-1, 1024)).toEqual([])
    expect(planChunks(Number.NaN, 1024)).toEqual([])
  })

  it('非法 chunkSize（0 / 负数 / NaN）归一 1MB', () => {
    const plan = planChunks(2 * 1024 * 1024 + 1, 0)
    expect(plan).toHaveLength(3)
    expect(plan[0]!.size).toBe(1024 * 1024)
    expect(plan[2]!.size).toBe(1)
  })

  it('chunkSize 小数向下取整', () => {
    const plan = planChunks(10, 3.9)
    expect(plan[0]!.size).toBe(3)
  })
})
