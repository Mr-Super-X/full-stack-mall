# Demo 站点体验优化实施计划（侧栏滚动根治 + EP 文档风 UI）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 根治 demo 站切换路由时左侧菜单滚动位置重置的问题（DocLayout 提升为路由级持久布局），并把 demo 文档站视觉对标 Element Plus 官网风格。

**Architecture:** 新增路由级布局 `DemoDocs.vue`（/demo 父路由组件），内部固定 `DocLayout` 三栏壳 + `<RouterView>`；toc 改用数据驱动——demo 页 setup 中 `useDocToc(tocItems)` 写入模块级 `currentDocToc`，布局侧统一渲染。113 个 demo 页用一次性 codemod 迁移（去自包 DocLayout / #toc slot）。视觉层只改 `DocLayout.vue` / `DemoFrame.vue` / `DocToc.vue` 的样式为 Element Plus CSS 变量 + 选中竖条 + 展开动画。

**Tech Stack:** Vue 3.5 `<script setup>` + TypeScript + Vitest + Element Plus（`el-collapse-transition` 已由 unplugin-vue-components 的 ElementPlusResolver 自动注册，见 `vite.config.ts:75`，模板直接用）+ node 一次性 codemod（`--experimental-strip-types`，跑完即删）。

**设计稿：** `docs/superpowers/specs/2026-10-21-demo-site-ux-design.md`（已批准）

**关键前置事实（执行者零上下文依赖）：**
- demo 页范式高度统一：113 个 `examples/**/*.vue` 全部 `import DocLayout from '<depth>/layouts/DocLayout.vue'`（depth 为 `../` 或 `../../`）+ `const tocItems = [...]` + `<DocLayout>` 包裹 + 末尾 `<template #toc>` 仅含 `<DocToc :items="tocItems" />`（单行/多行两种形态）。个别页模板还引用 `tocItems[0]!.id`（如 ProTableExpand.vue:389）——**tocItems 常量必须保留**。
- 例外：`Dict.vue` 等约 4 个页面有 `<DocLayout>` 但**无** `#toc` 块——只需拆包裹，不注册 toc。
- `DocLayout.vue` 的 main/toc 是 slot；sidebar 从 `router.getRoutes()` 自动收集（迁移后照常工作）。
- 项目禁止 `pnpm format` 全量跑（会污染无关文件）；只许局部 `prettier` / `eslint`。
- 所有 commit message 用中文 + conventional 前缀。

---

### Task 1: useDocToc composable（TDD）

**Files:**
- Create: `src/modules/demo/composables/useDocToc.ts`
- Test: `src/modules/demo/composables/useDocToc.spec.ts`

- [ ] **Step 1: 写失败测试**

```ts
/**
 * useDocToc 单元测试
 * 覆盖：注册写入 currentDocToc / scope 停止清空（页面卸载语义）/
 *      引用守卫（新页已注册时旧 scope 停止不清空）/ 连续注册后者胜出
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { effectScope, type EffectScope } from 'vue'
import { currentDocToc, useDocToc } from './useDocToc'

let scope: EffectScope

beforeEach(() => {
  scope = effectScope()
})

afterEach(() => {
  scope.stop()
  currentDocToc.value = []
})

const items = [{ id: 'demo-basic', label: '基础用法' }]

describe('useDocToc', () => {
  it('注册后 currentDocToc 即为本页锚点', () => {
    scope.run(() => useDocToc(items))
    expect(currentDocToc.value).toBe(items)
  })

  it('scope 停止（页面卸载）后清空锚点', () => {
    scope.run(() => useDocToc(items))
    scope.stop()
    expect(currentDocToc.value).toEqual([])
  })

  it('引用守卫：旧 scope 停止时 currentDocToc 已被新页占用则不清空', () => {
    scope.run(() => useDocToc(items))
    const scopeB = effectScope()
    const itemsB = [{ id: 'b', label: 'B' }]
    scopeB.run(() => useDocToc(itemsB))
    scope.stop() // 模拟旧页卸载晚于新页挂载的时序
    expect(currentDocToc.value).toBe(itemsB)
    scopeB.stop()
    expect(currentDocToc.value).toEqual([])
  })

  it('连续注册后者胜出（切路由只显示最新页的锚点）', () => {
    scope.run(() => useDocToc([{ id: 'a', label: 'A' }]))
    scope.run(() => useDocToc(items))
    expect(currentDocToc.value).toBe(items)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/modules/demo/composables/useDocToc.spec.ts`
Expected: FAIL（`Cannot find module './useDocToc'` 或 `useDocToc is not a function`）

- [ ] **Step 3: 实现 useDocToc**

```ts
/**
 * demo 文档站「右侧锚点导航」的跨层数据通道。
 *
 * 背景：DocLayout 提升为路由级布局（layouts/DemoDocs.vue）后，子路由 <RouterView>
 * 与 toc 分属两层，原 demo 页的 `#toc` slot 透传不可用。改为数据驱动：demo 页
 * setup 中 useDocToc(tocItems) 写入模块级 currentDocToc，布局侧统一渲染 <DocToc>。
 *
 * 生命周期：onScopeDispose 清空——页面卸载时移除本页锚点，避免无 toc 页残留上一页。
 * 清空前做引用相等守卫：防止「新页已注册、旧页后卸载」的时序竞争把新锚点清掉。
 *
 * @see layouts/DemoDocs.vue 消费方
 */
import { onScopeDispose, shallowRef, type Ref } from 'vue'

/** 单个锚点项（与 DocToc props.items 形态一致） */
export interface DocTocItem {
  id: string
  label: string
}

/** 当前 demo 页的锚点数据（模块级，跨路由共享给 DemoDocs 布局） */
export const currentDocToc: Ref<DocTocItem[]> = shallowRef<DocTocItem[]>([])

/**
 * demo 页注册本页右侧锚点。在页面 setup 中调用一次即可；
 * 页面卸载（作用域销毁）时自动清除注册。
 */
export function useDocToc(items: DocTocItem[]): void {
  currentDocToc.value = items
  onScopeDispose(() => {
    if (currentDocToc.value === items) currentDocToc.value = []
  })
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test src/modules/demo/composables/useDocToc.spec.ts`
Expected: PASS（4 例全过）

- [ ] **Step 5: Commit**

```bash
git add src/modules/demo/composables/useDocToc.ts src/modules/demo/composables/useDocToc.spec.ts
git commit -m "feat(demo): 新增 useDocToc 锚点数据通道（路由级布局前置）"
```

---

### Task 2: DemoDocs.vue 路由级布局组件（暂不接线）

**Files:**
- Create: `src/modules/demo/layouts/DemoDocs.vue`

> 本任务只建组件不改路由——路由接线在 Task 3 迁移完成后进行（避免「页面包布局套布局」的中间破损态）。

- [ ] **Step 1: 创建 DemoDocs.vue**

```vue
<script setup lang="ts">
/**
 * demo 文档站路由级布局（/demo 父路由组件）。
 *
 * 职责：把 DocLayout 三栏壳固定为路由级——子路由切换只重渲染 main 的
 * <RouterView />，sidebar / toc 不重挂载，侧栏滚动位置、搜索词、折叠与
 * 拖拽宽度跨页保留（根治「切路由侧栏滚动归零」）。
 *
 * toc 数据流：各 demo 页 setup 中 useDocToc(tocItems) 写入模块级
 * currentDocToc（见 composables/useDocToc），此处统一渲染 <DocToc>。
 *
 * @see composables/useDocToc.ts 数据通道
 * @see routes/index.ts /demo 父路由接线
 */
import DocLayout from './DocLayout.vue'
import DocToc from '../components/DocToc.vue'
import { currentDocToc } from '../composables/useDocToc'
</script>

<template>
  <DocLayout>
    <RouterView />
    <template #toc>
      <DocToc :items="currentDocToc" />
    </template>
  </DocLayout>
</template>
```

（本组件无自有样式，不写 `<style>` 块；BEM 规范只约束有样式的组件。）

- [ ] **Step 2: 验证能编译**

Run: `pnpm type-check:full`
Expected: PASS（组件暂未被引用，只要自身类型正确）

- [ ] **Step 3: Commit**

```bash
git add src/modules/demo/layouts/DemoDocs.vue
git commit -m "feat(demo): 新增 DemoDocs 路由级布局组件（未接线）"
```

---

### Task 3: codemod 迁移 113 个 demo 页 + 路由接线

**Files:**
- Create: `scripts/codemod-demo-layout.ts`（一次性，跑完即删）
- Modify: `src/modules/demo/routes/index.ts`（Task 3 最后一步才改）
- Modify: `src/modules/demo/examples/**/*.vue`（113 个，脚本批量）

- [ ] **Step 1: 写 codemod 脚本**

```ts
/**
 * 【一次性 codemod，跑完即删】demo 页从「自包 DocLayout + #toc slot」
 * 迁移到「路由级 DemoDocs 布局 + useDocToc 数据注册」。
 *
 * 每页三处机械改动：
 *   1. 删 `import DocLayout ...`（含行尾注释）
 *   2. 删模板 `<DocLayout>` / `</DocLayout>` 包裹 + 末尾 `<template #toc>` 块
 *   3. 有 toc 的页：`import DocToc ...` → `import { useDocToc } ...`（保留相对深度），
 *      `const tocItems = [...]` 定义后插 `useDocToc(tocItems)`
 *
 * 用法：
 *   node --experimental-strip-types scripts/codemod-demo-layout.ts --only AsyncState   # 试点
 *   node --experimental-strip-types scripts/codemod-demo-layout.ts                     # 全量
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = 'src/modules/demo/examples'
const onlyIdx = process.argv.indexOf('--only')
const only = onlyIdx > -1 ? process.argv[onlyIdx + 1] : null

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return walk(p)
    return p.endsWith('.vue') ? [p] : []
  })
}

// <template #toc> 块仅含 <DocToc :items="tocItems" />（单行/多行两种形态）
const TOC_BLOCK_RE = /\n[ \t]*<template #toc>\s*<DocToc :items="tocItems" \/>\s*<\/template>\n/
// tocItems 数组定义：从 `const tocItems = [` 到行首 `]` 结束
const TOC_ITEMS_RE = /^const tocItems = \[[\s\S]*?^\]/m

let migrated = 0
const failures: string[] = []

for (const file of walk(ROOT)) {
  if (only && !file.includes(only)) continue
  const src = readFileSync(file, 'utf8')
  if (!src.includes('<DocLayout>')) continue

  const hasToc = TOC_BLOCK_RE.test(src)
  let out = src

  // 1. 删 DocLayout import（连同行尾注释）
  out = out.replace(/^[ \t]*import DocLayout from '(\.\.\/)+layouts\/DocLayout\.vue'[^\n]*\n/m, '')
  // 2. 删 #toc 块
  out = out.replace(TOC_BLOCK_RE, '\n')
  // 3. 拆 wrapper 标签（开/闭标签各占一整行）
  out = out.replace(/^[ \t]*<DocLayout>\n/m, '')
  out = out.replace(/\n[ \t]*<\/DocLayout>\n/, '\n')

  if (hasToc) {
    // 4. DocToc import → useDocToc import（保留 ../ 深度，注释丢弃）
    const tocImport = /^[ \t]*import DocToc from '((?:\.\.\/)+)components\/DocToc\.vue'[^\n]*\n/m
    const depth = tocImport.exec(out)?.[1]
    if (!depth) {
      failures.push(`${file}: 未找到 DocToc import`)
      continue
    }
    out = out.replace(tocImport, `import { useDocToc } from '${depth}composables/useDocToc'\n`)
    // 5. tocItems 定义后注册
    if (!TOC_ITEMS_RE.test(out)) {
      failures.push(`${file}: 未找到 tocItems 定义`)
      continue
    }
    out = out.replace(TOC_ITEMS_RE, (m) => `${m}\n\nuseDocToc(tocItems)`)
  }

  // 自检：结果不得残留 DocLayout / #toc
  if (out.includes('DocLayout') || out.includes('#toc')) {
    failures.push(`${file}: 转换后仍残留 DocLayout/#toc`)
    continue
  }

  if (out !== src) {
    writeFileSync(file, out)
    migrated++
    console.log(`✓ ${relative('.', file)}`)
  }
}

console.log(`\n迁移 ${migrated} 个文件，失败 ${failures.length} 个`)
for (const f of failures) console.error(`✗ ${f}`)
if (failures.length) process.exit(1)
```

- [ ] **Step 2: 试点迁移 AsyncState.vue 并人工 diff**

Run: `node --experimental-strip-types scripts/codemod-demo-layout.ts --only AsyncState.vue`
Expected: 输出 `✓ src/modules/demo/examples/AsyncState.vue` + `迁移 1 个文件，失败 0 个`
然后 `git diff src/modules/demo/examples/AsyncState.vue` 人工核对：import 换对、`useDocToc(tocItems)` 位置正确、模板包裹拆掉、`tocItems` 常量保留。

- [ ] **Step 3: 全量迁移**

Run: `node --experimental-strip-types scripts/codemod-demo-layout.ts`
Expected: 迁移数 ≥100（部分页无 DocLayout），**失败 0 个**。若有失败：脚本已跳过该文件（未写入），逐个人工处理后再重跑。

- [ ] **Step 4: 残留检查（必须为 0）**

```bash
grep -rl "DocLayout" src/modules/demo/examples || echo "✓ 无 DocLayout 残留"
grep -rl "#toc" src/modules/demo/examples || echo "✓ 无 #toc 残留"
grep -rl "DocToc" src/modules/demo/examples || echo "✓ 无 DocToc 残留"
```

Expected: 全部输出 `✓ 无 ... 残留`（ProTableExpand 等页只引用 `tocItems[N]!.id`，不引用 DocToc 组件名；若个别页残留 DocToc 引用属预期外，人工处理）。

- [ ] **Step 5: 局部格式化 + lint 修复**

```bash
pnpm exec prettier --write "src/modules/demo/examples/**/*.vue"
pnpm exec eslint --fix src/modules/demo/examples
```

Expected: 无 error（warning 记录即可）

- [ ] **Step 6: 路由接线（`/demo` 父路由 component 换为 DemoDocs）**

`src/modules/demo/routes/index.ts` 中：

```ts
// 改前（line 97 附近）
component: () => import('@/layouts/blank/index.vue'),
// 改后
component: () => import('../layouts/DemoDocs.vue'),
```

并在该 route 对象 `meta` 行上方加一行注释：

```ts
        // 路由级布局：DocLayout 固定为父组件，子路由切换不重挂载侧栏（见 layouts/DemoDocs.vue）
```

- [ ] **Step 7: 全量静态验证**

```bash
pnpm type-check:full
pnpm lint
pnpm check:routes
pnpm test
```

Expected: 全绿。可能的坑：个别页 `tocItems` 带 `as const` 导致 readonly 类型不匹配 → 去掉 `as const` 或改 `useDocToc([...tocItems])`，以 type-check 报错行为准逐个修。

- [ ] **Step 8: 删除 codemod 脚本并 Commit**

```bash
git rm scripts/codemod-demo-layout.ts
git add -A src/modules/demo
git commit -m "refactor(demo): demo 页迁移至路由级布局（根治侧栏滚动重置）"
```

---

### Task 4: DocLayout EP 官网风改造（模板动画 + 样式变量化）

**Files:**
- Modify: `src/modules/demo/layouts/DocLayout.vue`

- [ ] **Step 1: 模板——分组列表包展开动画 + 更新文件头注释**

文件头注释（line 11-14 附近）改为：

```
 *   - 中间 main：演示页内容（default slot，路由级布局 DemoDocs.vue 注入 <RouterView />）
 *   - 右侧 toc：本页锚点导航（toc slot，由 DemoDocs.vue 注入 useDocToc 数据渲染）
```

分组列表（line 135-147 附近）：

```vue
<!-- 改前 -->
          <ul
            v-show="isSearchActive || !collapsedGroups.has(group.title)"
            :class="bem.e('group-list')"
          >
            ...
          </ul>
<!-- 改后 -->
          <el-collapse-transition>
            <ul
              v-show="isSearchActive || !collapsedGroups.has(group.title)"
              :class="bem.e('group-list')"
            >
              ...
            </ul>
          </el-collapse-transition>
```

（`<el-collapse-transition>` 由 ElementPlusResolver 自动注册，无需 import。）

- [ ] **Step 2: 样式——整块替换 `<style lang="scss">` 内容**

```scss
.#{$BEM_PREFIX}-doc-layout {
  // grid-template-columns 由内联 style 动态控制（sidebar 宽度可拖拽）
  display: grid;
  gap: 0;
  align-items: start;
  min-height: calc(100vh - 96px);

  &__sidebar,
  &__toc {
    position: sticky;
    top: 16px;
    max-height: calc(100vh - 32px);
    overflow-y: auto;
    padding: 16px;
  }

  &__toc {
    margin-left: 24px;
  }

  &__main {
    padding: 16px;
    margin-left: 24px;
  }

  &__sidebar-top {
    // 把 home + search 包成一个 sticky 容器：sidebar 内容超长滚动时
    // 「返回首页」按钮与搜索框始终可见，避免检索流程被滚动打断
    position: sticky;
    top: 0;
    z-index: 2;
    // 纯色底：侧栏内部滚动时本容器覆盖在菜单上，透明底会文字叠文字
    background: var(--el-bg-color-page);
    padding-bottom: 12px;
  }

  &__home {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    margin-bottom: 12px;
    padding: 6px 10px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    cursor: pointer;
    transition:
      background 0.15s,
      color 0.15s,
      border-color 0.15s;

    &:hover {
      background: var(--el-color-primary-light-9);
      color: var(--el-color-primary);
      border-color: var(--el-color-primary-light-7);
    }
  }

  &__home-icon {
    font-size: 14px;
  }

  &__search {
    // 无 margin：与 home 间距由 sidebar-top padding-bottom 统一管理
  }

  &__search-input {
    width: 100%;
  }

  &__search-empty {
    padding: 24px 8px;
    text-align: center;
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }

  &__search-empty-text {
    margin: 0 0 8px;
  }

  &__search-empty-btn {
    padding: 4px 12px;
    background: transparent;
    border: 1px solid var(--el-border-color);
    border-radius: 6px;
    color: var(--el-color-primary);
    font-size: 12px;
    cursor: pointer;
    transition: background 0.15s;

    &:hover {
      background: var(--el-color-primary-light-9);
    }
  }

  &__nav {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__group {
    margin-bottom: 4px;
  }

  &__group-header {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    padding: 7px 8px;
    background: transparent;
    border: none;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    color: var(--el-text-color-secondary);
    cursor: pointer;
    transition:
      background 0.15s,
      color 0.15s;

    &:hover {
      background: var(--el-fill-color-light);
      color: var(--el-text-color-primary);
    }
  }

  &__group-arrow {
    flex-shrink: 0;
    font-size: 12px;
  }

  &__group-name {
    flex: 1;
    text-align: left;
    letter-spacing: 0.02em;
  }

  &__group-count {
    flex-shrink: 0;
    font-size: 11px;
    font-weight: 400;
    color: var(--el-text-color-placeholder);
  }

  &__group-list {
    margin: 0;
    padding: 0 0 0 8px;
    list-style: none;
  }

  &__resizer {
    // 独立 grid 列，sticky 定位保证 sidebar 内部滚动或页面滚动时始终可见
    position: sticky;
    top: 16px;
    align-self: start;
    justify-self: end;
    z-index: 1;
    width: 6px;
    height: calc(100vh - 32px);
    cursor: col-resize;

    &:hover {
      background: var(--el-color-primary-light-7);
    }
  }

  &__link {
    display: block;
    // 长组件名（如 XFormCrossFieldReverse）在窄 sidebar 下允许断词，避免撑出横向滚动
    overflow-wrap: break-word;
    padding: 6px 12px;
    margin: 2px 0;
    font-size: 13px;
    color: var(--el-text-color-regular);
    text-decoration: none;
    border-radius: 6px;
    transition:
      background 0.15s,
      color 0.15s;

    &:hover {
      background: var(--el-fill-color-light);
      color: var(--el-color-primary);
    }

    // EP 官网标志选中态：左侧 3px 主色竖条 + tint 底（竖条对齐分组标题左缘）
    &.is-active {
      position: relative;
      background: var(--el-color-primary-light-9);
      color: var(--el-color-primary);
      font-weight: 500;

      &::before {
        content: '';
        position: absolute;
        left: -8px;
        top: 50%;
        transform: translateY(-50%);
        width: 3px;
        height: 16px;
        border-radius: 0 2px 2px 0;
        background: var(--el-color-primary);
      }
    }
  }
}
```

- [ ] **Step 3: 验证 + Commit**

```bash
pnpm lint
pnpm type-check:full
```

Expected: 全绿

```bash
git add src/modules/demo/layouts/DocLayout.vue
git commit -m "feat(demo): DocLayout 对标 EP 官网风格（选中竖条/展开动画/el 变量）"
```

---

### Task 5: DocToc / DemoFrame 样式变量化

**Files:**
- Modify: `src/modules/demo/components/DocToc.vue`（仅 `<style>` 块）
- Modify: `src/modules/demo/components/DemoFrame.vue`（仅 `<style>` 块）

- [ ] **Step 1: DocToc 样式整块替换**

```scss
.#{$BEM_PREFIX}-doc-toc {
  font-size: 12px;

  &__title {
    margin: 0 0 8px;
    font-size: 12px;
    font-weight: 600;
    color: var(--el-text-color-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  &__list {
    margin: 0;
    padding: 0;
    list-style: none;
    border-left: 1px solid var(--el-border-color-light);
  }

  &__link {
    display: block;
    padding: 4px 12px;
    margin-left: -1px;
    border-left: 1px solid transparent;
    color: var(--el-text-color-regular);
    text-decoration: none;
    line-height: 1.6;
    transition:
      color 0.15s,
      border-color 0.15s;

    &:hover {
      color: var(--el-color-primary);
      border-left-color: var(--el-color-primary);
    }

    // 当前激活楼层：左侧竖线 + 主色 + 加粗（滚动跟随与点击跳转都会进入此态）
    &--active {
      color: var(--el-color-primary);
      border-left-color: var(--el-color-primary);
      font-weight: 600;
    }
  }
}
```

- [ ] **Step 2: DemoFrame 样式整块替换**

```scss
.#{$BEM_PREFIX}-demo-frame {
  display: flex;
  flex-direction: column;
  gap: 16px;

  &__header {
    display: flex;
    align-items: baseline;
    gap: 12px;
    flex-wrap: wrap;
  }

  &__title {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  &__source {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    background: var(--el-fill-color-light);
    padding: 2px 6px;
    border-radius: 4px;
  }

  &__intro {
    margin: 0;
    padding: 12px 16px 12px 28px;
    background: var(--el-fill-color-light);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    list-style-position: inside;
    color: var(--el-text-color-regular);
    font-size: 13px;
    line-height: 1.8;

    li {
      list-style-type: disc;
    }
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
}
```

- [ ] **Step 3: 验证 + Commit**

```bash
pnpm lint
pnpm type-check:full
```

Expected: 全绿

```bash
git add src/modules/demo/components/DocToc.vue src/modules/demo/components/DemoFrame.vue
git commit -m "feat(demo): DocToc/DemoFrame 颜色全量切换 Element Plus 变量"
```

---

### Task 6: 全量验证（含 gh-pages 演示构建回归）

**Files:** 无新增修改，纯验证。

- [ ] **Step 1: 静态检查四连**

```bash
pnpm type-check:full
pnpm lint
pnpm check:routes
pnpm test
```

Expected: 全绿

- [ ] **Step 2: 常规生产构建（demo 应被 tree-shake）**

```bash
pnpm build
```

Expected: 构建成功；产物 chunk 数对齐 demo 门控基线（36 chunk / 4.0M 左右，以实际输出为准）——证明迁移没把 demo 意外打进常规 prod。

- [ ] **Step 3: gh-pages 演示构建（demo 应全量可见）**

Git Bash 下必须带 `MSYS2_ARG_CONV_EXCL='*'`（否则 `--base` 被 MSYS 路径污染）：

```bash
MSYS2_ARG_CONV_EXCL='*' VITE_BASE=/vue3-vite-project/ VITE_HISTORY_MODE=hash VITE_MENU_SOURCE=local VITE_USE_MOCK=true VITE_DEMO_NO_AUTH=true pnpm build
```

Expected: 构建成功；产物含全部 demo chunk（基线 182 chunk / 11M 左右，以实际输出为准）。

- [ ] **Step 4: 浏览器人工验证清单**（`pnpm dev:local` 后逐条过）

| # | 操作 | 预期 |
|---|------|------|
| 1 | 侧栏滚到中间 → 点击任意 demo 菜单 | 侧栏滚动位置不动；主内容切换并回顶部 |
| 2 | 搜索框输入关键词 → 点击搜索结果 | 关键词保留；结果过滤正确 |
| 3 | 折叠某分组 → 切换 3 个页面再回来 | 折叠状态保留；展开有高度动画 |
| 4 | 拖拽侧栏宽度 → 切换页面 | 宽度保留 |
| 5 | 有 toc 的页（如 AsyncState） | 右侧锚点正确显示，滚动跟随、点击跳转正常 |
| 6 | 切到无 toc 的页（如 Dict） | 右侧不出现上一页残留锚点 |
| 7 | 菜单选中项 | 左侧 3px 主色竖条 + tint 底 |
| 8 | 暗色主题切换 | 侧栏/toc/intro 卡片颜色跟随变量无硬编码色块 |

---

### Task 7: 文档同步 + CHANGELOG

**Files:**
- Modify: `docs/09-组件示例站点开发指引.md`
- Modify: `src/modules/demo/docs/如何写好一个 demo.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: docs/09 同步**

1. 目录结构表（line 38 附近）`layouts/DocLayout.vue` 行下新增一行：

```
├── layouts/DemoDocs.vue           # 路由级布局：固定 DocLayout + RouterView + useDocToc 锚点
```

2. 模板示例 imports（line 73-79）：删除 `import DocLayout ...` 与 `import DocToc ...` 两行，新增 `import { useDocToc } from '../composables/useDocToc'`。
3. 模板示例（line 124-146）：去掉 `<DocLayout>` / `</DocLayout>` 包裹与 `<template #toc>` 块，并在 script 的 `const tocItems = [...]` 之后补 `useDocToc(tocItems)`（sync 说明文字同步改为「`useDocToc(tocItems)` 的 items 顺序与 `ApiTable anchor` 一一对应」）。

- [ ] **Step 2: 如何写好一个 demo.md 同步（4 处同类改动）**

1. §目录树（line 60-63）补 `DemoDocs.vue` 行；
2. XForm 模板 imports（line 184-187）与模板（line 215、240-243）同 Step 1 改法；
3. §4.1 checklist（line 260）`- [ ] 使用 DocLayout 包裹整体。` 改为：

```
- [ ] **不要自包 `DocLayout`**（路由级布局自动包裹）；用 `useDocToc(tocItems)` 注册右侧锚点。
```

4. §6.5 DocToc 小节（line 377-383）改为：

````md
### 6.5 DocToc（useDocToc 注册）

```ts
// script setup 中 tocItems 定义之后
useDocToc(tocItems)
```

右侧锚点由路由级布局（DemoDocs.vue）统一渲染，页面只负责注册数据。
````

5. 最小示例（line 511-582）同 Step 1 改法。

- [ ] **Step 3: CHANGELOG 未发布区新增**

```md
### Fixed
- **demo**: 切换路由时左侧菜单滚动位置重置——DocLayout 提升为路由级持久布局（新增 `layouts/DemoDocs.vue`），侧栏滚动/搜索词/折叠/宽度跨页保留

### Features
- **demo**: 文档站 UI 对标 Element Plus 官网——菜单选中项左侧竖条高亮、分组展开收起动画、DocLayout/DocToc/DemoFrame 颜色全量切换 Element Plus CSS 变量（兼容暗色主题）
```

- [ ] **Step 4: 文档硬数据校验 + Commit**

```bash
pnpm check:doc-currency
```

Expected: PASS

```bash
git add docs/09-组件示例站点开发指引.md src/modules/demo/docs/如何写好一个 demo.md CHANGELOG.md
git commit -m "docs(demo): 文档站新范式同步（路由级布局 + useDocToc）与 CHANGELOG"
```

---

## Self-Review 记录

- **Spec 覆盖**：§3.1/§3.2 结构 → Task 1/2/3；§3.3 路由 → Task 3 Step 6；§4 视觉 → Task 4/5；§5 迁移 → Task 3；§6 验证 → Task 6；§7 文档 → Task 7。全覆盖。
- **占位符扫描**：无 TBD/TODO；所有代码步骤含完整代码。
- **类型一致性**：`DocTocItem { id; label }` 与 DocToc props.items 形态一致；`currentDocToc` 在 Task 1 定义、Task 2 消费；`useDocToc(tocItems)` 调用与 composable 签名一致。
- **已知风险**：个别页 `tocItems as const` 可能 readonly 不匹配（Task 3 Step 7 已给修法）；el-collapse-transition 首次使用，若 resolver 未自动注册则 type-check 报未知组件，届时在 DocLayout.vue 显式 `import { ElCollapseTransition } from 'element-plus'`（不新增依赖，element-plus 已在依赖内）。
