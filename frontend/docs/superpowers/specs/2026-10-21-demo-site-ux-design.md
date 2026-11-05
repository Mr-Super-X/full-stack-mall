# Demo 站点体验优化设计（侧栏滚动重置根治 + EP 文档风 UI）

> **日期**：2026-10-21 | **分支**：feature/engine-optimization | **状态**：已确认（用户批准）
>
> **问题来源**：demo 站（/demo/*）是项目最重要的功能展示面，当前体验有两个痛点：
> 1. 左侧菜单点击切换路由时**侧边栏自身滚动位置重置**（已确认是痛点 B，非主内容区问题）
> 2. 整体 UI 质感不足，大量硬编码颜色，未对标官方文档站

---

## 1. 背景与根因

### 1.1 现状结构

每个 demo 页（`src/modules/demo/examples/**`，113 个文件）**自包** `<DocLayout>`：

```
/demo/:demoName 路由切换
  └─ 页面 A（内含 <DocLayout> 实例 ①）→ 页面 B（内含 <DocLayout> 实例 ②）
       整棵树卸载重挂载：sidebar scrollTop / 搜索词归零
```

- `DocLayout.vue` 的侧栏是 `position: sticky + overflow-y: auto` 独立滚动容器
- 宽度（`sidebarWidth`）与折叠状态（`collapsedGroups`）已是模块级 state（跨页保留）
- **但 DOM 滚动位置、搜索关键词是组件局部状态 → 随重挂载丢失**（用户确认痛点）

### 1.2 根因

路由切换 → 不同页面组件 → 不同 `DocLayout` 实例 → 侧栏 DOM 重建。不是 scrollBehavior 问题（主内容区滚回顶部是符合预期的文档站行为，用户未选此项）。

## 2. 方案决策（已确认）

### 2.1 滚动修复：路由级持久布局（方案 A）

已否决方案 B（记录/恢复 scrollTop）：治标，搜索词/焦点等仍会丢，维护两套状态。

### 2.2 视觉方向：Element Plus 官网文档风（方向 A）

已否决方向 B（深色侧栏）、方向 C（只打磨细节不动风格）。

用户选定优化范围：**A 视觉质感 + B 交互细节 + D 对标官方文档站**（不含布局结构重排，三栏 grid 保留）。

## 3. 架构设计

### 3.1 目标结构

```
/demo (父路由，component 改为 DemoDocs.vue)
  └─ DemoDocs.vue（新增 · 路由级布局 · 跨子路由永久驻留）
       └─ DocLayout（sidebar | resizer | main | toc 三栏结构不变）
            ├─ main → <RouterView />        ← 子路由唯一渲染点
            └─ toc  → <DocToc :items="currentToc" />
```

**效果**：侧栏滚动位置、搜索词、拖拽宽度、折叠偏好全部跨页天然保留（组件不重挂载）。

### 3.2 toc 跨层通信（数据驱动，不用 Teleport / 具名视图）

新增 `src/modules/demo/composables/useDocToc.ts`：

- 模块级 `currentToc: Ref<{ id: string; label: string }[]>`（shallowRef，初始 `[]`）
- 导出 `useDocToc(items: TocItem[]): void`：写入 `currentToc`，并在 `onUnmounted` 时清除（防止页面卸载后 toc 残留）
- DemoDocs.vue 直接渲染 `<DocToc :items="currentToc">`（无 items 时 DocToc 自身 `v-if` 不渲染）

**取舍理由**：toc items 是纯数据（所有 113 页均用 `<DocToc :items="...">`）；数据驱动比 Teleport（选择器魔法、时序依赖）和具名视图（路由记录需静态组件，与 extractApi 运行时计算冲突）都简单。

### 3.3 路由改动

`src/modules/demo/routes/index.ts`：

- `/demo` 的 `component`：`@/layouts/blank/index.vue` → `../layouts/DemoDocs.vue`
- redirect 函数式逻辑、glob 自动注册、`routeNames` 白名单导出：**不动**
- glob 只扫 `examples/**`，新布局在 `layouts/` 下，**不会被误注册**

### 3.4 模块边界合规

- 新文件均在 `src/modules/demo/` 内（layouts/ + composables/），符合 Feature-Sliced 模块自治
- demo 模块 index.ts 无需对外暴露新接口（DocLayout 本就模块私有）

## 4. 视觉设计（EP 官网文档风）

只动样式层，涉及 `DocLayout.vue` / `DemoFrame.vue` / `DocToc.vue`：

| 项 | 现状 | 目标 |
|---|---|---|
| 颜色 | 硬编码 `#409eff` / `#606266` / `#f5f7fa` / `#909399` | 全部替换为 `--el-color-primary` / `--el-color-primary-light-9` / `--el-text-color-*` / `--el-bg-color` / `--el-border-color-*`，自动兼容暗色主题 |
| 菜单选中态 | 浅蓝底 + 主色文字 | **左侧 3px 竖条高亮**（EP 官网标志样式）+ primary-light-9 底 + 加粗 |
| 分组展开收起 | v-show 瞬间切换 | `<el-collapse-transition>` 高度动画（unplugin 自动注册可用） |
| 分组标题 | 灰色粗体 | 12px + 字间距 + 计数徽标弱化（#c0c4cc → `--el-text-color-placeholder`） |
| 菜单项 | 无统一圆角 | 6px 圆角、hover/选中 0.15s 过渡统一 |
| DemoFrame | 灰底 intro 块 | intro 改圆角 8px 卡片 + el 变量边框；标题 20px/600 层次保留 |
| toc | 结构已接近 EP 风 | 颜色换 el 变量，**激活算法与行为不动** |
| resizer | 半透明蓝 hover | 换 primary 变量色 |

BEM 规范不变：三个文件均已有 `createNamespace` + 无 scoped scss，本次只改声明值。

## 5. 迁移计划（113 个 demo 页）

每页三处机械改动：

1. 删 `import DocLayout from '<相对路径>/layouts/DocLayout.vue'`
2. 删 `import DocToc from '<相对路径>/components/DocToc.vue'`——**仅当**删掉 `#toc` 块后全文不再引用 `DocToc` 时才删；个别页面若在其他位置用到 DocToc 则保留 import
3. 模板：去掉 `<DocLayout>` / `</DocLayout>` 包裹；删除 `<template #toc>...</template>` 块
4. script：`const tocItems = [...]` 定义之后插入 `useDocToc(tocItems)`

**执行方式**：写一次性 codemod 脚本处理（demo 页范式高度统一），跑完**脚本即删**，不留在仓库。

**codemod 失败兜底**：跑不过的页面输出清单，人工处理；跑完后 `grep -r "DocLayout" src/modules/demo/examples` 必须为 0 残留。

## 6. 验证标准

| 项 | 标准 |
|---|---|
| 类型/静态检查 | `pnpm type-check:full` / `pnpm lint` / `pnpm check:routes` / `pnpm test` 全绿 |
| 侧栏滚动 | 侧栏滚到中间 → 点击菜单项 → 侧栏位置不动；多页来回切换不复位 |
| 搜索词 | 输入关键词 → 切换路由 → 关键词保留（顺带修复，重挂载丢失的连带收益） |
| toc | 每页锚点正确显示/跟随滚动；切到无 toc 页不残留上一页锚点 |
| 折叠/宽度 | 分组折叠、拖拽宽度跨页保留（现状回归） |
| gh-pages 演示构建 | `VITE_DEMO_NO_AUTH=true` 构建产物中 demo 路由仍全量可见 |
| 视觉 | 选中竖条、展开动画、暗色变量生效（切主题验证） |

## 7. 文档同步

- `docs/09-组件示例站点开发指引.md`：新范式（不自包 DocLayout，改用 `useDocToc`）
- `src/modules/demo/docs/如何写好一个 demo.md`：同步新范式
- `CHANGELOG.md` 未发布区：`fix(demo)` 侧栏滚动重置 + `feat(demo)` EP 文档风 UI 重构
- 本文档：`docs/superpowers/specs/2026-10-21-demo-site-ux-design.md`

## 8. 不做的事（YAGNI）

- 不改三栏 grid 布局结构 / 不加深色侧栏
- 不记忆主内容区滚动位置（用户未选该痛点）
- 不动 DocToc 激活算法、useDemoSearch、use-sidebar-drag 逻辑
- codemod 脚本不入库
