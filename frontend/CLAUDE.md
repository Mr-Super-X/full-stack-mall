@AGENTS.md

# CLAUDE.md

> 双文件结构：对任何工具都成立的团队标准（命令、约束、禁区）在根目录 `AGENTS.md`，经首行 `@AGENTS.md` 导入；本文件只保留 Claude Code 专属指令、个人偏好，以及 AGENTS.md 提炼版装不下的细则补充。

## Claude 专属

### 与全局规则的关系

> 本文档是 `~/.claude/CLAUDE.md` 的项目级补充。所有全局规则（§一～§十一）自动适用，遇到冲突以**本文档为准**。

### workspace 修改申请模板

如需做 §2.2 所列任一操作（且不属于 §2.3 例外），必须先输出**修改申请**（≤10 行）并等用户**单独批准**后才能动手：

```markdown
【workspace 修改申请】<方案名>

- 操作类型：[新增 app / 新增包 / 删除 / 重命名 / 移动 / 改职责 / 改依赖方向]
- 目标路径：apps|packages|scripts/xxx（可多行）
- 原因：[业务原因，≤2 句]
- 影响面：[影响哪些 app/包/调用方/路由/类型/turbo 拓扑]
- 备选：[是否考虑过其他归属，引用 docs/43 / docs/18 §2 决策矩阵]
- 回退：[如何恢复，是否需要备份]
```

### 合规简报验证机制

每次任务完成后，**必须**输出合规简报，其中以**表格形式**列出本次对 workspace 的全部写操作（含 apps/* / packages/* / scripts/ / 根配置），逐项写明**原功能/原状**与**本次变更内容**，由用户复核。无清单 = 未完成。

| 文件路径     | 操作（新增/修改/删除） | 原功能/原状 | 本次变更 |
| ------------ | ---------------------- | ----------- | -------- |
| （逐行登记） |                        |             |          |

**承诺**：所有对 workspace 的写操作按 §2 架构锁定执行——§2.3 例外条款（用户明确指定文件路径）直接实施；其他必须先输出修改申请并等用户单独批准。

### Skill 路由（gstack）

当用户请求匹配到可用 gstack skill 时，通过 Skill 工具调用；不确定时优先调用。

- 产品想法/头脑风暴 → `/office-hours`
- 战略/范围 → `/plan-ceo-review`
- 架构 → `/plan-eng-review`
- 设计体系/计划审查 → `/design-consultation` 或 `/plan-design-review`
- 完整多视角审查管道 → `/autoplan`
- Bug/报错 → `/investigate`
- QA/站点行为验证 → `/qa` 或 `/qa-only`
- 代码审查/diff 检查 → `/review`
- 视觉打磨 → `/design-review`
- 发布/部署/PR → `/ship` 或 `/land-and-deploy`
- 保存进度 → `/context-save`
- 恢复上下文 → `/context-restore`
- 编写 backlog 就绪的 spec/issue → `/spec`

## 个人偏好

本文件不收录个人偏好；个人偏好统一维护在 `~/.claude/CLAUDE.md`（用户全局文件）。

---

## 团队标准细则（AGENTS.md 补充）

> 本节只收录 AGENTS.md 提炼版装不下的细则（对照表 / 机制解释 / 示例）；规则本身以 AGENTS.md 为准。
> 节号沿用原 CLAUDE.md 编号，外部文档的历史引用（如「§4 #16」）可追溯：Commands 表 → AGENTS.md「常用命令」；§1.1 目录树 → 删除（结构以 codegraph 索引为准）；§1.4 → AGENTS.md「架构不变量」第 4 条；§4 约束表 → AGENTS.md「项目约束」（§4 #16 = 项目约束第 11 条）；§5 → AGENTS.md「专题文档速查」。

### §1.2 模块边界铁律（强制）

| 层级                       | 允许引用                                                                                                                              | 不允许引用                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `modules/<m>/views`        | 本模块 components / composables / utils / api；`layouts/<m>/config` 暴露的类型契约（inject/provide 跨层所需，如 BIG_SCALE_STATE_KEY） | 其他模块内部                                     |
| `modules/<m>/components`   | 本模块 views / composables / utils                                                                                                    | 其他模块                                         |
| `modules/<m>/store`        | 本模块 api / types                                                                                                                    | 其他模块 store                                   |
| `components/common`        | utils / enums / types / store/modules                                                                                                 | 任何 `modules/` 内容                             |
| `layouts/<m>/`             | 本布局内 `components/` / `config/` / `images/` / `styles/` + utils / enums / types / store/modules / composables                      | `@/components/` 下任何内容、其他 `layouts/` 内容 |
| `store/modules`（全局）    | api / utils / enums                                                                                                                   | `modules/` 内容                                  |
| `directives/` / `plugins/` | utils / enums / types / store/modules                                                                                                 | `modules/` 内容                                  |

模块间通信通过 `modules/<m>/index.ts` 对外接口暴露，**禁止直接 import 其他模块内部文件**。

### §1.3 状态管理分层细则

- 全局 `store/modules/` barrel 仅 5 个跨模块共享 store：`app`（`pick: ['layout', 'locale']` 持久化）、`user`（httpOnly cookie 模式：凭证由后端 Set-Cookie 管理、前端不可读，`Session.get('auth')` 仅为守卫同步判断的登录标记，**无 token 落 localStorage**）、`theme`（`pick: ['mode', 'primaryColor']`）、`tags-view`（**刻意不持久化**，避免换账号看到老 tab）、`dict`（5min TTL + Promise 防抖池）。
- `useRouterStore`（`src/store/modules/router.ts`）**不在 barrel**，由 `router/guards/remote-menu.ts` 内部消费，不属于跨模块共享。

### §1.5 业务代码封装细则

- ESLint 仅机械拦截 `useAppRouter` / `useRequest` 两条（`no-restricted-imports` error 级）；`useAuth` / `useDialog` / `useConfirm` 暂无 ESLint 规则，靠本规范 + code review 兜底（详见 [`docs/02-代码质量工具链.md`](docs/02-代码质量工具链.md)）。
- 语义差异：`useDialog` 取消时 reject `DialogCancelledError`；`useConfirm` 取消时 resolve `false`，调用方无须 try/catch。

### §1.6 AutoImport 细则

标识符注入清单以各 app `apps/<a>/src/types/auto-imports.d.ts`（dev/build 时生成）为准。新增注入标识符：改 `packages/config/src/create-vite-config.ts` 的 `AutoImport.imports` 数组 + 重启 dev server。

仍需显式 import 的内容：

| 类型                                                       | 示例                                                                     | 原因                                                                                    |
| ---------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| 第三方 UI 库组件                                           | `import { User, Lock } from '@element-plus/icons-vue'`                   | element-plus 用 `unplugin-vue-components` 按需注入，与 AutoImport 是两套机制            |
| 第三方工具库                                               | `import dayjs from 'dayjs'`                                              | 不在 AutoImport 配置列表中                                                              |
| 全局组件（`@vv/ui` 包三目录 + app 私有 `src/components/`） | **不要 import**，模板直接 `<BaseChart />` / `<ProTable />` / `<XForm />` | 自动注册到 `vue.GlobalComponents`；显式 import 会让 IDE hover 丢失类型展开（详见 §1.7） |
| app 内其他子目录组件（非自动注册）                         | `import Xxx from '@/components/sub/Xxx.vue'`                             | 仅当组件不在自动注册 dirs 内时才需显式 import                                           |
| 未注入的 shared composable（`useTheme`）                   | `import { useTheme } from '@vv/shared'`                                  | 工厂 `VV_SOURCE_MODULES` 未注入 `useTheme`（低频 API 不污染 setup 全局作用域）          |
| 类型导入                                                   | `import type { UserProfile } from '@/api/modules/auth'`                  | 类型 import 不参与运行时，但 TS 编译器需要                                              |
| SCSS / 资源文件                                            | 在 `<style>` 中用 `@use`                                                 | CSS 走 vite 资源管线，与 JS AutoImport 解耦                                             |

### §1.6.1 不常见 API 必须加来源注释

使用不属于高频 API（`ref` / `computed` / `watch` / `useRoute` / `defineStore` 等一眼能认出的）的自动注入标识符时，在 `.vue` 的 `<script setup>` 第一行或该标识符首次出现处上方加一行来源注释（**≤40 字**，说明来自哪个包）：

| 标识符（举例）                                             | 注释示例                                         |
| ---------------------------------------------------------- | ------------------------------------------------ |
| `storeToRefs`、`acceptHMRUpdate`                           | `// pinia 工具`                                  |
| `useAppRouter`、`useRequest`、`useAuth`、`useDict`         | `// 项目 composable @vv/shared（vite 自动注入）` |
| `useDialog`、`useConfirm`、`useLogout`                     | `// 项目 composable @vv/ui（vite 自动注入）`     |
| `createNamespace`                                          | `// 项目 BEM 工具 @vv/shared（vite 自动注入）`   |
| `RouterLink`、`RouterView`、`useLink`                      | `// vue-router 组件`                             |
| `watchEffect`、`nextTick`、`onErrorCaptured`、`shallowRef` | `// vue（生命周期/底层 API）`                    |

> 例外：`import { useUserStore } from '@/store/modules/user'` 这类业务 import 自带路径信息（IDE hover 可见），无需额外标注。

### §1.6.2 包消费约定（别名 vs 包名）

| 消费场景                                                               | 约定引用方式                                                 | 定性                                                                                                                               |
| ---------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| app 引用**自身 src** 文件                                              | `@/` 别名（或同目录 `./` 相对路径）                          | 合法、**永久保留**（`@/` 恒指本 app）                                                                                              |
| app 消费 `@vv/shared` 公共能力                                         | `import { ... } from '@vv/shared'`（根 barrel）              | **首选**——包边界可见，barrel 收敛公共 API                                                                                          |
| app 消费 `@vv/ui`（useDialog / useConfirm / useLogout 等）             | 包名路径（`@vv/ui/composables/useDialog`）或 AutoImport 注入 | 组件本体按 §1.7 走自动注册，不 import                                                                                              |
| `@api` / `@locales` / `@directives` / `@mock`                          | 别名                                                         | **既定例外**（barrel 刻意不聚合，见下）                                                                                            |
| `@components/*`                                                        | ——                                                           | **已收敛**：一律走 `@vv/ui/components/**` 显式文件路径（含 `index.ts`/`types.ts` 后缀）；@vv/ui 根 barrel 刻意不聚合 components/** |
| `@utils/*` / `@store/*` / `@enums/*` / `@composables/*` 等别名深层路径 | ——                                                           | **过渡态遗留**：新代码禁止新增，存量渐进收敛至包名 barrel                                                                          |

规则要点：

1. **别名机制本身保留**：`packages/config/src/app-aliases.ts` 别名定义不动（vite/tsconfig/check-aliases 三处消费），收敛只改消费侧 import。
2. **为什么收敛**：别名深层路径让包边界在消费代码中不可见，且绕过 barrel 的公共 API 收敛——包内部文件路径变化会直接炸消费方。
3. **既有例外不要误伤**：`packages/shared/src/index.ts` 头注刻意不聚合 `./api`（模块加载即建 axios 实例）、`./directives`（import.meta.glob 注册插件）、`./locales`（createI18n 副作用）——这三类消费经别名是既定路径。
4. **测试 mock 同步**：`vi.mock()` 说明符必须与被测模块的 import 说明符一致，否则失去拦截；被测模块从 barrel 同时消费多个导出时，用单点 mock + `importOriginal` 展开覆盖（同模块声明两个 `vi.mock('@vv/shared')` 后者覆盖前者）。
5. **收敛节奏**：不做大爆炸全量替换，按「热点优先」批次走——每批只改带引号 import 说明符，过三门禁（`pnpm type-check` / `pnpm check:aliases` / `pnpm test`）。
6. **与 AutoImport 的优先级**：注入清单内的标识符一律不显式 import；本节裁决的是**确需显式 import** 的场景（未注入标识符如 `useTheme`、mock 说明符、非注入的工具/类型）的来源选择。先判「要不要 import」（注入清单），再判「从哪 import」（本节）。

### §1.6.3 包源码自包含约定（packages/* 生产源码不使用 AutoImport）

- `apps/*`：维持 AutoImport 规则不变（业务 DX 优先）。
- `packages/*` 生产源码：**一律显式 import**（含 vue/pinia/vue-router 高频 API 与 ElMessage 等），不依赖宿主转换才能运行；ElMessage 等组件的显式 import 须同时携带样式副作用（`element-plus/es/components/message/style/css`）。
- 依赖可见性：packages/* 消费的每个 npm 包必须声明在自身 package.json——本地规则 `local/package-contract`（error 级，`pnpm lint` + CI 机械检查）兜底，含 @vv/* 方向铁律（mock → shared、ui → shared；构建装配配置豁免方向检查）。
- `packages/ui` 存量注入式源码与其 `src/types/auto-globals.d.ts` 暂保留，收敛为独立批次（本约定对 ui 为新代码约束先行）。

### §1.7 组件全局注册（强约束）

`unplugin-vue-components` 按 dirs 自动扫描 `@vv/ui` 包三目录（`components/common` + `components/ProTable` + `components/form-schema`，`deep: true` 含深层子目录）与各 app `src/components/` 下所有 .vue，按文件名（PascalCase）注册到 `vue.GlobalComponents`；产物 `apps/<a>/src/types/components.d.ts` 由 gitignore 屏蔽，仅在 `pnpm dev` / `pnpm build` 时重新生成。

- ✅ 模板中直接使用 `<BaseChart />` / `<ProTable />` / `<XForm />` / `<ProDialog />` 等，无须显式 import——IDE 经 `GlobalComponents` 路径解析，hover 展示完整 `DefineComponent` 类型签名（props / expose / slots）。
- ❌ 不要写 `import BaseChart from '...'`——Volar 对 ESM import 路径不做完整类型展开，hover 只显示 `import BaseChart`，丢失智能提示。
- 唯一例外：`<script setup>` 中需要 `InstanceType<typeof Xxx>` 作 ref 类型声明时（如取 `defineExpose` 暴露的方法），仍需显式 `import ProTable from '@vv/ui/components/ProTable/ProTable.vue'`。

---

## §2 ⚠️ apps/packages 架构锁定（最高优先级）

锁定对象：workspace 两级拓扑（`apps/*` × `packages/*`）+ 各 app 内部 src 结构。治理精神：**结构即契约，未经明确批准不得变更**（应用/包清单与端口见各 app `app.manifest.json` 及 codegraph 索引，本文件不维护目录表）。

### §2.1 依赖方向铁律（比目录锁更优先）

```text
apps/*  ──可依赖──▶  packages/*
apps/*  ──✗ 互相依赖──  apps/*（跨 app 通信走整页跳转协议，见 docs/43 §统一登录协议）
packages/*  ──单向──▶  config ∥ shared（并列上游）→ mock → ui（下游可引用上游；上游禁止反向依赖下游）
// 注：mock 仅以 import type 消费 @vv/shared 契约类型（编译期擦除，无运行时依赖）
packages/*  ──✗ 依赖──  apps/*；运行时依赖（vue/element-plus 等）一律 peerDependencies + catalog
```

边界机械强制手段（error 级）：`eslint.config.mjs` 的 `app/boundary-packages`（packages/** 禁依赖 apps/**）+ `app/boundary-apps-<a>`（逐 app 禁相对逃逸/绝对路径引用其他 app）+ `app/business-wrap-rule`（拦截裸用 vue-router useRouter / axios）；覆盖不到的语义以 code review 兜底。

### §2.2 禁止行为（最严格）

未经用户在每次具体任务中**明确批准**，**严禁**对 workspace 内任何路径实施以下任何操作：

- ❌ **新增 / 删除 / 重命名 / 移动**任何 app（`apps/<a>`）、包（`packages/<p>`）或根一级目录
- ❌ 违反 §2.1 依赖方向铁律（如 `@vv/shared` 反向 import `@vv/ui`、`apps/*` 互相 import）
- ❌ 改变任何 app / 包内部一级目录的**职责定位**（如把 `packages/shared` 改成依赖 Element Plus）
- ❌ 修改 `pnpm-workspace.yaml`、`turbo.json`、根 `package.json` scripts、各 app `vite.config.ts`、`packages/config` 工厂、根 `tsconfig.*`、`eslint.config.mjs` 中任何与 workspace 解析相关的配置
- ❌ 增删改移动重命名 app 内部 `src/` 一级目录：api / assets / components / composables / directives / enums / layouts / locales / modules / plugins / router / store / types / utils / styles（端级样式层三件套骨架见 docs/49 §5）

### §2.3 例外条款

用户在当前轮对话中**明确指定**目标文件路径（格式如：「在 `packages/shared/src/api/http.ts` 加 xxx」「新增 `apps/admin/src/modules/foo/views/Bar.vue`」），视为已对**该单次操作**预先批准——无需再次询问。

> 例外只覆盖**该次明确提及的文件**，不延伸到其他文件。

### §2.4 / §2.5 修改申请模板与验证机制

模板与合规简报格式见本文件「Claude 专属」节；规则本身（须先申请、须等批准、任务完成须列表格化写操作清单）见根目录 `AGENTS.md`「工作区架构锁定」节。

### §2.6 退役准则

治理面只增不减是维护螺旋：门禁、app、文档都须有退出路径。

1. **门禁退役**：新增 CI 门禁时须在 ci.yml 注释声明「保护的事故史」；某门禁连续两个审查周期零拦截且其保护面已被上游机制覆盖 → 列入退役评估（降级为 warn 或删除）。
2. **app keep/kill 复审**：vue 大版本升级等全量验证窗口前，所有者对每个 showroom app 回答「删掉它我会损失什么」——答不上来即退役候选。
3. **文档预算**：docs/ 根级文档数由 `check:doc-currency` 第 14 项冻结；新增须改预算值并在 PR 说明理由，瘦身先合并/归档再降预算。

---

## §3 组件 BEM 编写规范（强约束）

> 所有 `.vue` 单文件组件必须按本节编写，与 §2 同为不可妥协硬规则。
> 样式分层全局规范（五层架构 / tokens 命名 / z-index 分层 / EP 覆盖三级 / app 特性样式归属）见 [`docs/49-样式分层架构规范.md`](docs/49-样式分层架构规范.md)。

### §3.1 完整模板

```vue
<script setup lang="ts">
const bem = createNamespace('form-engine') // kebab-case，必须与 sass 根选择器 .#{$BEM_PREFIX}-form-engine 严格对齐
</script>

<template>
  <div :class="bem.b()">
    <header :class="bem.e('header')">...</header>
  </div>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-form-engine {
  /* 不写 scoped —— 命名空间隔离由 BEM 完成 */
  &__header {
    /* element */
  }
  &--primary {
    /* modifier */
  }
}
</style>
```

### §3.2 强制约定

| #   | 项                             | 约束                                                                                                                                                                                                                                                                                          |
| --- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `createNamespace` / `bem` 来源 | 由 `unplugin-auto-import` 自动注入，**禁止** `import { createNamespace } from '...'`                                                                                                                                                                                                          |
| 2   | `bem` 实例声明                 | `const bem = createNamespace('<kebab-case>')`，组件名必须 **kebab-case**（PascalCase 转换规则：每个大写字母前加 `-` 后全小写，如 `OrdersList` → `'orders-list'`），与 sass 根选择器 `.#{$BEM_PREFIX}-<kebab-case>` **严格对齐**——HTML class 与 CSS 选择器大小写敏感，不一致将导致整片样式失效 |
| 3   | 模板 class 拼装                | 必须通过 `bem.b()` / `bem.e()` / `bem.m()` / `bem.is()` / `bem.has()` 拼装，**禁止**硬编码 `vv-` 前缀字符串                                                                                                                                                                                   |
| 4   | `<style>` 块 `lang` 属性       | 必填 `lang="scss"`，用于解析 `$BEM_PREFIX` Sass 变量                                                                                                                                                                                                                                          |
| 5   | `<style>` 块 `scoped` 属性     | **禁止添加**——命名空间隔离由 BEM 接管，scoped 是冗余；连锁约束：非 scoped 样式下 `:deep()` 不会被编译（见第 10 条）                                                                                                                                                                           |
| 6   | 根选择器写法                   | 必须 `.#{$BEM_PREFIX}-组件名-kebab-case`，与 `bem` 实例一一对应                                                                                                                                                                                                                               |
| 7   | 嵌套占位符                     | element 用 `&__xxx`、modifier 用 `&--yyy`、状态用 `&.is-xxx` / `&.has-xxx`，禁止重复拼接前缀                                                                                                                                                                                                  |
| 8   | BEM 默认前缀                   | `vv`（即 `$BEM_PREFIX` 默认值），由 `unplugin-auto-import` 注入                                                                                                                                                                                                                               |
| 9   | `bem.m()` vs `bem.em()` 选择   | **block modifier** 用 `bem.m('xxx')` → `vv-<block>--xxx`；**element modifier** 用 `bem.em('elem', 'xxx')` → `vv-<block>__elem--xxx`。误用会导致 class 与 sass 嵌套选择器不匹配，样式失效                                                                                                      |
| 10  | 穿透写法                       | 非 scoped 样式下 `:deep()` / `::v-deep` / `:v-deep` **均不会被编译**，会以伪类原样输出并被整条规则丢弃——**必须直接写后代选择器**（如 `.#{$BEM_PREFIX}-form-engine .el-input__inner { ... }`）                                                                                                 |
| 11  | `bem` 实例数量                 | 同一组件只声明一份 `bem` 实例，多份会造成命名空间分裂、样式不生效                                                                                                                                                                                                                             |

### §3.3 验证机制

- 每次新增 / 修改 `.vue` 文件前，**逐条**比对 §3.2。
- 合规简报必须附「本次 BEM 规范核查清单」：本次涉及的 `.vue` 文件路径 + §3.2 每条判定结果。
- `pnpm lint` / `pnpm type-check:full` 无法自动检测此类违规时，以人工核查清单为准。

---

## 设计工作规范

团队级设计工序与工具搭配（对任何 AI 工具成立）见根 `AGENTS.md`「设计工作规范」节——impeccable × taste-skill 分工、surface mode 化投入、浏览器三宽验收纪律；本文件不重复收录。配套产物：产品上下文 `PRODUCT.md`、视觉 token 锚点 `DESIGN.md`（均为 impeccable 体系维护，新增自有 token 先登记 DESIGN.md 再使用）。
