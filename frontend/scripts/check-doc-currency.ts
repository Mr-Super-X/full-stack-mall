#!/usr/bin/env node
// 文档与代码一致性校验
//
// 用途：防止 ARCHITECTURE.md / README.md 中记录的"硬数据"随重构漂移。
//
// 设计原则：
// - 不试图验证"文档字面与代码 1:1 一致"（过度耦合，无维护价值）
// - 只验证"事实型硬数据"（字段数 / 文件数 / 行数阈值）——这些是用户和 reviewer
//   翻文档时会照搬的数字，一旦漂移会误导决策
// - 阈值给 ±N 容差（如 builder 数允许 25-30 之间），适应未来扩展
// - 任何 FAIL 立即退出 1，CI 阶段阻断
//
// 当前覆盖的事实：
//   1. SchemaNode 字段数（types/schema-node.ts interface 体）—— ARCHITECTURE.md §2.1 表格
//   2. builder 导出数（builders.ts 中 xXxx 入口）—— ARCHITECTURE.md §8.1 表格
//   3. composable 文件数（composables/*.ts，排除 .spec.ts）
//   4. spec 文件数（composables/*.spec.ts + 根目录 *.spec.ts）
//   5. use-xform-composer.ts 行数上限（顶层编排膨胀预警）
//   6. ProDialog 自有 Props 数 —— docs/27-ProDialog使用指南.md §2.1 表格
//   7. BaseChart Props 数 —— docs/28-BaseChart使用指南.md §1.1 表格
//   8. config 包顶层模块数（packages/config/src/*.ts 排除 .spec.ts）—— docs/04-构建与测试工具.md §1.1 表格
//      P5-A 锚定 9 个（app-aliases / clean-mock-bundled / create-vite-config / index / postcss /
//      proxy / scss / server / vendor-chunks）；2026-10-23 新增 create-vitest-config → 10 个
//      （docs/04 §1.1 同步重写为 packages/config 口径，build/ 历史段落移除）；
//      2026-10-28 新增 version-check-vite → 11 个（docs/04 §1.1 同步加行）
//   9. VENDOR_CHUNKS 具名组数 —— docs/04 §1.1 表格（vendor-vue / vendor-ui / vendor-charts）
//  10. ProTable composables 数 —— docs/29-ProTable使用指南.md §概述「17 composables」
//  11. ProTable 顶级 demo 数 —— docs/29-ProTable使用指南.md §概述「25 个演示」（24 能力 demo + ProTableOverview 主入口）
//  12. XFormProps 字段数 —— docs/24 §2 + form-schema README「18 个」（三视角审查 Wave1-5 同步后的硬数据；Wave3-4 i18n +1 t；Wave3-6 交互增强 +2 size/showDirtyMark）
//  13. XForm demo 数 —— docs/24 §19 示例索引「56 个」+ README（src/modules/demo/examples/XForm/ 下 .vue 数）
//  14. docs 根级文档数预算（2026-10-28 /autoplan Round 2 R2-CEO-10：庄园冻结——新增须
//      改 expected 并在 PR 说明理由，瘦身先合并/归档再降预算）
//
// 阈值调整原则：扩展字段 / 新增 composable 后，需同时更新本文档与 ARCHITECTURE.md。
// 任何调整都需要在 PR 描述中显式说明（避免阈值被随意放宽）。
//
// 用法：pnpm check:doc-currency

import { readdirSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(import.meta.dirname, '..')
const FORM_SCHEMA = join(ROOT, 'packages/ui/src/components/form-schema')

interface Check {
  name: string
  actual: () => number
  expected: number
  /** ±容差（默认 0）。composable / spec 数量允许小幅波动；核心字段数严格要求 */
  tolerance?: number
}

/** tolerance 区间判定纯函数（2026-10-28 /autoplan E3 提取——spec 表驱动守护边界） */
export function inRange(actual: number, expected: number, tolerance = 0): boolean {
  return actual >= expected - tolerance && actual <= expected + tolerance
}

/** 读取文件统一换行符（Windows CRLF → LF），避免正则 ^ 锚点跨平台失效 */
function readText(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf-8').replace(/\r\n/g, '\n')
}

/** 数行 */
function countLines(relativePath: string): number {
  return readText(relativePath).split('\n').length
}

/** SchemaNode 命名空间子接口清单（P2-1 重构后） */
const SCHEMA_NODE_NAMESPACES = [
  {
    file: 'packages/ui/src/components/form-schema/types/identity.ts',
    interfaceName: 'SchemaNodeIdentity',
  },
  {
    file: 'packages/ui/src/components/form-schema/types/render.ts',
    interfaceName: 'SchemaNodeRender',
  },
  {
    file: 'packages/ui/src/components/form-schema/types/layout.ts',
    interfaceName: 'SchemaNodeLayout',
  },
  {
    file: 'packages/ui/src/components/form-schema/types/validate.ts',
    interfaceName: 'SchemaNodeValidate',
  },
  {
    file: 'packages/ui/src/components/form-schema/types/reaction.ts',
    interfaceName: 'SchemaNodeReactive',
  },
  {
    file: 'packages/ui/src/components/form-schema/types/array.ts',
    interfaceName: 'SchemaNodeArray',
  },
  {
    file: 'packages/ui/src/components/form-schema/types/async-options.ts',
    interfaceName: 'SchemaNodeData',
  },
  {
    file: 'packages/ui/src/components/form-schema/types/v-model.ts',
    interfaceName: 'SchemaNodeVModel',
  },
  {
    file: 'packages/ui/src/components/form-schema/types/top-level.ts',
    interfaceName: 'SchemaNodeTopLevel',
  },
] as const

/** 解析 interface 体内的字段数（精确：仅 interface body 内的字段声明） */
export function countInterfaceFields(content: string, interfaceName: string): number {
  // 匹配 export interface Name { ... } —— 非贪婪，跨多行
  const re = new RegExp(`export interface ${interfaceName} \\{([\\s\\S]*?)\\n\\}`)
  const m = content.match(re)
  if (!m) return 0
  // 仅计字段声明行：空白开头 + 标识符 + ? : 或直接 :
  const fieldLines = m[1].split('\n').filter((line) => /^\s+[a-z][a-zA-Z]*\??:\s/.test(line))
  return fieldLines.length
}

/**
 * SchemaNode 字段总数 = 9 个命名空间子接口字段数之和（P2-1 重构后）
 *
 * SchemaNode 本身只 extends 不声明字段，所有字段分布在 9 个 namespace 子接口里。
 * 脚本聚合各子接口的字段数后与 ARCHITECTURE.md §2.1 表「合计」行校验。
 */
function countSchemaNodeFields(): number {
  let total = 0
  for (const ns of SCHEMA_NODE_NAMESPACES) {
    total += countInterfaceFields(readText(ns.file), ns.interfaceName)
  }
  return total
}

/**
 * 数 builder xXxx 入口数（builders/ 子目录全部 .ts，排除 index barrel）
 *
 * 架构审查 #3 拆分后 builders.ts 仅做 re-export（`export * from './builders/index'`），
 * 真正入口在 builders/core.ts + fields-*.ts + containers.ts。
 */
function countBuilders(): number {
  const dir = join(FORM_SCHEMA, 'builders')
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && f !== 'index.ts')
  const content = files
    .map((f) => readText(`packages/ui/src/components/form-schema/builders/${f}`))
    .join('\n')
  const matches = content.match(/^export const x[A-Z]\w+\s*[:=]/gm)
  return matches ? matches.length : 0
}

/** 数 composables/*.ts 文件（排除 .spec.ts 与 barrel.ts） */
function countComposables(): number {
  const files = readdirSync(FORM_SCHEMA + '/composables')
  return files.filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts') && f !== 'barrel.ts')
    .length
}

/**
 * 数 form-schema 全目录 spec 文件（composables + components + adapters + utils + 根级）
 *
 * 当前 65 个：composables 51（49 实现各 1 + barrel.spec + cross-rule-runner.spec）
 * + components 5 + adapters 1 + utils 5 + 根级 3。docs/25 TL;DR 与 ARCHITECTURE.md §9.1 表「合计」行写 65。
 * 2026-09-21 再锚定：fdc5809 批次 +3（render-tabs-steps-node / use-model-expression-rerender /
 * use-scan-async-options 各 1）。
 */
function countSpecFiles(): number {
  const dirs = ['composables', 'components', 'adapters', 'utils']
  const nested = dirs.reduce(
    (sum, d) =>
      sum + readdirSync(join(FORM_SCHEMA, d)).filter((f) => f.endsWith('.spec.ts')).length,
    0
  )
  const rootSpecs = readdirSync(FORM_SCHEMA).filter(
    (f) => f.endsWith('.spec.ts') && statSync(join(FORM_SCHEMA, f)).isFile()
  ).length
  return nested + rootSpecs
}

/**
 * 数 XFormProps 字段数（types/xform.ts interface 体）
 *
 * docs/24 §2 与 form-schema README props 段均写「16 个」；与 index.spec.ts
 * 'XFormProps 契约快照' 用例互锁 —— 增删 prop 时两处同时失败。
 */
function countXFormProps(): number {
  return countInterfaceFields(
    readText('packages/ui/src/components/form-schema/types/xform.ts'),
    'XFormProps'
  )
}

/**
 * 数 XForm demo 文件（apps/docs/src/modules/demo/examples/XForm/ 下 .vue，含 XFormOverview 主入口）
 *
 * docs/24 §19 示例索引表「56 个 demo」与 README demo 计数段写 56；§19 表行数与此互锁。
 * 2026-09-18 Wave4-2 新增 XFormTabsSteps：55 → 56。
 * P2 变更：demo 模块物理独立到 apps/docs，扫描路径随迁（原 admin 路径会 ENOENT 崩溃）
 */
function countXFormDemos(): number {
  return readdirSync(join(ROOT, 'apps/docs/src/modules/demo/examples/XForm')).filter((f) =>
    f.endsWith('.vue')
  ).length
}

/**
 * 数 ProDialog 显式声明的自有 Props（interface Props 体）
 *
 * 排除 ElDialog 通过 $attrs 透传的 Props（详见 packages/ui/src/components/common/ProDialog/ProDialog.vue 文件头）。
 * 解析规则：扫 `interface Props { ... }` 内 `^\s+name\??:\s` 模式。
 */
function countProDialogProps(): number {
  const content = readText('packages/ui/src/components/common/ProDialog/ProDialog.vue')
  const m = content.match(/interface Props \{([\s\S]*?)\n\}/)
  if (!m) return 0
  return m[1].split('\n').filter((line) => /^\s+[a-z][a-zA-Z]*\??:\s/.test(line)).length
}

/**
 * 数 BaseChart 显式声明的 Props（BaseChartProps interface 体）
 */
function countBaseChartProps(): number {
  const content = readText('packages/ui/src/components/common/BaseChart.vue')
  const m = content.match(/interface BaseChartProps \{([\s\S]*?)\n\}/)
  if (!m) return 0
  return m[1].split('\n').filter((line) => /^\s+[a-z][a-zA-Z]*\??:\s/.test(line)).length
}

/**
 * 数工程配置包顶层模块数（packages/config/src/*.ts 排除 .spec.ts）
 *
 * P1-1：build/ 已删除，配置模块迁入 packages/config/src/；P5-A 锚定实际值 9
 * （app-aliases / clean-mock-bundled / create-vite-config / index / postcss /
 * proxy / scss / server / vendor-chunks）。docs/04 §1.1 旧值 7 的修订归 P5-5 文档治理。
 * 2026-10-28 +version-check-vite → 11（构成见文件头注 8）
 */
function countBuildModules(): number {
  const files = readdirSync(join(ROOT, 'packages/config/src'))
  return files.filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts')).length
}

/**
 * 数 VENDOR_CHUNKS 具名组数（vendor-vue / vendor-ui / vendor-charts）
 *
 * 注意：manualChunks 中还有 `'vendor-utils'` fallback，不在 VENDOR_CHUNKS 数组内；
 * docs/04 §1.1 写「4 组」是包括 fallback 的总数，此处校验具名组数 = 3。
 */
function countVendorChunksNamed(): number {
  const content = readText('packages/config/src/vendor-chunks.ts')
  const matches = content.match(/name:\s*['"]vendor-/g)
  return matches ? matches.length : 0
}

/**
 * 数 ProTable composables/*.ts 文件（排除 .spec.ts）
 *
 * 当前 17 个：4 核心（useSearch / useColumns / useTable / useTableCapabilities）
 * + 13 能力/引擎/事件（useRowEdit / useRowDrag / useCellSpan / useTreeData / useSummary /
 * useVirtualScroll / useAutoHeight / useStatePersist / useFullscreen / useProTableEvents /
 * useVxeTable / useEngineFallback / useTableEngineDom）
 * docs/29 §概述写「17 composables」是概数；脚本校验精确值 = 17。
 */
function countProTableComposables(): number {
  const files = readdirSync(join(ROOT, 'packages/ui/src/components/ProTable/composables'))
  return files.filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts')).length
}

/**
 * 数 ProTable 顶级 demo 文件（ProTable*.vue，排除 configs/ 子目录）
 *
 * 当前 25 个：24 个能力 demo + ProTableOverview 主入口（2026-09-18 新增 HeaderActions / ImportExport；
 * 2026-10-19 新增 VxeRowSelect / SearchFilter——审计 demo 缺口补齐）
 *
 * P2 变更：demo 模块物理独立到 apps/docs，扫描路径随迁（原 admin 路径会 ENOENT 崩溃）
 */
function countProTableDemos(): number {
  const files = readdirSync(join(ROOT, 'apps/docs/src/modules/demo/examples/ProTable'))
  return files.filter(
    (f) =>
      f.endsWith('.vue') &&
      f !== 'configs' &&
      statSync(join(ROOT, 'apps/docs/src/modules/demo/examples/ProTable', f)).isFile()
  ).length
}

/**
 * 数 docs/ 根级编号文档（.md 文件数；archive/audit/superpowers 子目录为历史档案
 * 与设计稿，自然生长合理，不入口径）。
 *
 * 文档预算（2026-10-28 /autoplan Round 2 R2-CEO-10）：16k 行文档庄园只增不减，
 * 本检查把庄园锁成「结构承重墙」——新增文档须把 expected +1 并在 PR 说明理由
 * （有意识增长）；要瘦身则先合并/归档再降预算。冻结值 = 45（2026-10-28 实测）。
 */
function countDocs(): number {
  const files = readdirSync(join(ROOT, 'docs'))
  return files.filter((f) => f.endsWith('.md') && statSync(join(ROOT, 'docs', f)).isFile()).length
}

const checks: Check[] = [
  {
    // SchemaNode 实际 35 字段（ARCHITECTURE.md §2.1 已同步为 35）
    name: 'SchemaNode 字段数 (ARCHITECTURE.md §2.1 表格)',
    actual: countSchemaNodeFields,
    expected: 35,
    tolerance: 0,
  },
  {
    name: 'builder 入口数 (ARCHITECTURE.md §8.1 表格)',
    actual: countBuilders,
    expected: 29,
    tolerance: 0,
  },
  {
    // ARCHITECTURE.md 头部写「一文件一能力（50 个）」含 barrel.ts；本函数排除 barrel 数实现文件 = 49。
    // 2026-09-21 再锚定：fdc5809 批次 +3（render-tabs-steps-node / use-model-expression-rerender / use-scan-async-options）。
    name: 'composable 文件数 (ARCHITECTURE.md §1.1 目录树)',
    actual: countComposables,
    expected: 49,
    tolerance: 2,
  },
  {
    // 65 = ARCHITECTURE.md §9.1 表合计行 + docs/25 TL;DR（2026-09-21 再锚定，构成见 countSpecFiles 注释）
    name: 'spec 文件数 (ARCHITECTURE.md §9.1 表格)',
    actual: countSpecFiles,
    expected: 65,
    tolerance: 2,
  },
  {
    // 2026-09-21 再锚定 285→300（容差 50 → 250-350）：Wave4 能力装配使 composer 达 350（split 计数），
    // 增量来自 composition root 的接线（useModelExpressionRerender + modelExpressionEpoch /
    // showDirtyMark / permissionResolver 条件展开），非业务逻辑膨胀。
    // 已贴近上限：下次增长应先抽离 cross-field 编排块（composer 内约 30 行，含 resetFields tick 包装），
    // 而非继续放宽阈值。
    name: 'use-xform-composer.ts 行数 (顶层编排膨胀预警)',
    actual: () =>
      countLines('packages/ui/src/components/form-schema/composables/use-xform-composer.ts'),
    expected: 300,
    tolerance: 50,
  },
  {
    name: 'ProDialog 自有 Props 数 (docs/27 §2.1 表格)',
    actual: countProDialogProps,
    expected: 7,
    tolerance: 0,
  },
  {
    name: 'BaseChart Props 数 (docs/28 §1.1 表格)',
    actual: countBaseChartProps,
    expected: 4,
    tolerance: 0,
  },
  {
    // P5-A 锚定 9 → 2026-10-23 create-vitest-config 工厂新增后 10 → 2026-10-28
    // version-check-vite 新增后 11（构成见文件头注 8）
    name: 'config 包顶层模块数 (docs/04 §1.1 表格)',
    actual: countBuildModules,
    expected: 11,
    tolerance: 0,
  },
  {
    name: 'VENDOR_CHUNKS 具名组数 (docs/04 §1.1 表格)',
    actual: countVendorChunksNamed,
    expected: 3,
    tolerance: 0,
  },
  {
    name: 'ProTable composables 数 (docs/29 §概述)',
    actual: countProTableComposables,
    expected: 17,
    tolerance: 0,
  },
  {
    name: 'ProTable 顶级 demo 数 (docs/29 §概述)',
    actual: countProTableDemos,
    expected: 25,
    tolerance: 0,
  },
  {
    name: 'XFormProps 字段数 (docs/24 §2 + README「18 个」)',
    actual: countXFormProps,
    expected: 18,
    tolerance: 0,
  },
  {
    name: 'XForm demo 数 (docs/24 §19「63 个」+ README)',
    actual: countXFormDemos,
    expected: 63,
    tolerance: 0,
  },
  {
    // 文档预算（2026-10-28 /autoplan Round 2 R2-CEO-10）：新增文档须把 expected +1
    // 并在 PR 说明理由（有意识增长）；瘦身先合并/归档再降预算。冻结值 45 为当日实测；
    // 2026-10-29 R3-D2：新增 docs/46-CI门禁速查.md（门禁失败恢复单页）→ 46，理由见该 PR；
    // 2026-10-29：新增 docs/47-能力体验清单.md（架构/能力/排障操作手册，服务「会用→会修→会教」目标）→ 47。
    // 2026-10-30：新增 docs/48-单应用模式与Monorepo多应用能力对比.md（逐项对比 + 选型参考，
    // 承载 docs/42 评估/43 指引均无的「双版对比」视角）→ 48。
    // 2026-11-02：新增 docs/49-样式分层架构规范.md（五层分层 + monorepo 映射 + 端级归属裁决，
    // 承载当日样式审计报告的规范追认）→ 49。
    // 2026-11-02（同日 99c61ab 第二批，事后归因补记）：新增 docs/AGENTS.md（16 个层级化
    // AGENTS.md 目录导航之一）→ 50；该提交落地时未同步预算致第 14 项存量红，本次补齐。
    // 2026-11-12：新增 docs/50-页面开发组件选型速查.md（场景→封装组件正面决策表 +
    // 选型申请工序 + prefer-wrapped-component 规则豁免清单，服务 AI 架构遵循率）→ 51。
    name: 'docs 根级文档数预算（docs/ 庄园冻结）',
    actual: countDocs,
    expected: 51,
    tolerance: 0,
  },
]

export function main(): void {
  let failed = 0

  for (const check of checks) {
    const actual = check.actual()
    const tolerance = check.tolerance ?? 0
    const lo = check.expected - tolerance
    const hi = check.expected + tolerance
    const ok = inRange(actual, check.expected, tolerance)
    const status = ok ? '✓ PASS' : '✗ FAIL'
    const range = tolerance === 0 ? `${check.expected}` : `${lo}-${hi}`
    console.log(`${status}  ${check.name.padEnd(48)} actual=${actual}  expected=${range}`)
    if (!ok) failed++
  }

  console.log('')
  if (failed > 0) {
    console.error(`[check-doc-currency] ${failed} 项校验失败`)
    console.error(
      '[check-doc-currency] 阈值调整需同时更新 ARCHITECTURE.md + 此脚本，并在 PR 描述中显式说明'
    )
    process.exit(1)
  }
  console.log(`[check-doc-currency] 全部 ${checks.length} 项校验通过`)
}

// CLI 守卫：被 spec import 时不执行 main（2026-10-28 /autoplan E3 可测化改造）
const invokedDirectly =
  process.argv[1] !== undefined && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) main()
