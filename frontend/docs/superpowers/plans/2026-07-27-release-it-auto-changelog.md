# Release 流程集成：release-it + auto-changelog 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 vue3-vite-project 集成 release-it + auto-changelog，实现「bump 版本 → 生成 CHANGELOG → 打 tag → 推 tag」一站式 release 流程。

**Architecture:** release-it 21 作为 orchestrator 编排流程（校验分支 → 询问版本 → 调 auto-changelog → 打 tag → 推 tag），auto-changelog 2 作为 CHANGELOG 生成器读取 git log 按 conventional commits 自动分类。配置全部 JSON 化（与 `.commitlintrc` / `.lintstagedrc` 风格一致），避免 `package.json:type=module` 反复踩坑。

**Tech Stack:** release-it@21.0.0 + auto-changelog@2.6.0 + Node ^22.18 || >=24.12 + pnpm >=11 + GitLab SSH 远程

**Spec 引用**：`docs/superpowers/specs/2026-07-27-release-it-auto-changelog-design.md`

**生效分支**：master / release/*（release 命令本身；plan 实施在 feature 分支完成后再 merge）

---

## File Structure

**新建文件**（3 个）：

| 路径 | 职责 | 行数预估 |
|------|------|---------|
| `.release-it.json` | release-it 主配置（git/hooks/分支校验） | ~25 行 |
| `.auto-changelog.json` | auto-changelog 模板/分类/tag prefix | ~15 行 |
| `.claude/backups/release-it/CHANGELOG.md` | 旧 CHANGELOG 备份（实施前先备份） | 现有大小 |

**修改文件**（4 个）：

| 路径 | 改动内容 |
|------|---------|
| `package.json` | +2 devDependencies（release-it / auto-changelog）；+2 scripts（release / release:dry） |
| `README.md` | 常用脚本表加 `pnpm release` / `pnpm release:dry` 两行 |
| `CLAUDE.md` | Commands 表加 `pnpm release` / `pnpm release:dry` 两行 |
| `docs/03-Git工作流工具链.md` | 工具表加 release-it / auto-changelog 两行；新增 §「Release 流程」章节 |

**重生成文件**（1 个）：

| 路径 | 触发时机 |
|------|---------|
| `CHANGELOG.md` | Task 13 真实首发 v1.0.0 时由 auto-changelog 重写（实施阶段不修改） |

**`src/` 改动**：零（遵循项目 §2 src/ 架构保护）

---

## Task 1: 备份现有 CHANGELOG.md

**Files:**
- Create: `.claude/backups/release-it/CHANGELOG.md`

- [ ] **Step 1: 创建备份目录**

```bash
mkdir -p .claude/backups/release-it
```

- [ ] **Step 2: 复制 CHANGELOG.md 到备份目录**

```bash
cp CHANGELOG.md .claude/backups/release-it/CHANGELOG.md
```

- [ ] **Step 3: 验证备份文件大小一致**

```bash
ls -la CHANGELOG.md .claude/backups/release-it/CHANGELOG.md
```

Expected: 两个文件大小一致（Bytes 数相同）

- [ ] **Step 4: 提交备份**

```bash
git add .claude/backups/release-it/CHANGELOG.md
git commit -m "chore(backup): 备份 CHANGELOG.md 到 .claude/backups/release-it/

- auto-changelog 首次运行将重写 CHANGELOG.md
- 备份原内容便于回滚或对照"
```

---

## Task 2: 注入依赖（release-it + auto-changelog）

**Files:**
- Modify: `package.json`（devDependencies 自动新增）

- [ ] **Step 1: pnpm add 两个 dev 依赖**

```bash
pnpm add -D release-it@^21.0.0 auto-changelog@^2.6.0
```

Expected: exit 0，devDependencies 新增 `release-it` + `auto-changelog`

- [ ] **Step 2: 验证 release-it 安装**

```bash
pnpm exec release-it --version
```

Expected: `21.0.0`（或更高 21.x）

- [ ] **Step 3: 验证 auto-changelog 安装**

```bash
pnpm exec auto-changelog --version
```

Expected: `2.6.0`

- [ ] **Step 4: 验证 package.json 写入正确**

```bash
node -e "const pkg = require('./package.json'); console.log(pkg.devDependencies['release-it'], pkg.devDependencies['auto-changelog'])"
```

Expected: `^21.0.0 ^2.6.0`

- [ ] **Step 5: 提交依赖注入**

```bash
git add package.json pnpm-lock.yaml
git commit -m "feat(deps): 注入 release-it@21 + auto-changelog@2

- release-it: version orchestrator（含分支校验、bump、tag、push）
- auto-changelog: CHANGELOG 生成器（按 conventional commits 自动分类）
- 验证版本：npm view release-it@21.0.0 / auto-changelog@2.6.0 存在"
```

---

## Task 3: 创建 .release-it.json

**Files:**
- Create: `.release-it.json`

- [ ] **Step 1: 写 .release-it.json**

完整内容如下（按此生成）：

```json
{
  "git": {
    "commitMessage": "chore(release): v${version}",
    "tagName": "v${version}",
    "tagAnnotation": "Release v${version}",
    "requireBranch": ["master", "release/*"],
    "requireCleanWorkingDir": true,
    "pushRepo": "origin",
    "requireCommits": true
  },
  "hooks": {
    "before:init": ["pnpm type-check"],
    "before:release": ["pnpm test --run"],
    "after:bump": "auto-changelog -p --config .auto-changelog.json"
  },
  "npm": {
    "publish": false
  },
  "github": {
    "release": false
  },
  "gitlab": {
    "release": false
  }
}
```

- [ ] **Step 2: 校验 JSON 合法**

```bash
node -e "JSON.parse(require('fs').readFileSync('.release-it.json'))" && echo "JSON OK"
```

Expected: `JSON OK`，exit 0

- [ ] **Step 3: 提交配置文件**

```bash
git add .release-it.json
git commit -m "feat(release-it): 新增 .release-it.json 配置

- git.requireBranch: master + release/*（用户决策 D6）
- git.tagName: v\${version}（用户决策 D3）
- git.requireCleanWorkingDir: true（防误发布）
- hooks.before:init: pnpm type-check（防类型错误进 release）
- hooks.before:release: pnpm test --run（防测试失败进 release）
- hooks.after:bump: auto-changelog -p（CHANGELOG 自动生成）
- npm/github/gitlab.publish: false（仅 Git 流程，用户决策 D1）"
```

---

## Task 4: 创建 .auto-changelog.json

**Files:**
- Create: `.auto-changelog.json`

- [ ] **Step 1: 写 .auto-changelog.json**

完整内容如下（按此生成）：

```json
{
  "template": "default",
  "tagPrefix": "v",
  "versioning": "semver",
  "breakingPattern": "BREAKING CHANGE",
  "unreleased": true,
  "commitLimit": 500,
  "dateFormat": "yyyy-MM-dd",
  "sortCommits": "reversed",
  "exclude": [
    "^chore\\(release\\):",
    "^docs\\(CHANGELOG\\):"
  ]
}
```

- [ ] **Step 2: 校验 JSON 合法**

```bash
node -e "JSON.parse(require('fs').readFileSync('.auto-changelog.json'))" && echo "JSON OK"
```

Expected: `JSON OK`，exit 0

- [ ] **Step 3: 提交配置文件**

```bash
git add .auto-changelog.json
git commit -m "feat(auto-changelog): 新增 .auto-changelog.json 配置

- template: default（keep-a-changelog 模板）
- tagPrefix: v（对齐 v1.0.0，决策 D3）
- unreleased: true（保留 ## Unreleased 段）
- exclude: 排除 release 自身 commit，避免二次出现"
```

---

## Task 5: 注册 pnpm release 脚本

**Files:**
- Modify: `package.json`（scripts 字段）

- [ ] **Step 1: 在 scripts 段添加 release + release:dry**

在 `package.json` 的 `scripts` 段添加（在 `push` 之后，`commitlint` 之前）：

```json
"release": "release-it",
"release:dry": "release-it --dry-run",
```

完整 scripts 段示例（仅新增两行，其他行保持原样）：

```jsonc
{
  "scripts": {
    "preinstall": "npx only-allow pnpm",
    "dev": "vite",
    "dev:local": "cross-env VITE_MENU_SOURCE=local vite",
    "build": "run-s type-check:full \"build-only {@}\" --",
    "preview": "vite preview",
    "build-only": "vite build",
    "type-check": "vue-tsc --build",
    "type-check:full": "vue-tsc --build --force",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui",
    "check:routes": "node --experimental-strip-types scripts/check-routes.ts",
    "new-module": "node --experimental-strip-types scripts/new-module.ts",
    "analyze": "cross-env ANALYZE=true pnpm build",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "commit": "git add . && cz",
    "push": "git add . && cz && git push",
    "release": "release-it",
    "release:dry": "release-it --dry-run",
    "commitlint": "commitlint --edit",
    "prepare": "husky"
  }
}
```

- [ ] **Step 2: 验证脚本可调起**

```bash
pnpm run release --help
```

Expected: 输出 release-it 的帮助信息（不报错）

- [ ] **Step 3: 验证 dry-run 脚本**

```bash
pnpm run release:dry --help
```

Expected: 输出 release-it --dry-run 相关的帮助（不报错）

- [ ] **Step 4: 提交脚本注册**

```bash
git add package.json
git commit -m "feat(scripts): 添加 pnpm release / pnpm release:dry 脚本

- release: 真实发布（bump + changelog + tag + push）
- release:dry: dry-run 预览（0 副作用）
- 不修改 pnpm push，职责边界清晰（决策 D4）"
```

---

## Task 6: 工具链完整安装校验

**Files:**
- （无文件改动）

- [ ] **Step 1: 验证两个配置文件 JSON 合法**

```bash
node -e "JSON.parse(require('fs').readFileSync('.release-it.json'))" && \
node -e "JSON.parse(require('fs').readFileSync('.auto-changelog.json'))"
```

Expected: exit 0，无输出

- [ ] **Step 2: 验证两个工具的可执行**

```bash
pnpm exec release-it --version && pnpm exec auto-changelog --version
```

Expected: `21.0.0` `2.6.0`（或更高版本）

- [ ] **Step 3: 验证类型校验通过**

```bash
pnpm type-check
```

Expected: exit 0，无 TS 错误

- [ ] **Step 4: 验证测试通过**

```bash
pnpm test --run
```

Expected: exit 0，全部测试通过

---

## Task 7: dry-run 流程验证（feature 分支应失败）

**Files:**
- （无文件改动）

- [ ] **Step 1: 确认当前在 feature 分支**

```bash
git rev-parse --abbrev-ref HEAD
```

Expected: `feature/engine-optimization`（或当前所在 feature 分支）

- [ ] **Step 2: 在 feature 分支跑 dry-run**

```bash
pnpm release:dry
```

Expected: 报错并退出，提示 `Release must be on master or release/*`（分支校验）

- [ ] **Step 3: 验证 0 副作用**

```bash
git status
```

Expected: `nothing to commit, working tree clean`（或仅未追踪文件）

---

## Task 8: dry-run 流程验证（master 分支应成功）

**Files:**
- （无文件改动）

- [ ] **Step 1: 切换到 master 分支**

```bash
git checkout master
git pull origin master
```

Expected: 切换到 master，无需手动合并（master 与当前分支历史已知）

- [ ] **Step 2: 在 master 分支跑 dry-run**

```bash
pnpm release:dry
```

Expected: 打印所有 "Would ..." 步骤（bump version / commit / tag / push），但 0 副作用

- [ ] **Step 3: 验证 0 副作用**

```bash
git status
```

Expected: `nothing to commit, working tree clean`

- [ ] **Step 4: 切换回 feature 分支**

```bash
git checkout feature/engine-optimization
```

Expected: 切回原分支

---

## Task 9: 同步 README.md

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 在 README.md 找到常用脚本表**

定位到包含 `pnpm push` 的常用脚本表（通常是「常用脚本」或「Commands」标题下的表格）

- [ ] **Step 2: 在 `pnpm push` 行后插入两行**

在 `pnpm push` 行的下一行（相邻位置）插入：

```markdown
| `pnpm release`         | **发布版本**（bump + CHANGELOG + tag + push tag）     |
| `pnpm release:dry`     | 发布预览（dry-run，0 副作用）                          |
```

> 完整 markdown 表格行格式：保留原表格列分隔符（`|`），按 README.md 现有对齐风格补全空格

- [ ] **Step 3: 验证 Markdown 格式**

```bash
pnpm exec prettier --check README.md
```

Expected: 退出码 0（格式正确）或仅插入位点需要格式化

- [ ] **Step 4: 提交 README.md**

```bash
git add README.md
git commit -m "docs(README): 常用脚本表新增 pnpm release / pnpm release:dry

- pnpm release: 发布当前版本（bump + CHANGELOG + tag + push）
- pnpm release:dry: 预览发布流程（0 副作用）
- 完整流程详见 docs/03-Git工作流工具链.md『Release 流程』章节"
```

---

## Task 10: 同步 CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: 在 CLAUDE.md 找到 Commands 表**

定位到 `## Commands` 标题下的表格

- [ ] **Step 2: 在 `pnpm push` 行后插入两行**

```markdown
| 发布版本                        | `pnpm release`                                         |
| 发布预览（dry-run）              | `pnpm release:dry`                                     |
```

- [ ] **Step 3: 验证 Markdown 格式**

```bash
pnpm exec prettier --check CLAUDE.md
```

Expected: 退出码 0

- [ ] **Step 4: 提交 CLAUDE.md**

```bash
git add CLAUDE.md
git commit -m "docs(CLAUDE): Commands 表新增 pnpm release / pnpm release:dry

- 与 README.md 表格同步
- 完整配置决策见 docs/superpowers/specs/2026-07-27-release-it-auto-changelog-design.md"
```

---

## Task 11: 同步 docs/03-Git工作流工具链.md

**Files:**
- Modify: `docs/03-Git工作流工具链.md`

- [ ] **Step 1: 找到现有工具一览表**

定位到 `## 📋 工具一览` 章节下的表格

- [ ] **Step 2: 在工具表末尾新增两行**

```markdown
| **release-it**        | ^21.0.0 | 版本发布编排（bump + tag + push）       | `pnpm release`                       |
| **auto-changelog**    | ^2.6.0  | CHANGELOG 生成（按 conventional commits） | `auto-changelog -p`                  |
```

- [ ] **Step 3: 在文档末尾新增 `## 🚀 Release 流程` 章节**

完整内容如下（按此生成）：

```markdown
## 🚀 Release 流程

> **文档版本**：v1.0.0 | **最后更新**：2026-07-27
> **覆盖工具**：release-it 21 + auto-changelog 2

### 工具职责

| 工具 | 职责 |
|------|------|
| **release-it** | 版本发布编排：校验分支 → 询问版本 → bump → 调 auto-changelog → commit → tag → push |
| **auto-changelog** | CHANGELOG 生成：读取 git log → 按 conventional commit 分类 → 重写 CHANGELOG.md |

### 配置文件

| 配置文件 | 作用 |
|---------|------|
| `.release-it.json` | release-it 主配置（git/hooks/分支校验） |
| `.auto-changelog.json` | auto-changelog 模板/分类/tag prefix |

### Publish 流程

```
$ pnpm release
  ↓
[release-it] 启动
  ↓
校验分支（master / release/*） + 工作区干净
  ↓
交互式询问新版本号（推荐 patch/minor/major）
  ↓
hook: before:init  → pnpm type-check
  ↓
hook: before:release → pnpm test --run
  ↓
update version（package.json）
  ↓
hook: after:bump  → auto-changelog -p（重写 CHANGELOG.md）
  ↓
git commit -m "chore(release): v${version}"
  ↓
git tag v${version} -m "Release v${version}"
  ↓
git push origin HEAD + git push origin v${version}
  ↓
[v1.0.0 released]
```

### 常用命令

| 命令 | 作用 |
|------|------|
| `pnpm release` | 真实发布（master / release/* 分支） |
| `pnpm release:dry` | 预览发布流程（0 副作用，任意分支可用） |

### 错误分支

| 场景 | 行为 |
|------|------|
| 不在 master / release/* | 报错，exit 1 |
| 工作区有未提交改动 | 报错，exit 1 |
| type-check 失败 | 报错（hook before:init），exit 1 |
| test 失败 | 报错（hook before:release），exit 1 |
| 自上次 tag 后无新 commit | 报错，exit 1 |
| tag v1.0.0 已存在 | 报错，exit 1，需手动选新版本号 |

### 设计决策

- 范围：仅 Git 流程（不集成 GitLab Release API / npm publish）
- 配置文件用 JSON 格式（与 `.commitlintrc` / `.lintstagedrc` 风格一致，避免 `package.json:type=module` 反复踩坑）
- 保留 `pnpm push`（职责边界：`push` = 单 commit 推送；`release` = 版本发布）
- 首跑 v1.0.0：现有所有 commit 作为 v1.0.0 内容（baseline 处理）

### 故障排查

见各工具的官方文档：

- release-it: https://github.com/release-it/release-it
- auto-changelog: https://github.com/CookPete/auto-changelog
```

- [ ] **Step 4: 校验 Markdown 格式**

```bash
pnpm exec prettier --check docs/03-Git工作流工具链.md
```

Expected: 退出码 0

- [ ] **Step 5: 提交文档更新**

```bash
git add docs/03-Git工作流工具链.md
git commit -m "docs(03-Git工作流): 工具链配置详解新增 Release 流程章节

- 工具表：新增 release-it / auto-changelog 两行
- 章节：新增 🚀 Release 流程（职责 / 配置 / 流程 / 错误分支 / 决策）
- 与 README.md / CLAUDE.md 表格同步"
```

---

## Task 12: 提交所有集成变更（汇总 commit）

**Files:**
- （根据当前 git 状态，可能已无未提交文件）

- [ ] **Step 1: 检查 git 状态**

```bash
git status
```

Expected: `nothing to commit, working tree clean`（Task 1~11 已分别 commit）

- [ ] **Step 2: 查看最近 10 个 commit**

```bash
git log --oneline -10
```

Expected: 看到 Task 1~11 的 11 个 commit（备份 + 依赖 + 2 config + 脚本 + 3 文档）

---

## Task 13: 真实首发 v1.0.0（⚠️ 用户手动执行 / 决策点）

**Files:**
- Modify: `package.json`（version 自动改）
- Regenerate: `CHANGELOG.md`（auto-changelog 接管）
- Create: git tag v1.0.0
- Push: origin master + origin v1.0.0

> **⚠️ 重要**：本任务涉及远程推送（影响 GitLab 仓库 tag 列表），**不在 agent 自动化执行范围**。由用户决定执行时机。

### 13.1 准备阶段（用户/agent 决策）

- [ ] **Step 1: 评估是否到 v1.0.0 时刻**

确认：
- [ ] 当前版本 `0.0.0` 是否准备晋升为 `1.0.0`
- [ ] 现有所有 commit 是否已确认为 v1.0.0 内容
- [ ] 当前在 master 分支最新 version（如不确定先 `git pull origin master`）

### 13.2 真实发布（用户手动执行）

- [ ] **Step 2: 切换到 master**

```bash
git checkout master
git pull origin master
```

- [ ] **Step 3: 跑 release（真实发布）**

```bash
pnpm release
```

Expected: release-it 启动 → 交互式询问版本 → 输入 `1.0.0` → 走完流程

- [ ] **Step 4: 验证 package.json 已更新**

```bash
node -e "console.log(require('./package.json').version)"
```

Expected: `1.0.0`

- [ ] **Step 5: 验证 CHANGELOG.md 被 auto-changelog 重写**

```bash
head -50 CHANGELOG.md
```

Expected: 看到 `## v1.0.0 (2026-07-27)` 段 + `### Added` / `### Changed` / `### Fixed` 等分类

- [ ] **Step 6: 验证 git tag 已创建**

```bash
git tag --list v1.0.0
```

Expected: `v1.0.0`

- [ ] **Step 7: 验证远程已推送**

```bash
git ls-remote origin v1.0.0
```

Expected: 输出包含 `refs/tags/v1.0.0`

- [ ] **Step 8: 验证 GitLab 端 tag 列表**

打开 GitLab 仓库 → Repository → Tags → 看到 `v1.0.0`（含 commit 信息）

### 13.3 回滚（如失败）

如 release 过程中途失败，按以下顺序回滚：

```bash
# 1. 删除 local tag（如已创建）
git tag -d v1.0.0

# 2. 回滚 release commit（如已产生）
git reset --hard HEAD~1

# 3. 恢复 package.json version
git checkout HEAD~1 -- package.json

# 4. 恢复 CHANGELOG.md
cp .claude/backups/release-it/CHANGELOG.md ./CHANGELOG.md
```

### 13.4 提交发布后变更（如独立 commit）

```bash
git add package.json CHANGELOG.md
git commit --allow-empty -m "docs(release): v1.0.0 发布后归档

- auto-changelog 已接管 CHANGELOG.md
- 详见 master 分支 tag v1.0.0"
```

---

## Self-Review

**1. Spec coverage 检查**（spec §1-§12 全部覆盖？）：

| Spec 章节 | 覆盖任务 |
|----------|---------|
| §1 背景与目标 | 整个 plan（Goal 段落） |
| §2.1 In Scope 7 项 | Task 1~13 全部覆盖 |
| §2.2 Out of Scope 7 项 | 明确不做（plan 中通过 D1~D6 决策 + 配置文件 `publish: false` 落到代码） |
| §3 决策摘要 D1~D6 | Task 3（requireBranch）、Task 3（tagName）、Task 5（scripts）、Task 3（git.requireBranch） |
| §4 架构图 | Task 11 文档章节、Task 13.3 流程图 |
| §5.1 `.release-it.json` | Task 3 |
| §5.2 `.auto-changelog.json` | Task 4 |
| §5.3 `package.json` 改动 | Task 2 + Task 5 |
| §6 流程时序 | Task 11 文档 + Task 13 真实发布 |
| §7 错误处理矩阵 | Task 7（分支校验）、Task 11 文档错误分支表 |
| §8 验证清单 | Task 6 + Task 7 + Task 8 |
| §9 文档更新清单 | Task 9（README）+ Task 10（CLAUDE）+ Task 11（docs/03） |
| §10 风险与权衡 | Task 11 文档 + Task 13.3 回滚 |
| §11 实施计划 | Task 1~13 |

✅ 全部覆盖

**2. Placeholder 扫描**：

- [x] 无 TBD / TODO / "implement later"
- [x] 无 "add appropriate error handling" 类空泛描述
- [x] 每个代码 step 都有完整代码块（无 "类似 Task N" 引用）
- [x] 每个 step 都有具体命令 + 预期输出

✅ 通过

**3. Type / 命名一致性**：

- `release-it` / `auto-changelog` 命名全文一致
- 配置文件名 `.release-it.json` / `.auto-changelog.json` 全文一致
- 脚本名 `release` / `release:dry` 全文一致
- tag 格式 `v${version}` 全文一致
- 分支白名单 `master` / `release/*` 全文一致
- commit 格式 `chore(release): v${version}` 全文一致

✅ 通过

**4. 修复的问题**：

- 无（spec 完整、命名一致、配置无歧义）

---

## 实施摘要

**Total tasks**: 13
**Total commits**: 11（Task 1~11）+ 1~2（Task 13 视情况）
**Auto-execute range**: Task 1~12（agent / 用户皆可执行）
**Manual-decision range**: Task 13（涉及远程推送 + 首次版本发布，由用户决策）

**关键路径**：
- Task 1（备份）→ Task 2（依赖）→ Task 3 & 4（配置）→ Task 5（脚本）→ Task 6（校验）→ Task 7 & 8（dry-run）→ Task 9/10/11（文档）→ Task 12（汇总）→ Task 13（首发）

**DRY 原则**：
- Task 1 + Task 13.3 都有"备份 / 恢复 CHANGELOG.md"动作，避免重复重新备份
- Task 9/10/11 三个文档同步相互独立，但格式一致（prettier 校验 + 单独 commit）

**YAGNI 原则**：
- 不写自定义 auto-changelog 模板（用户决策 D2）
- 不集成 GitLab Release API（用户决策 D1）
- 不集成 npm publish（项目 private）
- 不引入 release-it 插件（默认能力已覆盖）
