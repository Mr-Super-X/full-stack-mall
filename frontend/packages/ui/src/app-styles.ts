/**
 * 浏览器样式基线四件套（@vv/ui）。
 *
 * 原 6 app main.ts 逐字重复的样式 import（2026-10-23 重复性审查收敛单源；
 * 2026-11-03 补第四件 EP 暗色变量，样式审计发现 #2 修复）。
 * 内部顺序即语义契约：
 *   1. normalize.css        —— 跨浏览器默认值统一（必须在最前）
 *   2. virtual:uno.css      —— UnoCSS 按需原子类
 *   3. ./styles/index.scss  —— 项目 SCSS 入口（本包 src/styles/）
 *   4. element-plus/theme-chalk/dark/css-vars.css —— EP 组件暗色变量（仅 html.dark
 *      下的变量定义，亮色零影响；dark class 由 theme store applyTheme 维护）
 *
 * 归属（2026-11-03 自 @vv/shared 迁回本包）：四件套中两件（index.scss / EP dark
 * css-vars）是本包样式资产——居 shared 时经 @assets 别名掩蔽 shared→ui 引用；
 * styles/ 上移 src/styles/ 后 @assets/styles 失效，改 @vv/ui 说明符触发
 * local/package-contract 方向铁律（shared 禁依赖 @vv/ui，husky 拦截实证）。
 * 迁回本包后引用转包内相对路径，铁律物理消解（依赖方向本身消失）。
 *
 * 为什么独立成模块而不并入 index.ts barrel：本模块含 `virtual:uno.css` 虚拟
 * 模块，vitest 的 vite-node 对虚拟 CSS id 解析与 dev server 不同（会按文件
 * 路径解析炸 ERR_INVALID_ARG_VALUE）；barrel 会被一切 `import '@vv/ui'` 的
 * spec 间接加载，而本模块只被各 app main.ts 显式副作用 import（spec 从不
 * import main），零测试暴露面。
 *
 * 消费方式（唯一合法）：各 app `main.ts` 顶部 `import '@vv/ui/app-styles'`。
 *
 * @group 应用入口：启动装配
 */
import 'normalize.css'
import 'virtual:uno.css'
import './styles/index.scss'
// 显式 .css 后缀：EP 2.14 exports 的 `./*` 通配符不做扩展名补全（vite 8 严格解析，无后缀 500）
import 'element-plus/theme-chalk/dark/css-vars.css'
