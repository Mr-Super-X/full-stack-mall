# vite.config.ts 工程化抽离：单一来源与语义化拆分

> 把 `vite.config.ts` 内的构建期配置抽离到 `build/` 工程配置目录，建立 src 子目录别名的单一来源，并通过生成器自动同步 `tsconfig.app.json` 的 `paths` 块，消除双维护痛点；同时为未来大概率需要的 proxy / devServer 等配置预留位置。

| 属性 | 值 |
| --- | --- |
| 版本 | v1.0.0 |
| 日期 | 2026-09-10 |
| 分支 | `feature/engine-optimization` |
| 范围 | 仅工程级配置（`vite.config.ts` / `tsconfig.app.json` / `package.json` scripts / 新建 `build/`），不动业务代码 |
| 落地策略 | 直接迁移 + 行为不变（alias / vendorChunks / port / 注释迁移），生成器首次写入后 CI 强制保持一致 |

---

## 1. 背景与动机

### 1.1 当前痛点

**痛点 1：双维护**

`vite.config.ts:11-27` 的 `SRC_DIR_ALIASES`（14 个别名）与 `tsconfig.app.json:9-39` 的 `compilerOptions.paths`（28 条）必须手动保持同步：

| 改动类型 | 必须修改 |
| --- | --- |
| 新增 `src/<dir>/` | vite.config.ts 的 `SRC_DIR_ALIASES` + tsconfig.app.json 的 2 条 paths |
| 删除子目录 | 同上 |
| 重命名子目录 | 同上 |

任何一处遗漏都会出现：vite 解析成功但 IDE 跳转失败（paths 缺），或 IDE 跳转成功但 build 失败（alias 缺）。

**痛点 2：配置语义内联在 200 行 vite.config.ts**

当前 `vite.config.ts`（213 行）混合了：
- 路径别名（第 11-36 行）
- vendor chunk 分组（第 48-61 行）
- SCSS 注入配置（第 134-159 行，30 行注释）
- 大量插件配置（70-123 行）
- build/rollupOptions（第 163-211 行）

任何一个新增改动都会让 vite.config.ts 继续膨胀。

**痛点 3：proxy / devServer 后续扩展无位**

`vite.config.ts` 第 100-108 行的 mock 启用注释提到「联调真实后端：在 .env.development 设 VITE_USE_MOCK=false」，但 `vite.config.ts:124-128` 的 `server` 字段只有 port + strictPort，无 proxy 预留位置——未来真要接真实后端时还得回头补这一块。

### 1.2 既有约束（必须遵守）

| 约束 | 证据 | 影响 |
| --- | --- | --- |
| `vitest.config.ts` 通过 `mergeConfig(viteConfig as never, ...)` 复用 alias | `vitest.config.ts:3` | 拆 vite.config.ts 后 alias 必须仍能导出 |
| `tsconfig.node.json` 包含 `vite.config.*` 的 type-check | `tsconfig.node.json:5-11` | 拆出的模块需可被它 type-check |
| `tsconfig.vitest.json` 继承 tsconfig.app.json | `tsconfig.vitest.json:2` | 生成的 paths 块必须被继承 |
| `src/` 下 15 个一级目录被 CLAUDE.md §2 锁定 | CLAUDE.md §2.2 | 新建 `build/` 必须放 src/ 外 |
| `tsconfig.app.json` 当前被 git 跟踪 | 仓库现状 | 生成式仍要提交，保证克隆即用 |

---

## 2. 目标

1. **单一来源**：`src/<dir>` 列表只维护一处（`build/aliases.ts`），vite 与 tsconfig 都从此派生。
2. **语义化拆分**：`vite.config.ts` 瘦身到只做「装配清单」，具体配置在 `build/<topic>.ts` 各管一摊。
3. **生成式同步**：`tsconfig.app.json` 的 `paths` 块由脚本自动写入，避免漂移。
4. **CI 校验**：`pnpm check:aliases` 检测双份不一致。
5. **扩展位**：未来 proxy / devServer 扩展有明确归位。
6. **零行为变更**：alias / vendorChunks / port / scss 注入的运行时行为完全等价。

---

## 3. 非目标（明确不做）

- ❌ 不动 src/ 下任何源码
- ❌ 不重构 vite.config.ts 的 plugins 数组（保持原状）
- ❌ 不重命名 vendorChunks 分组（保持 `vendor-vue` / `vendor-ui` / `vendor-utils`）
- ❌ 不调整 port 数值（保持 5174）
- ❌ 不换构建工具（仍 Vite 8 + rolldown）
- ❌ 不引入新的 npm 依赖（生成器用 `node:fs` + `node:path` + `--experimental-strip-types`）

---

## 4. 设计方案

### 4.1 目录结构

```
build/                                            # 工程配置目录（与 src/、scripts/ 平级）
├── index.ts                                      # 统一导出入口（re-export 全部配置）
├── aliases.ts                                    # 单一来源：SRC_DIR_ALIASES + 派生函数
├── vendor-chunks.ts                              # VENDOR_CHUNKS 列表（顺序敏感）
├── proxy.ts                                      # createProxyConfig(env) — 预留空壳
├── server.ts                                     # SERVER_DEFAULTS（port / strictPort）
├── scss.ts                                       # 抽离 css.preprocessorOptions.scss 配置
└── scripts/
    └── generate-tsconfig-paths.ts                # 读取 aliases.ts → 写入 tsconfig.app.json

tsconfig.app.base.json                            # 手写：extends @vue/tsconfig + 其他字段，无 paths
tsconfig.app.json                                 # 自动生成：extends base + 注入 paths（仍 git 跟踪）
```

**约束**：所有新文件必须在 `src/` 外（CLAUDE.md §2 lockdown 仅限 src/）。

### 4.2 单一来源：`build/aliases.ts`

```ts
// build/aliases.ts
import { fileURLToPath, URL } from 'node:url'

/** src 下子目录别名映射（单一来源） */
export const SRC_DIR_ALIASES = {
  '@': '',
  '@api': 'api',
  '@assets': 'assets',
  '@components': 'components',
  '@composables': 'composables',
  '@directives': 'directives',
  '@enums': 'enums',
  '@layouts': 'layouts',
  '@locales': 'locales',
  '@modules': 'modules',
  '@plugins': 'plugins',
  '@router': 'router',
  '@store': 'store',
  '@types': 'types',
  '@utils': 'utils',
} as const

/** vite resolve.alias 形态：bare → src/<dir> 绝对路径 */
export function resolveSrcDirAliases(): Record<string, string> {
  const map: Record<string, string> = {}
  for (const [alias, sub] of Object.entries(SRC_DIR_ALIASES)) {
    map[alias] = fileURLToPath(new URL(`./src/${sub}`, import.meta.url))
  }
  return map
}

/**
 * tsconfig paths 形态：
 *   "@"      → ["./src/*"]                     (catch-all)
 *   "@api"   → ["./src/api/index.ts"]          (bare)
 *   "@api/*" → ["./src/api/*"]                 (sub-path)
 *
 * 与 vite alias 的区别：tsconfig paths 必须显式列 bare + `/*` 两条，否则 IDE 跳转不工作；
 * vite resolve 算法会自动追加 /index.ts 或 .ts，所以 bare 一条够用。
 */
export function generateTsconfigPaths(): Record<string, string[]> {
  const paths: Record<string, string[]> = {}
  for (const [alias, sub] of Object.entries(SRC_DIR_ALIASES)) {
    if (alias === '@') {
      paths['@/*'] = ['./src/*']
      continue
    }
    paths[alias] = sub ? [`./src/${sub}/index.ts`] : ['./src/index.ts']
    paths[`${alias}/*`] = [`./src/${sub}/*`]
  }
  return paths
}
```

### 4.3 tsconfig 拆分与生成机制

**`tsconfig.app.base.json`**（手写，无 paths）：

```json
{
  "extends": "@vue/tsconfig/tsconfig.dom.json",
  "include": ["env.d.ts", "src/**/*", "src/**/*.vue"],
  "exclude": ["src/**/__tests__/*", "src/**/*.spec.ts", "src/**/*.test-d.ts"],
  "compilerOptions": {
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo"
  }
}
```

**`tsconfig.app.json`**（自动生成）：

```json
{
  "extends": "./tsconfig.app.base.json",
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@api": ["./src/api/index.ts"],
      "@api/*": ["./src/api/*"],
      "@assets": ["./src/assets/index.ts"],
      "@assets/*": ["./src/assets/*"],
      ...
    }
  }
}
```

**生成器 `build/scripts/generate-tsconfig-paths.ts`**：

| 行为 | 细节 |
| --- | --- |
| 读取 | `build/aliases.ts` 的 `generateTsconfigPaths()` 函数（用 `--experimental-strip-types` 直接执行 TS） |
| 解析 | 当前 `tsconfig.app.json` 为对象（保留 `extends` 等字段） |
| 比对 | 计算 `paths` 块内容哈希；与上次生成对比 |
| 写入 | 若哈希不同，序列化覆盖 `tsconfig.app.json`；若相同，跳过写入 |
| 退出码 | 0（写入成功或无需写入），1（解析/写入异常） |

**触发点**：

| 触发场景 | 方式 |
| --- | --- |
| `pnpm dev` / `pnpm build` / `pnpm type-check` 启动 | 通过 `npm-run-all2` 前置钩子自动跑一次 |
| `pnpm check:aliases`（手动） | 直接跑生成器 + 校验 |
| pre-commit git hook | 跑生成器（hash 比对，无变更秒跳过） |
| IDE 启动 | 不触发（生成器是 npm script，IDE 重启不感知） |

**git 跟踪**：`tsconfig.app.json` 仍 git 跟踪（保证克隆即用），但文件顶部加注释：

```jsonc
{
  // ⚠️ 此文件的 `compilerOptions.paths` 由 build/scripts/generate-tsconfig-paths.ts 自动生成
  //    单一来源在 build/aliases.ts；请勿手动编辑 paths 块
  //    手动编辑后运行 `pnpm check:aliases` 会失败
  "extends": "./tsconfig.app.base.json",
  ...
}
```

### 4.4 vendorChunks / proxy / server / scss 抽离

**`build/vendor-chunks.ts`**（保持现状，仅迁移）：

```ts
/** 第三方库 vendor chunk 分组（顺序敏感——先匹配先返回） */
export const VENDOR_CHUNKS: ReadonlyArray<{
  name: string
  patterns: ReadonlyArray<string>
}> = [
  {
    name: 'vendor-vue',
    patterns: ['/vue/', '/pinia/', '/@vue/'],
  },
  {
    name: 'vendor-ui',
    patterns: ['/element-plus/', '/unplugin-vue-components/'],
  },
]
```

**`build/proxy.ts`**（预留空壳）：

```ts
/**
 * dev server proxy 配置（当前空壳）
 *
 * 启用时机：联调真实后端时，按需补充 _env 字段解析逻辑
 * 用法（在 vite.config.ts）：
 *   server: { ...SERVER_DEFAULTS, proxy: createProxyConfig(process.env) }
 *
 * 未来典型场景：
 *   - '/api': { target: process.env.VITE_API_TARGET, changeOrigin: true }
 *   - '/upload': { target: 'https://upload.example.com', changeOrigin: true }
 */
export function createProxyConfig(_env: NodeJS.ProcessEnv): Record<string, unknown> {
  return {}
}
```

**`build/server.ts`**（保持现状）：

```ts
/** vite dev server 默认配置 */
export const SERVER_DEFAULTS = {
  port: 5174,
  strictPort: true, // 端口占用时直接报错而非自动切换，避免混淆
} as const
```

**`build/scss.ts`**（从 vite.config.ts 第 134-159 行迁移）：

```ts
import process from 'node:process'

/**
 * SCSS additionalData 注入 + silenceDeprecations 配置
 *
 * 详见 vite.config.ts 第 134-159 行原注释（迁移后保留链接）。
 *
 * 关键技术点：
 *   - bem mixin 通过 $BEM_PREFIX 拼前缀，与 src/utils/bem.ts 的 import.meta.env.VITE_BEM_PREFIX 共享来源
 *   - silenceDeprecations 白名单：'new-global'（bem mixin 的 !global）/ 'if-function'（bem mixin 的 if() 拼接）
 *     这两个 deprecation 在 sass 2.0 升级前必须静默，否则 CI 红
 */
export const SCSS_PREPROCESSOR_OPTIONS = {
  silenceDeprecations: ['new-global', 'if-function'],
  additionalData: `@use '@/assets/styles/mixins/bem' as * with ($BEM_PREFIX: '${process.env.VITE_BEM_PREFIX ?? 'vv'}');\n`,
} as const
```

**`build/index.ts`**（统一导出）：

```ts
export * from './aliases'
export * from './vendor-chunks'
export * from './proxy'
export * from './server'
export * from './scss'
```

### 4.5 改造后的 vite.config.ts（瘦身后 ~150 行）

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'
import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/resolvers'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { viteMockServe } from 'vite-plugin-mock'
import { visualizer } from 'rollup-plugin-visualizer'
import { cleanMockBundled } from './scripts/vite-plugin-clean-mock'

// 工程配置（语义化拆分）
import { resolveSrcDirAliases } from './build/aliases'
import { VENDOR_CHUNKS } from './build/vendor-chunks'
import { createProxyConfig } from './build/proxy'
import { SERVER_DEFAULTS } from './build/server'
import { SCSS_PREPROCESSOR_OPTIONS } from './build/scss'

export default defineConfig({
  plugins: [
    // ... 70-123 行的 plugins 数组原样保留
  ],
  server: { ...SERVER_DEFAULTS, proxy: createProxyConfig(process.env) },
  resolve: { alias: resolveSrcDirAliases() },
  css: {
    preprocessorOptions: {
      scss: SCSS_PREPROCESSOR_OPTIONS,
      less: { javascriptEnabled: true },
    },
  },
  build: {
    // ... 163-211 行原样保留，VENDOR_CHUNKS 从 build/ 引入
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          for (const { name, patterns } of VENDOR_CHUNKS) {
            if (patterns.some((p) => id.includes(p))) return name
          }
          return 'vendor-utils'
        },
      },
    },
  },
})
```

---

## 5. 兼容性分析

| 文件 | 改动 | 验证方式 |
| --- | --- | --- |
| `vitest.config.ts` | 无改动（继续 `import viteConfig from './vite.config'`） | `pnpm test` |
| `tsconfig.app.base.json` | 新增（手写） | `pnpm type-check:full` |
| `tsconfig.app.json` | 由生成器覆盖写入 | `pnpm type-check:full` |
| `tsconfig.node.json` | include `vite.config.*` + `build/**/*`（新增 include 范围） | `pnpm type-check:full` |
| `tsconfig.vitest.json` | 无改动（继承 tsconfig.app.json 自动继承 paths） | `pnpm test` |
| `eslint.config.mjs` | 无改动 | `pnpm lint` |
| `pnpm-workspace.yaml` | 无改动 | n/a |

---

## 6. 校验与单测

### 6.1 校验脚本 `pnpm check:aliases`

| 检查 | 失败条件 |
| --- | --- |
| 跑生成器 | 生成器抛异常 → exit 1 |
| 读取 tsconfig.app.json paths | 解析失败 → exit 1 |
| 比对 SRC_DIR_ALIASES 派生的 paths 与 tsconfig.app.json paths | key 数量不一致 / 任意一对 key-value 不同 → exit 1 + 列出差异 |

### 6.2 单测

| 文件 | 覆盖 |
| --- | --- |
| `build/aliases.spec.ts` | `generateTsconfigPaths()` 产出 28 条（14 别名 × 2 形态 + 1 catch-all），key 顺序稳定，值含 `./src/` 前缀 |
| `build/vendor-chunks.spec.ts` | `VENDOR_CHUNKS` 数组顺序与原 vite.config.ts 完全一致 |
| `build/scripts/generate-tsconfig-paths.spec.ts` | 给定 mock aliases fixture，生成器输出预期 tsconfig JSON 字符串 |

### 6.3 端到端验证

```bash
pnpm dev                       # vite alias 解析成功 + 浏览器无 404
pnpm type-check:full           # build/、tsconfig.app.json 都 type-check 通过
pnpm test                      # vitest 复用 alias 成功
pnpm build                     # vendorChunks 分组正确（dist/assets/vendor-vue-*.js 等出现）
pnpm analyze                   # visualizer 报告 vendor 分组正常
```

---

## 7. 迁移步骤

| 步骤 | 内容 | 验证 |
| --- | --- | --- |
| 1 | 新增 `build/aliases.ts` / `vendor-chunks.ts` / `proxy.ts` / `server.ts` / `scss.ts` / `index.ts` | `pnpm type-check:full` 通过 |
| 2 | 新增 `build/scripts/generate-tsconfig-paths.ts` | `node --experimental-strip-types build/scripts/generate-tsconfig-paths.ts` 跑通 |
| 3 | 新增 `tsconfig.app.base.json`（从现有 tsconfig.app.json 剥离 paths 块） | `pnpm type-check:full` |
| 4 | 跑一次生成器，写入新 `tsconfig.app.json`（带顶部注释） | 文件结构正确 |
| 5 | 改 `tsconfig.node.json`：`include` 加 `build/**/*` | `pnpm type-check:full` |
| 6 | 改造 `vite.config.ts`：替换 5 处内联配置为 `build/*` import | `pnpm dev` + `pnpm build` |
| 7 | 新增 `pnpm check:aliases` 到 package.json scripts | `pnpm check:aliases` 退出码 0 |
| 8 | 加 pre-commit hook：跑 `pnpm check:aliases` + 生成器 | `git commit` 时跑通 |
| 9 | 加单测：`build/aliases.spec.ts` 等 3 个 | `pnpm test` 全绿 |
| 10 | 删旧 `tsconfig.app.json` 内容（已被生成器覆盖） | diff 只剩 paths 块变更 |
| 11 | 跑端到端验证（§6.3） | 全部通过 |

---

## 8. 风险与回退

| 风险 | 影响 | 缓解 | 回退 |
| --- | --- | --- | --- |
| 生成器写错覆盖原 tsconfig.app.json 全部字段 | type-check 全失败 | 生成器用 JSON.parse + 字段级合并，只覆写 `compilerOptions.paths`，其他字段原样保留 | `git checkout HEAD -- tsconfig.app.json` |
| pre-commit hook 卡死 | 提交被阻塞 | hook 跑前先 `git diff --quiet` 检测有无 aliases 变更；无变更秒跳过 | 删除 `.husky/pre-commit` 中生成器相关行 |
| 生成器与 vitest.config.ts 解析冲突 | vitest 启动失败 | vitest 继续 merge `vite.config.ts`（已是 alias 的最终消费者），生成器不动 vitest | n/a |
| `build/` 与未来 src/<m>/config/ 命名混淆 | 误读 | `build/` 严格只放构建期配置（CLAUDE.md §2 锁定 15 个 src 一级目录不含 build/） | n/a |
| hash 比对实现错 | 生成器重复写入 | 用 `crypto.createHash('sha256')` 标准库；加单元测试覆盖「无变更 → 跳过写入」 | n/a |

**总体回退**：本次改动全部为新增 + 文件内 import 调整；任何环节失败 `git checkout HEAD -- .` 即可恢复主线状态（除非新文件已 commit，否则用 `git clean -fd build/`）。

---

## 9. 不动什么

- ❌ src/ 下任何源码
- ❌ BEM 命名空间与 SCSS 注释（仅迁移到 build/scss.ts）
- ❌ vendorChunks 分组规则与回退名 `vendor-utils`
- ❌ port 数值 5174 / strictPort 行为
- ❌ AutoImport / Components / viteMockServe 等插件配置
- ❌ tsconfig.json / tsconfig.node.json / tsconfig.vitest.json 的核心结构（仅 include 微调）

---

## 10. 验证清单（完工判定）

```
—— 单一来源 ——
□ 1. 新增 src/<dir> 时只需改 build/aliases.ts，生成器自动同步 tsconfig.app.json
□ 2. 删除 src/<dir> 时同上

—— 拆分语义化 ——
□ 3. vite.config.ts 不再内联 SRC_DIR_ALIASES / VENDOR_CHUNKS / port / scss 配置
□ 4. build/ 下 6 个文件职责单一（aliases / vendor / proxy / server / scss / index）

—— tsconfig 生成 ——
□ 5. tsconfig.app.base.json 手写无 paths
□ 6. tsconfig.app.json 由生成器写入，顶部带「勿手动编辑」注释
□ 7. pnpm check:aliases 跑通，build/aliases.ts 与 tsconfig.app.json paths 完全一致

—— CI / 校验 ——
□ 8. pre-commit hook 跑生成器，hash 比对秒跳过
□ 9. pnpm type-check:full / pnpm test / pnpm build / pnpm analyze 全部通过

—— 测试覆盖 ——
□ 10. build/aliases.spec.ts 覆盖 generateTsconfigPaths() 全部 28 条
□ 11. build/vendor-chunks.spec.ts 覆盖顺序敏感
□ 12. build/scripts/generate-tsconfig-paths.spec.ts 覆盖 fixture round-trip

—— 文档同步 ——
□ 13. CLAUDE.md §1.6 「新增 AutoImport 可自动注入的标识符」表格不动（本次不涉及）
□ 14. docs/18-代码组织决策表.md 不需要更新（仅限 src/ 内决策，build/ 在 src/ 外）
□ 15. CHANGELOG.md 记录本次改动（type: chore/refactor）
```

---

## 11. 相关链接

| 文档 | 关联点 |
| --- | --- |
| `CLAUDE.md` §1.6 AutoImport 自动注入 | 解释为什么 `createNamespace` 等无须 import（本次保持不变） |
| `CLAUDE.md` §2 src/ Architecture Lockdown | 解释为什么 build/ 必须放外面 |
| `CLAUDE.md` §4 #14 alias 优先 | 本次强化单一来源落地 |
| `docs/18-代码组织决策表.md` | 与本次「工程配置目录归属」无冲突（决策表仅限 src/） |
| `vite.config.ts` 当前实现 | 迁移起点（213 行） |
| `tsconfig.app.json` 当前实现 | 迁移终点（28 条 paths 自动生成） |

---

_文档版本：v1.0.0 | 编写日期：2026-09-10 | 配套项目版本：vue3-vite-project 1.x_