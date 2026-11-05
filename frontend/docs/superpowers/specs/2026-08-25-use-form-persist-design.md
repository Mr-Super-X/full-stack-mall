# useFormPersist —— XForm 表单草稿持久化设计文档

> 为 form-schema 组件体系新增 `useFormPersist` composable：表单数据（model）自动防抖保存到浏览器存储，
> 刷新/误关页面后可按需恢复草稿，解决长表单、多步骤表单的"填写内容丢失"痛点。

| 属性 | 值 |
|------|-----|
| 版本 | v1.0.0 |
| 日期 | 2026-08-25 |
| 状态 | 设计稿待用户复核 |
| 关联项目 | `vue3-vite-project` |
| 关联分支 | `feature/form-engine` |
| 关联文档 | `docs/superpowers/specs/2026-08-19-form-schema-design.md`（form-schema 总设计） |

---

## 1. 背景 & 需求

### 1.1 现状

- `XForm` 组件（`src/components/form-schema/XForm.vue` + 20+ 个 composables）**没有任何持久化代码**：`model` 完全由使用方传入的 `reactive` 对象管理，组件只负责渲染、校验、联动、dirty 追踪，数据生命周期全在组件外（Grep 确认无 `localStorage/sessionStorage` 调用）。
- 项目已有可复用基建：`src/utils/storage.ts` 提供 `Local`/`Session` 双封装（namespace 前缀隔离 + JSON.parse 失败自动清脏数据），与框架解耦，任何层可引用。
- `use-form-dirty` 已暴露 `resetDirty()` 基线机制（`XFormExpose` 中），草稿恢复后拍基线即可让 `isDirty()` 正确反映"相对草稿的修改"。

### 1.2 目标

新增 `useFormPersist` composable，实现：

1. **自动保存**：deep watch model + 防抖（默认 400ms）写入浏览器存储，用户无感。
2. **按需恢复**：初始化同步得出 `hasDraft`；使用方决定何时 `load()`（弹确认框或静默恢复）。
3. **手动补丁**：`save()` 立即 flush；`clear()` 清除草稿（提交成功后调用）。
4. **刷新兜底**：`beforeunload` 监听，同步 flush 防抖窗口内的输入。
5. **敏感字段排除**：`exclude` 配置（lodash 路径），如 `['password', 'card.cvv']`。

### 1.3 范围

**包含**：
- 新 composable + 单元测试（覆盖率 ≥80%）
- `index.ts` 追加导出
- demo 演示页（`examples/XFormPersist.vue`，路由自动注册零配置）
- CHANGELOG.md Unreleased 条目

**不包含**（YAGNI）：
- XForm 内置 `persist` prop（组件职责膨胀，见 §2 决策 #2）
- Pinia store 持久化通道（违背"状态下推"，见 §2 决策 #2）
- 多标签页并发编辑同步（storage 事件监听，留后续迭代）
- File/Blob/函数等不可序列化值的结构化序列化（文档注明限制即可）
- 草稿跨设备同步（服务端草稿接口，超出前端组件范围）

---

## 2. 关键决策摘要

| # | 决策维度 | 选择 | 关键依据 |
| --- | -------------- | --------------------------------------- | ---------------------------------------- |
| 1 | API 形态 | 独立 composable `useFormPersist` | XForm 零改动；与 use-form-dirty 等兄弟 composable 同构；可独立测试；符合组合式 API 心智 |
| 2 | 落点 | `components/form-schema/composables/`（非全局 `composables/`、非 Pinia） | 草稿是页面级状态，composable 层正合适；不污染全局 store（§1.3 状态下推） |
| 3 | 触发时机 | 自动防抖（默认 400ms）+ 手动补丁（save/load/clear） | 自动覆盖刷新场景；手动补丁覆盖提交后清理等业务节点 |
| 4 | 恢复策略 | **不自动恢复**，暴露 `hasDraft` + `load()` | 恢复时机是业务决策（确认框 vs 静默），composable 只提供能力 |
| 5 | 恢复合并 | 默认全量浅合并 + `restoreFilter` 钩子 | form-schema 惯用模式是 `reactive({})` 起步、字段靠输入出现，按 model 现有 key 过滤会丢光草稿；schema 升级场景由 restoreFilter 显式裁剪 |
| 6 | 存储介质 | 默认 `'local'`，可配 `'session'` | 草稿价值在于跨会话保留；session 留给敏感/临时表单 |
| 7 | 刷新兜底 | `beforeunload` 同步 flush | 防抖窗口内（≤400ms）的输入刷新时会丢；localStorage 同步 API 在卸载阶段可靠 |
| 8 | 敏感字段 | `exclude` 显式配置，不落盘 | 不启发式猜测字段名（无魔法行为）；README 警告表单含密码等字段必须排除 |

---

## 3. 架构与文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/components/form-schema/composables/use-form-persist.ts` | 新增 | 主 composable（≤80 行，超限则拆序列化纯函数） |
| `src/components/form-schema/composables/use-form-persist.spec.ts` | 新增 | 单元测试（覆盖率 ≥80%） |
| `src/components/form-schema/index.ts` | 修改 | 追加 `export { useFormPersist } from './composables/use-form-persist'` |
| `src/modules/demo/examples/XFormPersist.vue` | 新增 | demo 页（`routes/index.ts` 的 import.meta.glob 自动注册，零路由配置） |
| `src/components/form-schema/README.md` | 修改 | 补充持久化章节（含已知限制） |

**零改动**：XForm.vue / types.ts / 其余 22 个 composables。

**依赖**：`@/utils/storage`（Local/Session 封装）、`lodash-es`（cloneDeep/omit，项目已在用）。无新增 npm 包。

**模块边界**：form-schema 位于 `src/components/` 下，引用 `utils/`（与框架解耦层）符合 §1.2 边界铁律；demo 在 `modules/demo/`，经 `components/form-schema/index.ts` 公共出口引用，不跨模块深路径。

---

## 4. API 设计

```ts
export interface FormPersistOptions {
  /** 草稿唯一标识：建议 '<模块>.<表单名>.draft'，落入 storage.ts namespace 体系 */
  key: string
  /** 被监听的表单 model（reactive 对象） */
  model: Record<string, unknown>
  /** 存储介质：'local'（默认，跨会话保留）| 'session'（关标签页失效） */
  storage?: 'local' | 'session'
  /** 自动保存防抖 ms（默认 400） */
  debounce?: number
  /** 敏感字段 lodash 路径，序列化时剔除，如 ['password', 'card.cvv'] */
  exclude?: string[]
  /** 恢复过滤器：schema 升级后裁剪旧草稿；返回 null 表示丢弃草稿 */
  restoreFilter?: (draft: Record<string, unknown>) => Record<string, unknown> | null
}

export function useFormPersist(options: FormPersistOptions): {
  /** 立即保存当前 model（flush 防抖中的 pending 任务） */
  save(): void
  /** 读草稿并浅合并回 model；restoreFilter 返回 null 时清草稿不合并。返回是否成功恢复 */
  load(): boolean
  /** 清除草稿（提交成功后调用） */
  clear(): void
  /** 是否有草稿（初始化时同步得出，响应式） */
  hasDraft: Ref<boolean>
  /** 草稿最后保存时间戳（毫秒），未保存过为 null */
  lastSavedAt: Ref<number | null>
}
```

使用示例（demo 与文档统一采用此形态）：

```ts
const formModel = reactive<Record<string, unknown>>({})
const persist = useFormPersist({
  key: 'orders.create.draft',
  model: formModel,
  exclude: ['password'],
})

// 挂载时：检测到草稿 → 业务自行决定恢复方式
onMounted(() => {
  if (persist.hasDraft.value) {
    persist.load()
    formRef.value?.resetDirty() // 草稿为新基线，isDirty 从草稿起算
  }
})

// 提交成功后
await submitApi(...)
persist.clear()
```

---

## 5. 数据流

```
【初始化】（同步）
storage.get(key) ── 有值 ──> hasDraft = true（不自动写 model）
       │
       └── 无值/脏数据 ──> hasDraft = false

【使用方决策恢复】
hasDraft ──> 弹确认框 / 静默 ──> load()
    load(): restoreFilter(draft) ──> null ──> clear() 丢弃 + 返回 false
                       └──> 对象 ──> 浅合并进 model ──> 返回 true
    使用方随后调 formRef.resetDirty() 拍基线（isDirty 从草稿起算）

【自动保存】
watch(model, { deep: true })
    └──> debounce 400ms
           └──> serialize: cloneDeep → omit(exclude 路径) → JSON.stringify
                  └──> storage.set(key, draft) + lastSavedAt = Date.now()

【手动补丁】
save():  cancel 防抖 + 立即 serialize + 写入
clear(): storage.remove(key) + hasDraft = false + lastSavedAt = null

【刷新兜底】
window.addEventListener('beforeunload', flushPending)
    flushPending(): 若防抖窗口内存在未落盘的变更，同步写入（localStorage 同步 API）

【卸载清理】
onUnmounted: flushPending() + removeEventListener('beforeunload')
```

时序边界说明：
- 正常交互下，自动保存最多滞后 400ms；刷新/关页走 beforeunload 同步兜底，理论上**不丢任何输入**。
- `hasDraft` 只在初始化时同步计算一次，后续变化由 save/load/clear 维护，不重复读 storage。
- 防抖实现复用 lodash-es `debounce`（项目已在用），不手写计时器。

---

## 6. 错误处理与边界

| 场景 | 处理 | 依据 |
|------|------|------|
| JSON.stringify 循环引用（model 被塞入 DOM 节点等） | try-catch + `console.warn`，跳过本次保存，不打断表单 | 防静默吞错：warn 可观测 |
| storage.set 配额超限（QuotaExceededError） | catch + `console.warn` | 同上 |
| 草稿数据损坏（JSON.parse 失败） | storage.ts `safeParse` 自动清脏数据返回 null → hasDraft=false | 复用现有基建 |
| File/Blob/函数值被序列化退化（File→{}，fn→被丢弃） | 文档注明限制，一期不特殊处理 | 结构化序列化超出本期范围 |
| 多标签页同时编辑同一表单 | 一期不支持，README 注明已知限制 | storage 事件同步留后续迭代 |
| 敏感字段落盘 | `exclude` 显式剔除 + README 警告"含密码/证件号等字段必须配置 exclude" | 安全底线（全局安全规则：用户数据） |

---

## 7. 测试清单（use-form-persist.spec.ts）

| # | 用例 | 验证点 |
|---|------|--------|
| 1 | 无草稿初始化 | hasDraft=false，lastSavedAt=null |
| 2 | 有草稿初始化 | hasDraft=true |
| 3 | load() 恢复 | 浅合并进 model，返回 true，草稿保留（可反复 load） |
| 4 | restoreFilter 返回 null | 清草稿 + 不合并 + 返回 false |
| 5 | restoreFilter 裁剪 | 仅合并过滤后的字段 |
| 6 | 自动保存防抖 | vi.useFakeTimers：model 变化 → 防抖期不写入 → 到期后写入 |
| 7 | exclude 不落盘 | 落盘 JSON 中不含 exclude 路径（嵌套路径 'card.cvv'） |
| 8 | save() 立即 flush | 防抖窗口内调 save → storage 立即可见 |
| 9 | clear() | storage 无残留 + hasDirty 复位 |
| 10 | 循环引用 | warn 被调，不抛异常 |
| 11 | 配额超限 | mock storage.set 抛错 → warn 不抛 |
| 12 | beforeunload | 防抖窗口内 dispatch beforeunload → storage 已写入 |
| 13 | 卸载清理 | unmount 后 dispatch beforeunload 不再触发写入（监听器已移除） |
| 14 | storage: 'session' | 走 Session 而非 Local |

测试环境：Vitest + happy-dom/jsdom（mock `window.localStorage/sessionStorage`），fake timers 覆盖防抖。

---

## 8. 风险登记

| 风险 | 等级 | 对策 |
|------|------|------|
| 敏感字段误落盘 | 高 | exclude 配置 + README 警告 + spec #7 覆盖 |
| schema 升级后旧草稿结构腐化 | 中 | restoreFilter 钩子 + demo 演示裁剪用法 |
| 大表单 deep watch + 防抖成本 | 低 | use-form-dirty 已有 deep watch 先例，成本已接受；debounce 可配 |
| beforeunload 被浏览器限制（移动端 Safari） | 低 | 400ms 防抖保证常态下已落盘，最坏丢失 ≤400ms 输入 |

---

## 9. 验收标准

1. `pnpm test src/components/form-schema/composables/use-form-persist.spec.ts` 全绿，覆盖率 ≥80%。
2. demo 页完成闭环验证：填字段 → 刷新 → 恢复草稿 → isDirty 从草稿起算 → 提交 → clear。
3. `pnpm type-check:full` 与 `pnpm lint` 通过。
4. 敏感字段（exclude）在 localStorage DevTools 中不可见。
5. CHANGELOG.md 已记录。

---

*文档版本：v1.0.0 | 生成日期：2026-08-25 | 状态：待用户复核*
