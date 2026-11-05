# form-schema demo 可理解度提升（设计稿）

> 关联文档：评估报告（对话上文） + form-schema `README.md` + 5 份评估样本 demo
>
> 文档版本：v1.0.0 | 生成日期：2026-09-02 | 生效分支：feature/form-engine

---

## 一、背景 & 目标

### 1.1 问题

评估报告（2026-09-02）指出 form-schema 的 49 个 demo 中存在 4 类一致性问题，其中 **P0 三项**直接影响核心可理解度：

| #   | 问题                                                                                | 影响 demo                                          |
| --- | ----------------------------------------------------------------------------------- | -------------------------------------------------- |
| R-1 | 错误诊断 demo 把验证手段完全甩给"打开 DevTools"，页面上无任何视觉反馈                | `XFormInvalidComponent` / `XFormModelWarn` / `XFormExpressionSandbox` |
| T-2 | 错误 demo 文案偏向开发者（"[XForm][validate]" 日志前缀暴露给用户）                  | `XFormInvalidComponent`                            |
| R-5 | 业务综合 demo 的 7 大能力缺少"该点哪触发预期效果"的行内指引                         | `XFormOrderCreate`                                 |
| U-4 | XFormInvalidComponent 的 A/B/C/D/E 字段 label 只有字母，用户要自己映射到 introduction | `XFormInvalidComponent`                            |

### 1.2 目标

让"非前端用户也能独立完成 demo 验证"——把 4 项 P0 问题统一收敛到 3 类改动：

1. **新增 on-page console 反馈机制**——错误诊断 demo 在页面内可见地展示 XForm 触发 `console.error` / `console.warn` 的内容
2. **XFormOrderCreate 验证清单搬到 UI**——7 条编号指引以 ElCollapse 形式展示在 demo 顶部
3. **XFormInvalidComponent 字段 label 加预期状态后缀**——A/B/E 加"（应通过）"，C/D 加"（应警告）"

### 1.3 非目标

- 不动 `src/components/form-schema/` 内部实现
- 不重写 demo 整体架构或布局
- 不新增 demo 数量（只改 4 个 demo + 新增 3 个辅助文件）
- 不动 P1/P2 建议项（见评估报告第五节）

---

## 二、架构概览

### 2.1 数据流

```
[XForm 内部] console.error("[XForm][validate] 未注册的组件名: MyUnregisteredComp")
      │
      ▼
[useConsoleCapture] hook 拦截（onMounted）
      │  filter: message.includes("[XForm]")
      │  stringify 兜底（Error / object / string）
      │  push 到 logs: ref（最多 50 条 FIFO + 单条 500 字截断）
      ▼
[ConsoleLogPanel.vue] reactive 渲染（error 红 / warn 黄）
      │
      ▼
用户点 "清空" → emit('clear') → parent 调 logs.clear()
      │
      ▼
用户离开 demo → onUnmounted → console.error/warn 还原（强约束：避免污染全局 console）
```

### 2.2 组件树（XFormInvalidComponent.vue 改后）

```
<DemoFrame>
  <DemoField label="场景 1: 含拼写错误组件名（预期 2 个警告）">
    <XForm :schema="schema" :model="model" />
    <el-button @click="onSaveA">提交</el-button>
    <ConsoleLogPanel :logs="logs" title="XForm 控制台输出" /> ← 新增
  </DemoField>
</DemoFrame>
```

---

## 三、API 设计

### 3.1 `useConsoleCapture` composable

**文件**：`src/modules/demo/composables/useConsoleCapture.ts`

```ts
export interface CapturedLog {
  level: 'error' | 'warn'
  message: string
  timestamp: number
}

/**
 * 捕获组件生命周期内的 console.error / console.warn 到 reactive 数组
 *
 * @param prefix 仅捕获包含此前缀的日志（XForm 内部统一以 "[XForm]" 起头）
 * @returns logs reactive 数组 + clear 方法
 *
 * 边界：
 * - onMounted hook、onUnmounted 还原（避免污染全局 console）
 * - 容量上限 50 条 FIFO（高频日志防爆）
 * - 单条 message 500 字截断（防止错误堆栈撑爆页面）
 */
export function useConsoleCapture(prefix?: string): {
  logs: Ref<CapturedLog[]>
  clear: () => void
}
```

**使用示例**（XFormInvalidComponent）：

```ts
const { logs, clear } = useConsoleCapture('[XForm]')
```

### 3.2 `ConsoleLogPanel` 公共组件

**文件**：`src/modules/demo/components/ConsoleLogPanel.vue`

| Prop       | 类型              | 必填 | 说明                                                |
| ---------- | ----------------- | ---- | --------------------------------------------------- |
| `logs`     | `CapturedLog[]`   | ✅   | reactive 日志数组                                    |
| `title`    | `string`          |      | 折叠面板标题（默认 "控制台输出"）                    |
| `empty`    | `string`          |      | 无日志时占位文案（默认 "暂无日志"）                  |

| Event  | 说明                              |
| ------ | --------------------------------- |
| `clear` | 用户点击"清空"按钮；parent 调用 logs.clear() |

**视觉规则**：
- 默认折叠（与 ElCollapse 主流用法一致，不抢首屏空间）
- error 红色 / warn 黄色
- 渲染层：单条 message > 200 字符截断 + 提示"已截断"（UI 可读性）
  - 注：捕获层已有 500 字截断（见 §3.1），此处为视图层二次截断
- 底部"清空"按钮（仅 logs.length > 0 时显示）

---

## 四、文件清单（src/ 写操作）

### 4.1 新增（3 个）

| #   | 路径                                                       | 行数预估 | 类型     | 备注                                                          |
| --- | ---------------------------------------------------------- | -------- | -------- | ------------------------------------------------------------- |
| 1   | `src/modules/demo/composables/useConsoleCapture.ts`         | ~60      | composable | 单一职责：捕获 + 暴露数据，不渲染 UI                           |
| 2   | `src/modules/demo/composables/useConsoleCapture.spec.ts`    | ~80      | spec      | 4 个测试用例：hook 生效 / 容量上限 / 卸载还原 / prefix 过滤    |
| 3   | `src/modules/demo/components/ConsoleLogPanel.vue`          | ~50      | 组件       | BEM 命名空间 `console-log-panel`（kebab-case）                |

> 3 个新增全部归 `src/modules/demo/` 已有子目录下，符合 `CLAUDE.md §1.2` 模块边界铁律。

### 4.2 修改（4 个）

| #   | 路径                                                         | 改动行数预估 | 改动内容                                                                                                              |
| --- | ------------------------------------------------------------ | ------------ | --------------------------------------------------------------------------------------------------------------------- |
| 1   | `src/modules/demo/examples/XFormInvalidComponent.vue`         | +20          | ① 5 个字段 label 加括号后缀（"（应通过）"/"（应警告）"）② 引入 `useConsoleCapture` + `ConsoleLogPanel`               |
| 2   | `src/modules/demo/examples/XFormModelWarn.vue`                | +15          | 引入 `useConsoleCapture` + `ConsoleLogPanel`，展示 3 个场景的 [XForm] 警告                                              |
| 3   | `src/modules/demo/examples/XFormExpressionSandbox.vue`        | +15          | 引入 `useConsoleCapture` + `ConsoleLogPanel`，展示沙箱拒绝原因（"document 不可用"等）                                  |
| 4   | `src/modules/demo/examples/XFormOrderCreate.vue`              | +25          | 顶部加 `<el-collapse>` 验证指引面板（默认折叠），7 条编号指引从 `<script>` 注释搬到 UI                                   |

> 4 个修改文件均属于 `examples/` 子目录，符合 `CLAUDE.md §2.3` 例外条款（用户明确指定 demo 文件）。

---

## 五、具体改动细节

### 5.1 `XFormInvalidComponent.vue` 字段 label 调整

| 字段                  | 原 label                  | 新 label                                                |
| --------------------- | ------------------------- | ------------------------------------------------------- |
| A. 已知 EL 短名        | `'A. 已知 EL 短名'`        | `'A. 已知 EL 短名（应通过）'`                            |
| B. 已知 EL 全名        | `'B. 已知 EL 全名'`        | `'B. 已知 EL 全名（应通过）'`                            |
| C. 拼写错误 Inpurt      | `'C. 拼写错误（Inpurt）'`  | `'C. 拼写错误 Inpurt（应警告）'`                          |
| D. 未注册自定义组件     | `'D. 未注册自定义组件'`    | `'D. 未注册自定义组件（应警告）'`                        |
| E. 已注册 MyCustomInput | `'E. 已注册 MyCustomInput'`（inner 字段）  | `'E. 已注册 MyCustomInput（应通过）'`                  |

> 同步调整 introduction 文案："字段 A（应通过）、B（应通过）、E（应通过）不触发警告；字段 C（应警告）、D（应警告）触发警告"。

### 5.2 `XFormOrderCreate.vue` 验证指引面板

```vue
<el-collapse v-model="guideActive">
  <el-collapse-item title="📋 验证指引（7 步覆盖 XForm 7 大能力）" name="guide">
    <ol :class="bem.e('guide')">
      <li>客户名/电话都留空 → 点保存 → 提示「客户名称、联系电话至少填一个」</li>
      <li>填电话 13800 → blur → 红字「手机号格式不正确」</li>
      <li>城市选「北京」→ 区域 options 自动加载</li>
      <li>开「需要发票」→ 发票抬头显示 + 必填；关闭 → 隐藏</li>
      <li>点「新增明细」→ 加一行；删到 1 行时删除按钮禁用</li>
      <li>填几个字段 → F5 刷新 → 点「恢复草稿」→ 数据恢复 + isDirty 重置</li>
      <li>改任意字段 → isDirty=true（isDirty 与 getDirtyFields 实时同步）</li>
    </ol>
  </el-collapse-item>
</el-collapse>
```

`guideActive` 初始为空数组（默认折叠）；用户展开后写入 `'guide'`，刷新页面后回到折叠状态（无需持久化）。

### 5.3 introduction 文案统一修订（4 个 demo）

| demo                       | introduction 修订要点                                                                                                          |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| XFormInvalidComponent       | "字段 A（应通过）、B（应通过）、E（应通过）不触发警告；字段 C（应警告）、D（应警告）触发警告。"——把字母→场景→期望状态的映射直接说出来    |
| XFormModelWarn              | 把"打开 DevTools Console 查看"改为"页面下方控制台输出区会显示 XForm 的警告"                                                    |
| XFormExpressionSandbox      | 把"打开 devtools 看 console.error"改为"页面下方控制台输出区会显示沙箱拒绝原因"                                                  |
| XFormOrderCreate            | introduction 加"点击上方「验证指引」按步骤验证"                                                                                  |

---

## 六、错误处理 & 边界

| 场景                                  | 处理                                                                                            |
| ------------------------------------- | ----------------------------------------------------------------------------------------------- |
| useConsoleCapture 重复 mount          | 每次调用独立保存 originalError/originalWarn + 独立 onUnmounted 还原；多个 demo 同时挂载互不干扰 |
| console.error 被业务其他代码覆盖       | stringify 兜底（Error → message；其他 → JSON.stringify 失败时 String() 转换）                    |
| 日志刷爆（高频 error）                 | MAX_LOGS=50 上限 + FIFO 丢弃；UI 显示"[已截断]"提示溢出                                          |
| 组件未挂载就调用 clear                 | logs 是 ref，clear() 仅重置数组，无副作用                                                          |
| filter 误配置（prefix 空）              | 默认不传 prefix → 捕获所有 error/warn；调用方按需传前缀（XForm demo 统一传 `'[XForm]'`）            |
| DemoField/DemoFrame 嵌套 ConsoleLogPanel | ConsoleLogPanel 只接受 logs reactive 引用 + emit clear——不依赖父组件特定 API                   |
| 数组 demo（schema 含 array 节点）下日志 | 单次 console.error 可能含数组元素——500 字截断足以覆盖                                           |

---

## 七、测试策略

### 7.1 单元测试（`useConsoleCapture.spec.ts`，新增）

| 用例                                                | 验证                                                                       |
| --------------------------------------------------- | -------------------------------------------------------------------------- |
| `console.error('test')` → logs 包含 1 条            | hook 生效                                                                   |
| 连续 60 次 `console.error` → logs.length ≤ 50        | FIFO 上限                                                                    |
| 单条 message > 500 字 → logs 单条被截断 + "...[已截断]" | 截断逻辑                                                                     |
| onUnmounted 后再调 console.error → logs 不增长 + 原 console.error 行为还原 | 卸载清理（避免全局污染）                                                  |
| prefix='[XForm]' 时调 `console.error('foo')` → logs 空 | prefix 过滤生效                                                            |
| 同时调 error 和 warn → logs 同时含两种 level          | 多 level 捕获                                                                |

### 7.2 手动 visual 验证

操作清单（实施完成后由用户在 demo 站点执行）：

| #   | 验证项                                                                       |
| --- | ---------------------------------------------------------------------------- |
| 1   | 打开 `/demo/x-form-invalid-component` → 折叠面板默认折叠；展开后看到 2 条红字日志（Inpurt + MyUnregisteredComp） |
| 2   | 字段 label 显示"（应通过）" / "（应警告）"对照清晰                                |
| 3   | 打开 `/demo/x-form-model-warn` → 场景 1 自动显示 [XForm] model 警告；场景 2/3 不显示 |
| 4   | 打开 `/demo/x-form-expression-sandbox` → 安全测试字段变更后显示沙箱拒绝原因       |
| 5   | 打开 `/demo/x-form-order-create` → 顶部折叠面板默认折叠；展开后看到 7 条编号指引  |
| 6   | 离开任一 demo 再回到其他页面 → 全局 console.error 行为未被污染                  |

---

## 八、风险 & 回退

| 风险                                  | 缓解                                                                                                |
| ------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 修改 console 全局 hook 影响其他 demo   | 每个 demo 独立 useConsoleCapture 实例 + onUnmounted 还原——已在 §六列出                               |
| 新增 composable 引入新的依赖方向       | 仅依赖 `vue`（ref/onMounted/onUnmounted），无新增第三方包                                             |
| ConsoleLogPanel BEM 命名与其他 demo 组件冲突 | 用 `console-log-panel`（已有 DemoField/ApiTable/DemoFrame 等组件命名风格相近）；BEM 前缀默认 `vv-`     |
| ElCollapse 引入新组件依赖               | element-plus 已在项目依赖中（`ElMessage`/`ElButton` 等已大量使用）                                   |

**回退方案**：7 个文件独立可改；任何一个 demo 改动失败可单独 revert，不影响其他 demo。

---

## 九、验收标准

满足以下全部条件视为 P0 三项完成：

- [ ] `useConsoleCapture.ts` / `useConsoleCapture.spec.ts` / `ConsoleLogPanel.vue` 3 个新文件存在
- [ ] `useConsoleCapture.spec.ts` 全部 6 个测试用例通过（覆盖率 ≥ 80%）
- [ ] `pnpm type-check:full` 通过
- [ ] `pnpm lint` 通过
- [ ] 4 个 demo 文件改动行数 ≤ 报告中的预估（+20 / +15 / +15 / +25）
- [ ] 手动 visual 验证清单 6 项全部通过
- [ ] `CHANGELOG.md` 记录本次变更（4 demo 改 + 3 新文件）

---

## 十、待确认事项

> 已通过 brainstorming 与用户对齐 3 个核心决策：

| Q   | 决策                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------- |
| Q1  | useConsoleCapture 不捕获 `console.log`（info 级）——XForm 内部只用 error/warn                          |
| Q2  | ConsoleLogPanel 默认折叠（不抢首屏空间）                                                              |
| Q3  | 3 个 demo 共用同一个 `<ConsoleLogPanel>` 组件（避免复制粘贴）                                          |

---

**下一步**：调用 `superpowers:writing-plans` skill 生成实现计划。
