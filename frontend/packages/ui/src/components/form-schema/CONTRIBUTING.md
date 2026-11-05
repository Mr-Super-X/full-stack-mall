# 贡献指南(Contributing Guide)

> 给 `form-schema` 组件库(及其他中后台模块)贡献者。读完本篇能:
>
> - 知道**如何新增 composable / 渲染分支 / 校验规则 / 自定义组件**
> - 理解项目的**模块边界铁律**(避免破坏 `src/` Architecture Lockdown)
> - 跑通**完整的开发-测试-审查流程**

如果本篇与代码冲突,**以代码为准**;冲突点欢迎提 PR 修正本文件。

---

## 一、开发流程总览

```text
1. 阅读本指南 + 对应模块的 `ARCHITECTURE.md`(form-schema 为 `src/components/form-schema/ARCHITECTURE.md`)
2. 在 .claude/backups/<方案名>/ 备份待修改文件(方案隔离)
3. Grep / Glob 定位相关代码 + Read 上下文
4. Edit 精准修改(老文件用 Edit, 新文件用 Write)
5. 每完成一个文件 → 自检清单(本指南 §六) + pnpm test 该文件 spec
6. 完成 → 派发 code-reviewer 独立审查
7. 全过 → 跑完整套件 + type-check:full
8. 写中文 commit msg → 提交(用户明确同意后)
```

---

## 二、新增 composable(form-schema)

### 2.1 何时该新建 composable

- 一个能力可独立测试
- 文件 ≤80 行(硬约束,见 CLAUDE.md §4)
- 单一职责(不混合状态/副作用/渲染)

### 2.2 新建步骤

1. **创建文件**:`composables/use-<name>.ts`
2. **命名规范**:`use` 前缀 + camelCase,导出函数 `use<Name>`
3. **接口定义**:导出 `Use<Name>Options` / `Use<Name>Return` 类型
4. **JSDoc 注释**:遵循 comments.md(4 层结构 + IDE 智能提示 5 条陷阱)
5. **避免隐式依赖**:通过 `deps` 显式注入(避免 provide/inject 在 setup 嵌套中失效)
6. **配套测试**:`composables/use-<name>.spec.ts`(覆盖正向/反向/边界)

### 2.3 编排(composition root)

新增 composable 后,需要在 `use-xform-composer.ts` 装配:

```ts
// 在 useXFormComposer 内部,其他 composable 调用附近
const myComposable = useMyComposable({
  /* 显式 deps */
})

// 把返回值 spread 到最终 return
return {
  ...,
  ...myComposable,
}
```

### 2.4 拆分已有大 composable

如果发现 `use-xxx.ts` > 80 行,**先评估**:

- 是**多职责**还是**单职责但实现复杂**?
- 多职责 → 拆为 `useXxxSubA` / `useXxxSubB`,新增 `useXxxRoot` 装配
- 单职责但复杂 → 在内部用 helper 函数拆分(无需新建 composable)

---

## 三、新增渲染分支(form-schema)

> 适用场景:需要支持新的节点类型(如 Tabs / Steps / Tree)

### 3.1 当前 5 类分支(已有)

| 分支          | 文件                                      | 触发条件                                        |
| ------------- | ----------------------------------------- | ----------------------------------------------- |
| 数组节点      | `render-array-node.ts`                    | `node.kind === 'array'`                         |
| 视觉容器      | `render-visual-container.ts`              | 无 name + 有 slots / children                   |
| FormItem 包裹 | `render-form-item.ts`                     | `node.name !== undefined && formItem !== false` |
| Row+Column    | `render-form-item.ts:renderWithRowColumn` | `node.row !== undefined`                        |
| 默认分支      | 同文件 + `wrap-with-elcol.ts`             | 兜底                                            |

### 3.2 新增分支步骤

1. **新建文件**:`composables/render-<name>-node.ts`,导出 `render<Name>Node(node, opts)`
2. **在 `render-schema-node.ts` 加分支**:主调度 `renderToComponentInner` 中追加 if-else
3. **类型扩展**:在 `types/schema-node.ts` 添加 `node.kind?: 'your-kind'` + 对应 config 类型
4. **测试**:在 `render-schema-node.spec.ts` 加新分支用例
5. **demo**:在 `src/modules/demo/examples/` 加演示

### 3.3 避免分支顺序错乱

新增分支必须放在默认分支**之前**,并保证**第一个返回非 undefined 的胜出**。

---

## 四、新增校验规则(form-schema)

### 4.1 当前支持的校验类型

- async-validator 兼容字段(`required` / `pattern` / `min` / `max` / `validator`)
- 跨字段 `crossValidator` + `dependsOn` + `debounceMs`
- zod 整体 schema 校验(`zodSchema` prop)

### 4.2 新增字符串规则(如 `'phone'`)

1. **字符串 → RuleItem 映射**:在 `compile-rules.ts:warnUnknownRule` 旁的查表逻辑添加
2. **文档说明**:在 `xform-demos-api.ts` 的 ruleItems 数组加字段描述
3. **测试**:在 `compile-rules.spec.ts` 加用例

### 4.3 新增跨字段规则

1. **修改 `types/rule.ts`**:在 `RuleItem` 接口加字段
2. **修改 `use-cross-field-rule-trigger.ts`**:消费新字段
3. **测试**:在 `use-cross-field-rule-trigger.spec.ts` 加用例

---

## 五、新增自定义组件(form-schema)

### 5.1 注册组件名 + Props 类型

1. **在 `adapters/element-plus-adapter.ts` 添加短名映射**(如果包装 EL 组件)
2. **通过 TS module augmentation 扩展**:

```ts
// types.d.ts 或任意 .d.ts
declare module '@/components/form-schema/types' {
  interface ComponentPropsRegistry {
    MyInput: MyInputProps
  }
}
```

3. **测试**:在 `adapters/element-plus-adapter.spec.ts` 加用例

### 5.2 使用时通过 components prop 注册

```vue
<XForm :schema="schema" :components="{ MyInput }" />
```

---

## 六、自检清单(每次代码完成后)

```
——代码质量——
□ Edit 变更范围精准,未误删/改周围无关代码
□ import 路径在项目中可解析
□ 函数 ≤80 行(单文件 ≤400 行,前端组件 ≤300 行)
□ Hook / Composable ≤80 行,一文件一能力
□ 无 any(用 unknown + 类型守卫)
□ 无 @ts-ignore / @ts-expect-error(或已附跳过原因注释)

——防御性编程——
□ 异步组件显式处理 Loading / Error / Empty 三态
□ 异常处理无静默吞错(catch 块非空且有日志/提示)
□ 命名清晰(单一职责)、避免硬编码、无重复代码(DRY)

——输出规范——
□ 修改 ≥50 行 → 代码前已给 ≤3 行变更摘要
□ 文档同步(CHANGELOG.md / docs/)
□ commit msg 中文,符合 conventional commits

——验证闭环——
□ 原报错场景消失
□ 上下游相关功能未受影响(pnpm test src/components/form-schema)
□ git diff 无意外变更
□ type-check:full 通过(0 errors)
□ lint 通过(0 warnings)
```

---

## 七、模块边界铁律(CLAUDE.md §1.2)

| 层级                | 允许引用                                      | 不允许引用              |
| ------------------- | --------------------------------------------- | ----------------------- |
| `modules/<m>/views` | 本模块 components / composables / utils / api | 其他模块内部            |
| `components/common` | utils / enums / types / store/modules         | 任何 `modules/`         |
| `store/modules`     | api / utils / enums                           | `modules/`              |
| `utils/`            | -                                             | Vue / Pinia(与框架解耦) |

**模块间通信**走 `modules/<m>/index.ts` 对外接口。

---

## 八、src/ Architecture Lockdown(CLAUDE.md §2)

### 8.1 禁止行为(未经用户明确批准)

- ❌ 新增 / 删除 / 重命名 / 移动 `src/` 下任何文件
- ❌ 改变 `src/` 任何目录的职责定位

### 8.2 例外条款

用户在当前轮对话中**明确指定**目标文件路径(格式如「在 `src/xxx/yyy.ts` 加 xxx」),视为已对**该单次操作**预先批准。

### 8.3 修改申请模板(如需变更 src/ 结构)

```markdown
【src 修改申请】<方案名>

- 操作类型:[新增 / 删除 / 重命名 / 移动 / 改职责]
- 目标路径:src/xxx/yyy
- 原因:[业务原因,≤2 句]
- 影响面:[影响哪些模块]
- 备选:[其他归属方案]
- 回退:[如何恢复]
```

等用户单独批准后才能动手。

---

## 九、commit 规范(用户明确同意时)

```
<type>: <description>

<可选正文>
```

类型:`feat` / `fix` / `refactor` / `docs` / `test` / `chore` / `perf` / `ci`

示例:

```
fix(form-schema): validateField 失败时通过 errorBus 上报(原 silent catch)
```

---

## 十、回退方案

任何修改前,在 `.claude/backups/<方案名>/<日期>/` 备份待修改文件 + 写 manifest.txt:

```
[MODIFY] src/components/form-schema/composables/use-xform-composer.ts
[NEW]    src/components/form-schema/composables/use-xform-render.ts
```

回退:

```bash
cp -r .claude/backups/<方案名>/<日期>/* src/
```

---

## 十一、CLAUDE.md 必读章节

贡献前**必须**读:

- §1.2 模块边界铁律
- §1.6 AutoImport 约定
- §2 src/ Architecture Lockdown(最严格)
- §3 组件 BEM 编写规范(写 .vue 文件时)
- §4 代码编写规范(KISS / DRY / YAGNI)
- §5 代码注释规范(4 层结构 + IDE 智能提示)
- §七 工程纪律(方案隔离、npm 验证、不擅自 commit)

---

## 十二、获得帮助

- **架构理解**:读对应模块的 `ARCHITECTURE.md`(form-schema 为 `src/components/form-schema/ARCHITECTURE.md`)
- **类型 cast 归因**:读 `src/components/form-schema/types/TYPE-CAST-AUDIT.md`
- **API 用法**:读 `src/components/form-schema/README.md`
- **Bug 调试**:派发 `superpowers:systematic-debugging` skill
- **代码审查**:派发 `code-reviewer` agent
