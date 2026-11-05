# Git 工作流工具链配置详解

> **文档版本**：v1.0.0 | **最后更新**：2026-07-20
> **覆盖工具**：husky 9 + commitlint 21 + commitizen 4 + cz-customizable 7 + only-allow 1

---

## 📋 工具一览

| 工具                                   | 版本     | 作用                                                                                       | 触发时机                                |
| -------------------------------------- | -------- | ------------------------------------------------------------------------------------------ | --------------------------------------- |
| **only-allow**                         | ^1.2.2   | 强制只使用 pnpm                                                                            | `preinstall` 钩子                       |
| **husky**                              | ^9.1.7   | Git hooks 管理                                                                             | git 操作触发                            |
| **lint-staged**                        | ^17.0.8  | 暂存区文件检查/格式化                                                                      | pre-commit                              |
| **commitlint**                         | ^21.2.1  | 校验 commit message 格式                                                                   | commit-msg                              |
| `scripts/check-commit-msg.sh`          | 项目脚本 | commit message AI 协作痕迹拦截（`Co-Authored-By` trailer + 生成/共创标注宽拦，含国产工具） | commit-msg（commitlint 之前，命中即拦） |
| **commitizen**                         | ^4.3.2   | 交互式生成规范 commit                                                                      | `pnpm commit` / `pnpm push`             |
| **cz-customizable**                    | ^7.5.4   | 自定义 commitizen 提问流程                                                                 | commitizen 调用                         |
| **release-it**                         | ^21.0.0  | 版本发布编排（bump + tag + push）                                                          | `pnpm release` / `pnpm release:dry`     |
| **@release-it/conventional-changelog** | ^12.0.0  | release-it 插件：CHANGELOG 按 conventional commits 生成                                    | release-it 内部调用                     |

---

## 🔄 完整 Git 工作流

```
$ npm install   ← ❌ 被拦截（红色框："Use pnpm install"）
$ pnpm install  ← ✅ 通过
   ↓
git add .
   ↓
git commit -m "..."      ← 传统方式
   或
pnpm commit              ← 交互式（仅提交，不推送）
   或
pnpm push                ← 推荐：一站式（add + cz + push）
   ↓
[husky pre-commit 触发]（Monorepo 迁移期精简版，实跑 2 步）
   ├── pnpm lint-staged              ← 对暂存文件跑 eslint --fix + prettier --write
   └── pnpm check:routes             ← 路由一致性（声明 / whitelist / 实际 routes）
   ⚠ type-check / check:aliases 不在本地 pre-commit（秒级提交体验优先），由 ci.yml
     的 turbo build（内含 type-check:full）+ check:aliases 等步骤在 CI 统一拦截。
     原单应用时期的 5 步链（generate:tsconfig-paths/type-check/check:aliases）见本文历史说明。
   ↓
[husky commit-msg 触发]（实跑 2 步）
   ├── sh scripts/check-commit-msg.sh "$1"  ← AI 协作痕迹拦截（命中即 exit 1，不再执行 commitlint）
   └── pnpm exec commitlint --edit "$1"     ← 校验 Angular 规范（中文输出）
       ├── 拒绝：无 type 前缀、空 subject、错误 type → 中文错误提示
       └── 通过：feat/fix/docs/style/refactor/perf/test/build/ci/chore/revert
   ↓
✅ commit 完成
```

---

## ⚙️ 配置文件

### `package.json` 关键字段

```jsonc
{
  "scripts": {
    "preinstall": "npx only-allow pnpm", // ← 拦截非 pnpm 安装
    "commit": "git add . && cz", // ← 交互式提交（仅 commit，不推送）
    "push": "git add . && cz && git push", // ← 推荐：一站式提交并推送
    "commitlint": "commitlint --edit",
    "prepare": "husky", // ← git hooks 自动启用
  },
  "config": {
    "commitizen": {
      "path": "cz-customizable", // ← commitizen 用 cz-customizable 作 adapter
    },
  },
}
```

### `.husky/pre-commit`

```sh
# Monorepo 迁移期临时精简钩子（2026-10-21，P0 阶段启用）
# 原五步链（generate:tsconfig-paths / type-check / check:aliases）假设单根 src/，
# P0-P1 迁移期结构性不适用；完整多包门禁链在 P5 重建：
# docs/superpowers/plans/2026-10-21-monorepo-migration.md（Task P5-1 / P5-5）
# 暂存区文件先自动格式化 + ESLint fix（lint-staged 仅处理变更文件，不全库扫描）
pnpm lint-staged
# 路由一致性检查（P0-2 起已改指 apps/*/src/modules，P0 期间仍指 src/，均可用）
pnpm check:routes
```

### `.husky/commit-msg`

```sh
# 禁止 AI 协作痕迹进入 commit message（owner 规定 2026-10-30，CLAUDE.md §4 #16）
# 检查逻辑独立在 scripts/check-commit-msg.sh（可单独执行/测试，词表含国外+国产 AI 工具）
# 命中即 exit 1 并附 --no-verify 逃生指引，不再执行 commitlint
sh scripts/check-commit-msg.sh "$1" || exit 1

pnpm exec commitlint --edit "$1"
```

> **注意**：必须用 `pnpm exec`（不要直接 `commitlint`），否则 pnpm 11 不 hoist 的 bin 找不到。

### `.husky/pre-push`

```sh
# affected 子集测试（2026-10-28 /autoplan D2 决策）：原 `pnpm test` 经 turbo dependsOn ^build
# 会每次 push 先全量 build 6 app + 4 包再全量测试，日常循环被拖慢。
# 与 CI PR 模式同参数（--filter=[origin/master]...）：只跑自 origin/master 以来
# 变更的包及其依赖测试；master 全量网由 CI（turbo run test 无 filter）兜底。
# 紧急逃生门：git push --no-verify（README Git 节已披露此成本与用法）。
pnpm exec turbo run test --filter=[origin/master]...
```

### `.commitlintrc.cjs`（commitlint 21）

```js
module.exports = {
  extends: ['@commitlint/config-conventional'],
  // 跳过包含 "init" 的 commit（如 init: 初始化项目、init: 重构脚手架 等）
  // commitlint 21 ignores 必须返回 boolean[]（数组里包函数）
  ignores: [(commit) => commit.includes('init')],
  // 自定义中文输出 formatter（官方支持的相对路径方式）
  // 源码：@commitlint/load/lib/load.js resolveFormatter() 支持 './my-formatter.js'
  formatter: './scripts/commitlint-formatter.cjs',
  rules: {
    // 关键：不允许空 type（commitlint 默认放过"无 type 前缀"消息，加这条才严格）
    'type-empty': [2, 'never'],
    // subject 长度限制（不含 type 前缀）
    'header-max-length': [2, 'always', 72],
    // 不强制 scope（保持灵活）
    'scope-empty': [0],
  },
}
```

**type 列表**（11 种，Angular 规范）：
`feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

### `scripts/commitlint-formatter.cjs`（自定义中文 formatter）

> 📋 **官方依据**：`@commitlint/load/lib/load.js` line 10-15 注释明说支持相对路径 `./my-formatter.js`；`@commitlint/cli/lib/cli.js` line 432-438 的 `loadFormatter()` 函数优先级：`--format` flag > `config.formatter` > 默认 `@commitlint/format`。

**输出示例**（错误 commit）：

```
⧗ 输入的 commit 信息：
  wrongtype: bad

✖ 找到 1 个错误：

  ✖ type 不在允许列表
    type must be one of [build(构建相关), chore(其他杂项), ci(持续集成),
    docs(文档变更), feat(新增功能), fix(修复缺陷), perf(性能优化),
    refactor(代码重构), revert(回滚提交), style(代码格式), test(测试用例)]
```

**输出示例**（标题超长）：

```
⧗ 输入的 commit 信息：
  feat: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa...

✖ 找到 1 个错误：

  ✖ 标题过长
    标题不能超过 72 字符, 当前长度 106 字符
```

**输出示例**（init 跳过 → 通过）：

```
✓ commit 信息符合 Angular 规范
```

**核心设计**：

| 模块                                 | 作用                                                                                                      |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `RULE_LABELS`                        | 14 条 commitlint 规则名 → 中文标签映射（源码 15 行含一处 `header-max-length` 重复键定义，运行时后者生效） |
| `TYPE_NAMES`                         | 11 种 type → 中文名（含 emoji 友好的简短标签）                                                            |
| `translateMessage(msg, ruleName)`    | 动态翻译错误消息（type-enum 列表 + header-max-length 完整句）                                             |
| `format(report, options)`            | commitlint 主函数，返回格式化字符串                                                                       |
| `try { pc = require('picocolors') }` | 颜色降级（picocolors 不可用时纯文本）                                                                     |

**颜色方案**：

| 颜色     | 用途                              |
| -------- | --------------------------------- |
| 红色 `✖` | 错误                              |
| 黄色 `⚠` | 警告                              |
| 绿色 `✓` | 通过                              |
| 灰色     | 输入的 commit message（辅助展示） |

**导出兼容**：

```js
module.exports = format
module.exports.format = format // 兼容 default export
module.exports.default = format // 兼容 import default
```

> commitlint 21 通过 `dynamicImport()` 加载（`@commitlint/cli/lib/cli.js:436`），三种导出方式都能识别。

### `.cz-config.json`（commitizen 4 + cz-customizable 7）

> 📋 **配置详解**：见本文档下方「commitizen 配置详解」章节

**文件名必须是 `.cz-config.js` 或 `.cz-config.json`**（cz-customizable 默认查找名，不识别 `.czrc` 或 `.cz-config.cjs`）

### `.npmrc`（pnpm 配置）

```ini
# 强制检查 package.json 中的 engines 字段，如果不满足条件则直接报错并退出安装/运行过程
engine-strict=true
```

> **pnpm 11 起项目级 `.npmrc` 配置不再被读取**——依赖构建许可（`allowBuilds`）与
> hoisting（`publicHoistPattern`）等须写在 `pnpm-workspace.yaml`（见 :79-82 / :125-128
> 及 :123 注释）。向 `.npmrc` 加 `shamefully-hoist=true` / `onlyBuiltDependencies` 无效。

---

## 🎮 常用命令

| 命令                           | 作用                                          |
| ------------------------------ | --------------------------------------------- |
| `pnpm install`                 | 安装依赖（被 only-allow 强制）                |
| `git commit -m "feat: 新功能"` | 传统提交（被 commitlint 校验）                |
| `pnpm commit`                  | 交互式提交（仅 commit，不推送）               |
| `pnpm push`                    | **推荐**：一站式提交并推送（add + cz + push） |
| `git cz`                       | commitizen 别名（同 `pnpm commit`）           |
| `pnpm commitlint`              | 手动校验（默认读 COMMIT_EDITMSG）             |

---

## 🐛 故障排查

### 1. `pnpm commit` 报 "Unable to find a configuration file"

**根因**：`.cz-config.cjs` / `.czrc` 文件名不被 cz-customizable 识别

**解决**：文件名改为 `.cz-config.js` 或 `.cz-config.json`（默认查找名）

### 2. `.cz-config.js` 报 "module is not defined in ES module scope"

**根因**：`package.json` 有 `"type": "module"`，`.js` 文件强制 ESM，不能用 `module.exports`

**解决**：

- 选项 A：用 `.cz-config.json`（JSON 无此问题）
- 选项 B：移除 `"type": "module"`（破坏其他配置）
- 选项 C：fork cz-customizable 支持 ESM

**当前选择**：选项 A（`.cz-config.json`）

### 3. `pnpm exec commitlint` 报 "Command not found"

**根因**：pnpm 11 默认不 hoist `@commitlint/cli` 的 bin 到 `.bin/`

**解决**：

- 钩子与手动校验一律走 `pnpm exec commitlint`（根 devDependencies 已声明，pnpm exec
  从 workspace 根解析 bin）——本项目 `.husky/commit-msg` 已是此写法
- 确需调整 hoisting 时改 `pnpm-workspace.yaml` 的 `publicHoistPattern`（pnpm 11 项目级
  `.npmrc` 不再被读取，写 `shamefully-hoist=true` 到 `.npmrc` 无效）

### 4. `npm install` 报 "Cannot read properties of null (reading 'matches')"

**根因**：npm 10/11 把 `package.json` 中的 `lint-staged` 等顶层字段当作依赖列表解析，arborist 解析崩溃

**解决**：把 `lint-staged` 配置移到独立文件 `.lintstagedrc.json`

### 5. only-allow 拦截提示框没出现

**检查清单**：

1. `package.json` 有 `"preinstall": "npx only-allow pnpm"` 吗？
2. 跑 `npm run preinstall` 能看到红色框吗？
3. 如果跑 `npm install` 先崩在 dependency resolution（看不到红色框），先解决 npm 解析问题（见 #4）

### 6. 自定义 commitlint formatter 不生效

**症状**：commitlint 仍输出英文（"type may not be empty"）

**检查清单**：

1. `.commitlintrc.cjs` 有 `formatter: './scripts/commitlint-formatter.cjs'` 吗？
2. `scripts/commitlint-formatter.cjs` 存在吗？导出 `format` 函数吗？
3. 直接跑 `echo "wrongtype: bad" | pnpm exec commitlint` 看输出是中文还是英文？
4. 如果英文，看 `node ./scripts/commitlint-formatter.cjs` 单独是否能加载（require 错误通常显示路径问题）

**扩展 formatter 翻译规则**：编辑 `scripts/commitlint-formatter.cjs` 的 `RULE_LABELS` 字典，加新规则即可：

```js
const RULE_LABELS = {
  'type-empty': 'type 不能为空',
  // 加新规则：
  'body-max-length': 'body 总长过长',
}
```

---

## 📝 commitizen 配置详解（`.cz-config.json`）

### 11 种 type 选项

| value      | emoji | 中文描述                       |
| ---------- | ----- | ------------------------------ |
| `feat`     | ✨    | 新功能                         |
| `fix`      | 🐛    | 修复 bug                       |
| `docs`     | 📝    | 文档变更                       |
| `chore`    | 🚀    | 对构建过程或辅助工具和库的更改 |
| `style`    | 💄    | 代码格式（不影响功能）         |
| `refactor` | ♻️    | 代码重构                       |
| `perf`     | ⚡    | 性能优化                       |
| `test`     | 🚨    | 添加、修改测试用例             |
| `build`    | 📦️    | 构建流程、外部依赖变更         |
| `ci`       | 👷    | 修改 CI 配置、脚本             |
| `revert`   | ⏪️    | 回滚 commit                    |

### 25 种 scope 选项

合并自：项目特定（api、auth、home 等）+ 通用前端（views、router、components 等）+ 兜底（other、custom）

每个 scope 格式：`{ value, name: "value       (描述)" }`

完整列表见 `.cz-config.json` 文件。

### 关键配置字段

| 字段                   | 值                                    | 作用                                         |
| ---------------------- | ------------------------------------- | -------------------------------------------- |
| `allowCustomScopes`    | `true`                                | 允许自定义填写 scope                         |
| `allowBreakingChanges` | `['feat', 'fix', 'refactor', 'perf']` | 这 4 种类型会询问 breaking change            |
| `subjectLimit`         | `72`                                  | subject 字符数限制（与 commitlint 对齐）     |
| `breaklineChar`        | `"\|"`                                | body/footer 换行符                           |
| `footerPrefix`         | `"ISSUES CLOSED:"`                    | footer 前缀                                  |
| `allowTicketNumber`    | `false`                               | 不询问 ticket 编号                           |
| `messages`             | 完整中文 8 条                         | 自定义交互提示（type/scope/subject/body 等） |

---

## 🔗 相关文档

- 代码质量：`docs/02-代码质量工具链.md`
- 工具兼容性踩坑：`docs/01-工具兼容性问题踩坑记录.md`
- commitlint 官方：https://github.com/conventional-changelog/commitlint
- commitlint formatter API：https://commitlint.js.org/api/format
- commitlint load 源码：`@commitlint/load/lib/load.js` resolveFormatter()
- cz-customizable 官方：https://github.com/leonardoanalista/cz-customizable

## 🚀 Release 流程

> **覆盖工具**：release-it 21 + @release-it/conventional-changelog 12

### 工具职责

| 工具                                   | 职责                                                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **release-it**                         | 版本发布编排：校验分支 → 询问版本 → bump → 调插件 → commit → tag → push                                       |
| **@release-it/conventional-changelog** | CHANGELOG 生成：读取 git log → 按 conventional commit 分类（11 种 type + 中文 emoji 双轨）→ 重写 CHANGELOG.md |

### 配置文件

| 配置文件           | 作用                                                                           |
| ------------------ | ------------------------------------------------------------------------------ |
| `.release-it.json` | release-it 主配置（git / hooks / plugins 内嵌 conventional-changelog presets） |

### 完整流程

```
$ pnpm release
  ↓
[release-it] 启动
  ↓
校验分支 ∈ {master, release/*} + 工作区干净
  ↓
交互式询问新版本号（推荐 patch / minor / major）
  ↓
hook: before:init    → pnpm type-check
  ↓
hook: before:release → pnpm test --run
  ↓
update version（package.json）
  ↓
git commit -m "chore(release): v${version}"
  ↓
git tag v${version} -m "Release v${version}"
  ↓
git push origin HEAD + git push origin v${version}
  ↓
[${version} released]
```

### 常用命令

| 命令               | 作用                                   |
| ------------------ | -------------------------------------- |
| `pnpm release`     | 真实发布（master / release/* 分支）    |
| `pnpm release:dry` | 预览发布流程（0 副作用，任意分支可用） |

### 错误分支

| 场景                     | 行为                                                |
| ------------------------ | --------------------------------------------------- |
| 不在 master / release/*  | 报错 `Must be on branch master,release/*`，exit 1   |
| 工作区有未提交改动       | 报错 `Please commit or stash changes first`，exit 1 |
| type-check 失败          | 报错（hook before:init），exit 1                    |
| test 失败                | 报错（hook before:release），exit 1                 |
| 自上次 tag 后无新 commit | 报错，exit 1                                        |
| tag v1.0.0 已存在        | 报错，exit 1，需手动选新版本号                      |

### 发版时 CHANGELOG 处理（2026-10-27 起：纯手写，生成器运行时下线——配置已从 .release-it.json 移除，依赖仍留 catalog）

**形态变更**：`@release-it/conventional-changelog` 插件已从 `.release-it.json` 移除——CHANGELOG.md 为**纯手写文档**，release-it 不参与生成。

**为什么弃用 plugin 形式**（2026-10-27 评估裁决）：

- 插件生成的版本段是 commit 列表骨架（每行一条 conventional commit + hash 链接），全部信息可从 git log 一键再生——**零增量价值**
- 本项目手写条目是五段式（背景引用块 / 变更清单 / 踩坑记录 / 验证证据 / 手动验证步骤）——「为什么这么做、踩了什么坑、怎么验证」无法从 git 历史再生，是接手者唯一需要的信息
- 两套语义并存的实测代价：生成段插入顶部后「未发布」区残留成孤儿区块，且同版本内「骨架行 + 详细条目」双记录无法判断哪个权威
- 结论：手写价值 ≫ 生成价值时，保留生成器只会制造合并负担——下线插件，release 回归「bump + tag + push」单一职责

**发版操作流程**（`pnpm release` 完成后）：

1. 把 `CHANGELOG.md` 顶部 `## 未发布` 标题改为版本段标题：`## v${version} (YYYY-MM-DD)`
2. 在文件顶部「未发布」位置重新开一个空的 `## 未发布` 区（供下一轮手写积累）
3. 提交：`git add CHANGELOG.md && git commit -m "docs(changelog): v${version} 归档"`——可 `--amend` 进 release commit 或独立提交

**如何回退启用插件**（将来若想恢复自动生成）：

1. `.release-it.json` 的 `hooks` 后加回 `plugins` 块（以下为下线前的完整配置，直接复制粘贴）：

```json
"plugins": {
  "@release-it/conventional-changelog": {
    "infile": "CHANGELOG.md",
    "preset": {
      "name": "conventionalcommits",
      "header": "# 📋 更新历史 \n\n",
      "types": [
        { "type": "feat", "section": "✨ Features | 新特性" },
        { "type": "fix", "section": "🐛 Bug Fixes | Bug 修复" },
        { "type": "perf", "section": "⚡ Performance Improvements | 性能优化" },
        { "type": "revert", "section": "⏪ Reverts | 代码回退" },
        { "type": "chore", "section": "📦 Chores | 其余更新" },
        { "type": "docs", "section": "📝 Documentation | 文档修改" },
        { "type": "style", "section": "💄 Styles | 代码格式调整", "hidden": true },
        { "type": "refactor", "section": "♻ Code Refactoring | 代码重构" },
        { "type": "test", "section": "✅ Tests | 测试用例" },
        { "type": "build", "section": "👷‍ Build System | 构建" },
        { "type": "ci", "section": "🔧 Continuous Integration | CI 配置" }
      ],
      "commitUrlFormat": "{{host}}/{{owner}}/{{repository}}/-/commit/{{hash}}"
    }
  }
}
```

2. 回退后形态变回「生成段 + 人工合并」：发版后把「未发布」区手写条目合并进生成段（按 commit type 对号入座、删骨架行、清空未发布区、单独 commit）
3. 依赖未卸载：`@release-it/conventional-changelog` 仍在 devDependencies（回退零安装成本；确认永不回退时可 `pnpm remove` 清理）

### 关键设计决策

- 范围：仅 Git 流程（GitHub Releases 由 `.release-it.json` 的 `github.release: true` 发布；不集成 npm publish）
- 配置文件用 JSON 格式（与 `.commitlintrc` / `.lintstagedrc` 风格一致，避免 `package.json:type=module` 反复踩坑）
- 保留 `pnpm push`（职责边界：`push` = 单 commit 推送；`release` = 版本发布）
- 使用 `@release-it/conventional-changelog` 插件（替代 auto-changelog，集成更深；**该插件已于 2026-10-27 下线**，CHANGELOG 纯手写，见上方「发版时 CHANGELOG 处理」）
- commitUrlFormat 原用 GitLab 风格 `/-/commit/{{hash}}`（历史配置遗留——项目远程是 **GitHub** `git@github.com:Mr-Super-X/vue3-vite-project.git`，插件下线后此配置不再生效）

### 故障排查

#### 1. requireBranch 报错 "Must be on branch master,release/*"

**现象**：`.release-it.json` 配置为数组 `"requireBranch": ["master", "release/*"]`，在非 master/release 分支发布时，报错信息把数组 toString 拼成 `"master,release/*"` 显示（视觉上像单 pattern），让人误以为配置被错误合并。

**实况**：数组形态是**当前实配且可正常工作**——release-it 内部 `castArray` 后逐元素做 wildcard 匹配，master 与 release/* 分支都能正常发布；只是报错信息拼接显示有误导性。

**处理**：无需改配置。若报错出现在 master/release 分支之外的合法场景（如 hotfix 分支），临时在该分支跑 `pnpm release` 前改用 `--no-git.requireBranch` 跳过，或把分支名临时加入数组。

### 相关文档

- 设计：`docs/superpowers/specs/2026-07-27-release-it-auto-changelog-design.md`
- 计划：`docs/superpowers/plans/2026-07-27-release-it-auto-changelog.md`
- release-it 官方：https://github.com/release-it/release-it
- @release-it/conventional-changelog：https://github.com/release-it/conventional-changelog
