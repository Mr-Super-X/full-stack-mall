/**
 * draft-storage —— 草稿 localStorage / sessionStorage 读写工具（纯函数层）
 *
 * 拆出独立文件便于 use-form-persist 测试时 mock storage；本文件不持有任何 reactive state。
 * 数据损坏由 storage.ts 的 safeParse 自动清脏（读出 null），无需在本层处理。
 *
 * @group 表单编排：草稿
 */
import { cloneDeep, omit } from 'lodash-es'
import { Local, Session } from '@vv/shared'

/** 草稿存储介质 */
export type DraftStorageKind = 'local' | 'session'

function pickStore(kind: DraftStorageKind) {
  return kind === 'session' ? Session : Local
}

/** 读草稿；无草稿或数据损坏（storage.ts safeParse 自动清脏）时返回 null */
export function readDraft(key: string, kind: DraftStorageKind): Record<string, unknown> | null {
  return pickStore(kind).get<Record<string, unknown>>(key)
}

/** 写草稿：cloneDeep 剥离 reactive Proxy + omit 剔除敏感路径；异常仅 warn 不抛出。
 *  version 提供时写版本信封 { __v, data }（schema 升级后旧版本草稿由 load 方丢弃） */
export function writeDraft(
  key: string,
  kind: DraftStorageKind,
  model: Record<string, unknown>,
  exclude: string[],
  version?: string | number
): void {
  try {
    const body = omit(cloneDeep(model) as Record<string, unknown>, exclude)
    pickStore(kind).set(key, version !== undefined ? { __v: version, data: body } : body)
  } catch (err) {
    console.warn(`[useFormPersist] 草稿写入失败 (key: ${key}):`, err)
  }
}

/** 删除草稿 */
export function removeDraft(key: string, kind: DraftStorageKind): void {
  pickStore(kind).remove(key)
}
