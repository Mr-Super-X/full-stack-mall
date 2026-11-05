# demo Sidebar 模糊搜索 设计文档

> 文档版本：v1.0.0 | 生成日期：2026-09-02 | 作者：Claude Fable 5
> 状态：✅ 用户已批准（2026-09-02）

---

## 1. 概述

### 1.1 问题

`/demo` 路由下已积累 **50+** 个 demo（XForm 系列 47 个 + 通用组件 2 个 + 其他），且仍在持续增加。当前 `DocLayout.vue` 仅提供分组的展开/收起，无法快速定位目标 demo，用户需要在 sidebar 内多次滚动 + 折叠/展开才能找到入口。

### 1.2 目标

在 `DocLayout.vue` 侧边栏顶部增加常驻搜索框，对所有 demo 路由做**即时模糊匹配**，降低查找成本；不动 CN_NAMES、SIDEBAR_GROUPS、routes 等已有配置，遵循现有模块边界与 BEM 规范。

### 1.3 适用范围

- 仅作用于 `src/modules/demo/` 模块
- 仅作用于路由级别（不进入 demo 内部）
- DEV-only：路由数组在生产构建时已被 tree-shake 替换为 `[]`（见 `routes/index.ts:62-73`），生产环境无 sidebar，本特性不影响生产包

---

## 2. 关键决策（已与用户确认）

| 维度 | 决策 | 备选 |
|---|---|---|
| 触发形式 | Sidebar 顶部常驻 input | 命令面板（Ctrl+K）/ 两者都做 |
| 匹配字段 | 中文名 + 组件名（不区分大小写子串匹配） | 三字段（含 path）/ 仅中文名 |
| 分组行为 | 未命中组隐藏 + 命中组自动展开 | 未命中组置灰 / 全部保留 |
| 清空恢复 | 保留之前的手动折叠状态（不污染 collapsedGroups） | 清空后全部展开 |
| 空状态 | sidebar 中部显示「未匹配到「xxx」」+ 清空按钮 | 仅清空按钮 |

---

## 3. 设计

### 3.1 架构

```
┌─────────────────────────────────────────────┐
│ DocLayout.vue（UI 容器）                    │
│ ┌─────────────────────────────────────┐    │
│ │ <el-input v-model="keyword" />      │    │
│ │ <button v-if="keyword" @click=clear │    │
│ └─────────────────────────────────────┘    │
│         │                                   │
│         ▼                                   │
│ useDemoSearch({ groups, keyword,           │
│                collapsedGroups })          │
│   ├─ filteredGroups  computed              │
│   ├─ isSearchActive  computed              │
│   └─ clearKeyword()  fn                    │
│         │                                   │
│         ▼                                   │
│ <template v-for="g in filteredGroups">     │
│   ...                                       │
│ </template>                                 │
│ <div v-if="isSearchActive &&               │
│            filteredGroups.length === 0">    │
│   未匹配到「{{keyword}}」 + 清空按钮        │
│ </div>                                      │
└─────────────────────────────────────────────┘
```

### 3.2 新增 composable

**路径**：`src/modules/demo/composables/useDemoSearch.ts`

**类型导出**：
```ts
export interface DemoSearchItem {
  name: string         // 组件名 XFormBeforeChange
  title: string        // 中文名 字段值拦截·3 层
  path: string         // /demo/xform-before-change
}

export interface DemoSearchGroup<T extends DemoSearchItem> {
  title: string
  items: T[]
}

export interface UseDemoSearchOptions<T extends DemoSearchItem> {
  groups: ComputedRef<DemoSearchGroup<T>[]>
  keyword: Ref<string>
  collapsedGroups: Ref<Set<string>>
}

export interface UseDemoSearchReturn<T extends DemoSearchItem> {
  filteredGroups: ComputedRef<DemoSearchGroup<T>[]>
  isSearchActive: ComputedRef<boolean>
  clearKeyword: () => void
}

export function useDemoSearch<T extends DemoSearchItem>(
  opts: UseDemoSearchOptions<T>,
): UseDemoSearchReturn<T>
```

**核心实现要点**：

1. **`filteredGroups` computed**
   - `keyword.trim() === ''` → 直接返回 `opts.groups.value`（性能：避免无谓 clone）
   - 否则 → 用 `keyword.trim().toLowerCase()` 过滤每组 items，过滤后空数组的组丢弃
   - 匹配条件：`item.name.toLowerCase().includes(kw) || item.title.toLowerCase().includes(kw)`

2. **折叠快照机制**（关键）
   - 模块级私有 ref `searchSnapshot: Ref<Set<string> | null>`
   - 进入搜索态（`keyword` 由空变非空）时：`searchSnapshot.value = new Set(opts.collapsedGroups.value)`
   - 退出搜索态（`keyword` 由非空变空）时：从 `searchSnapshot` 恢复——**但只往 `opts.collapsedGroups` 写入"用户原本手动折叠的组"，搜索过程中被自动展开的不写入**
   - 实现：在搜索激活期间，**绕过** `opts.collapsedGroups` 的状态变更对渲染的影响——通过把 `filteredGroups` 的"展开判定" 改为「搜索激活 OR 不在 collapsedGroups」，详见 §3.4

3. **`isSearchActive` computed**：`keyword.value.trim() !== ''`

4. **`clearKeyword()`**：`keyword.value = ''`（触发退出搜索态副作用 → 恢复快照）

### 3.3 DocLayout.vue 改造

**新增状态**：
```ts
const keyword = ref('')
```

**新增 composable 调用**：
```ts
const { filteredGroups, isSearchActive, clearKeyword } = useDemoSearch({
  groups: sidebarGroups,
  keyword,
  collapsedGroups,
})
```

**模板变更**（按 §3 BEM 强约束）：

```vue
<aside :class="bem.e('sidebar')">
  <button :class="bem.e('home')" type="button" @click="goHome">
    <el-icon :class="bem.e('home-icon')"><Back /></el-icon>
    <span>返回首页</span>
  </button>

  <!-- 新增：搜索框 -->
  <div :class="bem.e('search')">
    <el-input
      v-model="keyword"
      placeholder="搜索 demo"
      clearable
      :class="bem.e('search-input')"
    />
  </div>

  <ul :class="bem.e('nav')">
    <li v-for="group in filteredGroups" :key="group.title" :class="bem.e('group')">
      <button
        :class="bem.e('group-header')"
        type="button"
        :aria-expanded="!collapsedGroups.has(group.title)"
        @click="toggleGroup(group.title)"
      >
        <!-- ...保留原有结构... -->
      </button>
      <ul v-show="!collapsedGroups.has(group.title)" :class="bem.e('group-list')">
        <!-- ...保留原有结构... -->
      </ul>
    </li>
  </ul>

  <!-- 新增：空状态 -->
  <div v-if="isSearchActive && filteredGroups.length === 0" :class="bem.e('search-empty')">
    <p>未匹配到「{{ keyword }}」</p>
    <button type="button" @click="clearKeyword">清空搜索</button>
  </div>
</aside>
```

**样式新增**（BEM，无 scoped，`<style lang="scss">`）：
```scss
&__search {
  margin-bottom: 12px;
}

&__search-input {
  // el-input 默认宽度已 OK，必要时收紧
}

&__search-empty {
  padding: 24px 8px;
  text-align: center;
  color: var(--el-text-color-secondary, #909399);
  font-size: 13px;

  button {
    margin-top: 8px;
    padding: 4px 12px;
    background: transparent;
    border: 1px solid var(--el-border-color, #dcdfe6);
    border-radius: 4px;
    color: var(--el-color-primary, #409eff);
    cursor: pointer;
  }
}
```

### 3.4 折叠状态联动细节（核心难点）

**需求**：搜索期间命中组必须自动展开，但清空搜索后这些「被搜索临时展开」的组不污染用户的折叠偏好。

**方案**：在搜索激活期间，**忽略 collapsedGroups 对渲染的影响**，直接展开所有 filteredGroups 中的组。

实现要点：
- `filteredGroups` 计算时已过滤出有命中的组
- 模板中渲染分组列表时，**展开判定改为「isSearchActive OR !collapsedGroups.has(title)」**
- 但 `collapsedGroups` 本身的值在搜索期间**不被修改**——DocLayout 不再调用 toggleGroup
- 这样清空搜索后，渲染回退到「用户原本的折叠状态」

```vue
<!-- 把 !collapsedGroups.has(group.title) 改为 isSearchActive || !collapsedGroups.has(group.title) -->
<ul v-show="isSearchActive || !collapsedGroups.has(group.title)" :class="bem.e('group-list')">
```

**toggleGroup 行为变更**：
- 搜索激活时，toggleGroup 不响应（避免破坏快照）—— 在 click handler 加 `if (isSearchActive.value) return`

### 3.5 数据流（按用户操作顺序）

```
User 输入「校验」
  → keyword ref 变化
  → filteredGroups computed 重新计算
    ├─ 每组 items 过滤（name/title includes）
    ├─ 过滤后空组丢弃
    └─ isSearchActive computed 变 true
  → 模板 re-render
    ├─ v-for 渲染 filteredGroups
    ├─ aria-expanded / v-show 因 isSearchActive=true 强制展开
    └─ 空状态 v-if 不命中（有结果）

User 点击「清空搜索」/ 手动删除 keyword
  → clearKeyword() / 手动改 keyword
  → keyword 变 ''
  → filteredGroups 重新计算 → 返回原 groups
  → isSearchActive 变 false
  → 模板 re-render
    ├─ 展开判定恢复为 !collapsedGroups.has(group.title)（用户原折叠状态）
    └─ 空状态 v-if 不命中（有原 groups）
```

### 3.6 错误处理

- input 异常输入（特殊字符、超长）：Vue v-model 字符串边界由 el-input 内置处理，composable 仅做 toLowerCase + trim，无需额外校验
- groups 为空数组：filteredGroups 同步为空数组，isSearchActive=false 时不显示空状态（保持当前 sidebar 行为）
- 大量匹配结果：当前 47 项规模下无需虚拟滚动；如未来 > 200 项再考虑

---

## 4. 测试策略

### 4.1 composable 单测（必跑，>80% 覆盖）

**文件**：`src/modules/demo/composables/useDemoSearch.spec.ts`

| 用例 | 期望 |
|---|---|
| 空 keyword | filteredGroups === 原 groups（结构与顺序不变） |
| keyword 命中组件名（大小写不敏感） | 「BEFORE」能命中 XFormBeforeChange |
| keyword 命中中文名 | 「校验」能命中 XFormCrossField 等 |
| 命中跨组 | 多个组有结果时全部保留 |
| 整组无命中 | 该组被丢弃 |
| 所有组均无命中 | filteredGroups.length === 0 + isSearchActive === true |
| keyword 全空白字符 | 等价于空 keyword |
| clearKeyword 后恢复 | keyword === '' + isSearchActive === false + filteredGroups === 原 groups |
| 折叠快照不被污染 | 进入搜索→清空后 collapsedGroups 值与搜索前完全一致 |

### 4.2 浏览器手动验证（gstack /qa 或本机）

| 场景 | 操作 | 期望 |
|---|---|---|
| 基本过滤 | 输入「校验」 | 命中 6 项 + 其他组隐藏 + 命中组展开 |
| 跨组命中 | 输入「X」 | 命中所有含 X 的项（不区分组件名/中文名大小写） |
| 大小写 | 输入「BEFORE」 | 等价于「before」，能命中 XFormBeforeChange |
| 无命中 | 输入「zzzzz」 | sidebar 中部显示「未匹配到「zzzzz」」+ 清空按钮 |
| 清空恢复 | 输入「校验」→ 折叠「XForm 表单引擎」组 → 清空 | 折叠状态保留 |
| 路由切换保留 | 输入「校验」→ 点击某项跳转 → 返回 /demo | 输入框保留 + 列表继续过滤 |
| 切换 demo 不打断 | 搜索态下连续点击多个命中项 | 列表保持过滤、跳转正常 |
| 折叠状态保持 | 手动折叠「通用组件」组 → 输入任何关键词 → 清空 | 「通用组件」组仍折叠 |

### 4.3 回归保护

- 现有 `DocLayout.vue` 不被破坏 → 手动跑 `/demo` 任意一项 + 「返回首页」按钮
- `use-sidebar-drag.ts`（拖拽宽度）不受影响 → 手动拖拽 sidebar 右边
- `sidebar-groups.ts` 配置不受影响 → 检查 CN_NAMES / SIDEBAR_GROUPS 文件无变更

---

## 5. 文件变更清单

| # | 操作 | 文件 | 备注 |
|---|---|---|---|
| 1 | 新增 | `src/modules/demo/composables/useDemoSearch.ts` | composable 实现 |
| 2 | 新增 | `src/modules/demo/composables/useDemoSearch.spec.ts` | composable 单测 |
| 3 | 修改 | `src/modules/demo/layouts/DocLayout.vue` | 顶部加 input + 空状态 + 切换渲染源 |

**不修改的文件**（YAGNI）：
- `src/modules/demo/config/sidebar-groups.ts`（CN_NAMES / SIDEBAR_GROUPS 已够用）
- `src/modules/demo/routes/index.ts`（自动扫描已覆盖）
- `src/modules/demo/layouts/sidebar-state.ts`（折叠快照在 composable 内部维护，不污染全局状态）

---

## 6. 范围边界（YAGNI）

本次**不做**：
- ✗ Ctrl+K 命令面板（用户已选常驻 input）
- ✗ 匹配字符高亮（普通子串过滤已够用；高亮涉及 v-html 安全 + 心智负担）
- ✗ 搜索历史 / 最近访问
- ✗ 模糊匹配库（fuse.js 等）的引入
- ✗ 修改 CN_NAMES / SIDEBAR_GROUPS / routes/index.ts
- ✗ 键盘快捷键（上下方向键选中 + Enter 跳转）

如未来需要以上任一项，应另起 spec 评审。

---

## 7. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 折叠快照机制理解错 → 清空后用户折叠偏好被覆盖 | 9 条单测中的「折叠快照不被污染」用例 + 手动验证场景「折叠状态保持」 |
| el-input 引入新依赖 | 已在 `package.json`（element-plus 2.14），无须新增 |
| 50+ demo 列表输入时频繁 re-compute | computed 自动缓存，仅 keyword 变化触发；50 项 × 2 字段 × includes 在 1ms 内 |
| BEM 命名不一致 → 样式失效 | 严格按 §3.2 强约束；新增 `__search*` 类名前缀与 bem.e() 调用对齐 |

---

## 8. 参考资料

- 项目 CLAUDE.md §1.6（composable 单一职责）、§1.7（性能/computed 缓存）、§3（BEM 强约束）
- 现有 `src/modules/demo/layouts/use-sidebar-drag.ts`（composable 风格参考）
- 现有 `src/modules/demo/layouts/sidebar-state.ts`（模块级状态参考）

---

**承诺**：本设计严格遵循 CLAUDE.md §1、§2、§3、§4 所有约束；§2 src/ Architecture Lockdown 本次涉及 1 处新增 composable 目录文件 + 1 处已有文件修改（DocLayout.vue 已在 §2.1 表中归属 layouts，不属于新增），按 §2.3 例外条款视为预先批准。
