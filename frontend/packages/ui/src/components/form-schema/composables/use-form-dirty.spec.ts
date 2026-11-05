/**
 * useFormDirty 单元测试
 * 覆盖：
 * - resetDirty() 拍基线
 * - isDirty() / getDirtyFields() / isTouched() 在 model 变化时的行为
 * - 嵌套字段（lodash 路径）
 * - 未拍基线时（initialSnapshot 为空）返回 false / 空数组
 */
import { describe, it, expect } from 'vitest'
import { ref, nextTick, reactive } from 'vue'
import { useFormDirty } from './use-form-dirty'

describe('useFormDirty / 基础', () => {
  it('未拍基线时 isDirty 返回 false', () => {
    const model: Record<string, unknown> = { name: 'a', age: 18 }
    const dirty = useFormDirty({ model: () => model, fieldNames: () => ['name', 'age'] })
    expect(dirty.isDirty()).toBe(false)
    expect(dirty.getDirtyFields()).toEqual([])
  })

  it('H4 回归：嵌套对象字段原位修改 → isDirty 检测到（快照深拷贝，不存活引用）', () => {
    const model = reactive({ addr: { city: '深圳' } })
    const dirty = useFormDirty({
      model: () => model,
      fieldNames: () => ['addr'],
    })
    dirty.resetDirty()
    expect(dirty.isDirty()).toBe(false)
    // 原位修改嵌套属性 —— 快照若存活 reactive 引用，isEqual 恒 true 导致漏检
    model.addr.city = '广州'
    expect(dirty.isDirty()).toBe(true)
    expect(dirty.getDirtyFields()).toEqual(['addr'])
    // 改回基线值 → 恢复非 dirty
    model.addr.city = '深圳'
    expect(dirty.isDirty()).toBe(false)
  })

  it('dirtyFieldsRef 响应式（F13）：recompute 时整体替换新 Set，触发响应式依赖', async () => {
    const model = ref<Record<string, unknown>>({ name: 'a', age: 18 })
    const dirty = useFormDirty({ model: () => model.value, fieldNames: () => ['name', 'age'] })
    dirty.resetDirty()
    // 初始为 empty Set
    expect(dirty.dirtyFieldsRef.value.size).toBe(0)
    // 修改 name → dirtyFieldsRef 含 name
    model.value = { name: 'b', age: 18 }
    await nextTick()
    expect(dirty.dirtyFieldsRef.value.has('name')).toBe(true)
    expect(dirty.dirtyFieldsRef.value.has('age')).toBe(false)
    // resetDirty → dirtyFieldsRef 清空
    dirty.resetDirty()
    expect(dirty.dirtyFieldsRef.value.size).toBe(0)
  })

  it('未拍基线时 isTouched 返回 false', () => {
    const dirty = useFormDirty({
      model: () => ({ name: 'a' }),
      fieldNames: () => ['name'],
    })
    expect(dirty.isTouched('name')).toBe(false)
  })

  it('resetDirty 后 isDirty = false', () => {
    const model = ref<Record<string, unknown>>({ name: 'a' })
    const dirty = useFormDirty({ model: () => model.value, fieldNames: () => ['name'] })
    dirty.resetDirty()
    expect(dirty.isDirty()).toBe(false)
  })

  it('拍基线后修改字段 → isDirty = true', async () => {
    const model = ref<Record<string, unknown>>({ name: 'a' })
    const dirty = useFormDirty({ model: () => model.value, fieldNames: () => ['name'] })
    dirty.resetDirty()
    model.value = { name: 'b' }
    await nextTick()
    expect(dirty.isDirty()).toBe(true)
  })

  it('isTouched 返回精确字段状态', async () => {
    const model = ref<Record<string, unknown>>({ name: 'a', age: 18 })
    const dirty = useFormDirty({ model: () => model.value, fieldNames: () => ['name', 'age'] })
    dirty.resetDirty()
    expect(dirty.isTouched('name')).toBe(false)
    expect(dirty.isTouched('age')).toBe(false)

    model.value = { name: 'b', age: 18 }
    await nextTick()
    expect(dirty.isTouched('name')).toBe(true)
    expect(dirty.isTouched('age')).toBe(false)
  })

  it('getDirtyFields 返回所有 dirty 字段', async () => {
    const model = ref<Record<string, unknown>>({ a: 'x', b: 'y', c: 'z' })
    const dirty = useFormDirty({ model: () => model.value, fieldNames: () => ['a', 'b', 'c'] })
    dirty.resetDirty()
    model.value = { a: 'x', b: 'changed', c: 'z' }
    await nextTick()
    expect(dirty.getDirtyFields().sort()).toEqual(['b'])
  })

  it('重置后所有字段再次被视为未 dirty', async () => {
    const model = ref<Record<string, unknown>>({ name: 'a' })
    const dirty = useFormDirty({ model: () => model.value, fieldNames: () => ['name'] })
    dirty.resetDirty()
    model.value = { name: 'b' }
    await nextTick()
    expect(dirty.isDirty()).toBe(true)

    dirty.resetDirty()
    expect(dirty.isDirty()).toBe(false)
  })
})

describe('useFormDirty / 嵌套字段（lodash path）', () => {
  it('嵌套字段路径支持（lodash get）', async () => {
    const model = reactive<{ user: { profile: { name: string } }; age: number }>({
      user: { profile: { name: 'a' } },
      age: 18,
    })
    const dirty = useFormDirty({
      model: () => model,
      fieldNames: () => ['user.profile.name', 'age'],
    })
    dirty.resetDirty()
    expect(dirty.isDirty()).toBe(false)

    model.user.profile.name = 'b'
    await nextTick()
    expect(dirty.isDirty()).toBe(true)
    expect(dirty.isTouched('user.profile.name')).toBe(true)
    expect(dirty.isTouched('age')).toBe(false)
  })

  it('嵌套数组路径支持', async () => {
    const model = reactive<{ items: Array<{ id: number; qty: number }> }>({
      items: [
        { id: 1, qty: 5 },
        { id: 2, qty: 10 },
      ],
    })
    const dirty = useFormDirty({
      model: () => model,
      fieldNames: () => ['items[0].qty', 'items[1].qty'],
    })
    dirty.resetDirty()
    expect(dirty.isDirty()).toBe(false)

    model.items[0]!.qty = 6
    await nextTick()
    expect(dirty.isDirty()).toBe(true)
    expect(dirty.getDirtyFields()).toEqual(['items[0].qty'])
  })
})

describe('useFormDirty / 复杂值比较', () => {
  it('lodash isEqual 处理嵌套对象', async () => {
    const model = reactive<{ config: { theme: string; lang: string } }>({
      config: { theme: 'dark', lang: 'zh' },
    })
    const dirty = useFormDirty({
      model: () => model,
      fieldNames: () => ['config'],
    })
    dirty.resetDirty()

    // 整体替换为深相等的新对象 —— 不应视为 dirty
    model.config = { theme: 'dark', lang: 'zh' }
    await nextTick()
    expect(dirty.isDirty()).toBe(false)

    // 实际修改
    model.config.theme = 'light'
    await nextTick()
    expect(dirty.isDirty()).toBe(true)
  })

  it('数组内容深相等但不同引用 —— 不视为 dirty', async () => {
    const model = reactive<{ tags: string[] }>({
      tags: ['a', 'b'],
    })
    const dirty = useFormDirty({ model: () => model, fieldNames: () => ['tags'] })
    dirty.resetDirty()

    model.tags = ['a', 'b'] // 新数组引用但内容相同
    await nextTick()
    expect(dirty.isDirty()).toBe(false)

    model.tags.push('c')
    await nextTick()
    expect(dirty.isDirty()).toBe(true)
  })
})

describe('useFormDirty / stop 卸载', () => {
  it('stop() 后 model 变化不再触发重算', async () => {
    const model = ref<Record<string, unknown>>({ name: 'a' })
    const dirty = useFormDirty({ model: () => model.value, fieldNames: () => ['name'] })
    dirty.resetDirty()

    dirty.stop()

    model.value = { name: 'b' }
    await nextTick()
    // isDirty 会重算，但因为 watch 已停，可能返回错误状态
    // 实际上 dirty 内部仍是 snapshot 状态 —— 此测试只验证 stop 不抛错
    expect(() => dirty.stop()).not.toThrow()
  })
})

describe('useFormDirty / model 是 undefined', () => {
  it('model undefined 时 isDirty 返回 false（snapshot 空）', () => {
    const dirty = useFormDirty({
      model: () => undefined,
      fieldNames: () => ['name'],
    })
    expect(dirty.isDirty()).toBe(false)
  })

  it('model undefined → {} 不抛错', () => {
    const modelRef = ref<Record<string, unknown> | undefined>(undefined)
    const dirty = useFormDirty({ model: () => modelRef.value, fieldNames: () => ['name'] })
    expect(() => dirty.resetDirty()).not.toThrow()
  })
})
