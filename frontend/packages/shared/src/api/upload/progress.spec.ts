/**
 * UploadProgressTracker：字节级进度、覆盖式重试语义、失败清理。
 */
import { describe, expect, it } from 'vitest'
import { UploadProgressTracker } from './progress'

describe('UploadProgressTracker', () => {
  it('进行中分片的已传字节计入分子（分片计数式进度无法做到）', () => {
    const t = new UploadProgressTracker(100)
    t.beginPart(0)
    t.setLoaded(0, 30)
    expect(t.progress).toBeCloseTo(0.3)
    t.setLoaded(0, 60)
    expect(t.progress).toBeCloseTo(0.6)
  })

  it('markDone 后迟到回调不再写入（防已完成分片被顶回进行中）', () => {
    const t = new UploadProgressTracker(100)
    t.beginPart(0)
    t.setLoaded(0, 50)
    t.markDone(0, 40)
    expect(t.progress).toBeCloseTo(0.4)
    t.setLoaded(0, 99) // 迟到的 progress 事件
    expect(t.progress).toBeCloseTo(0.4)
  })

  it('多分片聚合：完成字节 + 进行中字节', () => {
    const t = new UploadProgressTracker(100)
    t.beginPart(0)
    t.markDone(0, 40)
    t.beginPart(1)
    t.setLoaded(1, 20)
    expect(t.progress).toBeCloseTo(0.6)
  })

  it('重试覆盖语义：重新上传从 0 涨，旧值被替换而非累加', () => {
    const t = new UploadProgressTracker(100)
    t.beginPart(0)
    t.setLoaded(0, 80)
    // 模拟重试：引擎重新 beginPart（覆盖），axios loaded 从 0 重涨
    t.beginPart(0)
    expect(t.progress).toBeCloseTo(0)
    t.setLoaded(0, 30)
    expect(t.progress).toBeCloseTo(0.3)
  })

  it('clearPart：失败/中止分片的脏字节被移除', () => {
    const t = new UploadProgressTracker(100)
    t.beginPart(0)
    t.setLoaded(0, 50)
    t.clearPart(0)
    expect(t.progress).toBe(0)
  })

  it('totalBytes <= 0 恒 1（防 NaN）', () => {
    const t = new UploadProgressTracker(0)
    expect(t.progress).toBe(1)
  })

  it('进度封顶 1', () => {
    const t = new UploadProgressTracker(100)
    t.beginPart(0)
    t.setLoaded(0, 250)
    expect(t.progress).toBe(1)
  })
})
