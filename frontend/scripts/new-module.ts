#!/usr/bin/env node
// 模块脚手架
//
// 用途：为指定应用的新业务模块生成最简骨架，省去手动建 5 处目录。
//   1. 验证 kebab-case 命名 + --app 目标应用（默认 admin，须已存在 apps/<app>/src/modules）
//   2. 创建 apps/<app>/src/modules/<name>/{views,routes,store,apis,components} 5 个子目录 + 6 个产物文件
//      ─ views/index.vue（默认 layout 业务页）
//      ─ routes/index.ts（默认 layout 包裹 + 自动注册）
//      ─ store/index.ts（Setup Store 骨架）
//      ─ apis/index.ts（模块本地 API 层，与 packages/shared/src/api/modules/<name>.ts 互斥）
//      ─ index.ts（对外接口 stub）
//      ─ components/.gitkeep（占位，让 components/ 目录被 git 跟踪）
//   3. 可选选项：--with-mock / --with-store / --with-i18n / --with-request 一次性补齐模板
//   4. 输出下一步建议（mock / check:routes / 权限码）
//
// 设计变更（2026-07-24 方案 A）：
//   - 移除 RouteName 联合类型追加逻辑（types.ts RouteName 改为 string alias）
//   - 新增模块零成本：写 routes/index.ts 即可，auto-register 自动捕获
//
// P5-A 变更：目标路径从 apps/admin/src/modules 参数化为 apps/<app>/src/modules（--app 指定，默认 admin）。
//
// 用法：pnpm new-module <kebab-case-name> [--app <app-name>] [--with-mock] [--with-store] [--with-i18n] [--with-request]
// 例如：pnpm new-module orders --app admin --with-mock --with-i18n --with-request
//
// 默认生成 default layout（业务页通用）。blank layout（登录页/注册页）请参考
// apps/auth/src/modules/auth/routes/index.ts 手工写。

import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { APPS } from './apps-registry.mjs'

const ROOT = resolve(import.meta.dirname, '..')
const APPS_DIR = resolve(ROOT, 'apps')
// mock 数据源已迁 @vv/mock 包（P1-2）；指向根 mock/ 残留目录生成的 mock 不被 vite 扫描（静默 404）
const MOCK_DIR = resolve(ROOT, 'packages/mock/src')

/**
 * 列出 apps/ 下所有含 src/modules/ 的合法目标应用（与 check-routes 同口径 discoverApps）。
 * 用于 --app 校验的错误提示。
 */
function listValidApps(): string[] {
  return readdirSync(APPS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(APPS_DIR, entry.name, 'src/modules')))
    .map((entry) => entry.name)
    .sort()
}

/**
 * 校验 --app 目标应用存在且含 src/modules/。错误时打印合法应用列表并 process.exit(1)。
 */
function resolveAppModulesDir(app: string): string {
  const appModulesDir = join(APPS_DIR, app, 'src/modules')
  if (!existsSync(appModulesDir)) {
    console.error(`✖ 目标应用 "${app}" 不存在或缺少 src/modules/：${appModulesDir}`)
    console.error(`  合法应用：${listValidApps().join(' / ')}`)
    process.exit(1)
  }
  return appModulesDir
}

function kebabToPascal(s: string): string {
  return s.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase())
}

/** 脚手架选项 */
interface ModuleOptions {
  /** 生成 mock/<name>.ts 含 3 条典型 GET 响应 */
  withMock: boolean
  /** 生成 store 完整骨架（带 isLoggedIn getter + logout handler） */
  withStore: boolean
  /** 在 apps/<app>/src/locales/{zh-CN,en-US}.ts 的 menu 段加 'menu.<name>' 翻译键（目录缺失则跳过） */
  withI18n: boolean
  /** 生成 composables/use<Name>List.ts（useRequest 三态封装 + AsyncState 模板） */
  withRequest: boolean
}

/**
 * 解析并校验 argv 输入。支持 --app <app-name>（默认 admin）及选项
 * --with-mock / --with-store / --with-i18n / --with-request。
 * 错误时 process.exit(1)。
 * @returns 规范化后的 kebab-case 名 + PascalCase 名 + 目标应用 + 选项
 */
function parseArgs(argv: string[]): {
  name: string
  pascal: string
  app: string
  options: ModuleOptions
} {
  const args = argv.slice(2)
  const rest: string[] = []
  let app = 'admin'
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!
    if (arg === '--app') {
      const value = args[++i]
      if (!value || value.startsWith('--')) {
        console.error('✖ --app 需要一个应用名（如 --app admin）')
        process.exit(1)
      }
      app = value
    } else if (arg.startsWith('--app=')) {
      app = arg.slice('--app='.length)
    } else {
      rest.push(arg)
    }
  }

  const positional = rest.filter((a) => !a.startsWith('--'))
  const flags = new Set(rest.filter((a) => a.startsWith('--')))
  const name = positional[0]
  // --help / -h / 无参：完整用法输出（/autoplan D8：原仅一行用法；help 本身是无害探索，exit 0）
  if (flags.has('--help') || flags.has('-h') || !name) {
    console.log(`用法: pnpm new-module <kebab-case-name> [选项]

生成业务模块骨架（默认 apps/admin/src/modules/<name>/，6 个产物文件）。

选项:
  --app <app-name>    目标应用（默认 admin，须已存在 apps/<app>/src/modules）
  --with-mock         生成 mock 数据文件（apis/mock.ts）
  --with-store        生成模块私有 store
  --with-i18n         生成 locales 词条
  --with-request      生成 useRequest 三态示例
  -h, --help          输出本帮助

示例:
  pnpm new-module orders
  pnpm new-module user-profile --app portal --with-mock --with-i18n --with-request`)
    process.exit(flags.has('--help') || flags.has('-h') ? 0 : 1)
  }
  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    console.error(`✖ 模块名必须是 kebab-case：以小写字母开头，仅含小写字母/数字/短横线`)
    console.error(`  当前: "${name}"`)
    console.error(`  正确示例: orders  /  user-profile  /  report-export`)
    process.exit(1)
  }
  const options: ModuleOptions = {
    withMock: flags.has('--with-mock'),
    withStore: flags.has('--with-store'),
    withI18n: flags.has('--with-i18n'),
    withRequest: flags.has('--with-request'),
  }
  return { name, pascal: kebabToPascal(name), app, options }
}

/** 在模块目录创建 views/components/routes/store/apis 子目录。 */
function createModuleDirs(moduleDir: string): void {
  mkdirSync(join(moduleDir, 'views'), { recursive: true })
  mkdirSync(join(moduleDir, 'components'), { recursive: true })
  mkdirSync(join(moduleDir, 'routes'), { recursive: true })
  mkdirSync(join(moduleDir, 'store'), { recursive: true })
  mkdirSync(join(moduleDir, 'apis'), { recursive: true })
}

/** views/index.vue：BEM 骨架 + "本页面由 new-module 生成"提示。 */
function buildIndexVue(name: string, pascal: string): string {
  return `<script setup lang="ts">
// 模块入口视图
// 真实场景下常替换为 AsyncState + useRequest 的列表/表单/详情模板
// 参考 apps/admin/src/modules/user/views/List.vue 了解 useRequest + AsyncState + el-table 列表模板
const bem = createNamespace('${name}')
</script>

<template>
  <div :class="bem.b()">
    <h1 :class="bem.e('title')">${pascal} 首页</h1>
    <p :class="bem.e('hint')">本页面由 <code>pnpm new-module ${name}</code> 生成，请按需扩展。</p>
  </div>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-${name} {
  padding: 16px;

  &__title {
    margin: 0 0 8px;
    font-size: var(--font-size-xl, 20px);
    font-weight: var(--font-weight-semibold, 600);
  }

  &__hint {
    color: var(--text-secondary, #666);

    code {
      padding: 2px 6px;
      background: var(--code-bg, rgba(0, 0, 0, 0.05));
      border-radius: 4px;
      font-family: var(--font-family-mono, monospace);
    }
  }
}
</style>
`
}

/** routes/index.ts：default layout + 单一 children（多级菜单参考 orders 模块）。 */
function buildRoutesTs(name: string, pascal: string): string {
  return `// ${name} 模块路由
//
// 自动注册：被 src/router/auto-register.ts 扫描到，无需手动 import。
// 新增/修改路由细节参考 docs/07-路由模块设计.md。

import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/${name}',
    component: () => import('@/layouts/default/index.vue'),
    children: [
      {
        path: '',
        name: '${pascal}',
        component: () => import('../views/index.vue'),
        meta: {
          title: '${pascal} 首页',
          titleKey: 'menu.${name}',
          icon: 'document',
          // 声明性元数据：仅供 remote 菜单 zod 与类型声明消费——登录守卫不读此字段，
          // 「公开免登录访问」唯一机制是 ROUTE_WHITE_LIST 白名单（见 docs/07）
          requiresAuth: true,
          // permissions: ['${name}:view'], // 可选：路由级权限，未配置则所有人可访问
        },
      },
      // 多级菜单示例：children 嵌套（参考 apps/admin/src/modules/workbench/routes/index.ts）
    ],
  },
]

export default routes
`
}

/** store/index.ts：Setup Store 骨架（含 draft/setDraft/clearDraft 示例）。 */
function buildStoreTs(name: string, pascal: string): string {
  return `import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * ${pascal} 模块私有状态。
 *
 * 命名约束：首参数 \`'module-${name}'\` 必须全局唯一，否则 Pinia 启动时会冲突。
 * 私有状态不与跨模块共享，跨模块通信请走"模块对外接口"（本目录的 ../index.ts）。
 */
export const use${pascal}Store = defineStore('module-${name}', () => {
  // 示例：列表查询条件 / 详情缓存 / 表单草稿
  const draft = ref<Record<string, unknown>>({})

  function setDraft(key: string, value: unknown): void {
    draft.value[key] = value
  }

  function clearDraft(): void {
    draft.value = {}
  }

  return { draft, setDraft, clearDraft }
})
`
}

/** index.ts：模块对外接口 stub。 */
function buildModuleIndexTs(name: string, pascal: string, app: string): string {
  return `// ${pascal} 模块对外接口（公开 API）。
//
// 模块对外只暴露 \`apps/${app}/src/modules/${name}/index.ts\`（本文件）。
// 其他模块需要引用本模块时，必须只 import 本文件，不得越级 import 内部文件。
//
// 当前模块无对外 API；按业务需要导出即可，例如：
//   export { use${pascal}Store } from './store'
//   export { ${name}Api } from './apis'
//   export type { ${pascal}Item } from './apis'

export {}
`
}

/**
 * apis/index.ts：模块本地 API 层（互斥于 packages/shared/src/api/modules/<name>.ts）。
 *
 * 与 packages/shared/src/api/modules/<name>.ts 的取舍：
 *   - 仅本模块使用（强内聚）：放本目录（脚手架默认，强烈推荐新模块用此）
 *   - 跨模块共享（多页面共用同一接口）：迁到 packages/shared/src/api/modules/<name>.ts
 *
 * 自动应用 http.ts 全部基建（401 refresh、retry、cache、abort、pageAdapter、request-id 等）。
 */
function buildApisIndexTs(name: string, pascal: string): string {
  // camelCase 由 pascal 派生，避免 kebab-case 名字（如 `kebab-case-test`）生成非法 TS 标识符
  const camel = pascal.charAt(0).toLowerCase() + pascal.slice(1)
  return `// ${pascal} 模块的 API 层（模块内强内聚版本）。
//
// 与 packages/shared/src/api/modules/${name}.ts 互斥：
//   - 仅本模块使用（强内聚）→ 放本目录（脚手架默认）
//   - 跨模块共享            → 迁到 packages/shared/src/api/modules/${name}.ts
//
// 自动应用 http.ts 基建：401 refresh、retry、cache、abort、pageAdapter 等。
// @api 别名指 @vv/shared/src/api（sanctioned 既定路径，§1.6.2——api 不聚合 barrel）；
// '@/api' 是单应用时代残留（app src 已无 api 目录），2026-10-27 注释审计修复

import { request } from '@api/http'

/** 业务实体类型定义（按需扩展） */
export interface ${pascal}Item {
  id: number
  name: string
  // createdAt?: string
  // status?: 'active' | 'inactive'
}

/** 列表查询参数 */
export interface ${pascal}ListParams {
  page: number
  pageSize: number
  keyword?: string
}

/** 分页响应（pageAdapter 转换后的统一结构） */
export interface ${pascal}ListResponse {
  list: ${pascal}Item[]
  total: number
}

/**
 * ${name} API 命名空间。
 *
 * 命名约定：函数名小驼峰，对象名 \`\${name}Api\`（与项目 packages/shared/src/api/modules/*.ts 风格一致）。
 * 全部走 \`request<T>()\`，由 http.ts 拦截器链统一注入 token / 401 retry / 缓存 / 分页适配等。
 */
export const ${camel}Api = {
  /** 列表查询（自动分页转换 + GET 缓存 + 401 自动 refresh 重试） */
  getList: (params: ${pascal}ListParams) =>
    request<${pascal}ListResponse>({
      url: '/${name}/list',
      method: 'get',
      params,
      usePageAdapter: true,
    }),

  // 示例：详情 / 创建 / 更新 / 删除（按需启用）
  // getById: (id: number) =>
  //   request<${pascal}Item>({ url: \`/\${'${name}'}/\${id}\`, method: 'get' }),
  //
  // create: (payload: Omit<${pascal}Item, 'id'>) =>
  //   request<${pascal}Item>({ url: '/${name}', method: 'post', data: payload }),
  //
  // update: (id: number, payload: Partial<${pascal}Item>) =>
  //   request<${pascal}Item>({ url: \`/\${'${name}'}/\${id}\`, method: 'put', data: payload }),
  //
  // remove: (id: number) =>
  //   request<void>({ url: \`/\${'${name}'}/\${id}\`, method: 'delete' }),
}
`
}

/** mock/<name>.ts：3 条典型 GET 响应，供 dev 模式 mock 默认加载。 */
function buildMockStub(name: string, pascal: string): string {
  return `import { defineFakeRoute } from 'vite-plugin-mock/client'

/**
 * ${pascal} 模块 mock 数据
 *
 * 自动生成：3 条典型 GET 响应 + 1 条 POST 响应。
 * 业务侧按需扩展（CRUD 全套、分页参数、错误场景等）。
 *
 * dev 模式生效（mock 在 prod 自动剔除，参见 src/api/mock-guard.ts）。
 */
export default defineFakeRoute([
  {
    url: '/api/${name}/list',
    method: 'get',
    response: () => ({
      code: 200,
      message: 'ok',
      data: {
        records: [
          { id: 1, name: '${pascal} 示例 1', createdAt: '2026-07-24T00:00:00Z' },
          { id: 2, name: '${pascal} 示例 2', createdAt: '2026-07-24T00:00:01Z' },
          { id: 3, name: '${pascal} 示例 3', createdAt: '2026-07-24T00:00:02Z' },
        ],
        current: 1,
        size: 10,
        total: 3,
      },
    }),
  },
  {
    url: '/api/${name}/:id',
    method: 'get',
    response: ({ url }: { url: string }) => ({
      code: 200,
      message: 'ok',
      data: {
        id: Number(url.split('/').pop()),
        name: '${pascal} 详情',
        createdAt: '2026-07-24T00:00:00Z',
      },
    }),
  },
  {
    url: '/api/${name}',
    method: 'post',
    response: () => ({ code: 200, message: 'ok', data: { id: 4 } }),
  },
])
`
}

/**
 * 把 ${pascal} 翻译键加到 apps/<app>/src/locales/{zh-CN,en-US}.ts 的 menu 段。
 * 幂等：重复跑不会重复追加。
 *
 * P5-A：locale 文件按目标应用定位；应用无 locales/ 目录时跳过并提示
 * （admin 的 menu 文案已随 P1-3 迁 packages/shared/src/locales，本同步仅对
 * 仍保留应用私有 locales 的应用生效）。
 */
function syncI18nKeys(name: string, pascal: string, localesDir: string): void {
  for (const locale of ['zh-CN', 'en-US'] as const) {
    const path = join(localesDir, `${locale}.ts`)
    if (!existsSync(path)) {
      console.warn(`  ⚠ ${path} 不存在，跳过 i18n 同步`)
      continue
    }
    const text = `${pascal} 业务` // 中文占位；en-US 用 pascal 即可
    const enValue = pascal
    // kebab-case 等含 `-` 的 key 在 TS 对象字面量里必须加引号，否则 vue-tsc 编译失败
    const keyText = /^[$_a-zA-Z][$_\w]*$/.test(name) ? name : `'${name}'`
    const newEntry = `${keyText}: '${locale === 'zh-CN' ? text : enValue}'`
    const content = readFileSync(path, 'utf-8').replace(/\r\n/g, '\n')

    // 幂等：重复跑不会重复追加。兼容含 `-` 的 key（syncI18nKeys 会自动加引号包裹）
    if (content.includes(`${name}:`) || content.includes(`'${name}':`)) {
      console.log(`  · locales/${locale}.ts：menu.${name} 已存在，跳过`)
      continue
    }

    const lines = content.split('\n')
    const menuStartIdx = lines.findIndex((l) => /^\s*menu:\s*\{/.test(l))
    if (menuStartIdx === -1) {
      console.warn(`  ⚠ locales/${locale}.ts 未找到 menu 段，跳过 i18n 同步`)
      continue
    }
    const menuStartLine = lines[menuStartIdx]!

    // 兼容单行 / 多行 menu 段，统一在闭合 `}` 前插入新 key。
    // 单行：menu: { key: 'v', ... }, —— 字符串替换在 `}` 前注入（兼容空段与非空段）
    // 多行：
    //   menu: {
    //     key: 'v',
    //   },
    //   —— 找结束行 `}`，在它之前 splice 插入
    if (/^\s*menu:\s*\{.*\}\s*,?\s*$/.test(menuStartLine)) {
      lines[menuStartIdx] = menuStartLine.replace(
        /^(\s*menu:\s*\{)(.*?)(\s*\},?\s*)$/,
        (_, head, body, tail) => {
          const trimmed = body.trim()
          // 空段：`menu: { },` → `menu: { newKey },`
          // 非空段：`menu: { a: 'v' },` → `menu: { a: 'v', newKey },`
          return trimmed === ''
            ? `${head} ${newEntry}${tail}`
            : `${head}${body.replace(/,?\s*$/, '')}, ${newEntry}${tail}`
        }
      )
    } else {
      let menuEndIdx = -1
      for (let i = menuStartIdx + 1; i < lines.length; i++) {
        if (/^\s*\},?\s*$/.test(lines[i]!)) {
          menuEndIdx = i
          break
        }
      }
      if (menuEndIdx === -1) {
        console.warn(`  ⚠ locales/${locale}.ts menu 段未闭合，跳过 i18n 同步`)
        continue
      }
      lines.splice(menuEndIdx, 0, `  ${newEntry},`)
    }

    writeFileSync(path, lines.join('\n'), 'utf-8')
    console.log(`  ✓ locales/${locale}.ts：menu 段追加 '${name}'`)
  }
}

/**
 * composables/use<Name>List.ts：useRequest 三态封装。
 *
 * 适用场景：一次性请求（不跨组件共享）→ 用 useRequest 而不是 Pinia store。
 * 跨组件共享请用 --with-store（生成 store 完整骨架）。
 *
 * 参考 docs/17-useRequest使用规范.md 与 src/modules/user/views/List.vue（真实使用范例）。
 */
function buildRequestComposable(name: string, pascal: string): string {
  return `// useRequest 由 unplugin-auto-import 从 '@vv/shared' 注入 setup 全局作用域（CLAUDE.md §1.6），
// 本文件无须显式 import
import { ${name}Api, type ${pascal}ListParams, type ${pascal}ListResponse } from '../apis'

/**
 * ${pascal} 列表请求（三态：loading / error / empty）。
 *
 * 用法（在 views/index.vue）：
 *   const { data, loading, error, isEmpty, execute } = use${pascal}List({ page: 1, pageSize: 10 })
 *
 * 详见 docs/17-useRequest使用规范.md。
 */
export function use${pascal}List(params: ${pascal}ListParams) {
  return useRequest<${pascal}ListResponse>(
    () => ${name}Api.getList(params),
    { immediate: true }
  )
}
`
}

/** 串接：建目录 + 按映射写文件 + 打印成功行。 */
function writeSkeleton(
  name: string,
  pascal: string,
  app: string,
  moduleDir: string,
  localesDir: string,
  options: ModuleOptions
): void {
  createModuleDirs(moduleDir)

  const files: ReadonlyArray<readonly [string, string]> = [
    ['views/index.vue', buildIndexVue(name, pascal)],
    ['routes/index.ts', buildRoutesTs(name, pascal)],
    ['store/index.ts', buildStoreTs(name, pascal)],
    ['apis/index.ts', buildApisIndexTs(name, pascal)],
    ['index.ts', buildModuleIndexTs(name, pascal, app)],
    ['components/.gitkeep', ''],
  ]

  for (const [rel, content] of files) {
    writeFileSync(join(moduleDir, rel), content, 'utf-8')
    console.log(`  ✓ ${rel}`)
  }

  if (options.withMock) {
    const mockPath = join(MOCK_DIR, `${name}.ts`)
    writeFileSync(mockPath, buildMockStub(name, pascal), 'utf-8')
    console.log(`  ✓ mock/${name}.ts`)
  }

  if (options.withI18n) {
    syncI18nKeys(name, pascal, localesDir)
  }

  if (options.withRequest) {
    const composableDir = join(moduleDir, 'composables')
    mkdirSync(composableDir, { recursive: true })
    const composablePath = join(composableDir, `use${pascal}List.ts`)
    writeFileSync(composablePath, buildRequestComposable(name, pascal), 'utf-8')
    console.log(`  ✓ composables/use${pascal}List.ts`)
  }
}

/** 输出用户下一步的手动清单（i18n / API / mock / 一致性校验 / 删除方法）。 */
function printNextSteps(name: string, app: string): void {
  const modulePath = `apps/${app}/src/modules/${name}`
  console.log('')
  console.log('🎉 模块骨架生成完成！')
  console.log('')
  console.log('▶ 接下来手动做的事：')
  console.log('')
  console.log(`  1. 编辑 ${modulePath}/apis/index.ts 完善 API 业务字段（${name}Api 占位已生成）`)
  console.log('')
  console.log(`  2. 编辑 ${modulePath}/views/index.vue 把"首页骨架"换成真实页面`)
  console.log('')
  console.log(
    `  3. 按需补翻译键（menu 文案现归 packages/shared/src/locales；${app} 若有应用私有 locales 在 apps/${app}/src/locales）`
  )
  console.log('')
  console.log(`  4. 在 mock/${name}.ts 加假数据（开发模式 mock 默认开启）`)
  console.log('')
  console.log(
    `  5. 跑 pnpm check:routes 验证路由一致性（whitelist ⊆ 实际 routes name + 系统路由必存在）`
  )
  console.log('')
  // 端口自 manifest 单源派生（apps-registry → discoverAppManifests）——不硬编码
  // （2026-10-28 /autoplan R2-DX-1：曾硬编码 5173=单 app 时代 vite 默认端口，
  // monorepo 后各 app 端口由 app.manifest.json 唯一决定，banner 打印死链）
  const appPort = APPS.find((a) => a.name === app)?.port
  console.log(
    appPort !== undefined
      ? `  6. 启动 pnpm -C apps/${app} dev，本地访问 http://localhost:${appPort}/${name}`
      : `  6. 启动 pnpm -C apps/${app} dev（端口见 apps/${app}/app.manifest.json），路由路径 /${name}`
  )
  console.log('')
  console.log(
    `  7. 给登录账号的 permissions 加 '${name}:view' 等权限码（如需路由级权限，admin 示例见 apps/admin/src/store/modules/user.ts——user store 仅 admin 持有，其余 app 无该文件）`
  )
  console.log('')
  console.log(
    `  8. 删除模块：跑 pnpm remove-module ${name} --app ${app}（默认交互确认；CI / 管道环境传 --force）`
  )
  console.log('')
}

// ─── 入口 ─────────────────────────────────────────────────────────

const { name, pascal, app, options } = parseArgs(process.argv)
const MODULES_DIR = resolveAppModulesDir(app)
const LOCALES_DIR = join(APPS_DIR, app, 'src/locales')
const moduleDir = join(MODULES_DIR, name)

if (existsSync(moduleDir)) {
  console.error(`✖ 模块 "${name}" 已存在：${moduleDir}`)
  process.exit(1)
}

const flags = Object.entries(options)
  .filter(([, v]) => v)
  .map(
    ([k]) =>
      `--${k
        .replace(/^with/, '')
        .toLowerCase()
        .replace(/^./, (c) => c.toLowerCase())}`
  )
  .join(' ')
console.log(
  `📦 新建模块：${name}（app: ${app}，视图组件名: ${pascal}${flags ? `, ${flags}` : ''}）`
)

writeSkeleton(name, pascal, app, moduleDir, LOCALES_DIR, options)
printNextSteps(name, app)
