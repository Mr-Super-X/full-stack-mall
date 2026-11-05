# Release 流程集成：release-it + auto-changelog

> **设计文档** | **日期**：2026-07-27 | **生效分支**：`master` / `release/*`
>
> **关联 plan**：待 writing-plans 阶段产出

---

## 1. 背景与目标

项目当前 Git 工作流已具备 commit 规范（commitizen + commitlint + husky），但**版本发布完全靠人工**：

- `package.json:version` 长期停在 `0.0.0`
- 无 git tag、无 CHANGELOG.md 自动生成
- `pnpm push` 仅做单 commit 推送，无 release 编排

**目标**：引入工业级 release 编排工具，实现「bump 版本 → 生成 CHANGELOG → 打 tag → 推 tag」一条命令闭环。

**业务收益**：
- 团队成员每次发布前无需手动对齐版本号、tag、CHANGELOG
- 杜绝"tag 与代码版本不一致" / "CHANGELOG 漏写"等常见错误
- 历史 commit 自动分类（Added / Changed / Fixed / Docs）—— 已有 conventional commit 规范的直接复用

---

## 2. 范围

### 2.1 In Scope（做）

| # | 事项 |
|---|------|
| 1 | 集成 `release-it@21` 作为 orchestration 工具 |
| 2 | 集成 `auto-changelog@2` 作为 CHANGELOG 生成器 |
| 3 | 新增 `pnpm release` / `pnpm release:dry` 脚本 |
| 4 | 新增 `.release-it.json` + `.auto-changelog.json` 两个配置文件 |
| 5 | 在 master / release/* 分支限制 release |
| 6 | 同步更新 README.md / CLAUDE.md / docs/03-Git工作流工具链.md |
| 7 | 首次运行重写现有 CHANGELOG.md（用户已确认） |

### 2.2 Out of Scope（不做）

- ❌ GitLab Release API（无需企业 token，GitLab 仓库靠 tag 列表识别发布版本）
- ❌ npm publish（项目 `private: true`）
- ❌ 自定义 auto-changelog 模板（用 keep-a-changelog 默认模板）
- ❌ pre-release / canary 流程（v1.0.0 之后再说）
- ❌ monorepo 编排（单仓单包）
- ❌ 修改 `pnpm push`（保留职责边界）
- ❌ 集成 release-it 插件（`@release-it/...`）（默认能力已覆盖）

---

## 3. 关键决策摘要

| # | 决策 | 选项 | 用户选择 |
|---|------|------|----------|
| D1 | Release 范围 | 仅 Git / 完整 GitLab Release / 仅 dry-run | **仅 Git 流程** |
| D2 | CHANGELOG 格式 | 完全交给 auto-changelog / 保留手写 / 混合 | **完全交给 auto-changelog** |
| D3 | Tag 格式 | v1.0.0 / 1.0.0 / vue3-vite-project-v1.0.0 | **v1.0.0** |
| D4 | 与 pnpm push 关系 | 新增独立 / 集成 / 替换 | **新增独立 `pnpm release`** |
| D5 | bump 策略 | 手动交互 / 自动推断 / 手动+auto hint | **手动交互式输入** |
| D6 | 可发布分支 | 仅 master / 任意 / master+release/* | **master + release/*** |

---

## 4. 整体架构

```
pnpm release / pnpm release:dry
    ↓
release-it 21.0.0（orchestrator）
    ├── 校验分支 ∈ {master, release/*}
    ├── 校验工作区干净
    ├── 交互式询问新版本号
    ├── 更新 package.json:version
    ├── hook: before:init  → pnpm type-check
    ├── hook: before:release → pnpm test --run
    ├── hook: after:bump   → auto-changelog -p --config .auto-changelog.json
    ├── git commit -m "chore(release): v${version}"
    ├── git tag v${version} -m "Release v${version}"
    ├── git push origin HEAD
    └── git push origin v${version}
              ↓
auto-changelog 2.6.0（CHANGELOG 生成器）
    ├── 读取 git log (since last tag)
    ├── 按 commit type 分类（feat/fix/refactor/docs/...）
    ├── 按 conventional commit 模板渲染
    └── 重写 CHANGELOG.md
```

---

## 5. 配置文件

### 5.1 `.release-it.json`（新建）

```jsonc
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

### 5.2 `.auto-changelog.json`（新建）

```jsonc
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

### 5.3 `package.json` 改动

新增 scripts（在 `commit` / `push` 段后）：

```jsonc
{
  "scripts": {
    "release": "release-it",
    "release:dry": "release-it --dry-run"
  }
}
```

新增 devDependencies（PHP spec 验证 release-it@21.0.0 / auto-changelog@2.6.0 均已存在）：

```jsonc
{
  "devDependencies": {
    "release-it": "^21.0.0",
    "auto-changelog": "^2.6.0"
  }
}
```

---

## 6. 流程时序

### 6.1 用户操作流程

```
$ pnpm release
  ↓
[release-it] 启动，输出欢迎语 + 当前版本
  ↓
displayCollectedUpdates()                  ← console 输出"检测到 5 commits"
  ↓
promptVersion() 交互式询问                ← 三个选项（patch / minor / major）+ 手动输入
  ↓
用户选择 1.0.0
  ↓
[release-it] hook: before:init
  └→ pnpm type-check                       ← 检查类型
  ├ 失败 → 报错 + 0 副作用退出
  └ 成功 ↓
[release-it] hook: before:release
  └→ pnpm test --run                       ← 跑测试
  ├ 失败 → 报错 + 0 副作用退出
  └ 成功 ↓
updateVersion()                            ← package.json:version = "1.0.0"
  ↓
[release-it] hook: after:bump
  └→ auto-changelog -p                     ← 读取 git log → 重写 CHANGELOG.md
  ↓
git commit -m "chore(release): v1.0.0"     ← 含 package.json + CHANGELOG.md
  ↓
git tag v1.0.0 -m "Release v1.0.0"
  ↓
git push origin HEAD                       ← 推 master
  ↓
git push origin v1.0.0                     ← 推 tag
  ↓
[release-it] 输出 "v1.0.0 released!"
```

### 6.2 dry-run 模式

```
$ pnpm release:dry
  打印：Would update package.json to 1.0.0
  打印：Would commit 'chore(release): v1.0.0'
  打印：Would tag v1.0.0
  打印：Would push origin HEAD
  打印：Would push origin v1.0.0
  实际：0 文件修改，0 commit，0 tag，0 push
```

---

## 7. 错误处理矩阵

| 失败点 | 检测方式 | 行为 | 退出码 |
|--------|---------|------|-------|
| 不在 master / release/* 分支 | `git rev-parse --abbrev-ref HEAD` | 报错 `Release must be on master or release/*` | 1 |
| 工作区有未提交改动 | `git status --porcelain` | 报错 `Please commit or stash changes first` | 1 |
| `before:init` type-check 失败 | 子进程退出码 ≠ 0 | 报错 + 0 副作用 | 1 |
| `before:release` test 失败 | 子进程退出码 ≠ 0 | 报错 + 提示 `pnpm test` 查看 | 1 |
| 自上次 tag 后无新 commit | `git log` 输出为空 | 报错 `No commits since last release` | 1 |
| auto-changelog 写入失败 | 子进程退出码 ≠ 0 | 报错 + rollback | 1 |
| git push 失败（网络/权限） | 子进程退出码 ≠ 0 | 报错 + 保留 local tag + commit，需手动 `git push` 重试 | 1 |
| tag v1.0.0 已存在 | release-it 内置 | 报错 + 建议更换版本号 | 1 |

**关键设计意图**：
- `before:init` 而非 `before:release`：type-check 早于任何文件变更，失败时**零副作用**
- 命令退出码统一为 1：CI 能直接 fail
- `pnpm release:dry`（--dry-run）：所有步骤打印但**不写文件、不打 tag、不 push**

---

## 8. 验证清单

| 验证项 | 命令 | 预期结果 |
|--------|------|----------|
| 配置文件 JSON 合法 | `node -e "JSON.parse(require('fs').readFileSync('.release-it.json'))"` | exit 0 |
| 配置文件 JSON 合法 | `node -e "JSON.parse(require('fs').readFileSync('.auto-changelog.json'))"` | exit 0 |
| release-it 安装 | `pnpm exec release-it --version` | 21.0.0 |
| auto-changelog 安装 | `pnpm exec auto-changelog --version` | 2.6.0 |
| 依赖安装 | `pnpm install` | exit 0，无 peer warning 阻塞 |
| 类型校验 | `pnpm type-check` | exit 0 |
| 测试 | `pnpm test` | 全部通过 |
| dry-run 流程 | `pnpm release:dry` | 0 文件变更，0 commit，0 tag，0 push |
| 错误分支（feature 分支） | `pnpm release` 在 feature/engine-optimization 上 | 报错"不在 master/release/*" |
| auto-changelog 单独运行 | `pnpm exec auto-changelog -p --config .auto-changelog.json` | CHANGELOG.md 头部更新 |
| 旧 CHANGELOG 备份 | `cp CHANGELOG.md .claude/backups/release-it/` | 备份文件落地 |

**首跑 baseline 处理**：
- 当前 `version=0.0.0` + 无 tag → 首次 `pnpm release` 会用现有所有 commit 作为 v1.0.0 内容
- 建议首次直接发布 `v1.0.0`（不 prepend 0.0.x），把"自项目初始化到当前"作为 v1.0.0 完整内容
- auto-changelog 会从 `git log` 最 commit 扫描，**无可回避**——但用户已确认"完全交给 auto-changelog"

---

## 9. 文档更新清单

| 文件 | 变更 | 理由 |
|------|------|------|
| `CHANGELOG.md` | 整体重写（auto-changelog 接管） | 用户已确认 |
| `docs/03-Git工作流工具链.md` | 新增 § 「Release 流程」章节 + `release-it`/`auto-changelog` 工具表 | 工具链文档同步 |
| `README.md` | 常用脚本表加 `pnpm release` / `pnpm release:dry` | 命令速查 |
| `CLAUDE.md` | Commands 表加 `pnpm release` / `pnpm release:dry` | 项目工作流锚点 |

**`src/` 改动**：零（仅 `.release-it.json` + `.auto-changelog.json` + `package.json`，遵循 §2 src/ 架构保护）

---

## 10. 风险与权衡

| 风险 | 影响 | 缓解 |
|------|------|------|
| 现有 CHANGELOG.md 手写格式被覆盖 | 失去原有结构（按日期 + 大段叙事） | 备份到 `.claude/backups/release-it/CHANGELOG.md` |
| `package.json:type=module` 时 auto-changelog 配置必须 JSON | 容易踩坑（参见 docs/03 故障排查 #2） | 统一用 `.json` 格式 |
| auto-changelog 首次运行解析所有 commit | 大项目可能耗时 + 输出冗长 | `commitLimit: 500` 限制（按需调整）|
| release-it 21 依赖 `@octokit/rest@22` + `undici@7`（间接） | 依赖树变大；同时 `github`/`gitlab` 配置 false 时 `@octokit/rest` 不会实际发请求 | 必需依赖，必须接受；本项目 Node `^22.18 \|\| >=24.12` 满足 undici 7 要求 |
| `before:release` 跑测试慢 | 1-2 分钟 | 默认 100+ 测试，可接受 |
| `pnpm release` 在 CI 跑会卡在交互 | 不适配 CI | 仅本地手动跑；CI 暂不接 release-it |
| tag 已存在 | 报错退出 | 用户需手动选择新版本号 |

---

## 11. 实施计划（高级）

> 具体 plan 由 writing-plans 阶段产出。本节只列骨架。

**Phase 1：依赖注入**
- `pnpm add -D release-it@^21.0.0 auto-changelog@^2.6.0`
- 验证版本与 peer deps

**Phase 2：配置文件**
- 创建 `.release-it.json`
- 创建 `.auto-changelog.json`
- 备份现有 CHANGELOG.md

**Phase 3：脚本注册**
- `package.json` 添加 `release` / `release:dry` scripts

**Phase 4：首次 dry-run 验证**
- `pnpm release:dry` 走完流程，确认 0 副作用

**Phase 5：文档同步**
- 更新 README.md / CLAUDE.md / docs/03-Git工作流工具链.md

**Phase 6：真实首发（v1.0.0）**
- `pnpm release` 真实发布 v1.0.0
- 验证 GitLab 仓库 tag 列表正确

---

## 12. 元数据

| 属性 | 值 |
|------|-----|
| 设计文档版本 | v1.0.0 |
| 设计日期 | 2026-07-27 |
| 生效分支 | master / release/* |
| 关联工具 | release-it@21.0.0 / auto-changelog@2.6.0 |
| 用户参与 | D1~D6 全部 6 个决策已确认 |
| 等待用户审阅 | 待确认 |
| 下一步 | writing-plans 写实施计划 |
