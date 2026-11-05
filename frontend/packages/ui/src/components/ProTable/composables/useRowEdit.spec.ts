import { describe, it, expect, beforeEach } from 'vitest'
import { useRowEdit } from './useRowEdit'

describe('useRowEdit', () => {
  let edit: ReturnType<typeof useRowEdit>

  beforeEach(() => {
    edit = useRowEdit({
      onSave: undefined,
      onSaved: undefined,
      onSaveError: undefined,
    })
  })

  it('初始无编辑行', () => {
    expect(edit.isEditing('row-1')).toBe(false)
    expect(edit.editingKeys.value.size).toBe(0)
  })

  it('start 后 isEditing 返回 true', () => {
    edit._start('row-1')
    expect(edit.isEditing('row-1')).toBe(true)
    expect(edit.editingKeys.value.has('row-1')).toBe(true)
  })

  it('cancel 后 draft 丢弃 + 回到 view', () => {
    edit._start('row-1')
    edit.setValue('row-1', 'name', '张三')
    expect(edit.getValue('row-1', 'name')).toBe('张三')

    edit._cancel('row-1')
    expect(edit.isEditing('row-1')).toBe(false)
    expect(edit.getValue('row-1', 'name')).toBeUndefined()
  })

  it('setValue / getValue 走 draft Map，不污染外部 data', () => {
    edit._start('row-1')
    edit.setValue('row-1', 'name', '张三')
    expect(edit.getValue('row-1', 'name')).toBe('张三')

    edit._cancel('row-1')
    expect(edit.getValue('row-1', 'name')).toBeUndefined()
  })

  it('getError / setError 字段级错误', () => {
    edit.setError('row-1', 'name', '必填')
    expect(edit.getError('row-1', 'name')).toBe('必填')
  })

  it('validate 同步校验通过 + 合并 draft 到 data', async () => {
    const data: Record<string, unknown>[] = [{ id: 'row-1', name: '李四' }]
    edit._start('row-1')
    edit.setValue('row-1', 'name', '张三')

    const result = await edit._save('row-1', data)
    expect(result).toBe(true)
    expect(data[0].name).toBe('张三')
    expect(edit.isEditing('row-1')).toBe(false)
  })

  it('validate 同步失败（onSave 返回 false）保留 editing', async () => {
    const data: Record<string, unknown>[] = [{ id: 'row-1', name: '李四' }]
    const editWithReject = useRowEdit({
      onSave: () => false,
      onSaved: undefined,
      onSaveError: undefined,
    })

    editWithReject._start('row-1')
    editWithReject.setValue('row-1', 'name', '张三')

    const result = await editWithReject._save('row-1', data)
    expect(result).toBe(false)
    expect(editWithReject.isEditing('row-1')).toBe(true)
    expect(data[0].name).toBe('李四')
  })

  it('validate 异步失败（onSave reject）写错误 + 保留 editing', async () => {
    const data: Record<string, unknown>[] = [{ id: 'row-1', salary: 1000 }]
    const editWithAsync = useRowEdit({
      onSave: async () => {
        throw new Error('工资超限')
      },
      onSaved: undefined,
      // Error 实例取 message —— String(new Error('x')) 会得到 'Error: x' 前缀
      onSaveError: (row, err) =>
        editWithAsync.setError(
          row.id as string,
          'salary',
          err instanceof Error ? err.message : String(err)
        ),
    })

    editWithAsync._start('row-1')
    editWithAsync.setValue('row-1', 'salary', 99999)

    const result = await editWithAsync._save('row-1', data)
    expect(result).toBe(false)
    expect(editWithAsync.isEditing('row-1')).toBe(true)
    expect(editWithAsync.getError('row-1', 'salary')).toBe('工资超限')
  })

  it('自定义 rowKey（如 uuid）保存成功（H5：不再硬编码 id）', async () => {
    const editWithUuid = useRowEdit({
      rowKey: 'uuid',
      onSave: undefined,
      onSaved: undefined,
      onSaveError: undefined,
    })
    const data: Record<string, unknown>[] = [{ uuid: 'u-1', name: '李四' }]
    editWithUuid._start('u-1')
    editWithUuid.setValue('u-1', 'name', '张三')

    const result = await editWithUuid._save('u-1', data)
    expect(result).toBe(true)
    expect(data[0].name).toBe('张三')
  })

  it('自定义 rowKey 的 catch 分支：onSave 抛错时按 uuid 定位行并触发 onSaveError', async () => {
    const receivedRows: Record<string, unknown>[] = []
    const editWithUuid = useRowEdit({
      rowKey: 'uuid',
      onSave: async () => {
        throw new Error('提交失败')
      },
      onSaved: undefined,
      onSaveError: (row) => receivedRows.push(row),
    })
    const data: Record<string, unknown>[] = [{ uuid: 'u-1', name: '李四' }]
    editWithUuid._start('u-1')
    editWithUuid.setValue('u-1', 'name', '张三')

    const result = await editWithUuid._save('u-1', data)
    expect(result).toBe(false)
    expect(receivedRows).toEqual([{ uuid: 'u-1', name: '李四' }])
  })

  it('多行同时编辑独立', () => {
    edit._start('row-1')
    edit._start('row-2')
    expect(edit.isEditing('row-1')).toBe(true)
    expect(edit.isEditing('row-2')).toBe(true)
    expect(edit.editingKeys.value.size).toBe(2)

    edit._cancel('row-1')
    expect(edit.isEditing('row-1')).toBe(false)
    expect(edit.isEditing('row-2')).toBe(true)
  })
})
