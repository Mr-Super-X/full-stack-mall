/**
 * 运行时 BEM 类名拼接工具（TypeScript 版本）。
 *
 * 角色：utils 工具模块，被 `unplugin-auto-import` 自动注入到 `<script setup>` 全局作用域，
 * 业务侧无须 `import { createNamespace } from '@vv/shared'`（注释示例随 codemod 批次 2
 * 收敛为包名形态；@utils 深层别名已定性为过渡态遗留，见 CLAUDE.md §1.6.2）。
 *
 * 与 `src/styles/tools/_bem.scss`（@vv/ui 包）的 SCSS 编译期 mixin 互补：
 * - SCSS mixin：在编译期把 BEM 拼接写入 CSS（适合纯样式场景）
 * - 本工具：在运行时拼接类名并返回字符串（适合 `:class` / `class` 动态控制场景）
 *
 * 命名规则（对齐 Element Plus / Vant 等 Vue 生态主流约定）：
 * - Block：      `{prefix}-{name}`            （前缀来自 `VITE_BEM_PREFIX`，默认 `vv`）
 * - Block 后缀： `{prefix}-{name}-{suffix}`   （同一 Block 的多个变体）
 * - Element：    `{prefix}-{name}__{element}`
 * - Modifier：   `{prefix}-{name}--{modifier}`
 * - State：      `is-{state}`                 （独立类名，通过 `is()` 生成）
 *
 * 前缀可通过环境变量 `VITE_BEM_PREFIX` 调整（如改为 `''` 输出无前缀类名）。
 * SCSS 端同名变量由 vite.config.ts 的 `additionalData` 同步注入，保证两套工具输出对齐。
 *
 * @see [`@vv/ui styles/tools/_bem.scss`](../../../ui/src/styles/tools/_bem.scss) 编译期 SCSS 端 mixin
 * @see [`vite.config.ts`](../../vite.config.ts) `$BEM_PREFIX` 注入配置
 * @see [`src/types/auto-imports.d.ts`](../types/auto-imports.d.ts) 全局注入声明
 * @group BEM 类名
 */

// 模块加载时一次性读取 env，避免每次 createNamespace 重复解引用 import.meta.env。
// vitest 默认不注入 VITE_* 变量，单测中用 vi.stubEnv('VITE_BEM_PREFIX', 'custom') mock。
const BEM_PREFIX: string = import.meta.env.VITE_BEM_PREFIX ?? 'vv'

/**
 * 创建 BEM 类名命名空间。
 *
 * @param name Block 名（不含前缀），如 `'button'`
 * @returns 一组拼接函数：`b / e / m / be / bm / em / bem / is`
 *
 * @example
 * ```ts
 * const bem = createNamespace('button')
 *
 * bem.b()                    // 'vv-button'
 * bem.b('group')             // 'vv-button-group'
 * bem.e('icon')              // 'vv-button__icon'
 * bem.m('large')             // 'vv-button--large'
 * bem.be('group', 'icon')    // 'vv-button-group__icon'
 * bem.bm('group', 'large')   // 'vv-button-group--large'
 * bem.em('icon', 'large')    // 'vv-button__icon--large'
 * bem.bem('group', 'icon', 'large') // 'vv-button-group__icon--large'
 * bem.is('loading', true)    // 'is-loading'
 * bem.is('loading', false)   // ''
 * ```
 *
 * Vue 模板用法：
 * ```vue
 * <button :class="[bem.b(), { [bem.is('loading')]: loading }]">
 *   <i :class="bem.e('icon')" />
 * </button>
 * ```
 */
export function createNamespace(name: string) {
  // 空字符串前缀 → 直接用 name，避免出现 '-button' 这种多余连字符。
  const prefixName = BEM_PREFIX ? `${BEM_PREFIX}-${name}` : name
  return createBEM(prefixName)
}

function createBEM(prefixName: string) {
  // 用对象字面量方法简写 + 显式返回类型，让 IDE hover 时能读取每个方法的 JSDoc 提示。
  // （内联箭头函数赋值给 const 变量，TS 不会把变量上的 JSDoc 关联到返回对象的属性上。）
  return {
    /**
     * 生成 Block 类名。可选 `blockSuffix` 用于同 Block 的多个变体。
     *
     * @example
     * ```ts
     * bem.b()          // 'vv-button'
     * bem.b('group')   // 'vv-button-group'
     * ```
     */
    b(blockSuffix: string = ''): string {
      return _bem(prefixName, blockSuffix, '', '')
    },

    /**
     * 生成 Element 类名 `vv-{name}__{element}`。
     *
     * @example
     * ```ts
     * bem.e('icon')    // 'vv-button__icon'
     * ```
     */
    e(element: string = ''): string {
      return element ? _bem(prefixName, '', element, '') : ''
    },

    /**
     * 生成 Block Modifier 类名 `vv-{name}--{modifier}`。
     *
     * @example
     * ```ts
     * bem.m('large')   // 'vv-button--large'
     * ```
     */
    m(modifier: string = ''): string {
      return modifier ? _bem(prefixName, '', '', modifier) : ''
    },

    /**
     * 生成 Block + Element 类名 `vv-{name}-{blockSuffix}__{element}`。
     *
     * @example
     * ```ts
     * bem.be('group', 'icon')   // 'vv-button-group__icon'
     * ```
     */
    be(blockSuffix: string = '', element: string = ''): string {
      return blockSuffix && element ? _bem(prefixName, blockSuffix, element, '') : ''
    },

    /**
     * 生成 Block + Modifier 类名 `vv-{name}-{blockSuffix}--{modifier}`。
     *
     * @example
     * ```ts
     * bem.bm('group', 'large')  // 'vv-button-group--large'
     * ```
     */
    bm(blockSuffix: string = '', modifier: string = ''): string {
      return blockSuffix && modifier ? _bem(prefixName, blockSuffix, '', modifier) : ''
    },

    /**
     * 生成 Element + Modifier 类名 `vv-{name}__{element}--{modifier}`。
     *
     * @example
     * ```ts
     * bem.em('icon', 'large')   // 'vv-button__icon--large'
     * ```
     */
    em(element: string = '', modifier: string = ''): string {
      return element && modifier ? _bem(prefixName, '', element, modifier) : ''
    },

    /**
     * 生成 Block + Element + Modifier 三段类名 `vv-{name}-{blockSuffix}__{element}--{modifier}`。
     *
     * @example
     * ```ts
     * bem.bem('group', 'icon', 'large')  // 'vv-button-group__icon--large'
     * ```
     */
    bem(blockSuffix: string = '', element: string = '', modifier: string = ''): string {
      return blockSuffix && element && modifier
        ? _bem(prefixName, blockSuffix, element, modifier)
        : ''
    },

    /**
     * 生成 `is-{state}` 状态类名。
     *
     * @param name  状态名（如 `loading` / `checked` / `disabled`）
     * @param state 真值返回 `'is-{state}'`，假值返回空字符串（Vue `:class` 自动忽略）
     *
     * @example
     * ```ts
     * bem.is('loading', true)      // 'is-loading'
     * bem.is('loading', false)     // ''
     * bem.is('loading', null)      // ''
     * bem.is('loading', undefined) // ''
     * ```
     */
    is(name: string, state: boolean | undefined | null): string {
      return state ? `is-${name}` : ''
    },
  }
}

/**
 * 拼接单个 BEM 类名（内部函数，不直接导出）。
 *
 * 各参数为空字符串时跳过对应分隔符，避免出现 `vv-button--` 这类尾部连字符。
 *
 * @param prefixName  前缀名（已含 `vv-`），如 `vv-button`
 * @param blockSuffix Block 后缀（变体名），可空
 * @param element     Element 名，可空
 * @param modifier    Modifier 名，可空
 * @returns 拼接后的完整类名
 */
function _bem(prefixName: string, blockSuffix: string, element: string, modifier: string): string {
  if (blockSuffix) {
    prefixName += `-${blockSuffix}`
  }
  if (element) {
    prefixName += `__${element}`
  }
  if (modifier) {
    prefixName += `--${modifier}`
  }
  return prefixName
}
