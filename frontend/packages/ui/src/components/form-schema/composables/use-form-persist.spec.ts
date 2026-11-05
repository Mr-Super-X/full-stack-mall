/**
 * useFormPersist 单元测试
 * 覆盖：hasDraft 初始化 / load 恢复 / restoreFilter / 防抖自动保存 /
 * exclude 敏感字段 / save 手动 flush / clear 清理 / 序列化与配额错误 /
 * beforeunload 兜底 / 卸载清理 / session 介质
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive, type EffectScope } from 'vue'
import { useFormPersist } from './use-form-persist'
import { Local, Session } from '@vv/shared'

const KEY = 'form-persist.spec.draft'

let scope: EffectScope

beforeEach(() => {
  Local.remove(KEY)
  Session.remove(KEY)
  scope = effectScope()
})

afterEach(() => {
  scope.stop()
})

function run(options: Parameters<typeof useFormPersist>[0]) {
  return scope.run(() => useFormPersist(options))!
}

describe('useFormPersist / 初始化', () => {
  it('无草稿时 hasDraft=false 且 lastSavedAt=null', () => {
    const model = reactive<Record<string, unknown>>({})
    const persist = run({ key: KEY, model })
    expect(persist.hasDraft.value).toBe(false)
    expect(persist.lastSavedAt.value).toBeNull()
  })

  it('存在草稿时 hasDraft=true', () => {
    Local.set(KEY, { name: '张三' })
    const model = reactive<Record<string, unknown>>({})
    const persist = run({ key: KEY, model })
    expect(persist.hasDraft.value).toBe(true)
  })
})

describe('useFormPersist / load 恢复', () => {
  it('load() 合并草稿到 model 且返回 true、草稿保留', () => {
    Local.set(KEY, { name: '张三', age: 30 })
    const model = reactive<Record<string, unknown>>({ name: '', bio: '' })
    const persist = run({ key: KEY, model })
    expect(persist.load()).toBe(true)
    expect(model.name).toBe('张三')
    expect(model.age).toBe(30) // 草稿字段全量合并（form-schema 惯例 model 从空对象起步）
    expect(model.bio).toBe('') // model 原有字段保留
    expect(Local.get(KEY)).toEqual({ name: '张三', age: 30 }) // 草稿保留可反复 load
  })

  it('restoreFilter 返回 null 时丢弃草稿且不合并', () => {
    Local.set(KEY, { name: '张三' })
    const model = reactive<Record<string, unknown>>({ name: '' })
    const persist = run({ key: KEY, model, restoreFilter: () => null })
    expect(persist.load()).toBe(false)
    expect(model.name).toBe('')
    expect(Local.get(KEY)).toBeNull()
    expect(persist.hasDraft.value).toBe(false)
  })

  it('restoreFilter 裁剪后仅合并过滤后的字段', () => {
    Local.set(KEY, { name: '张三', obsolete: 'x' })
    const model = reactive<Record<string, unknown>>({ name: '' })
    const persist = run({
      key: KEY,
      model,
      restoreFilter: (draft) => ({ name: draft.name }),
    })
    expect(persist.load()).toBe(true)
    expect(model.name).toBe('张三')
    expect('obsolete' in model).toBe(false)
  })
})

describe('useFormPersist / 自动保存', () => {
  it('model 变化后防抖 400ms 才写入', async () => {
    vi.useFakeTimers()
    const model = reactive<Record<string, unknown>>({ name: '' })
    const persist = run({ key: KEY, model })
    model.name = '张三'
    await nextTick()
    expect(Local.get(KEY)).toBeNull() // 防抖窗口内不写入
    vi.advanceTimersByTime(400)
    expect(Local.get(KEY)).toEqual({ name: '张三' })
    expect(persist.lastSavedAt.value).not.toBeNull()
    vi.useRealTimers()
  })

  it('exclude 字段不落盘（含嵌套路径）', async () => {
    vi.useFakeTimers()
    const model = reactive<Record<string, unknown>>({
      name: '张三',
      password: '123456',
      card: { cvv: '999' },
    })
    run({ key: KEY, model, exclude: ['password', 'card.cvv'] })
    model.name = '李四'
    await nextTick()
    vi.advanceTimersByTime(400)
    const draft = Local.get<Record<string, unknown>>(KEY)
    expect(draft).toEqual({ name: '李四', card: {} }) // password 剔除；card.cvv 剔除后 card 留空对象
    vi.useRealTimers()
  })
})

describe('useFormPersist / 手动补丁', () => {
  it('save() 立即 flush 防抖窗口内的变更', async () => {
    vi.useFakeTimers()
    const model = reactive<Record<string, unknown>>({ name: '' })
    const persist = run({ key: KEY, model })
    model.name = '张三'
    await nextTick()
    expect(Local.get(KEY)).toBeNull()
    persist.save()
    expect(Local.get(KEY)).toEqual({ name: '张三' }) // 立即落盘，无需推进定时器
    expect(persist.lastSavedAt.value).not.toBeNull()
    vi.useRealTimers()
  })

  it('clear() 清除草稿并复位状态', async () => {
    vi.useFakeTimers()
    const model = reactive<Record<string, unknown>>({ name: '' })
    const persist = run({ key: KEY, model })
    model.name = '张三'
    await nextTick()
    vi.advanceTimersByTime(400)
    expect(Local.get(KEY)).not.toBeNull()
    persist.clear()
    expect(Local.get(KEY)).toBeNull()
    expect(persist.hasDraft.value).toBe(false)
    expect(persist.lastSavedAt.value).toBeNull()
    vi.useRealTimers()
  })

  it('markResetting 屏蔽下一次 watch 写入（resetFields 场景不覆盖草稿）', async () => {
    vi.useFakeTimers()
    const model = reactive<Record<string, unknown>>({ name: '' })
    const persist = run({ key: KEY, model })
    // 先写入一份草稿
    model.name = '张三'
    await nextTick()
    vi.advanceTimersByTime(400)
    expect(Local.get(KEY)).toEqual({ name: '张三' })
    // 模拟 resetFields：先 markResetting 再清空 model
    persist.markResetting()
    model.name = ''
    await nextTick()
    vi.advanceTimersByTime(400)
    // 关键断言：localStorage 中仍是「张三」草稿，未被空 model 覆盖
    expect(Local.get(KEY)).toEqual({ name: '张三' })
    // 下一次 model 变化应正常触发自动保存（markResetting 只屏蔽 1 次）
    model.name = '李四'
    await nextTick()
    vi.advanceTimersByTime(400)
    expect(Local.get(KEY)).toEqual({ name: '李四' })
    vi.useRealTimers()
  })
})

describe('useFormPersist / 错误处理', () => {
  it('model 含循环引用时 save 不抛出（console.warn）', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const model = reactive<Record<string, unknown>>({})
    model.self = model
    const persist = run({ key: KEY, model })
    expect(() => persist.save()).not.toThrow()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('storage 写入配额超限时 save 不抛出（console.warn）', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const model = reactive<Record<string, unknown>>({ name: 'a' })
    const persist = run({ key: KEY, model })
    expect(() => persist.save()).not.toThrow()
    expect(warn).toHaveBeenCalled()
    setItemSpy.mockRestore()
    warn.mockRestore()
  })
})

describe('useFormPersist / 刷新兜底与生命周期', () => {
  it('beforeunload 时 flush 防抖窗口内的变更（同步写入）', async () => {
    vi.useFakeTimers()
    const model = reactive<Record<string, unknown>>({ name: '' })
    run({ key: KEY, model })
    model.name = '张三'
    await nextTick()
    expect(Local.get(KEY)).toBeNull()
    window.dispatchEvent(new Event('beforeunload'))
    expect(Local.get(KEY)).toEqual({ name: '张三' }) // 同步 flush，无需推进定时器
    vi.useRealTimers()
  })

  it('scope.stop 模拟卸载：flush pending + 移除监听 + 停止自动保存', async () => {
    vi.useFakeTimers()
    const model = reactive<Record<string, unknown>>({ name: '' })
    run({ key: KEY, model })
    model.name = '张三'
    await nextTick()
    scope.stop() // 触发 onScopeDispose：flushPending 写入 + 移除 beforeunload 监听
    expect(Local.get(KEY)).toEqual({ name: '张三' })
    model.name = '李四'
    await nextTick()
    vi.advanceTimersByTime(1000)
    expect(Local.get(KEY)).toEqual({ name: '张三' }) // 卸载后不再自动保存
    window.dispatchEvent(new Event('beforeunload'))
    expect(Local.get(KEY)).toEqual({ name: '张三' }) // 监听已移除
    vi.useRealTimers()
  })

  it("storage: 'session' 走 Session 介质", async () => {
    vi.useFakeTimers()
    const model = reactive<Record<string, unknown>>({ name: '' })
    run({ key: KEY, model, storage: 'session' })
    model.name = '张三'
    await nextTick()
    vi.advanceTimersByTime(400)
    expect(Session.get(KEY)).toEqual({ name: '张三' })
    expect(Local.get(KEY)).toBeNull()
    vi.useRealTimers()
  })
})

describe('useFormPersist / schemaVersion 版本信封（③ 回归）', () => {
  it('版本匹配 → load 成功解包恢复', () => {
    Local.set(KEY, { __v: 2, data: { name: '张三' } })
    const model = reactive<Record<string, unknown>>({ name: '' })
    const persist = run({ key: KEY, model, schemaVersion: 2 })
    expect(persist.load()).toBe(true)
    expect(model.name).toBe('张三')
  })

  it('版本不匹配（旧版草稿）→ 丢弃并清除 storage，不污染 model', () => {
    Local.set(KEY, { __v: 1, data: { name: '旧值', staleKey: '污染字段' } })
    const model = reactive<Record<string, unknown>>({ name: '' })
    const persist = run({ key: KEY, model, schemaVersion: 2 })
    expect(persist.load()).toBe(false)
    expect(persist.hasDraft.value).toBe(false)
    expect(Local.get(KEY)).toBeNull()
    expect(model.name).toBe('')
    expect(model.staleKey).toBeUndefined()
  })

  it('配置 schemaVersion 后存量无信封草稿 → 视为不匹配丢弃', () => {
    Local.set(KEY, { name: '张三' }) // 旧格式（无版本信封）
    const model = reactive<Record<string, unknown>>({ name: '' })
    const persist = run({ key: KEY, model, schemaVersion: 1 })
    expect(persist.load()).toBe(false)
    expect(Local.get(KEY)).toBeNull()
  })

  it('save 后草稿带版本信封，版本一致可恢复', async () => {
    const model = reactive<Record<string, unknown>>({ name: '李四' })
    const persist = run({ key: KEY, model, schemaVersion: 3 })
    persist.save()
    expect(Local.get(KEY)).toEqual({ __v: 3, data: { name: '李四' } })
    const model2 = reactive<Record<string, unknown>>({ name: '' })
    const persist2 = run({ key: KEY, model: model2, schemaVersion: 3 })
    expect(persist2.load()).toBe(true)
    expect(model2.name).toBe('李四')
  })
})

describe('useFormPersist / load 深合并（③ 回归）', () => {
  it('嵌套对象逐层合并：schema 新增字段的默认值保留，旧值覆盖既有 key', () => {
    // schema 升级后 model 新增 address.street 默认值；旧草稿只有 address.city
    Local.set(KEY, { address: { city: '广州' } })
    const model = reactive<Record<string, unknown>>({
      address: { city: '深圳', street: '默认街道' },
    })
    const persist = run({ key: KEY, model })
    expect(persist.load()).toBe(true)
    const addr = model.address as Record<string, unknown>
    expect(addr.city).toBe('广州') // 草稿覆盖
    expect(addr.street).toBe('默认街道') // 浅合并会整棵替换丢失该默认值；深合并保留
  })

  it('数组字段整体替换：草稿数组更短时不残留旧尾项', () => {
    Local.set(KEY, { items: [{ qty: 1 }] })
    const model = reactive<Record<string, unknown>>({
      items: [{ qty: 9 }, { qty: 8 }, { qty: 7 }],
    })
    const persist = run({ key: KEY, model })
    expect(persist.load()).toBe(true)
    expect(model.items).toEqual([{ qty: 1 }]) // 按索引深合并会残留 qty:8/7
  })
})
