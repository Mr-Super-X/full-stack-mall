import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('element-plus', () => ({
  ElMessageBox: { confirm: vi.fn() },
}))

// 隔离 useDialog：它会连带加载 ProDialog 组件树，本用例只关心上下文回退取值
const { mockGetDialogAppContext } = vi.hoisted(() => ({
  mockGetDialogAppContext: vi.fn(() => null),
}))

vi.mock('./useDialog', () => ({
  getDialogAppContext: mockGetDialogAppContext,
}))

import { ElMessageBox } from 'element-plus'
import { useConfirm } from './useConfirm'

const confirmMock = ElMessageBox.confirm as unknown as ReturnType<typeof vi.fn>

/** 取第 n 次调用传给 ElMessageBox.confirm 的第 3 个参数（options） */
function optionsOfCall(index = 0): Record<string, unknown> {
  return confirmMock.mock.calls[index]?.[2] as Record<string, unknown>
}

beforeEach(() => {
  confirmMock.mockReset()
  mockGetDialogAppContext.mockReset().mockReturnValue(null)
})

describe('useConfirm —— Promise 行为重塑', () => {
  it('点确定 resolve(true)', async () => {
    confirmMock.mockResolvedValueOnce('confirm')
    await expect(useConfirm('确定删除吗？')).resolves.toBe(true)
  })

  it("点取消（EP reject 'cancel'）resolve(false) 而非 reject", async () => {
    confirmMock.mockRejectedValueOnce('cancel')
    await expect(useConfirm('确定删除吗？')).resolves.toBe(false)
  })

  it("点关闭图标（EP reject 'close'）resolve(false)", async () => {
    confirmMock.mockRejectedValueOnce('close')
    await expect(useConfirm('确定删除吗？')).resolves.toBe(false)
  })

  it('beforeClose 抛出的真实异常原样上抛，不被降级为 false', async () => {
    const bizError = new Error('beforeClose 内业务校验失败')
    confirmMock.mockRejectedValueOnce(bizError)
    await expect(useConfirm('确定删除吗？')).rejects.toThrow(bizError)
  })

  it('非哨兵字符串同样上抛（避免误把未知 reject 当作取消）', async () => {
    confirmMock.mockRejectedValueOnce('some-unknown-reason')
    await expect(useConfirm('确定删除吗？')).rejects.toBe('some-unknown-reason')
  })
})

describe('useConfirm —— 参数归一与默认值', () => {
  beforeEach(() => {
    confirmMock.mockResolvedValue('confirm')
  })

  it('位置参数形态：title 缺省为 系统提示，按钮文案为 确定/取消', async () => {
    await useConfirm('确定删除吗？')
    const [message, title] = confirmMock.mock.calls[0] ?? []
    expect(message).toBe('确定删除吗？')
    expect(title).toBe('系统提示')
    expect(optionsOfCall()).toMatchObject({
      confirmButtonText: '确定',
      cancelButtonText: '取消',
    })
  })

  it('位置参数形态：显式 title 覆盖默认值', async () => {
    await useConfirm('确定删除吗？', '危险操作')
    expect(confirmMock.mock.calls[0]?.[1]).toBe('危险操作')
  })

  it('对象参数形态：content 映射为 EP 的 message', async () => {
    await useConfirm({ content: '确定重置吗？', title: '重置确认' })
    const [message, title] = confirmMock.mock.calls[0] ?? []
    expect(message).toBe('确定重置吗？')
    expect(title).toBe('重置确认')
  })

  it('原生配置项透传（dangerouslyUseHTMLString 等）', async () => {
    await useConfirm({
      content: '<strong>订单 #1024</strong> 将被永久删除',
      dangerouslyUseHTMLString: true,
      closeOnClickModal: false,
    })
    expect(optionsOfCall()).toMatchObject({
      dangerouslyUseHTMLString: true,
      closeOnClickModal: false,
    })
  })
})

describe('useConfirm —— danger 危险操作预设', () => {
  beforeEach(() => {
    confirmMock.mockResolvedValue('confirm')
  })

  it('danger: true 时确认按钮转红 + 警告图标', async () => {
    await useConfirm({ content: '确定删除吗？', danger: true })
    expect(optionsOfCall()).toMatchObject({
      type: 'warning',
      confirmButtonType: 'danger',
    })
  })

  it('danger 预设可被显式同名字段覆盖（预设仅作默认值）', async () => {
    await useConfirm({ content: '确定删除吗？', danger: true, type: 'error' })
    expect(optionsOfCall()).toMatchObject({
      type: 'error',
      confirmButtonType: 'danger',
    })
  })

  it('未开 danger 时不注入预设字段', async () => {
    await useConfirm('确定删除吗？')
    expect(optionsOfCall()).not.toHaveProperty('confirmButtonType')
  })

  it('danger 不会泄漏进 EP 原生 options', async () => {
    await useConfirm({ content: '确定删除吗？', danger: true })
    expect(optionsOfCall()).not.toHaveProperty('danger')
  })
})

describe('useConfirm —— appContext 透传', () => {
  beforeEach(() => {
    confirmMock.mockResolvedValue('confirm')
  })

  it('缺省时回退到 main.ts 注册的全局上下文', async () => {
    const fakeContext = { app: {} } as never
    mockGetDialogAppContext.mockReturnValue(fakeContext)
    await useConfirm('确定删除吗？')
    expect(confirmMock.mock.calls[0]?.[3]).toBe(fakeContext)
  })

  it('显式传 null 表示不要上下文，不再回退', async () => {
    mockGetDialogAppContext.mockReturnValue({ app: {} } as never)
    await useConfirm({ content: '确定删除吗？', appContext: null })
    expect(confirmMock.mock.calls[0]?.[3]).toBeNull()
    expect(mockGetDialogAppContext).not.toHaveBeenCalled()
  })

  it('appContext 不会泄漏进 EP 原生 options', async () => {
    await useConfirm({ content: '确定删除吗？', appContext: null })
    expect(optionsOfCall()).not.toHaveProperty('appContext')
  })
})
