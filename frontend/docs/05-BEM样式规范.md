# BEM 样式规范

> **文档版本**：v2.1.0 | **最后更新**：2026-08-19
> **覆盖范围**：BEM 命名约定、`createNamespace` 使用、style 块编写（**两种方案**：sass 插值 vs SCSS mixin）、样式隔离策略、文件组织、代码评审清单
> **v2.1 变更**：把 SCSS mixin 写法从"v1 弃用"提升为**备选方案**，与 sass 插值写法并列，开发者按场景灵活选择
> **v2 重大变更**：样式隔离改为 BEM 命名空间单一防线，`<style>` 块一律不写 `scoped`

---

## 📋 为什么选 BEM

| 候选方案                            | 优点                                                                     | 缺点                                        | 结论        |
| ----------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------- | ----------- |
| **BEM（Block__Element--Modifier）** | 类名语义化、可读、跨团队无歧义、与 Element Plus 等主流 UI 库源码风格一致 | 类名较长                                    | ✅ **采纳** |
| CSS Modules                         | 隔离最强                                                                 | 背离 BEM 可读性目标、覆盖第三方样式成本高   | ❌          |
| OOCSS / SMACSS                      | 灵活                                                                     | 团队共识成本高、容易走向"自定义无规范"      | ❌          |
| Atomic CSS（UnoCSS 已用）           | 复用高                                                                   | 仅适合布局/工具类，业务组件样式仍需命名约定 | ⚠️ 互补     |

**核心立场**：UnoCSS 负责**布局/工具类**（flex、spacing、color），BEM 负责**业务组件作用域样式**。两者不冲突。

---

## 🎯 三大核心原则

1. **Block = 独立组件**：一个 Block 必须能独立"搬走"到任何项目而不破坏其他样式
2. **Element 只在 Block 内部有意义**：脱离 Block 的 Element 无意义，禁止跨 Block 复用 Element
3. **Modifier 不破坏结构**：Modifier 只调整外观/状态，不能重排 DOM 结构

---

## 🏷️ 命名规则（核心）

### 1. Block（块）

- **格式**：连字符式小写英文（`kebab-case`）
- **语义**：可独立复用的功能模块，对应一个 Vue 组件
- **示例**：`user-card`、`login-form`、`header-bar`、`sidebar-menu`

### 2. Element（元素）

- **格式**：`block__element`（双下划线连接）
- **语义**：Block 的组成部件，离开 Block 无意义
- **示例**：`user-card__avatar`、`login-form__submit`、`header-bar__title`

### 3. Modifier（修饰符）

- **格式**：`block--modifier`（双连字符）或 `block__element--modifier`
- **语义**：改变外观/状态/主题，不改变结构
- **示例**：`user-card--featured`、`login-form__submit--loading`、`header-bar--dark`

### 4. State（状态，BEM 扩展）

- **格式**：`is-{state}`（前缀 `is-`，避免与 Modifier 混淆）
- **语义**：运行时状态（active、disabled、loading、focused）
- **应用方式**：通过 Vue 的 `:class="{ 'is-active': isActive }"` 切换（`bem.is()` 运行时生成）

### 5. 命名禁区

| 反例                     | 原因                                     |
| ------------------------ | ---------------------------------------- |
| `.user-card__item__link` | Element 嵌套 Element，违反 BEM 结构      |
| `.btn`                   | Block 缩写无语义，不可独立复用           |
| `.userCard__avatar`      | Block 必须小写连字符，不能 camelCase     |
| `.card--primary__btn`    | Modifier 不能脱离 Block 单独修饰 Element |

---

## 🛠️ 优先使用 `createNamespace()` 创建 BEM（必读）

> `createNamespace()` 来自 `@vv/shared` 的 `packages/shared/src/utils/bem.ts`。
> 由 `unplugin-auto-import`（`@vv/config` 工厂 `packages/config/src/create-vite-config.ts` 的 AutoImport 段）自动注入到 `<script setup>` **全局作用域**。
> 禁止 `import { createNamespace } from '@utils/bem'`——会与自动注入冲突。

### API 一览（运行时拼接类名）

| 方法                                | 用途                            | 输出示例                            |
| ----------------------------------- | ------------------------------- | ----------------------------------- |
| `bem.b()`                           | Block 根类名                    | `'vv-user-card'`                    |
| `bem.b('group')`                    | Block 后缀（变体根）            | `'vv-user-card-group'`              |
| `bem.e('name')`                     | Element                         | `'vv-user-card__name'`              |
| `bem.m('large')`                    | Block Modifier                  | `'vv-user-card--large'`             |
| `bem.em('name', 'large')`           | Element Modifier                | `'vv-user-card__name--large'`       |
| `bem.be('group', 'icon')`           | Block + Element                 | `'vv-user-card-group__icon'`        |
| `bem.bm('group', 'large')`          | Block + Modifier                | `'vv-user-card-group--large'`       |
| `bem.bem('group', 'icon', 'large')` | 三段                            | `'vv-user-card-group__icon--large'` |
| `bem.is('active', state)`           | State（真返回类名，假返回空串） | `'is-active'` 或 `''`               |

### 完整使用模板

```vue
<!-- 教学示例（user 模块当前无 components/UserCard.vue，模式适用于任意业务组件） -->
<script setup lang="ts">
// createNamespace 由 unplugin-auto-import 自动注入（@vv/config 工厂 AutoImport 段），
// 无须显式 import。BEM 前缀来自 import.meta.env.VITE_BEM_PREFIX ?? 'vv'。
const bem = createNamespace('user-card')
</script>

<template>
  <div :class="[bem.b(), bem.is('featured', featured), bem.is('loading', loading)]">
    <img :class="bem.e('avatar')" :src="user.avatar" />
    <h3 :class="bem.e('name')">{{ user.name }}</h3>
    <button :class="bem.e('action')">关注</button>
  </div>
</template>

<style lang="scss">
// 详见下方"style 块编写规范"章节
.#{$BEM_PREFIX}-user-card {
  padding: 16px;

  &__avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
  }
}
</style>
```

**编译/运行产物**：

```html
<!-- template 渲染的 class（来自 bem.b() 等） -->
<div class="vv-user-card is-featured is-loading">
  <img class="vv-user-card__avatar" />
  <h3 class="vv-user-card__name">张三</h3>
  <button class="vv-user-card__action">关注</button>
</div>
```

```css
/* <style lang="scss"> 编译后的 CSS（来自 sass 插值 + vite additionalData 注入 $BEM_PREFIX） */
.vv-user-card {
  padding: 16px;
}
.vv-user-card__avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
}
```

两套工具输出**完全等价**——JS 拼接的类名与 SCSS 编译的 CSS 选择器自动对齐。改 `VITE_BEM_PREFIX=app` 后 `.vv-user-card` 全站变 `.app-user-card`，无需任何代码改动。

### createNamespace name 命名约定（关键）

| 规则                     | 原因                                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| ✅ **必须 kebab-case**   | 与 sass 根选择器 `.#{$BEM_PREFIX}-<kebab>` 严格对齐——HTML class 与 CSS 选择器大小写敏感         |
| ❌ **禁止 PascalCase**   | `createNamespace('OrdersList')` → `'vv-OrdersList'`，与 `.vv-orders-list` 不匹配 → 整片样式失效 |
| ✅ **全项目唯一**        | 不要用 `card` / `button` 这种通用 Block 名（与 Element Plus / UnoCSS 工具类冲突）               |
| ✅ **与 Vue 文件名一致** | `<user-card>.vue` → `createNamespace('user-card')`                                              |

转换示例：

| ❌ PascalCase  | ✅ kebab-case   |
| -------------- | --------------- |
| `OrdersList`   | `orders-list`   |
| `SiteHero`     | `site-hero`     |
| `SiteFeatures` | `site-features` |
| `SiteStats`    | `site-stats`    |
| `SiteAbout`    | `site-about`    |
| `SiteFooter`   | `site-footer`   |
| `UserLogin`    | `user-login`    |

---

## 🎨 style 块编写规范

> 提供**两种等价写法**供灵活选择：① sass 插值写法（推荐，简单场景）② SCSS mixin 写法（备选，嵌套深的复杂组件更清晰）。两种写法运行时产物完全等价。

---

### 方案 A：sass 插值写法（推荐）

> 适用：大多数业务组件（嵌套 ≤ 3 层、选择器数量 ≤ 10 个）。

#### 必须遵守 4 条

| #   | 项                                                 | 说明                                                           |
| --- | -------------------------------------------------- | -------------------------------------------------------------- |
| 1   | 必须 `lang="scss"`                                 | 用于解析 `$BEM_PREFIX` sass 变量与 sass 语法                   |
| 2   | **不写** `scoped`                                  | 详见下方"为什么不写 scoped"                                    |
| 3   | 根选择器必须用 sass 插值 `.#{$BEM_PREFIX}-<kebab>` | 与 `bem.b()` 输出的类名一一对应；改 `VITE_BEM_PREFIX` 自动同步 |
| 4   | element/modifier 用 `&__xxx` / `&--yyy` 嵌套       | 沿用 BEM 嵌套写法，sass 编译为完整类名                         |

#### 为什么不写 `scoped`（3 条核心理由）

1. **BEM 命名空间本身已是隔离层**
   `.vv-user-card` 类名带 `vv-` 前缀，不可能与其他组件或第三方样式冲突。`scoped` 给元素加 `[data-v-xxx]` 属性选择器是**冗余**的——BEM 命名已经实现了同样强度的隔离。

2. **`scoped` 与 element-plus 穿透需求矛盾**
   Vue 3 的 `:deep(.el-button)` 伪类**只在 scoped 块中**有意义（用于穿透子组件 scoped）。无 scoped 时 `:deep()` 是**非法 CSS 选择器**，浏览器直接忽略 → element-plus 表单/按钮样式穿透失败 → 整片样式丢失。这是 BEM 改造后反复出现的真实回归。

3. **`scoped` 会破坏 sass `&` 嵌套**
   vue-loader 在编译 scoped 时会给 `&` 加属性后缀，对 `@include b() {}` 嵌套的影响可控，但对手写 sass 嵌套 `&__xxx` 会引入额外属性选择器。在 sass 插值写法下保持纯 BEM 命名更简单可控。

#### 完整 style 块示例（方案 A）

```vue
<style lang="scss">
// 根选择器：必用 sass 插值，与 createNamespace(name) 中的 name 一一对应
.#{$BEM_PREFIX}-user-card {
  padding: var(--spacing-md);
  border: 1px solid var(--border-base);
  border-radius: var(--radius-md);

  // Element：用 &__xxx 嵌套占位符
  &__avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
  }

  &__name {
    font-size: 16px;
    font-weight: 600;
  }

  &__action {
    padding: 4px 12px;
    cursor: pointer;
    background: var(--el-color-primary);
    color: #fff;

    // Element Modifier：&__xxx--yyy
    &--primary {
      background: var(--el-color-primary);
    }
  }

  // Block Modifier：用 &--yyy
  &--featured {
    border-color: gold;
  }

  // State：用 &.is-xxx（与 bem.is() 输出对齐）
  &.is-loading {
    opacity: 0.6;
    pointer-events: none;
  }
}
</style>
```

**编译产物**：

```css
.vv-user-card {
  padding: 16px;
  border: 1px solid #eee;
  border-radius: 8px;
}
.vv-user-card__avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
}
.vv-user-card__name {
  font-size: 16px;
  font-weight: 600;
}
.vv-user-card__action {
  padding: 4px 12px;
  cursor: pointer;
  background: #409eff;
  color: #fff;
}
.vv-user-card__action--primary {
  background: #409eff;
}
.vv-user-card--featured {
  border-color: gold;
}
.vv-user-card.is-loading {
  opacity: 0.6;
  pointer-events: none;
}
```

#### 方案 A 反模式（禁止）

| #   | 反例                                                     | 原因                                                                                   |
| --- | -------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1   | `<style lang="scss" scoped>` 或 `<style scoped>`         | 详见上方"为什么不写 scoped"。BEM 命名空间已隔离，scoped 冗余且与 `:deep()` 冲突        |
| 2   | 硬编码 `.vv-user-card { ... }`（不带 `#{$BEM_PREFIX}-`） | 改 `VITE_BEM_PREFIX` 后失效，JS 端输出新前缀但 CSS 选择器不动 → 样式丢失               |
| 3   | `@use '@vv/ui/styles/tools/bem' as *;`                   | vite additionalData 已通过 `@use ... with` 注入，重复引入会报 sass 编译错误            |
| 4   | `:deep(.el-button) { ... }`                              | 无 scoped 时 `:deep()` 非法，浏览器忽略。靠 BEM 命名空间隔离即可穿透 element-plus 组件 |

---

### 方案 B：SCSS mixin 写法（备选）

> 适用：组件嵌套深度 ≥ 3 层、选择器数量多、需要复用现有 mixin 的场景。两种方案运行时产物完全等价（`.vv-` 前缀拼接 + sass `&` 编译）。

#### 何时优先选方案 B

- 同一组件选择器数量 ≥ 20 个，sass 插值写法嵌套层级深、视觉臃肿
- 习惯 SCSS mixin 心智模型（团队历史习惯）
- 需要与 `packages/ui/src/styles/tools/_bem.scss` 现存 mixin 复用

#### 何时仍选方案 A

- 新写的简单组件（≤10 个选择器）
- 团队以 sass 插值为默认风格（更直观、不依赖项目私有 mixin）
- 直接用 createNamespace 命名约定更顺手的场景

#### SCSS mixin 一览（来自 `packages/ui/src/styles/tools/_bem.scss`）

| mixin             | 用途                                      | 生成示例                                          |
| ----------------- | ----------------------------------------- | ------------------------------------------------- |
| `b($block)`       | 注册 Block 并打开作用域（**自动加前缀**） | `.vv-user-card { ... }`（前缀来自 `$BEM_PREFIX`） |
| `e($element)`     | 注册 Element（基于当前 Block）            | `.vv-user-card__avatar { ... }`                   |
| `m($modifier)`    | 注册 Block 修饰符                         | `.vv-user-card--featured { ... }`                 |
| `em($elem, $mod)` | 注册 Element 修饰符                       | `.vv-user-card__avatar--large { ... }`            |
| `is($state)`      | 注册 State（BEM 扩展）                    | `.vv-user-card.is-active { ... }`                 |
| `when($suffix)`   | 注册主题/场景前缀                         | `.vv-user-card--when-light { ... }`               |
| `reset-block`     | 重置块名作用域（仅测试用）                | —                                                 |

> **重要**：`b($block)` 的 `$block` 参数**只传基础名**（如 `user-card`），不要传完整前缀（如 `vv-user-card`）——前缀由 `$BEM_PREFIX` 自动拼接，否则会出现 `.vv-vv-user-card` 这种重复前缀。

#### 完整 style 块示例（方案 B）

```vue
<style lang="scss">
// b() / e() / m() / is() mixin 由 vite additionalData 通过 `@use ... with` 注入。
// 本文件不要再写 @use 'bem' as * —— 重复引入会报 sass 编译错误。
@include b(user-card) {
  padding: var(--spacing-md);
  border: 1px solid var(--border-base);
  border-radius: var(--radius-md);

  @include e(avatar) {
    width: 40px;
    height: 40px;
    border-radius: 50%;
  }

  @include e(name) {
    font-size: 16px;
    font-weight: 600;
  }

  @include e(action) {
    padding: 4px 12px;
    cursor: pointer;
    background: var(--el-color-primary);
    color: #fff;

    // Element Modifier
    @include em(action, primary) {
      background: var(--el-color-primary);
    }
  }

  // Block Modifier
  @include m(featured) {
    border-color: gold;
  }

  // State
  @include is(loading) {
    opacity: 0.6;
    pointer-events: none;
  }
}
</style>
```

**编译产物**（与方案 A 完全等价）：

```css
.vv-user-card {
  padding: 16px;
  border: 1px solid #eee;
  border-radius: 8px;
}
.vv-user-card__avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
}
.vv-user-card__name {
  font-size: 16px;
  font-weight: 600;
}
.vv-user-card__action {
  padding: 4px 12px;
  cursor: pointer;
  background: #409eff;
  color: #fff;
}
.vv-user-card__action--primary {
  background: #409eff;
}
.vv-user-card--featured {
  border-color: gold;
}
.vv-user-card.is-loading {
  opacity: 0.6;
  pointer-events: none;
}
```

#### 方案 B 反模式（禁止）

| #   | 反例                                                            | 原因                                                                        |
| --- | --------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | `<style lang="scss" scoped>` 或 `<style scoped>`                | 与方案 A 同理，BEM 命名空间已隔离                                           |
| 2   | `@include b(vv-user-card)`（传完整前缀）                        | 会输出 `.vv-vv-user-card` 重复前缀                                          |
| 3   | `@use '@vv/ui/styles/tools/bem' as *;`（在 style 块中重复引入） | vite additionalData 已通过 `@use ... with` 注入，重复引入会报 sass 编译错误 |
| 4   | `:deep(.el-button) { ... }`                                     | 无 scoped 时 `:deep()` 非法                                                 |

---

### 方案 A vs 方案 B 对比

| 维度         | 方案 A sass 插值（推荐）       | 方案 B SCSS mixin（备选）       |
| ------------ | ------------------------------ | ------------------------------- |
| 心智成本     | ✅ 零成本（标准 sass 语法）    | ⚠️ 需记 mixin 名（b/e/m/em/is） |
| 调试类名     | ✅ 直接看到（sass 编译后展开） | ⚠️ 编译后才能看                 |
| IDE 高亮兼容 | ✅ 原生 sass 支持              | ⚠️ 部分 IDE 不识别 mixin 调用   |
| 嵌套可读性   | ⚠️ 嵌套深时视觉臃肿            | ✅ 优秀（mixin 嵌套自带作用域） |
| 大型组件适用 | ⚠️ 选 ≥20 个时累赘             | ✅ 嵌套清晰                     |
| **运行产物** | 完全等价                       | 完全等价                        |

**建议**：

- 简单组件（≤10 选择器、嵌套 ≤3 层）→ 选方案 A（默认推荐）
- 复杂组件（选 ≥20、嵌套 ≥3 层、复用 mixin）→ 选方案 B
- 同一项目内**不必统一**——按场景选最合适的，但建议团队内部形成大致倾向（如默认 A、复杂场景 B）

---

### 前缀可配置：`VITE_BEM_PREFIX`（两种方案共享）

| 工具                     | 文件                                                     | 读取方式                                                     |
| ------------------------ | -------------------------------------------------------- | ------------------------------------------------------------ |
| 运行时 TS 工具           | `packages/shared/src/utils/bem.ts` → `createNamespace()` | `import.meta.env.VITE_BEM_PREFIX ?? 'vv'`                    |
| 编译期 SCSS 插值 / mixin | `<style lang="scss">` 块                                 | 由 vite additionalData 用 sass `with` 语法注入 `$BEM_PREFIX` |

**vite 注入实现**（`@vv/config` 工厂 scss 段，`packages/config/src/scss.ts` 的 `createScssPreprocessorOptions`）：

```ts
// bem mixin 已随迁 @vv/ui 包（packages/ui/src/styles/tools/_bem.scss，2026-11-03 起
// styles/ 自 assets/ 上移、mixins/ 更名 tools/）；
// 经 sass loadPaths + 裸模块名 @use（绝对路径盘符冒号会被 sass 误判为 URL scheme，见 scss.ts 头注）
scss: {
  additionalData: `@use 'bem' as * with ($BEM_PREFIX: '${process.env.VITE_BEM_PREFIX ?? 'vv'}');\n`,
}
```

`$BEM_PREFIX` 在每个 `<style lang="scss">` 块编译时自动可用，**无需**手动 `@use`。

---

## 🛡️ 样式隔离策略（BEM 命名空间为唯一防线）

| 防线                                     | 机制                                                | 作用                                       |
| ---------------------------------------- | --------------------------------------------------- | ------------------------------------------ |
| **第一层（也是唯一层）**：BEM 命名       | 类名自带 Block 前缀（`vv-`）+ Element/Modifier 后缀 | 类名全局唯一，不可能冲突                   |
| ~~第二层~~（已弃用）：`<style scoped>`   | ~~vue-loader 加 `[data-v-xxx]` 属性选择器~~         | ~~已被 BEM 命名取代，且与 `:deep()` 冲突~~ |
| ~~第三层~~（已弃用）：SCSS `@use` 模块化 | ~~顶层 reset 隔离~~                                 | ~~BEM 命名已足够，无需额外隔离~~           |

### 为什么只需要 BEM 命名一层

| 单层 BEM 的兜底场景                        | 兜底机制                                            |
| ------------------------------------------ | --------------------------------------------------- |
| 父子组件同名 class（如都有 `.title`）      | BEM 命名让 `.vv-parent__title` ≠ `.vv-child__title` |
| 子组件根元素透传（`<slot>`）               | BEM 类名仍带组件前缀，不会污染                      |
| 第三方库样式（如 Element Plus `el-` 冲突） | Element Plus 自身用 BEM，统一约定                   |
| 全局 `*` 重置误伤                          | 重置只影响 `html` / `body`，不进入 BEM 命名的组件类 |

### 何时写全局样式（放在 `packages/ui/src/styles/`）

| 场景                       | 处理                                                                                         |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| 全局 reset / 工具类        | 放在 `packages/ui/src/styles/`（base/ 与 utilities/ 子目录），**不写 scoped**（无 BEM 命名） |
| Element Plus 主题覆盖      | 放在 `packages/ui/src/styles/element-overwrite/`（目录，按组件维度拆分文件）                 |
| 路由过渡 / fade keyframes  | 放在 `packages/ui/src/styles/base/transition.scss`                                           |
| **禁止** Element Plus 穿透 | ❌ 禁止写 `:deep(.el-button)`——去掉 scoped 后 `:deep()` 非法                                 |

---

## 📁 文件组织

> Monorepo 后全局样式资产归 @vv/ui 包（`packages/ui/src/styles/`——2026-11-03 起 styles/ 自 assets/ 上移，assets/ 只放静态资源），全局组件归 @vv/ui（`packages/ui/src/components/`，unplugin-vue-components 自动注册，见 docs/08 §3.3）；各 app 私有组件放 `apps/<a>/src/components/`。

```
packages/ui/src/styles/      # 五目录骨架（docs/49）：值与用法分离
├── index.scss               # 入口：七段顺序 @use（reset → tokens → themes → transition → a11y → element-overwrite → utilities）
├── tokens/                  # 设计令牌六族：_colors/_spacing/_typography/_shadow/_z-index/_motion + index @forward
├── themes/                  # 主题覆盖：_light/_dark mixin + index.scss 选择器应用点（[data-theme] + prefers-color-scheme）
├── base/                    # reset.css（浏览器基线 + 滚动条）+ transition.scss（全局动画）+ a11y.css（:focus-visible/::selection）
├── tools/                   # mixin 三件套：_bem/_responsive/_transitions（零 CSS 产出，SFC 按需 @use）
├── utilities/custom.scss    # 复合场景工具类（.vv-flex-center / .vv-flex-between / .vv-ellipsis-* 等）
└── element-overwrite/       # Element Plus 主题覆盖（目录，按组件维度拆分文件）

packages/ui/src/components/   # @vv/ui 全局组件（components/common + ProTable + form-schema 三目录，自动注册）
apps/<a>/src/components/      # app 私有全局组件（自动注册 dirs 扩展位）
apps/<a>/src/layouts/<m>/     # 路由级布局（layout 私有子组件归各 app，如 apps/admin/src/layouts/default/）
```

### 规则

1. **全局样式只放在 `packages/ui/src/styles/`**：禁止在组件中写"全局生效"的样式
2. **组件样式写在 SFC 内**：禁止拆出独立 `.scss` 文件（除非组件库对外发布，且行数超过 400）
3. **跨组件复用的样式 → 抽到 `tokens/` 对应族文件**：禁止在组件内 `:root { --xxx: ... }` 散落定义

---

## ✅ 评审 Checklist

> 代码评审时，对涉及样式的 PR 必须逐条过。

```
□  1. 命名是否符合 BEM（Block__Element--Modifier / is-{state}）？
□  2. createNamespace name 是否 kebab-case（不是 PascalCase）？
□  3. createNamespace name 是否与 sass 根选择器 .#{$BEM_PREFIX}-name 一致？
□  4. Element 是否仅在所属 Block 内部使用？
□  5. Modifier 是否仅调整外观（未改变 DOM 结构）？
□  6. 是否滥用 Element 嵌套 Element（__a__b）？
□  7. <style> 块是否 lang="scss"？
□  8. <style> 块是否无 scoped？
□  9. 方案 A：根选择器是否用 .#{$BEM_PREFIX}-<kebab> 形式（不带硬编码前缀）？
□ 10. 方案 A：element/modifier 是否用 &__xxx / &--yyy 嵌套（不写重复前缀）？
□ 11. 方案 B：是否用 @include b(block-name) { @include e(elem) { ... } }（不传完整前缀）？
□ 12. 方案 B：是否避免在 <style> 内 @use '@vv/ui/styles/tools/bem' as *;（vite 已注入）？
□ 13. 是否避开了命名禁区（缩写 / camelCase / PascalCase Block 名）？
□ 14. 是否避免了深层嵌套（>4 层需重构成多个 Block）？
□ 15. 是否避免了 .is-* 被硬编码到模板（应通过 bem.is() 切换）？
□ 16. 是否避免了 :deep() 伪类（无 scoped 时 :deep() 非法）？
```

---

## 🛠️ How to write a new component（端到端流程）

> 新人首次写业务组件的完整流程。从命名到评审，5 步可走完。

### Step 1：定 Block 名（kebab-case）

```
✅ user-card / order-list / data-table
❌ UserCard / userCard / usercard / card
```

Block 名就是组件的"作用域根"，**全局唯一**（不要用 `card` / `button` 这种通用名）。

### Step 2：创建组件文件

```
src/components/<block-name>/  （通用组件）
或
src/modules/<m>/components/<block-name>/  （模块私有组件）
├── index.vue
└── <block-name>.spec.ts  （可选，复杂组件才加）
```

> Vue 文件名用 kebab-case（如 `user-card.vue`），与 Block 名一致。

### Step 3：SFC 三段结构模板（v2 规范）

```vue
<script setup lang="ts">
// 1. props/emits 用 interface（详见 CLAUDE.md §四 TS 用法）
interface UserCardProps {
  user: { id: number; name: string; avatar?: string }
  variant?: 'default' | 'compact'
}
const props = withDefaults(defineProps<UserCardProps>(), { variant: 'default' })

// 2. 状态用 ref；不要在 computed 内改 ref
const collapsed = ref(false)

// 3. emit 用 defineEmits<T>()
const emit = defineEmits<{ select: [id: number] }>()

// 4. createNamespace（已通过 vite AutoImport 全局化，无需 import）。
//    只传基础名（kebab-case），前缀由 $BEM_PREFIX（默认 vv）自动拼接。
const bem = createNamespace('user-card')
</script>

<template>
  <!-- 5. BEM 类名：block / element / modifier / state（运行时拼接，自动带前缀） -->
  <div :class="[bem.b(), bem.m(`variant-${props.variant}`)]">
    <img :class="bem.e('avatar')" :src="user.avatar" />
    <h3 :class="bem.e('name')">{{ user.name }}</h3>
    <button
      :class="[bem.e('action'), bem.is('collapsed', collapsed)]"
      @click="emit('select', user.id)"
    >
      查看
    </button>
  </div>
</template>

<style lang="scss">
// 6. sass 插值写法（v2 规范，v1 mixin 已弃用）
//    根选择器用 .#{$BEM_PREFIX}-<kebab>，element/modifier 用 & 嵌套。
//    本文件不要写 @use 'bem'——vite additionalData 已注入 $BEM_PREFIX。
//    禁止加 scoped（BEM 命名空间已是隔离层，加 scoped 反而与 :deep() 冲突）。
.#{$BEM_PREFIX}-user-card {
  display: flex;
  gap: 12px;

  &__avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
  }

  &__name {
    margin: 0;
    font-size: var(--font-size-md);
  }

  &__action {
    padding: 4px 12px;
    border: 1px solid var(--border-base);
    background: var(--bg-primary);
    cursor: pointer;

    &--primary {
      background: var(--el-color-primary);
      color: #fff;
    }
  }

  // 7. Block Modifier：仅调整外观，不改 DOM
  &--variant-compact {
    gap: 8px;

    &__avatar {
      width: 32px;
      height: 32px;
    }
  }

  // 8. State：用 &.is-xxx（与 bem.is() 输出对齐）
  &.is-collapsed {
    .#{$BEM_PREFIX}-user-card__action {
      padding: 2px 8px;
      font-size: 12px;
    }
  }
}
</style>
```

### Step 4：4 个最常见反例

| #   | 反例                                                          | 正确做法                                                   |
| --- | ------------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | `createNamespace('UserCard')`（PascalCase）                   | `createNamespace('user-card')`（kebab-case）               |
| 2   | `class="user-card-avatar"`（混 kebab 和 BEM）                 | `class="vv-user-card__avatar"`（bem.e() 生成）             |
| 3   | `<div class="user-card__header__title">`（3 层 Element 嵌套） | 拆为多个 Block（如 `user-card__header` + `header__title`） |
| 4   | `<style scoped>` 或 `:deep(.el-button)`                       | 去掉 scoped，依赖 BEM 命名空间隔离穿透第三方组件           |

### Step 5：跑 `pnpm check:routes` + ESLint + 单测

```bash
pnpm lint:fix        # ESLint 自动修复 + 检查 BEM 命名
pnpm test --run      # 若有 <block>.spec.ts 跑单测
pnpm check:routes    # 如果改了 routes/* 跑一致性
```

---

## ❓ FAQ

### Q1：为什么 BEM 命名就足够隔离，不用 `scoped`？

**A**：三方面原因，详见上方"为什么不写 scoped"章节。核心：**BEM 命名空间本身就是隔离层**，`scoped` 加的 `[data-v-xxx]` 属性选择器是冗余的，反而与 `:deep()` 伪类冲突（`:deep()` 仅在 scoped 中有效）。

### Q2：Element Plus 的 BEM 怎么对齐？

**A**：Element Plus 类名是 `el-button`、`el-button--primary`、`el-button__content`，与本规范完全兼容。本项目自定义组件使用 **`vv-` 前缀**（与 Element Plus 的 `el-` 同源约定），由环境变量 `VITE_BEM_PREFIX` 控制，默认 `vv`。

### Q3：sass 插值写法 vs SCSS mixin 写法，哪个好？

| 维度         | 方案 A sass 插值（推荐）       | 方案 B SCSS mixin（备选）       |
| ------------ | ------------------------------ | ------------------------------- |
| 调试类名     | ✅ 直接看到（sass 编译后展开） | ⚠️ 编译后才能看                 |
| 心智成本     | ✅ 零成本（标准 sass 语法）    | ⚠️ 需记 mixin 名（b/e/m/em/is） |
| IDE 高亮兼容 | ✅ 原生 sass 支持              | ⚠️ 部分 IDE 不识别 mixin 调用   |
| 嵌套可读性   | ⚠️ 嵌套深时视觉臃肿            | ✅ 优秀（mixin 嵌套自带作用域） |
| 大型组件适用 | ⚠️ 选 ≥20 个时累赘             | ✅ 嵌套清晰                     |
| **运行产物** | 完全等价                       | 完全等价                        |

详见 §🎨"方案 A vs 方案 B 对比"章节。两种写法运行时产物完全等价，按场景灵活选择。

**建议**：

- 简单组件（≤10 选择器）→ 方案 A
- 复杂组件（选 ≥20、嵌套深）→ 方案 B

### Q4：什么时候用 `bem.is()`，什么时候用 `bem.m()`？

| 场景                                      | 方法       | 说明                  |
| ----------------------------------------- | ---------- | --------------------- |
| 运行时状态切换（loading/active/disabled） | `bem.is()` | 通过 Vue 响应式切换   |
| 视觉变体（primary/success/warning）       | `bem.m()`  | 通常由 props 静态决定 |

注意：`bem.is('active', true)` 返回 `'is-active'`，`bem.is('active', false)` 返回 `''`（空串，Vue 自动忽略）。

### Q5：UnoCSS 原子类与 BEM 冲突吗？

**A**：不冲突。UnoCSS 用于**布局/工具类**（`flex`、`p-4`、`text-center`），BEM 用于**业务组件作用域样式**。规则：

```vue
<!-- ✅ 正确：UnoCSS 布局 + BEM 业务样式 -->
<div class="user-card flex items-center justify-between">
  <img class="user-card__avatar" />
</div>

<!-- ❌ 反例：把 BEM 类名硬塞进 UnoCSS 工具类名 -->
<div class="user-card-flex">  <!-- 这不是 BEM，也不是 UnoCSS 工具类 -->
```

---

## 🔗 相关文档

- **CLAUDE.md §3 组件 BEM 编写规范（强约束）**：项目级别硬规则，详细列出强制约定 9 条 + 反模式 7 条
- 工具链：`docs/04-构建与测试工具.md` §Sass 配置
- 代码评审：`docs/02-代码质量工具链.md` §ESLint flat config
- 设计规范：`docs/superpowers/specs/2026-07-17-vue3-vite-ts-scaffold-design.md`
- BEM 运行时工具：`packages/shared/src/utils/bem.ts`
- BEM mixin（方案 B）：`packages/ui/src/styles/tools/_bem.scss`
- 示范组件：`apps/admin/src/layouts/default/components/ToolHeader.vue`、`packages/ui/src/components/common/AsyncState.vue`
