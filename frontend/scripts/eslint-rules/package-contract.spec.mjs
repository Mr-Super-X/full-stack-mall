/**
 * package-contract 规则单测（node:test + ESLint RuleTester）。
 *
 * 运行：pnpm test:eslint-rules（根 package.json，node --test 直跑——scripts 非 workspace
 * 包，不经 turbo/vitest；与同目录 node-gateway.spec.ts 的 test:gateway 同形态）。
 *
 * 用例全部锚定稳定事实（真实 packages/<pkg>/package.json），不依赖「尚未补齐的声明」——
 * 未声明用例统一用虚构包名 left-pad-xyz-not-declared，保证规则测试与 manifest 修复解耦。
 */
import { createRequire } from 'node:module'
import { readdirSync, readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { RuleTester } from 'eslint'
import rule from './package-contract.mjs'

RuleTester.describe = describe
RuleTester.it = it

// TS 语法用例（import type）需要 @typescript-eslint/parser：pnpm 严格模式下它不在根
// node_modules，且宿主链（@vue/eslint-config-typescript → typescript-eslint 元包）实测
// 逐跳 require 不可达——改为按版本无关前缀在 .pnpm 存储中定位真实目录后按绝对路径加载
const requireFromRoot = createRequire(new URL('../../package.json', import.meta.url))
const pnpmStore = new URL('../../node_modules/.pnpm/', import.meta.url)
const parserStoreDir = readdirSync(pnpmStore).find((d) =>
  d.startsWith('@typescript-eslint+parser@')
)
if (!parserStoreDir) {
  throw new Error('未找到 @typescript-eslint/parser（.pnpm 存储），请先 pnpm install')
}
// parser 包无 main（纯 exports 形态），目录 require 不适用——从 package.json 读真实入口再加载
const parserPkgDir = fileURLToPath(
  new URL(`${parserStoreDir}/node_modules/@typescript-eslint/parser`, pnpmStore)
)
const parserPkg = JSON.parse(readFileSync(`${parserPkgDir}/package.json`, 'utf8'))
const parserEntry = parserPkg.main ?? parserPkg.exports?.['.']?.default
if (!parserEntry) throw new Error('@typescript-eslint/parser package.json 缺少可用入口')
const tsParser = requireFromRoot(`${parserPkgDir}/${parserEntry}`)

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
})

ruleTester.run('package-contract', rule, {
  valid: [
    // ui → shared：方向合法且 ui dependencies 已声明 @vv/shared
    {
      filename: 'packages/ui/src/components/common/X.ts',
      code: "import { useAuth } from '@vv/shared'",
    },
    // 生产源码的纯类型导入允许 devDependencies（mock 的 vite-plugin-mock 只在 devDeps）；
    // import type 是 TS 语法，espree 解析不了，该用例指定 TS parser
    {
      filename: 'packages/mock/src/auth.ts',
      code: "import type { MockMethod } from 'vite-plugin-mock'",
      languageOptions: { parser: tsParser },
    },
    // spec 文件允许 devDependencies（vitest 在 ui devDeps）
    {
      filename: 'packages/ui/src/composables/useConfirm.spec.ts',
      code: "import { describe } from 'vitest'",
    },
    // 自引用合法（shared spec 经包名引用自身测试工具）
    {
      filename: 'packages/shared/src/auth/redirect.spec.ts',
      code: "import { installFakeLocation } from '@vv/shared/test-utils/fakeLocation'",
    },
    // 相对路径 / node builtins / 虚拟模块 / 项目既定别名：不是 npm 包，跳过
    { filename: 'packages/ui/src/components/common/X.ts', code: "import { a } from '../x'" },
    { filename: 'packages/config/src/proxy.ts', code: "import path from 'node:path'" },
    { filename: 'packages/shared/src/app-styles.ts', code: "import 'virtual:uno.css'" },
    { filename: 'packages/ui/src/composables/useLogout.spec.ts', code: "import i18n from '@locales'" },
    // 已声明的外部包（element-plus 在 ui peerDependencies）
    {
      filename: 'packages/ui/src/components/common/X.ts',
      code: "import { ElMessage } from 'element-plus'",
    },
    // 非字面量动态 import 无法静态判定，跳过
    { filename: 'packages/ui/src/components/common/X.ts', code: 'const m = await import(name)' },
    // 构建装配配置豁免方向检查（vitest.config 消费 @vv/config 工厂是既定合法形态），
    // 但仍走声明检查——@vv/config 在 ui devDependencies
    {
      filename: 'packages/ui/vitest.config.ts',
      code: "import { createAppAliases } from '@vv/config'",
    },
    // bench 基准文件与 test-utils 目录属测试基建，允许 devDependencies
    {
      filename: 'packages/ui/src/components/form-schema/bench/large-schema.bench.ts',
      code: "import { bench } from 'vitest'",
    },
    {
      filename: 'packages/shared/src/test-utils/fakeLocation.ts',
      code: "import { vi } from 'vitest'",
    },
    // ── apps/* 宿主侧（2026-10-28 C4 扩展）：方向铁律豁免（app 可消费全部 @vv/*），声明检查生效 ──
    // 已声明的外部包（vue 在 admin dependencies，catalog: 引用）
    { filename: 'apps/admin/src/main.ts', code: "import { createApp } from 'vue'" },
    // app 消费全部 @vv/* 属宿主合法形态（方向检查仅约束 packages/* 库间依赖）
    { filename: 'apps/admin/src/main.ts', code: "import { useAuth } from '@vv/shared'" },
    // vant 在 h5 dependencies（catalog:）
    { filename: 'apps/h5/src/main.ts', code: "import { Button } from 'vant'" },
    // app spec 文件的测试基建（vitest 在 app devDependencies）
    { filename: 'apps/admin/src/utils/x.spec.ts', code: "import { describe } from 'vitest'" },
    // app 的 vite.config 消费 @vv/config 工厂（config 豁免方向 + devDependencies 声明）
    { filename: 'apps/admin/vite.config.ts', code: "import { createViteConfig } from '@vv/config'" },
    // 项目既定别名在 app 内同样跳过
    { filename: 'apps/admin/src/main.ts', code: "import i18n from '@locales'" },
  ],
  invalid: [
    // 方向违规：shared → ui
    {
      filename: 'packages/shared/src/x.ts',
      code: "import { useDialog } from '@vv/ui/composables/useDialog'",
      errors: [{ messageId: 'forbiddenDirection' }],
    },
    // spec 文件不豁免方向检查（测试里的反向 import 同样腐蚀方向）
    {
      filename: 'packages/shared/src/x.spec.ts',
      code: "import { useDialog } from '@vv/ui/composables/useDialog'",
      errors: [{ messageId: 'forbiddenDirection' }],
    },
    // 方向违规：ui 只允许 → shared，→ mock 禁止
    {
      filename: 'packages/ui/src/x.ts',
      code: "import { something } from '@vv/mock'",
      errors: [{ messageId: 'forbiddenDirection' }],
    },
    // 未知 @vv 包（不在方向表）
    {
      filename: 'packages/ui/src/x.ts',
      code: "import { x } from '@vv/unknown'",
      errors: [{ messageId: 'unknownVvPackage' }],
    },
    // 未声明外部包（生产值导入）
    {
      filename: 'packages/ui/src/x.ts',
      code: "import leftPad from 'left-pad-xyz-not-declared'",
      errors: [{ messageId: 'undeclared' }],
    },
    // 生产值导入不允许落 devDependencies（vite-plugin-mock 仅在 mock devDeps）
    {
      filename: 'packages/mock/src/x.ts',
      code: "import { setupDevMockServer } from 'vite-plugin-mock'",
      errors: [{ messageId: 'undeclared' }],
    },
    // 字面量动态 import 同样检查
    {
      filename: 'packages/ui/src/x.ts',
      code: "const m = await import('left-pad-xyz-not-declared')",
      errors: [{ messageId: 'undeclared' }],
    },
    // re-export 同样检查
    {
      filename: 'packages/ui/src/x.ts',
      code: "export { x } from 'left-pad-xyz-not-declared'",
      errors: [{ messageId: 'undeclared' }],
    },
    // ── apps/* 宿主侧（C4）：声明检查生效，方向检查豁免 ──
    // app 未声明的外部包 → undeclared（big 未声明 element-plus）
    {
      filename: 'apps/big/src/x.ts',
      code: "import { ElMessage } from 'element-plus'",
      errors: [{ messageId: 'undeclared' }],
    },
    // app 消费未声明的虚构包 → undeclared（方向豁免不覆盖声明检查）
    {
      filename: 'apps/admin/src/x.ts',
      code: "import leftPad from 'left-pad-xyz-not-declared'",
      errors: [{ messageId: 'undeclared' }],
    },
  ],
})
