# [2026-07-20] npm install 在 pnpm 项目中崩溃

> **类型**：spec - 工具兼容性踩坑归档（事实记录，无代码 commit）
> **日期**：2026-07-20
> **原始位置**：`docs/01-工具兼容性问题踩坑记录.md`（已于 **2026-09-11** 迁移到 `docs/superpowers/specs/`，索引页保留在原路径）
> **状态**：已记录，缓解方案已知——项目强制 pnpm（preinstall only-allow + engines）
> **相关索引**：[← 返回 `docs/01-工具兼容性问题踩坑记录.md`](../../01-工具兼容性问题踩坑记录.md)

---

## 一句话总结

npm 的 `@npmcli/arborist` 在解析 pnpm 创建的符号链接 node_modules 时，`Link.matches` 函数访问 `null` 的 `target` 属性崩溃，导致 `npm install` 抛出 `Cannot read properties of null (reading 'matches')`。

## 环境

| 工具             | 版本                                    |
| ---------------- | --------------------------------------- |
| npm              | 10.9.8（复现）/ 11.18.0（升级后仍复现） |
| @npmcli/arborist | 8.x（npm 10）/ 10.0.1（npm 11）         |
| pnpm             | 11.13.1                                 |
| Node.js          | 22.23.1                                 |
| OS               | Windows 11 10.0.26200                   |

## 复现步骤

```bash
# 在使用 pnpm 的项目目录下执行
npm install
```

## 现象

```text
npm error Cannot read properties of null (reading 'matches')
npm error A complete log of this run can be found in: C:\Users\xxx\AppData\Local\npm-cache\_logs\...
```

完整堆栈（npm 10.9.8）：

```text
TypeError: Cannot read properties of null (reading 'matches')
    at Link.matches (...\npm\node_modules\@npmcli\arborist\lib\node.js:1137:41)
    at Link.canDedupe (...\npm\node_modules\@npmcli\arborist\lib\node.js:1091:15)
    at PlaceDep.pruneDedupable (...\npm\node_modules\@npmcli\arborist\lib\place-dep.js:426:14)
    at new PlaceDep (...\npm\node_modules\@npmcli\arborist\lib\place-dep.js:278:14)
    at #buildDepStep (...\@npmcli\arborist\lib\arborist\build-ideal-tree.js:920:18)
    at async Arborist.buildIdealTree (...\build-ideal-tree.js:181:7)
    at async Arborist.reify (...\arborist\arborist\reify.js:133:5)
    at async Install.exec (...\npm\lib\commands\install.js:150:5)
```

## 根因

调用链分析（npm 10.9.8 `@npmcli/arborist` 源码）：

| 层               | 文件:行                            | 行为                                                                                     |
| ---------------- | ---------------------------------- | ---------------------------------------------------------------------------------------- |
| npm install 入口 | `commands/install.js:150`          | `Install.exec → Arborist.reify`                                                          |
| 依赖树构建       | `arborist/build-ideal-tree.js:181` | `buildIdealTree` 遍历已有 node_modules                                                   |
| 节点放置         | `arborist/place-dep.js:278`        | `new PlaceDep` 处理每个依赖节点                                                          |
| 去重判断         | `place-dep.js:426`                 | `pruneDedupable` → `node.canDedupe()`                                                    |
| 去重匹配         | `node.js:1091`                     | `other.matches(this)` 调用                                                               |
| **崩溃点**       | **`node.js:1137`**                 | `this.target.matches(node.target)` —— 当 `this.isLink=true` 但 `this.target=null` 时崩溃 |

**关键发现**：

1. 崩溃发生在 **依赖树解析阶段**，早于 `preinstall` 脚本执行 —— 这意味着项目里 `package.json` 中配置的 `"preinstall": "npx only-allow pnpm"` 拦截逻辑 **永远没有机会执行**
2. pnpm 创建的 `node_modules/@xxx/` 是符号链接 → `node_modules/.pnpm/@xxx+yyy_zzz/node_modules/@xxx/yyy`
3. npm arborist 试图检查这些 link 节点能否去重，遇到 link.target 为 null 时崩溃
4. 该 bug 在 npm 10.x（arborist 8.x）和 npm 11.x（arborist 10.0.1）均未修复

## 已尝试的修复（全部失败）

按 systematic-debugging 流程执行了 3 次修复尝试，均失败：

| #   | 方案                                       | 结果                                                       |
| --- | ------------------------------------------ | ---------------------------------------------------------- |
| 1   | 删除 `node_modules` 后 `pnpm install` 重建 | ❌ npm install 仍报同样错误（pnpm 重建的仍是符号链接结构） |
| 2   | 临时移除 `preinstall` 验证假设             | ❌ npm install 仍报同样错误（证实 preinstall 从未执行）    |
| 3   | 全局升级 npm 10 → 11.18.0                  | ❌ npm install 仍报同样错误（arborist 10.0.1 同样问题）    |

按 CLAUDE.md §八「调试三不原则 — 不反复」+ systematic-debugging Phase 4.5「3+ Fixes Failed: Question the Architecture」，**停止继续尝试，承认架构层面的固有不兼容**。

## 推荐方案（当前采用）

**接受 npm 不可用，项目以 pnpm 为唯一安装路径**。

### 项目侧配置（保持现状）

- `package.json` 中 `"preinstall": "npx only-allow pnpm"` 保留（虽然 npm 解析阶段会先崩溃，但不影响 pnpm 流程，保留作为意图声明）
- `engines.pnpm: ">=11.0.0 < 13.0.0"` 强制 pnpm 版本（2026-10 起上界从 <12 放宽到 <13，CI 已用 pnpm 12 验证）
- 文档明确"本项目使用 pnpm，请勿使用 npm/yarn"

### 团队规范

```bash
# 推荐安装命令
pnpm install

# ❌ 不要使用（即使不报错，也是 npm 10/11 与 pnpm 符号链接不兼容）
npm install
yarn install
```

### 临时绕过（如必须使用 npm）

唯一可行方案：**删除 pnpm 风格的 `node_modules` 后让 npm 自己重建**（npm 会创建扁平 node_modules）

```bash
# 警告：这会重新下载所有依赖（pnpm 缓存失效），且会生成 package-lock.json
rm -rf node_modules
npm install
```

但这与项目设计意图冲突（only-allow 强制 pnpm），仅作为应急方案。

## 验证

```bash
# 项目 pnpm 链路完全正常
pnpm install        # ✅ 成功（约 7s，lockfile 命中）
pnpm type-check     # ✅ vue-tsc 通过
pnpm dev            # ✅ 开发服务器启动

# npm install 必然失败（除非删除 pnpm node_modules 后重建）
npm install         # ❌ Cannot read properties of null (reading 'matches')
```

## 教训

1. **跨包管理器兼容性**：选择 pnpm 后，npm 的解析逻辑对符号链接结构不健壮。`only-allow` 这类 preinstall 拦截工具 **无法挽救依赖树解析阶段的崩溃** —— 拦截必须发生在 npm 进入依赖解析之前（如 shell 层包装、husky pre-commit 等）
2. **根因定位顺序**：先看堆栈 → 找崩溃点 → 反推调用链 → 验证是否在脚本执行前。本次根因（arborist Link.matches 1137 行）的精确定位依赖 `--loglevel=silly` 才能看到完整堆栈
3. **包管理器升级不是万能药**：npm 10 → 11 跨大版本升级并未修复 arborist bug（npm 11 用的 arborist 10.0.1 同样问题）

## 参考

- npm arborist 源码：`node_modules/npm/node_modules/@npmcli/arborist/lib/node.js:1137`
- only-allow 1.2.2 源码：`node_modules/.pnpm/only-allow@1.2.2/node_modules/only-allow/bin.js`
- pnpm 工作原理：<https://pnpm.io/zh/symlinked-node-modules-layout>
- CLAUDE.md §八 调试与问题定位规范

---

_归档于 2026-09-11 迁移至 specs/，原 `docs/01` 保留为索引页。_
