import pluginVue from 'eslint-plugin-vue'
// import vueTsEslintConfig from '@vue/eslint-config-typescript'
import { withVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'

import { APPS } from './scripts/apps-registry.mjs'
import packageContract from './scripts/eslint-rules/package-contract.mjs'

// 单一职责：组合 Vue/TS/Prettier 三层规则
// Prettier 规则必须放最后，避免与 Prettier 冲突
//
// 用 withVueTs（v14.9+ 推荐 API）替代旧的 vueTsEslintConfig()：旧 API 声明 scriptLangs 要靠
// configureVueProject 改全局状态，而 demo 的 JSX 插槽示例需要 <script setup lang="tsx">。
// 规则等级保持 vueTsConfigs.recommended（与迁移前的 vueTsEslintConfig() 默认值一致）——
// 升级到 recommendedTypeChecked 会给全项目引入类型感知规则并显著拖慢 lint，属独立议题。
// ─── Monorepo 包边界常量（P5-A）────────────────────────────
// 独立应用清单（apps/ 下含 src/modules 的 6 个应用）与相对逃逸深度表。
// 深度 1-7 层：从 apps/<a>/src/** 任何深度向上越过 src → <a> → apps 三级区间
// 即可能进入兄弟 app（如 src/main.ts 的 '../portal/...' 直达 apps/portal）。
// MONOREPO_APPS 单一事实源是 scripts/apps-registry.mjs（纯 ESM，ESLint 加载本文件的
// Node 进程不带 --experimental-strip-types，读不了 .ts，故注册表本体为 .mjs + .d.mts 镜像）；
// 新增第 7 个 app 只改注册表，boundary-apps-<a> 规则自动随之生成。
const MONOREPO_APPS = APPS.map((app) => app.name)
const SIBLING_APP_ESCAPE_DEPTHS = [
  '../',
  '../../',
  '../../../',
  '../../../../',
  '../../../../../',
  '../../../../../../',
  '../../../../../../../',
]

export default withVueTs(
  // scriptLangs 默认 ['ts']，显式加 'tsx' 才允许 .vue 内写 JSX。
  // 代价：lang="tsx" 的 .vue 会落入 typescript-eslint 的 disableTypeChecked 名单——
  // 本项目未启用 type-aware 规则（recommended 而非 recommendedTypeChecked），故该名单为空集；
  // .vue 的类型安全由 `pnpm type-check:full`（vue-tsc）全量保证，不依赖 eslint。
  // 不加 'tsx' 的话，.vue 内写 JSX 会被 vue-eslint-plugin 误报为 "Parsing error: Unexpected token"。
  // 导致 pre-commit 阶段的 lint-fix 失败，阻塞提交。
  { scriptLangs: ['ts', 'tsx'] },
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}'],
  },
  {
    name: 'app/files-to-ignore',
    ignores: [
      '**/dist/**',
      '**/dist-prod/**',
      '**/dist-ssr/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/.husky/**',
      '**/mock/**',
      '**/scripts/**/*.cjs',
      '**/playwright-report/**',
      '**/test-results/**'
    ],
  },
  // Vue 官方基础规则
  ...pluginVue.configs['flat/essential'],
  // TypeScript 规则等级，vueTsConfigs.recommended = vueTsEslintConfig()
  vueTsConfigs.recommended,
  // 业务目录强制使用项目封装
  // - 拦截 useRouter：业务代码必须用 @composables/useAppRouter
  // - 拦截 axios：业务代码必须用 @composables/useRequest 或 @api/_http
  // - 白名单：composables/router/plugins/main.ts 默认不受限
  // P5-A 修订：files 从旧单应用 src/modules|src/components 改为 apps/*/src/...，
  // 否则 Monorepo 结构下 glob 匹配不到任何文件，规则名存实亡
  {
    name: 'app/business-wrap-rule',
    files: ['apps/*/src/modules/**/*.{ts,vue}', 'apps/*/src/components/**/*.{ts,vue}'],
    rules: {
      'no-restricted-imports': [
        'warn',
        {
          patterns: [
            {
              group: ['vue-router'],
              importNames: ['useRouter'],
              message:
                '业务代码禁止直接使用 vue-router 的 useRouter，请改用 @composables/useAppRouter',
            },
            {
              group: ['axios', 'axios/*'],
              message:
                '业务代码禁止直接使用 axios 包，请通过 @composables/useRequest 或 @api/_http 调用',
            },
          ],
        },
      ],
    },
  },
  // ─── Monorepo 包边界规则（P5-A）────────────────────────────
  //
  // 边界铁律（CLAUDE.md §1.2 的 ESLint 兜底）：
  //   - packages/** 不得依赖任何 app（禁 app 私有别名 @modules/@layouts/@router/@plugins + 禁 apps/** 路径）
  //   - apps/<a>/** 不得引用其他 app（禁相对逃逸 ../<other-app>/ 与绝对路径 apps/<other-app>/）
  //
  // 跨 app 共享能力一律经 workspace 包（@vv/shared / @vv/ui / @vv/mock / @vv/config）出口引用。
  // 规则为 error 级：CI 阶段 pnpm lint 直接阻断越界引用。
  {
    name: 'app/boundary-packages',
    files: ['packages/**/*.{ts,mts,tsx,vue}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@modules/*', '@layouts/*', '@router/*', '@plugins/*'],
              message:
                'packages/** 禁止引用 app 私有别名（@modules/@layouts/@router/@plugins 指向具体 app 的 src）；跨包能力请经 @vv/shared / @vv/ui 包出口引用',
            },
            {
              group: ['apps/*', 'apps/**/*', '**/apps/**'],
              message:
                'packages/** 禁止引用 apps/**（包不得依赖应用）；跨 app 共享能力请下沉到 packages/*',
            },
          ],
        },
      ],
    },
  },
  // packages/* 依赖契约（P0 共享包自包含）：包消费的每个 npm 包必须在自身 package.json
  // 声明（dependencies/peerDependencies；类型导入与 spec/config 文件允许 devDependencies），
  // @vv/* 方向铁律（mock → shared、ui → shared）机械检查，防包间反向依赖漂移
  {
    name: 'app/package-contract',
    files: ['packages/**/*.{ts,mts,tsx,vue}', 'apps/**/*.{ts,mts,tsx,vue}'],
    plugins: { local: { rules: { 'package-contract': packageContract } } },
    rules: { 'local/package-contract': 'error' },
  },
  // @vv/ui 两子系统目录边界：form-schema ⇄ ProTable 双向禁 import（防腐化，为后续按触发
  // 条件拆包（@vv/pro-table + @vv/form-schema）铺路——拆分评估确认两子系统编译期零互依，
  // 此规则保持该不变量；common/ProDialogForm 对 form-schema 的依赖属合理 XForm 弹窗封装）。
  {
    name: 'app/ui-subsystem-boundary',
    files: [
      'packages/ui/src/components/form-schema/**/*.{ts,mts,tsx,vue}',
      'packages/ui/src/components/ProTable/**/*.{ts,mts,tsx,vue}',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['*/ProTable/*', '*/components/ProTable/*'],
              message:
                'form-schema 子系统禁止引用 ProTable（拆分子系统双向防腐化：保持编译期零互依）',
            },
            {
              group: ['*/form-schema/*', '*/components/form-schema/*'],
              message:
                'ProTable 子系统禁止引用 form-schema（拆分子系统双向防腐化；common/ProDialogForm 的 XForm 封装属合理）',
            },
          ],
        },
      ],
    },
  },

  // 逐 app 生成边界规则：apps/<a>/src/** 禁引用其他 5 个 app。
  //
  // 相对逃逸覆盖深度 1-7 层：自身 app 名不参与 ban（避免 apps/auth 的
  // src/modules/auth 等同级目录被误伤）；其余 5 个 app 名在任意 ../ 深度前缀下
  // 出现即判定为跨 app 相对引用。
  ...MONOREPO_APPS.flatMap((app) => {
    const siblingPatterns = MONOREPO_APPS.filter((other) => other !== app).flatMap((other) =>
      SIBLING_APP_ESCAPE_DEPTHS.map((depth) => `${depth}${other}/**`)
    )
    return [
      {
        name: `app/boundary-apps-${app}`,
        files: [`apps/${app}/src/**/*.{ts,mts,tsx,vue}`],
        rules: {
          'no-restricted-imports': [
            'error',
            {
              patterns: [
                {
                  group: ['apps/*', 'apps/**/*', '**/apps/**', ...siblingPatterns],
                  message: `apps/${app} 禁止引用其他应用（跨 app 共享能力请经 @vv/shared / @vv/ui / @vv/mock workspace 包出口引用，而不是直接 import 兄弟 app 的路径）`,
                },
              ],
            },
          ],
        },
      },
    ]
  }),
  // 项目级规则覆盖：
  // - 关闭单字组件名（项目刻意保持简洁命名）
  // - 允许 _ 前缀变量被忽略（用于"解构但暂不使用"的场景）
  {
    rules: {
      'vue/multi-word-component-names': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
      ],
    },
  },
  skipFormatting
)
