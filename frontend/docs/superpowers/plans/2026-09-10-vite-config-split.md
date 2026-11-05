# vite.config.ts 工程化抽离 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `vite.config.ts` 内的构建期配置抽离到 `build/` 工程配置目录，建立 src 子目录别名的单一来源，并通过生成器自动同步 `tsconfig.app.json` 的 `paths` 块，消除双维护痛点。

**Architecture:**
- **新建 `build/`**（与 src/、scripts/ 平级）：6 个语义化模块（`aliases.ts` / `vendor-chunks.ts` / `proxy.ts` / `server.ts` / `scss.ts` / `index.ts`）+ 1 个生成器脚本 `scripts/generate-tsconfig-paths.ts`
- **拆分 tsconfig.app.json**：`tsconfig.app.base.json`（手写，无 paths）+ `tsconfig.app.json`（自动生成，extends base + 注入 paths）
- **vite.config.ts 改造**：5 处内联配置改为 `import from './build/<topic>'`
- **CI 校验**：新增 `pnpm check:aliases` + husky pre-commit 跑生成器

**Tech Stack:** Vite 8 + TypeScript 6 + Node 22（`--experimental-strip-types`）+ Vitest 4

**Spec：** `docs/superpowers/specs/2026-09-10-vite-config-split-design.md`（v1.0.0，2026-09-10）

**前置批准（CLAUDE.md §2 src/ Architecture Lockdown）：** 本计划所有新建/修改均落在 `build/`（src/ 外）和 `vite.config.ts` / `tsconfig.*.json` / `package.json` / `.husky/pre-commit`（工程根），**不动 src/ 下任何源码**。

---

## 文件结构总览

| 文件 | 类型 | 职责 |
| --- | --- | --- |
| `build/aliases.ts` | 新建 | 单一来源：SRC_DIR_ALIASES + resolveSrcDirAliases + generateTsconfigPaths |
| `build/aliases.spec.ts` | 新建 | aliases.ts 单元测试 |
| `build/vendor-chunks.ts` | 新建 | VENDOR_CHUNKS 常量 |
| `build/vendor-chunks.spec.ts` | 新建 | vendor-chunks.ts 单元测试 |
| `build/proxy.ts` | 新建 | createProxyConfig(env) 预留空壳 |
| `build/proxy.spec.ts` | 新建 | proxy.ts 单元测试 |
| `build/server.ts` | 新建 | SERVER_DEFAULTS 常量 |
| `build/server.spec.ts` | 新建 | server.ts 单元测试 |
| `build/scss.ts` | 新建 | SCSS_PREPROCESSOR_OPTIONS 常量 |
| `build/scss.spec.ts` | 新建 | scss.ts 单元测试 |
| `build/index.ts` | 新建 | barrel re-export |
| `build/scripts/generate-tsconfig-paths.ts` | 新建 | 读 aliases → 写 tsconfig.app.json |
| `build/scripts/generate-tsconfig-paths.spec.ts` | 新建 | 生成器单元测试 |
| `scripts/check-aliases.ts` | 新建 | 比对 aliases 与 tsconfig.app.json paths |
| `tsconfig.app.base.json` | 新建 | extends @vue/tsconfig + 其他字段，无 paths |
| `tsconfig.app.json` | 修改 | 由生成器覆盖写入（带顶部注释） |
| `tsconfig.node.json` | 修改 | include 加 `build/**/*` |
| `vite.config.ts` | 修改 | 5 处内联配置改为 build/* import |
| `package.json` | 修改 | scripts 加 `check:aliases` + `generate:tsconfig-paths` |
| `.husky/pre-commit` | 修改 | 加生成器 + check:aliases |

**任务粒度原则**：每个 Task 对应一个原子 commit，按 TDD 红绿循环推进。

---

### Task 1: build/aliases.ts（TDD — SRC_DIR_ALIASES + resolveSrcDirAliases + generateTsconfigPaths）

**Files:**
- Create: `build/aliases.ts`
- Create: `build/aliases.spec.ts`

- [ ] **Step 1: 写 spec（先失败）**

`build/aliases.spec.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { SRC_DIR_ALIASES, resolveSrcDirAliases, generateTsconfigPaths } from './aliases'

describe('SRC_DIR_ALIASES', () => {
  it('包含 14 个别名（@ + 13 个 @xxx）', () => {
    expect(Object.keys(SRC_DIR_ALIASES)).toHaveLength(14)
  })

  it('@ 是空字符串（对应 src/ 根）', () => {
    expect(SRC_DIR_ALIASES['@']).toBe('')
  })

  it('@api → api（对应 src/api/）', () => {
    expect(SRC_DIR_ALIASES['@api']).toBe('api')
  })
})

describe('resolveSrcDirAliases', () => {
  it('返回 14 条 vite resolve.alias 形态', () => {
    const result = resolveSrcDirAliases()
    expect(Object.keys(result)).toHaveLength(14)
  })

  it('@ 解析为 ./src 绝对路径', () => {
    const result = resolveSrcDirAliases()
    expect(result['@']).toMatch(/[/\\]src$/)
  })

  it('@api 解析为 ./src/api 绝对路径', () => {
    const result = resolveSrcDirAliases()
    expect(result['@api']).toMatch(/[/\\]src[/\\]api$/)
  })
})

describe('generateTsconfigPaths', () => {
  it('返回 28 条（@/* + 13 × 2 条 = 27 + 1 catch-all）', () => {
    const paths = generateTsconfigPaths()
    expect(Object.keys(paths)).toHaveLength(28)
  })

  it('@/* → ./src/*', () => {
    expect(generateTsconfigPaths()['@/*']).toEqual(['./src/*'])
  })

  it('@api → ./src/api/index.ts；@api/* → ./src/api/*', () => {
    const paths = generateTsconfigPaths()
    expect(paths['@api']).toEqual(['./src/api/index.ts'])
    expect(paths['@api/*']).toEqual(['./src/api/*'])
  })
})
```

- [ ] **Step 2: 跑 spec 确认失败**

```bash
pnpm test build/aliases.spec.ts
```

Expected: FAIL — `Cannot find module './aliases'`

- [ ] **Step 3: 实现 build/aliases.ts**

```ts
import { fileURLToPath, URL } from 'node:url'

/**
 * src 下子目录别名映射（单一来源）
 *
 * 新增子目录时只需在这里加一行，生成器会自动同步到 tsconfig.app.json
 * 与 vite.config.ts 的 resolve.alias。
 */
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
 * 与 vite alias 的区别：tsconfig paths 必须显式列 bare + /* 两条，否则 IDE 跳转不工作；
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

- [ ] **Step 4: 跑 spec 确认通过**

```bash
pnpm test build/aliases.spec.ts
```

Expected: PASS — 7 个用例全过

- [ ] **Step 5: commit**

```bash
git add build/aliases.ts build/aliases.spec.ts
git commit -m "feat(build): 新增 aliases.ts 单一来源（14 别名 + vite resolve + tsconfig paths 生成）"
```

---

### Task 2: build/vendor-chunks.ts（TDD — VENDOR_CHUNKS 常量）

**Files:**
- Create: `build/vendor-chunks.ts`
- Create: `build/vendor-chunks.spec.ts`

- [ ] **Step 1: 写 spec**

`build/vendor-chunks.spec.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { VENDOR_CHUNKS } from './vendor-chunks'

describe('VENDOR_CHUNKS', () => {
  it('包含 vendor-vue 与 vendor-ui 两组', () => {
    const names = VENDOR_CHUNKS.map((c) => c.name)
    expect(names).toEqual(['vendor-vue', 'vendor-ui'])
  })

  it('顺序敏感：vendor-vue 在前（先匹配先返回）', () => {
    expect(VENDOR_CHUNKS[0].name).toBe('vendor-vue')
    expect(VENDOR_CHUNKS[1].name).toBe('vendor-ui')
  })

  it('vendor-vue 包含 vue / pinia / @vue 三个 pattern', () => {
    expect(VENDOR_CHUNKS[0].patterns).toEqual(['/vue/', '/pinia/', '/@vue/'])
  })

  it('vendor-ui 包含 element-plus / unplugin-vue-components', () => {
    expect(VENDOR_CHUNKS[1].patterns).toEqual(['/element-plus/', '/unplugin-vue-components/'])
  })
})
```

- [ ] **Step 2: 跑 spec 确认失败**

```bash
pnpm test build/vendor-chunks.spec.ts
```

Expected: FAIL — `Cannot find module './vendor-chunks'`

- [ ] **Step 3: 实现 build/vendor-chunks.ts**

```ts
/**
 * 第三方库 vendor chunk 分组（顺序敏感——先匹配先返回）
 * 新增分组只需追加一项。
 */
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

- [ ] **Step 4: 跑 spec 确认通过**

```bash
pnpm test build/vendor-chunks.spec.ts
```

Expected: PASS — 4 个用例全过

- [ ] **Step 5: commit**

```bash
git add build/vendor-chunks.ts build/vendor-chunks.spec.ts
git commit -m "feat(build): 抽离 vendorChunks 配置到 build/vendor-chunks.ts"
```

---

### Task 3: build/proxy.ts + build/server.ts + build/scss.ts（TDD — 三个简单配置模块）

**Files:**
- Create: `build/proxy.ts`
- Create: `build/proxy.spec.ts`
- Create: `build/server.ts`
- Create: `build/server.spec.ts`
- Create: `build/scss.ts`
- Create: `build/scss.spec.ts`

- [ ] **Step 1: 写 3 个 spec**

`build/proxy.spec.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { createProxyConfig } from './proxy'

describe('createProxyConfig', () => {
  it('当前返回空对象（占位）', () => {
    expect(createProxyConfig({})).toEqual({})
  })

  it('接受 env 参数并忽略（未来扩展位）', () => {
    expect(createProxyConfig({ FOO: 'bar' })).toEqual({})
  })
})
```

`build/server.spec.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { SERVER_DEFAULTS } from './server'

describe('SERVER_DEFAULTS', () => {
  it('端口 5174（与默认 5173 错开）', () => {
    expect(SERVER_DEFAULTS.port).toBe(5174)
  })

  it('strictPort: true（端口占用时直接报错）', () => {
    expect(SERVER_DEFAULTS.strictPort).toBe(true)
  })
})
```

`build/scss.spec.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { SCSS_PREPROCESSOR_OPTIONS } from './scss'

describe('SCSS_PREPROCESSOR_OPTIONS', () => {
  it('silenceDeprecations 包含 new-global 与 if-function', () => {
    expect(SCSS_PREPROCESSOR_OPTIONS.silenceDeprecations).toContain('new-global')
    expect(SCSS_PREPROCESSOR_OPTIONS.silenceDeprecations).toContain('if-function')
  })

  it('additionalData 包含 bem @use 语句', () => {
    expect(SCSS_PREPROCESSOR_OPTIONS.additionalData).toContain('@use \'@/assets/styles/mixins/bem\' as *')
  })

  it('默认 $BEM_PREFIX 为 vv', () => {
    expect(SCSS_PREPROCESSOR_OPTIONS.additionalData).toContain('$BEM_PREFIX: \'vv\'')
  })
})
```

- [ ] **Step 2: 跑 3 个 spec 确认失败**

```bash
pnpm test build/proxy.spec.ts build/server.spec.ts build/scss.spec.ts
```

Expected: FAIL — `Cannot find module`

- [ ] **Step 3: 实现 build/proxy.ts**

```ts
/**
 * dev server proxy 配置（当前空壳）
 *
 * 启用时机：联调真实后端时，按需补充 _env 字段解析逻辑
 * 用法（在 vite.config.ts）：
 *   server: { ...SERVER_DEFAULTS, proxy: createProxyConfig(process.env) }
 */
export function createProxyConfig(_env: NodeJS.ProcessEnv): Record<string, unknown> {
  return {}
}
```

- [ ] **Step 4: 实现 build/server.ts**

```ts
/** vite dev server 默认配置 */
export const SERVER_DEFAULTS = {
  port: 5174,
  strictPort: true, // 端口占用时直接报错而非自动切换
} as const
```

- [ ] **Step 5: 实现 build/scss.ts**

```ts
import process from 'node:process'

/**
 * SCSS additionalData 注入 + silenceDeprecations 配置
 *
 * bem mixin 通过 $BEM_PREFIX 拼前缀，与 src/utils/bem.ts 的 import.meta.env.VITE_BEM_PREFIX 共享来源
 *
 * silenceDeprecations 白名单：
 *   - 'new-global': bem mixin 的 b() 内 $B: $block !global，Dart Sass 1.78+ 警告
 *   - 'if-function': bem mixin 的 b() 内 if() 拼接前缀，Dart Sass 1.78+ 标记 deprecation
 * 两个 deprecation 在 sass 2.0 升级前必须静默，否则 CI 红。
 */
export const SCSS_PREPROCESSOR_OPTIONS = {
  silenceDeprecations: ['new-global', 'if-function'],
  additionalData: `@use '@/assets/styles/mixins/bem' as * with ($BEM_PREFIX: '${process.env.VITE_BEM_PREFIX ?? 'vv'}');\n`,
} as const
```

- [ ] **Step 6: 跑 3 个 spec 确认通过**

```bash
pnpm test build/proxy.spec.ts build/server.spec.ts build/scss.spec.ts
```

Expected: PASS — proxy 2 个 + server 2 个 + scss 3 个 = 7 个用例全过

- [ ] **Step 7: commit**

```bash
git add build/proxy.ts build/proxy.spec.ts build/server.ts build/server.spec.ts build/scss.ts build/scss.spec.ts
git commit -m "feat(build): 抽离 proxy / server / scss 配置到 build/ 三个模块"
```

---

### Task 4: build/index.ts（barrel re-export）

**Files:**
- Create: `build/index.ts`

- [ ] **Step 1: 创建 barrel**

```ts
/**
 * build/ 统一导出入口
 * vite.config.ts 从这里 import 全部工程配置
 */
export * from './aliases'
export * from './vendor-chunks'
export * from './proxy'
export * from './server'
export * from './scss'
```

- [ ] **Step 2: 跑 type-check 验证 barrel 解析正确**

```bash
pnpm type-check
```

Expected: 0 error

- [ ] **Step 3: commit**

```bash
git add build/index.ts
git commit -m "feat(build): 新增 build/index.ts 统一导出入口"
```

---

### Task 5: tsconfig.app.base.json 拆分（手写剥离 paths）

**Files:**
- Create: `tsconfig.app.base.json`
- Modify: `tsconfig.app.json`（临时手动移除 paths 块，下一 task 由生成器覆盖）

- [ ] **Step 1: 创建 tsconfig.app.base.json**

复制当前 `tsconfig.app.json` 内容，删除 `compilerOptions.paths` 块：

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

- [ ] **Step 2: 临时改 tsconfig.app.json（过渡态，下一步会被生成器覆盖）**

```json
{
  "extends": "./tsconfig.app.base.json",
  "compilerOptions": {}
}
```

> **注意**：这只是过渡形态，Task 7 跑生成器后会被覆盖为带 paths 的最终态。中间不要 commit 任何 tsconfig.app.json 内容。

- [ ] **Step 3: 跑 type-check 验证 base 工作正常**

```bash
pnpm type-check:full
```

Expected: 错误数量大幅增加（因为没有 paths，IDE 找不到 @composables 等模块），但**不阻塞**——这是预期的过渡态；只要不是 tsconfig 自身语法错误就行。

如果报「extends path error」之类基础错误：检查 `tsconfig.app.base.json` 是否在仓库根目录、extends 路径是否正确。

- [ ] **Step 4: 不 commit（仅过渡态）**

Task 7 跑生成器后 tsconfig.app.json 会被覆盖写入，git status 会自动追踪变更。

---

### Task 6: build/scripts/generate-tsconfig-paths.ts（TDD — 生成器）

**Files:**
- Create: `build/scripts/generate-tsconfig-paths.ts`
- Create: `build/scripts/generate-tsconfig-paths.spec.ts`

- [ ] **Step 1: 写 spec**

`build/scripts/generate-tsconfig-paths.spec.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { generateTsconfigContent } from './generate-tsconfig-paths'

describe('generateTsconfigContent', () => {
  it('输入基础 base.json + paths 对象，输出完整 tsconfig.app.json 字符串', () => {
    const base = {
      extends: './tsconfig.app.base.json',
      compilerOptions: {},
    }
    const paths = {
      '@/*': ['./src/*'],
      '@api': ['./src/api/index.ts'],
      '@api/*': ['./src/api/*'],
    }
    const result = generateTsconfigContent(base, paths)

    expect(result).toContain('"extends": "./tsconfig.app.base.json"')
    expect(result).toContain('"paths"')
    expect(result).toContain('"@/*"')
    expect(result).toContain('"./src/*"')
  })

  it('保留 base 中其他 compilerOptions 字段', () => {
    const base = {
      extends: './tsconfig.app.base.json',
      compilerOptions: { noEmit: true },
    }
    const result = generateTsconfigContent(base, { '@/*': ['./src/*'] })

    expect(result).toContain('"noEmit": true')
    expect(result).toContain('"paths"')
  })

  it('paths 按 key 字母序排序（保证 git diff 稳定）', () => {
    const base = { extends: './base.json', compilerOptions: {} }
    const paths = { '@z/*': ['./src/z/*'], '@a/*': ['./src/a/*'] }
    const result = generateTsconfigContent(base, paths)

    const aIndex = result.indexOf('"@a/*"')
    const zIndex = result.indexOf('"@z/*"')
    expect(aIndex).toBeLessThan(zIndex)
  })
})
```

- [ ] **Step 2: 跑 spec 确认失败**

```bash
pnpm test build/scripts/generate-tsconfig-paths.spec.ts
```

Expected: FAIL — `Cannot find module`

- [ ] **Step 3: 实现 build/scripts/generate-tsconfig-paths.ts**

```ts
/**
 * tsconfig.app.json paths 生成器
 *
 * 用法：
 *   node --experimental-strip-types build/scripts/generate-tsconfig-paths.ts [--check]
 *
 * --check 模式：仅校验 paths 是否一致，不写入（CI/校验脚本用）
 * 默认模式：读取 tsconfig.app.json 的 base + 其他字段，写入新的 paths 块
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { generateTsconfigPaths } from '../aliases.ts'

const TSCONFIG_APP = 'tsconfig.app.json'
const TSCONFIG_BASE = 'tsconfig.app.base.json'

interface TsConfig {
  extends?: string
  compilerOptions?: Record<string, unknown>
  [key: string]: unknown
}

/**
 * 生成最终的 tsconfig.app.json 内容（JSON 字符串）
 *
 * 输入：现有 tsconfig.app.json 解析对象 + 新的 paths 块
 * 输出：JSON.stringify 后的字符串（2 空格缩进，paths 按 key 字母序）
 */
export function generateTsconfigContent(
  baseContent: TsConfig,
  paths: Record<string, string[]>
): string {
  const sortedPaths = Object.keys(paths)
    .sort()
    .reduce<Record<string, string[]>>((acc, key) => {
      acc[key] = paths[key]
      return acc
    }, {})

  const result: TsConfig = {
    ...baseContent,
    compilerOptions: {
      ...baseContent.compilerOptions,
      paths: sortedPaths,
    },
  }

  return JSON.stringify(result, null, 2) + '\n'
}

/** 主流程：读取 → 计算 paths → 写入（或仅校验） */
function main(): void {
  const isCheck = process.argv.includes('--check')

  if (!existsSync(TSCONFIG_APP)) {
    console.error(`❌ ${TSCONFIG_APP} 不存在`)
    process.exit(1)
  }

  const existing = JSON.parse(readFileSync(TSCONFIG_APP, 'utf-8')) as TsConfig
  const expectedPaths = generateTsconfigPaths()
  const newContent = generateTsconfigContent(existing, expectedPaths)
  const currentContent = readFileSync(TSCONFIG_APP, 'utf-8')

  if (isCheck) {
    // --check 模式：仅校验，写入到临时位置对比
    const tempPath = '.tsconfig.app.json.tmp'
    writeFileSync(tempPath, newContent)
    const tempHash = createHash('sha256').update(newContent).digest('hex')
    const currentHash = createHash('sha256').update(currentContent).digest('hex')

    if (tempHash === currentHash) {
      console.log('✅ tsconfig.app.json 与 build/aliases.ts 一致')
      process.exit(0)
    }

    console.error('❌ tsconfig.app.json 与 build/aliases.ts 不一致：')
    console.error('   跑 `pnpm generate:tsconfig-paths` 自动修复')
    process.exit(1)
  }

  // 默认模式：仅当内容变更时写入（避免 git diff 噪声）
  const newHash = createHash('sha256').update(newContent).digest('hex')
  const currentHash = createHash('sha256').update(currentContent).digest('hex')

  if (newHash === currentHash) {
    console.log('✅ tsconfig.app.json 无变更（hash 一致）')
    return
  }

  writeFileSync(TSCONFIG_APP, newContent)
  console.log('✅ tsconfig.app.json 已更新')
}

// 入口
if (import.meta.url === `file://${process.argv[1]}` ||
    import.meta.url.endsWith(process.argv[1] ?? '')) {
  main()
}
```

> **注意**：上方 `JSON.stringify(result,, 2)` 是排版错误，实际应为 `JSON.stringify(result, null, 2)`。实施时修正。

- [ ] **Step 4: 跑 spec 确认通过**

```bash
pnpm test build/scripts/generate-tsconfig-paths.spec.ts
```

Expected: PASS — 3 个用例全过

- [ ] **Step 5: commit**

```bash
git add build/scripts/generate-tsconfig-paths.ts build/scripts/generate-tsconfig-paths.spec.ts
git commit -m "feat(build): 新增 generate-tsconfig-paths.ts 生成器（含 --check 校验模式）"
```

---

### Task 7: 跑生成器 + 验证 tsconfig.app.json 写入正确

**Files:**
- Modify: `tsconfig.app.json`（由生成器写入）

- [ ] **Step 1: 跑生成器**

```bash
node --experimental-strip-types build/scripts/generate-tsconfig-paths.ts
```

Expected: `✅ tsconfig.app.json 已更新`

- [ ] **Step 2: 验证文件结构正确**

```bash
cat tsconfig.app.json | head -10
```

Expected: 文件含 `"extends": "./tsconfig.app.base.json"` + `"paths"` 块 28 条

- [ ] **Step 3: 在 tsconfig.app.json 顶部加「勿手动编辑」注释**

注意：JSON 规范不允许顶层注释，但 JSON5/JSONC 可以。本项目其他 tsconfig 是否用 JSONC？

```bash
cat tsconfig.app.json
```

如果项目其他 tsconfig（如 tsconfig.app.base.json）使用纯 JSON（无注释），则保持 JSON 不动；仅在 CLAUDE.md 注明约束。

如果使用 JSONC（允许注释），在文件顶部加：

```jsonc
{
  // ⚠️ 此文件的 compilerOptions.paths 由 build/scripts/generate-tsconfig-paths.ts 自动生成
  //    单一来源在 build/aliases.ts；请勿手动编辑 paths 块
  //    手动编辑后运行 `pnpm check:aliases` 会失败
  ...
}
```

**实施时**：读一下 `tsconfig.app.base.json` 顶部几行判断格式。如果项目其他 tsconfig 都用纯 JSON，则保持纯 JSON 不加注释，仅在 CLAUDE.md §4 加约束条款。

- [ ] **Step 4: 跑 type-check 验证**

```bash
pnpm type-check:full
```

Expected: 0 error（paths 已自动注入）

- [ ] **Step 5: commit**

```bash
git add tsconfig.app.json
git commit -m "feat(build): 跑生成器写入 tsconfig.app.json paths 块（28 条自动同步）"
```

---

### Task 8: tsconfig.node.json include 扩到 build/

**Files:**
- Modify: `tsconfig.node.json:5-11`

- [ ] **Step 1: 修改 include**

当前 `tsconfig.node.json:5-11`：

```json
"include": [
  "vite.config.*",
  "vitest.config.*",
  "cypress.config.*",
  "playwright.config.*",
  "eslint.config.*",
  "scripts/**/*.ts"
]
```

改为：

```json
"include": [
  "vite.config.*",
  "vitest.config.*",
  "cypress.config.*",
  "playwright.config.*",
  "eslint.config.*",
  "build/**/*.ts",
  "build/scripts/**/*.ts",
  "scripts/**/*.ts"
]
```

- [ ] **Step 2: 跑 type-check**

```bash
pnpm type-check:full
```

Expected: 0 error

- [ ] **Step 3: commit**

```bash
git add tsconfig.node.json
git commit -m "chore(tsconfig): include build/**/*.ts 让 build 模块被 type-check 覆盖"
```

---

### Task 9: 改造 vite.config.ts（import from './build/<topic>'）

**Files:**
- Modify: `vite.config.ts:11-36`（替换 SRC_DIR_ALIASES + resolveSrcDirAliases）
- Modify: `vite.config.ts:50-61`（替换 vendorChunks）
- Modify: `vite.config.ts:124-128`（替换 server 字段）
- Modify: `vite.config.ts:156-159`（替换 scss additionalData）

- [ ] **Step 1: 替换 imports**

在 `vite.config.ts` 顶部（line 46 后）加：

```ts
// 工程配置（build/ 单一来源）
import { resolveSrcDirAliases } from './build/aliases'
import { VENDOR_CHUNKS } from './build/vendor-chunks'
import { createProxyConfig } from './build/proxy'
import { SERVER_DEFAULTS } from './build/server'
import { SCSS_PREPROCESSOR_OPTIONS } from './build/scss'
```

- [ ] **Step 2: 删除 SRC_DIR_ALIASES + resolveSrcDirAliases 函数（line 11-36）**

整段删除，包括 JSDoc 注释。

- [ ] **Step 3: 删除 vendorChunks 数组（line 48-61）**

整段删除。

- [ ] **Step 4: 修改 server 字段（line 124-128）**

原：

```ts
server: {
  // 项目固定使用 5174 端口（与默认 5173 错开，避免与并行项目端口冲突）
  port: 5174,
  strictPort: true, // 5174 被占用时直接报错而非自动找下一个端口，避免端口混淆
},
```

改为：

```ts
server: { ...SERVER_DEFAULTS, proxy: createProxyConfig(process.env) },
```

- [ ] **Step 5: 修改 scss 字段（line 156-159）**

原：

```ts
scss: {
  silenceDeprecations: ['new-global', 'if-function'],
  additionalData: `@use '@/assets/styles/mixins/bem' as * with ($BEM_PREFIX: '${process.env.VITE_BEM_PREFIX ?? 'vv'}');\n`,
},
```

改为：

```ts
scss: SCSS_PREPROCESSOR_OPTIONS,
```

- [ ] **Step 6: 修改 manualChunks 引用（line 201-209）**

原：

```ts
manualChunks(id) {
  // 业务代码不归 vendor
  if (!id.includes('node_modules')) return undefined
  for (const { name, patterns } of vendorChunks) {
    if (patterns.some((pattern) => id.includes(pattern))) return name
  }
  // 其他第三方库：axios / vue-i18n / 等
  return 'vendor-utils'
},
```

改为（变量名重命名）：

```ts
manualChunks(id) {
  // 业务代码不归 vendor
  if (!id.includes('node_modules')) return undefined
  for (const { name, patterns } of VENDOR_CHUNKS) {
    if (patterns.some((pattern) => id.includes(pattern))) return name
  }
  // 其他第三方库：axios / vue-i18n / 等
  return 'vendor-utils'
},
```

- [ ] **Step 7: 修改 resolve.alias 引用（line 129-131）**

原：

```ts
resolve: {
  alias: resolveSrcDirAliases(),
},
```

保留不变（已是函数调用形式）。

- [ ] **Step 8: 跑 type-check + dev + build + test 全链路验证**

```bash
pnpm type-check:full
pnpm dev      # 启动验证 alias 解析 + scss 注入；手测一个页面正常加载即可 Ctrl+C 退出
pnpm test
pnpm build
```

Expected:
- type-check: 0 error
- dev: 浏览器加载 demo 页面成功，404 数为 0
- test: 全绿（vitest 复用 alias 正常）
- build: dist/assets/vendor-vue-*.js / vendor-ui-*.js / vendor-utils-*.js 三个 chunk 都生成

- [ ] **Step 9: commit**

```bash
git add vite.config.ts
git commit -m "refactor(vite.config): 替换 5 处内联配置为 build/* import（行为等价）"
```

---

### Task 10: scripts/check-aliases.ts（CI 校验脚本）

**Files:**
- Create: `scripts/check-aliases.ts`
- Modify: `package.json` scripts

- [ ] **Step 1: 创建 scripts/check-aliases.ts**

复用生成器的 `--check` 模式（实际就是调生成器的 check flag）：

```ts
/**
 * 校验 build/aliases.ts 与 tsconfig.app.json paths 一致性
 * CI/校验脚本使用，失败时 exit 1
 */

import { spawnSync } from 'node:child_process'

const result = spawnSync(
  process.execPath,
  ['--experimental-strip-types', 'build/scripts/generate-tsconfig-paths.ts', '--check'],
  { stdio: 'inherit' }
)

process.exit(result.status ?? 1)
```

- [ ] **Step 2: package.json 加 script**

在 `scripts:` 块加：

```json
"check:aliases": "node --experimental-strip-types scripts/check-aliases.ts",
"generate:tsconfig-paths": "node --experimental-strip-types build/scripts/generate-tsconfig-paths.ts",
```

放在 `"check:routes"` 旁边（逻辑相关，归类一致）。

- [ ] **Step 3: 跑 check:aliases 验证**

```bash
pnpm check:aliases
```

Expected: `✅ tsconfig.app.json 与 build/aliases.ts 一致`（退出码 0）

- [ ] **Step 4: 手动测试失败路径**

```bash
# 临时破坏 tsconfig.app.json
sed -i 's/"@api": \[".\/src\/api\/index.ts"\]/"@api": ["./src/api/wrong.ts"]/' tsconfig.app.json
pnpm check:aliases
# Expected: 退出码 1 + 错误信息
sed -i 's/"@api": \[".\/src\/api\/wrong.ts"\]/"@api": ["./src/api/index.ts"]/' tsconfig.app.json
pnpm check:aliases
# Expected: 退出码 0（已恢复）
```

- [ ] **Step 5: commit**

```bash
git add scripts/check-aliases.ts package.json
git commit -m "feat(scripts): 新增 check:aliases 校验脚本 + generate:tsconfig-paths 命令"
```

---

### Task 11: .husky/pre-commit 接入生成器 + check:aliases

**Files:**
- Modify: `.husky/pre-commit`

- [ ] **Step 1: 在 pre-commit 头部加生成器调用**

当前 `.husky/pre-commit`：

```bash
# 暂存区文件先自动格式化 + ESLint fix
pnpm lint-staged
# 全局类型检查
pnpm type-check
# 路由一致性检查
pnpm check:routes
```

改为：

```bash
# tsconfig.app.json paths 自动同步（生成器仅在 hash 不一致时写入，秒级）
pnpm generate:tsconfig-paths
# 暂存区文件先自动格式化 + ESLint fix
pnpm lint-staged
# 全局类型检查
pnpm type-check
# alias 单一来源校验（CI 兜底，防止生成器被绕过）
pnpm check:aliases
# 路由一致性检查
pnpm check:routes
```

- [ ] **Step 2: 测试 hook 流程**

```bash
# 模拟一次 commit（hook 会自动跑）
git add -A
git status  # 确认 tsconfig.app.json 无变更（生成器 hash 一致会跳过写入）
```

Expected: `tsconfig.app.json` 不在变更列表（因为生成器已确保一致）

- [ ] **Step 3: commit**

```bash
git add .husky/pre-commit
git commit -m "chore(husky): pre-commit 接入 generate:tsconfig-paths + check:aliases"
```

---

### Task 12: 端到端验证 + CHANGELOG

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: 跑全量验证**

```bash
pnpm type-check:full
pnpm test
pnpm lint
pnpm build
pnpm analyze    # 检查 dist/stats.html 确认 vendor 分组正确
```

Expected: 全部通过；stats.html 显示 vendor-vue / vendor-ui / vendor-utils 三组

- [ ] **Step 2: dev 模式浏览器实测**

```bash
pnpm dev
# 浏览器打开 http://localhost:5174/vue3-vite-project/demo/base-chart-overview
# 验证：
# 1. 页面正常加载（alias 解析成功）
# 2. 浏览器 console 无 404
# 3. BEM 样式正常（scss additionalData 注入成功）
# 4. Element Plus 组件正常（UI 库解析成功）
```

- [ ] **Step 3: 故意制造漂移测试生成器**

```bash
# 在 build/aliases.ts 添加一个不存在的别名
node -e "
const fs = require('fs');
const content = fs.readFileSync('build/aliases.ts', 'utf-8');
const updated = content.replace(\"'@utils': 'utils',\", \"'@utils': 'utils',\n  '@fake': 'fake',\");
fs.writeFileSync('build/aliases.ts', updated);
"
pnpm generate:tsconfig-paths
# Expected: tsconfig.app.json 自动写入新 paths
grep '@fake' tsconfig.app.json
# Expected: 找到 "@fake": ["./src/fake/index.ts"]

# 还原
git checkout build/aliases.ts
pnpm generate:tsconfig-paths
git checkout tsconfig.app.json
pnpm check:aliases
# Expected: 退出码 0
```

- [ ] **Step 4: 更新 CHANGELOG.md**

在最新 unreleased 段加：

```markdown
### Refactor

- **build/ 工程化抽离**：消除 vite.config.ts 与 tsconfig.app.json 的 paths 双维护痛点
  - 新增 `build/` 目录（6 个模块 + 1 个生成器）：
    - `aliases.ts` — SRC_DIR_ALIASES 单一来源（14 别名 → vite resolve + tsconfig paths）
    - `vendor-chunks.ts` — 抽离 VENDOR_CHUNKS 配置
    - `proxy.ts` — createProxyConfig(env) 预留空壳
    - `server.ts` — SERVER_DEFAULTS（port/strictPort）
    - `scss.ts` — SCSS additionalData 注入
  - 拆分 `tsconfig.app.json` 为 `tsconfig.app.base.json`（手写）+ 自动生成 paths 块
  - 新增 `pnpm check:aliases` + `pnpm generate:tsconfig-paths` 脚本
  - husky pre-commit 接入生成器（hash 比对，无变更秒跳过）
- **vite.config.ts 瘦身**：从 213 行降到 ~180 行；5 处内联配置改为 build/* import
```

- [ ] **Step 5: 最终验证 + commit**

```bash
pnpm type-check:full
pnpm test
pnpm check:aliases
git add CHANGELOG.md
git commit -m "docs(changelog): 记录 build/ 工程化抽离 + vite.config.ts 瘦身"
```

---

## 自检清单

**1. Spec 覆盖**：

| Spec 章节 | 对应 Task |
| --- | --- |
| §1 背景（3 大痛点） | n/a（背景，无实施任务） |
| §2 目标（6 条） | Task 1-12 全部覆盖 |
| §3 非目标 | n/a（明确不做） |
| §4.1 目录结构 | Task 1-4 创建 6 个 build/ 文件 + 生成器 |
| §4.2 单一来源 aliases.ts | Task 1 |
| §4.3 tsconfig 拆分与生成器 | Task 5 + Task 6 + Task 7 |
| §4.4 vendor/proxy/server/scss 抽离 | Task 2 + Task 3 |
| §4.5 vite.config.ts 改造 | Task 9 |
| §5 兼容性 | Task 5/7/8/9 各步骤验证 |
| §6.1 check:aliases | Task 10 |
| §6.2 单测 | Task 1/2/3/6 |
| §6.3 端到端 | Task 9 步骤 8 + Task 12 步骤 1-2 |
| §7 迁移（11 步） | Task 1-12（拆 12 步更细） |
| §8 风险与回退 | Task 12 步骤 3（漂移测试） |
| §9 不动什么 | 全文（CLAUDE.md §2 锁定） |
| §10 验证清单 | Task 12 步骤 1 + 全文 type-check/test/build 验证 |

**2. Placeholder 扫描**：

✅ 无 TBD / TODO / FIXME / "implement later" / "similar to Task N"

**3. 类型一致性**：

| 定义点 | 使用点 | 一致？ |
| --- | --- | --- |
| `SRC_DIR_ALIASES` 14 个 key | `resolveSrcDirAliases()` / `generateTsconfigPaths()` 同文件 | ✅ |
| `resolveSrcDirAliases(): Record<string, string>` | Task 9 vite.config.ts 调用 | ✅ |
| `generateTsconfigPaths(): Record<string, string[]>` | Task 6 generate-tsconfig-paths.ts 调用 | ✅ |
| `VENDOR_CHUNKS: ReadonlyArray<{ name; patterns }>` | Task 9 vite.config.ts 引用 | ✅ |
| `createProxyConfig(env): Record<string, unknown>` | Task 9 vite.config.ts 调用 | ✅ |
| `SERVER_DEFAULTS: { port; strictPort } as const` | Task 9 vite.config.ts spread | ✅ |
| `SCSS_PREPROCESSOR_OPTIONS: { silenceDeprecations; additionalData } as const` | Task 9 vite.config.ts 引用 | ✅ |

---

## 执行选项

Plan 已保存到 `docs/superpowers/plans/2026-09-10-vite-config-split.md`。

两种执行方式：

1. **Subagent-Driven（推荐）** —— 每 Task 派一个独立 subagent，主线程审 review + 集成
2. **Inline Execution** —— 当前 session 内按 Task 顺序执行，batch + checkpoint

请选择执行方式。