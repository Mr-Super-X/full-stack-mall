# Default 布局复刻 vue-element-plus-admin 实施计划

> **日期**：2026-09-09 | **分支**：feature/engine-optimization | **状态**：实施中
> **参考**：https://github.com/kailong321200875/vue-element-plus-admin/tree/master/apps/admin/src
> **组织约定**：对齐 `layouts/portal` 自包含结构（components / config / styles），不引用 `@/components/` 下任何组件

## 一、参考结构梳理

参考仓 `apps/admin/src/layout/`：

| 参考文件 | 职责 | 本项目落点 |
|---------|------|-----------|
| `Layout.vue` | 四模式外壳（sidebar/top/mixed/dual）+ 移动端遮罩 + Backtop | `layouts/default/index.vue` |
| `components/ToolHeader.vue` | 折叠 + 面包屑 ｜ 布局切换 + 主题 + 语言 + 用户 | `components/ToolHeader.vue` |
| `components/AppView.vue` | RouterView + keep-alive + Footer | `components/AppView.vue` |
| `components/PrimaryNav.vue` | 主导航（top 横排 / rail 竖排） | `components/PrimaryNav.vue` |
| `components/LayoutSwitcher.vue` | 四布局预览切换面板 | `components/LayoutSwitcher.vue` |
| `components/Menu/`（tsx） | el-menu 递归菜单 + hasOneShowingChild | `components/AppMenu.vue`（SFC 递归） |
| `components/TagsView/` | 多页签 + 右键菜单（刷新/关闭/左/右/其他/全部） | `components/TagsView.vue` + `components/ContextMenu.vue` |
| `components/{Logo,Collapse,Breadcrumb,UserInfo,LocaleDropdown,Footer,ContextMenu}` | 头部原子组件 | 同名组件 |

## 二、关键决策（已与用户确认）

1. **四模式全做**：sidebar / top / mixed / dual + LayoutSwitcher
2. **验收模块**：`modules/workbench`（`pnpm new-module workbench` 生成）
3. **技术映射差异**：
   - iconify 图标 → `@element-plus/icons-vue`（名称解析器，参考旧 Sidebar `resolveIcon`）
   - 路由源：参考 `permissionStore.routers` → 本项目 `router.getRoutes()` 派生
   - 主题：参考自带 isDark → 复用项目 `useTheme`（`data-theme` 属性 + `default-tokens.scss` 暗色变体）
   - 页签刷新：参考 `/redirect` 路由 → 本项目 AppView 内部 key 重建（provide/inject，不新增路由）
   - i18n：参考 `t(meta.title)` → 项目 `resolveRouteTitle`（titleKey → title → name）
   - 隐藏菜单语义：参考 `meta.hidden` → 项目 `meta.visible === false || meta.menuVisible === false`

## 三、文件清单

### 编辑现有文件
- [x] `src/store/modules/app.ts` — + `layout: LayoutMode`、+ `mobile`（matchMedia ≤767px）、persist 仅 pick `layout`
- [x] `src/store/modules/tags-view.ts` — + `closeLeft` / `closeRight` / `removeCachedView`

### 删除（旧 default 组件被重写版替换）
- [x] `src/layouts/default/components/Header.vue`
- [x] `src/layouts/default/components/Sidebar.vue`
- 保留不动：`src/components/common/TagsView/`（default 改用内部自包含版，common 版变死代码待后续清理）

### 新建 layouts/default
- [x] `config/types.ts` — `LayoutMode`（re-export app store）、`MenuNode` 菜单树节点
- [x] `config/app.ts` — ui 功能开关（breadcrumb/hamburger/theme/locale/footer/tagsViewIcon/uniqueOpened/title）
- [x] `config/menu.ts` — `isUrl` / `pathResolve` / `resolveSingleChild` / `filterAffixRoutes` / `buildMenuTree`（router.getRoutes → MenuNode）
- [x] `styles/default-tokens.scss` — `--left-menu-*` / `--top-header-*` / `--app-content-*` 等 CSS 变量，亮/暗（`[data-theme='dark']`）双套
- [x] `components/MenuIcon.vue` — Element Plus 图标名 → 组件解析
- [x] `components/Logo.vue` — 品牌区（svg logo + 标题，折叠/compact 隐藏标题）
- [x] `components/Collapse.vue` — 折叠按钮
- [x] `components/Breadcrumb.vue` — 面包屑（route.matched 派生，icon 可选）
- [x] `components/AppMenu.vue` — el-menu 递归（vertical/horizontal、collapse、单子项提升、外链新开、popper 样式）
- [x] `components/PrimaryNav.vue` — 主导航 top/rail 两模式
- [x] `components/LayoutSwitcher.vue` — 四布局预览切换
- [x] `components/LocaleDropdown.vue` — zh-CN/en-US（appStore.locale）
- [x] `components/UserInfo.vue` — 字母头像 + 下拉退出（useLogout）
- [x] `components/ToolHeader.vue` — 组合以上（showCollapse/showBreadcrumb props）
- [x] `components/ContextMenu.vue` — el-dropdown 封装（右键/点击触发）
- [x] `components/TagsView.vue` — 页签滚动 + 右键菜单 + 工具按钮（左右滚动/刷新/更多）
- [x] `components/AppView.vue` — keep-alive RouterView + refresh key 机制 + Footer
- [x] `index.vue` — 四模式外壳 + 移动端抽屉遮罩 + Backtop

### 新建 workbench 验收模块
- [x] `pnpm new-module workbench`（生成骨架）
- [x] `views/Index.vue` — 工作台首页（index 子路由 + keep-alive 输入验证）
- [x] `views/Analysis.vue` + `views/Monitor.vue` — 嵌套菜单 + 页签缓存验证页
- [x] `routes/index.ts` — 父分组 meta + 3 children，挂 `@/layouts/default/index.vue`
- [x] `config/menu.spec.ts` — 15 用例锁定菜单树派生（createRouter 真实实例）

### 验证清单执行
- [x] `pnpm type-check:full` 通过
- [x] `pnpm lint` 通过（0 error）
- [x] `pnpm test` 通过（130 文件 / 1679 用例全绿，含新增 menu.spec.ts 15 用例）
- [x] `pnpm check:routes` 通过（16 routes，Workbench 三路由在列）
- [ ] `pnpm dev` 手动验收：`/workbench` 页面四模式切换、折叠、页签右键、主题/语言切换、移动端抽屉（用户侧执行，步骤见合规简报）
- [x] CHANGELOG.md 同步
- [x] 合规简报：src/ 写操作清单 + BEM 核查清单

## 四、四模式渲染矩阵（index.vue）

| 模式 | 顶栏 | 一级导航 | 二级侧栏 | ToolHeader 位置 |
|------|------|---------|---------|----------------|
| sidebar | 无 | 左侧栏（Logo+AppMenu） | 无（AppMenu 全量） | workspace 顶部 |
| top | Logo + AppMenu(horizontal) | 无 | 无 | topbar 右侧 |
| mixed | Logo + PrimaryNav(top) | 无 | AppMenu(secondaryRoutes) | topbar 右侧（含折叠） |
| dual | rail(Logo compact + PrimaryNav rail) | rail | AppMenu(secondaryRoutes) | workspace 顶部 |

移动端（≤767px）：一律 drawer 侧栏 + 遮罩，点遮罩收起。

## 五、验证清单（全部完成才收尾）

- [ ] `pnpm type-check:full` 通过
- [ ] `pnpm lint` 通过（0 error）
- [x] `pnpm test` 通过（130 文件 / 1679 用例全绿，含新增 menu.spec.ts 15 用例）
- [ ] `pnpm check:routes` 通过
- [ ] `pnpm dev` 手动验收：`/workbench` 页面四模式切换、折叠、页签右键、主题/语言切换、移动端抽屉
- [ ] CHANGELOG.md 同步
- [ ] 合规简报：src/ 写操作清单 + BEM 核查清单

## 六、进度日志

- 2026-09-09：方案确认（用户回复：四模式全做 / workbench / 确认）。store 扩展完成。
- 2026-09-09：layouts/default 全部组件 + index.vue 完成；旧 Header/Sidebar 已删；第三轮 type-check 清零（EP 2.14 prop 类型 bug 用 `as any` 绕过，同 PortalNav.vue 先例；MenuIcon name 放宽 `string | undefined`；vertical/horizontal 分支颜色改为固定值消除收窄后比较报错）。
- 2026-09-09：菜单树派生修两处边界（空 path 子路由 → 父路径去尾斜杠；子项全排除的父记录不再成幽灵分组）+ index 子路由标题继承父节点；新增 menu.spec.ts 15 用例全绿。workbench 验收模块完成（父分组 + 3 children + 双语 locale）。
- 2026-09-09：验证闭环——type-check:full ✓ / lint ✓ / test 1679 全绿 ✓ / check:routes 16 routes ✓ / vite transform 冒烟 7 模块 200 ✓（5174 已有用户 dev server，未新开）。剩用户手动验收。
- 2026-09-09（Phase 2 样式高保真对齐）：用户反馈「样式差距太大」。根因：参考仓 master 已重设计为现代亮色系（白侧栏 + 紫主色 #5b5bd6 + 毛玻璃顶栏），Phase 1 按旧版深色经典风实现。已从 GitHub API 拉取参考仓 var.css / Layout.vue / Menu / TagsView / Logo 等 16 个文件逐项对照修正：
  1. default-tokens.scss 整体重写为 var.css 精确值（亮/暗两套）；EP 变量覆盖（--el-color-primary 紫系 + slate 文字/边框色）以 mixin 导出、由 index.vue 施加在 .vv-default-layout 容器作用域——避免污染项目全局主题（theme-vars.scss 管理的 portal 布局主色不受影响）；布局专用变量仍全局定义（菜单弹层 teleport body 需取到）。
  2. index.vue：topbar/toolbar/tags 毛玻璃（color-mix 94%/96% + backdrop-filter blur(16px) + --layout-shadow）；secondary-title 颜色改 --logo-title-text-color 并保留紫色圆点；二级侧栏 AppMenu 背景透明化；模板挂 toolbar/tags BEM 类。
  3. Logo：mark 28→38px，标题色按 top/mixed（--top-header-text-color）与 sidebar/dual（--logo-title-text-color）分模式。
  4. AppMenu：补 .el-sub-menu__icon-arrow 1em、.el-menu--inline flex 列间隙布局、折叠态图标 22px、vertical gap 10px；水平弹层 teleport 取不到容器紫色主色 → 在 default 专属 popper 类局部定义 EP 变量（含 dark 覆盖）。
  5. AppView 内容区 min-height calc(100vh - 顶栏 - 页签)；ToolHeader padding 改 --top-tool-p-x；TagsView 背景移交布局壳（统一毛玻璃）；Breadcrumb :to 改显式 v-if 分支（EP 2.14 + TS6 exactOptionalPropertyTypes 不接收 :to="undefined"，消除 TS2379）。
  6. 尺寸对齐：224/72 侧栏宽、60px 顶栏、38px 页签、24px 内容 padding、50px 页脚。
  验证：type-check ✓ / eslint(default) ✓ / menu.spec 15 ✓ / check:routes ✓ / 官网截图对比：亮色（白侧栏紫主色）+ 暗色（#111827/#0b1120/#818cf8）均与 element-plus-admin.cn 一致；mixed 模式主导航 pill + 圆点二级标题正常；sass `&&` 复合选择器不被 dart-sass 1.101 支持，已改用单 &（背景职责移交布局壳）。
- 2026-09-09（Phase 3 EP 弹层变量映射）：用户反馈「下拉菜单 hover 样式与官网不同」。根因：teleport 到 body 的 EP 弹层（el-dropdown-menu 等）取不到 .vv-default-layout 容器内的紫色变量，回落项目全局主题（#409eff 蓝系）。评估过逐弹层类名补变量（dropdown/select/dialog 类名与 portal 全局共享，无法限定作用域，放弃）。最终方案（用户已确认 §2.4 修改申请）：
  1. 新增 `styles/element-overwrite.scss`——在 `[data-layout='default']` / `[data-theme='dark'][data-layout='default']` / auto media 选择器上施加与容器相同的 EP mixin（复用 default-tokens.scss 导出）。
  2. `index.vue` 生命周期：onMounted 写 `document.documentElement data-layout="default"`，onUnmounted 仅当值仍为 default 时清除（不误伤其他布局标记）。
  3. 属性随路由切换——portal 布局页面无此属性，弹层回落项目全局主题，无泄漏。
  验证：type-check ✓ / eslint ✓ / vite transform 200 ✓；浏览器实测（chrome-devtools，5174）：html 级变量亮 #5b5bd6/#eeeeff/#f5f6fa/#526077 全紫；用户下拉弹层项色 #526077、hover fill #eeeeff、hover 文字 #5b5bd6；auto 暗色模拟 html 级 #818cf8/#252c49/#151e30/#cbd5e1，弹层底色 #1b2538、hover #252c49/#818cf8 全部命中。CHANGELOG 已补 element-overwrite 条目。
- 2026-09-09（Phase 4 滚动容器 + TagsView 样式修复）：用户反馈两问题，实测定位双根因：
  1. 「body 滚动而非 main 滚动」：App.vue 的 ErrorBoundary / AsyncState 包装层（block + auto 高）截断 #app→布局的百分比高度链，`height: 100%` 退化为内容高度，页脚 50px 溢出到 body。修复：index.vue 布局根改 `height: 100vh/100dvh`（自包含，不碰全局组件）；AppView 内容 min-height 补扣 `--app-footer-height`，页脚短内容页恰好沉底。
  2. 「TagsView 样式与官网不同」：三个叠加根因——a) 非 scoped 样式下 `:deep()` 不被编译、整条规则被浏览器丢弃（TagsView 的 scrollbar-view 高度链断裂致页签仅 22px；AppMenu 8 处 :deep 规则同样全丢），全部改为普通后代选择器；b) `src/components/common/TagsView`（死代码，无模板引用）以全局非 scoped 样式占用同名 `vv-tags-view` 命名空间，align-items:center/padding 等规则篡改布局页签——布局侧命名空间改 `default-tags-view` 规避；c) 项目 reset.css 对 div/a 设 font-weight:normal 阻断激活页签 600 字重继承，item-body/link 逐级 `font-weight: inherit` 恢复。
  验证：chrome-devtools 实测页签高 31.4286px（与官网逐位一致）、激活字重 600、菜单项 44px/radius 10px/gap 10px 恢复、bodyScrolls=false 且 __scroll 为唯一滚动容器、页脚沉底；type-check ✓ / eslint 4 文件 0 问题 ✓。
- 2026-09-09（Phase 5 功能审查）：用户要求「再次审查页面功能，确保原官网功能都实现（中英文切换 / 侧边栏折叠 / 页签刷新 / 左右滚动 / 更多菜单等）」。chrome-devtools 系统性实测，发现 4 个真问题并修复：
  1. **i18n 同步缺失（Phase 1 遗留）**：点击 English 仅 store.locale 变，全仓无任何代码写 i18n.global.locale，UI 永不翻译、不持久化。修复：App.vue watch appStore.locale → useI18n 可写 locale + `<html lang>`（immediate 兼刷新回灌）；app.ts persist pick 加 'locale'（实测 theme-mode/app-ui 均写入 localStorage）。
  2. **部分 UI 不随语言热更新**：仅 workbench 路由配了 meta.titleKey（菜单经 buildMenuTree(router, t) computed 响应式重建），home/user/demo 路由无 titleKey 恒显中文；页签（tags-view store toTag 快照 meta.title）与面包屑（meta.title 快照）同样不翻译。修复：三个模块路由补 titleKey（menu.home 文案对齐「仪表盘」、新增 menu.demo）；TagView 增加可选 titleKey（toTag / filterAffixRoutes 携带），TagsView 渲染改 tagTitle() = titleKey ? t(titleKey) : title；Breadcrumb 改 resolveRouteTitle(record, t)。zh/en locale 同步新增 header.*（布局切换面板/折叠/dark/退出等 15 键）与 tagsView.*（工具 aria + 右键菜单 6 项 11 键），Collapse/LayoutSwitcher/ToolHeader/UserInfo/LocaleDropdown/index.vue 遮罩全部改 t()。顺带修复 en-US app.title 残留错误产品名（Emergency Water Portal → Enterprise Admin）。
  3. **页签刷新静默失效**：控制台告警 injection "default-layout-refresh" not found——TagsView 与 AppView 是 `<main>` 下平级兄弟，AppView provide 对 TagsView 不可见，refreshView?.() 静默空转。修复：refreshKey + refresh 句柄上提 default/index.vue 统一 provide（refresh / refresh-key 两个 key），AppView 改 inject key，TagsView 改 inject 句柄。
  4. 验证矩阵（英文态 + 中文态双向）：菜单/页签/面包屑/布局面板/右键菜单全翻译 ✓、html lang 同步 ✓、app-ui 持久化刷新回灌 ✓、折叠 224↔72 ✓、keep-alive 切走切回输入保留 + 刷新后输入清空重建 ✓、左右滚动无报错 ✓、更多菜单 6 项禁用态正确 ✓、四模式 DOM 结构（topbar/horizontal/primaryNav/secondary/rail/sidebar）✓、深色主题 data-theme + theme-mode 持久化 ✓、用户下拉退出登录 ✓。type-check ✓ / eslint 16 文件 0 问题 ✓ / tags-view + menu spec 24 用例全绿 ✓。
- 2026-09-10（Phase 5 反馈五项修复）：用户反馈 5 项，逐项处理：
  1. **ResizeObserver 报错污染 errorHandler**：`ResizeObserver loop completed with undelivered notifications` 是 Chromium 布局观测良性噪声（EP el-scrollbar/弹层动画高频触发、无堆栈无损害）。修复：errorHandler.ts 新增 BENIGN_ERROR_PATTERNS 白名单 + isBenignError()，window error 监听处命中即 return（不 console 也不上报）。实测：dispatch 良性错误被吞、真实错误仍打 [window.error] ✓。
  2. **刷新功能不生效**：实测当前构建正常（输入 refresh-verify-456 → 点刷新 → 输入清空重建、keep-alive 保留）。判断为 HMR 旧状态（provide/inject 跨组件 HMR 需整刷），已在回复中建议硬刷新 Ctrl+F5。
  3. **左右滚动按钮无法验证**：demo 路由挂 blank 布局造不出页签溢出；改在 workbench 页面 emulate 640px 视口 + JS 撑宽页签列表造出 scrollWidth 1600 > clientWidth 488。实测发现自动化浏览器 smooth 滚动动画被冻结（连页面内新建的隔离 div smooth scrollBy 都不动，属测试环境限制），降级把 scrollBy 改 instant 后验证按钮真实逻辑：右点 scrollLeft 0→200、左点 200→0 ✓（handler → scrollBy(±200) → el-scrollbar wrapRef 链路完整）。
  4. **死代码清理（用户批准删除）**：删 `src/components/common/TagsView/index.vue` + 空目录；同步清 types/components.d.ts 两处 TagsView 全局声明（dev server 监听会自动重生成，删文件后手动对齐）、tags-view.ts @see 改指 layouts/default/components/TagsView.vue、TagsView.vue 命名空间注释改历史说明（default-tags-view 不回迁）。docs/CHANGELOG/audit 历史记录不动。
  5. **storage key 命名空间化**：utils/storage.ts 导出 namespacedStorageKey()（与 Local/Session 同规则）；theme.ts persist key 改 namespacedStorageKey('theme-mode') + 老裸 key 一次性读取兜底并清除；app.ts persist key 改 namespacedStorageKey('app-ui')。实测：vue3-vite-project:theme-mode / vue3-vite-project:app-ui 均按新规则落盘、布局切换与主题切换正常。docs/06/10/18/19/21 同步更新——docs/19 §4.4「裸 key 靠 storeId 隔离」旧决策按用户新决策重写为「必须经 namespacedStorageKey() 拼接」；docs/18 app.ts「无持久化」陈旧描述一并修正。
  验证：type-check ✓ / eslint 8 文件 0 问题 ✓ / storage+tags-view+menu 40 用例全绿 ✓。CHANGELOG 已补「功能审查反馈五项修复」条目。

---

## 2026-09-10 Phase 5 反馈第二项修复：折叠菜单不可见

用户反馈「经典布局收起左侧菜单栏后，菜单不可见，鼠标 hover 时有一块背景」，根因两项均已修复并浏览器实测：

1. **菜单图标从不渲染**——`MenuIcon.vue` 以路由 `meta.icon`（kebab-case `'magic-stick'`）直接取 `@element-plus/icons-vue` 的 PascalCase 导出键，恒为 `undefined`。EP collapse 机制下折叠态菜单项的 span 标题 `visibility:hidden`、子菜单箭头 `display:none`，图标是唯一可见内容——图标缺失即"菜单不可见、只剩一块背景"。修复：取键前经 `pascalCase()` 转换。实测折叠态 4 个图标 22×22 居中恢复。
2. **折叠 hover 弹层超高**——demo 模块 60+ 子项撑出 1159px 弹层超出视口。修复：`.vv-app-menu-popper--vertical` 加 `max-height: calc(100vh - 20px); overflow-y: auto`。

验证：`pnpm type-check` / eslint 双文件 0 问题；新增 `MenuIcon.spec.ts` 4 用例全绿；浏览器实测折叠图标 + 弹层限高滚动正常。

关于「hover 时整页变暗」：自动化浏览器 DOM 全量扫描无任何半透明遮罩元素（opacity 全为 1），强制移除弹层即恢复，且该浏览器环境实测冻结 CSS 动画（smooth scroll 不动）——判断为自动化测试环境动画冻结导致的截图伪影，非应用 bug；真实浏览器如出现请再反馈。

---

## 2026-09-10 Phase 6 增强：折叠侧栏菜单项 hover tooltip

用户提议：折叠态菜单只剩图标、hover 只有背景高亮，用户无从知晓目标页——补 tooltip 更好。

设计决策与实现（AppMenu.vue 单文件）：

1. **仅叶子菜单项**：折叠态 hover 分组（sub-menu）本就会弹子项浮层（有上下文），tooltip 会与浮层重叠冲突。
2. **仅根实例**（`showCollapsedTooltip = isCollapsed && !isNested`）：递归实例渲染在 hover 弹层内——弹层是展开态、文字完整可见，无需 tooltip。
3. **tooltip 分支不渲染标题 span**：EP collapse 样式本就把 `.el-menu-item > span` 隐藏（0×0 + visibility:hidden），不渲染等效；同时保证 el-tooltip 单根触发（其 slot 要求单一根元素）。
4. 内容 = `promotedNode(node).title`，与展开态文字同源，随 locale 切换自动更新（index.vue 的 `menuTree` computed 依赖 `t`）。
5. `el-tooltip`：placement right、show-after 300ms、dark 主题、teleport body（不被 el-scrollbar 裁剪）。EP 组件由 unplugin-vue-components 按需注入。

验证：`pnpm type-check` / eslint 0 问题；layouts/default 19 用例全绿；浏览器实测折叠 hover 仪表盘 → dark tooltip「仪表盘」右侧弹出，hover 分组仅弹子项浮层无 tooltip。

## Phase 6 验收反馈修复日志（2026-09-10 续）

### 6.6 页签刷新可见反馈（AppView 180ms 淡入）

- 现象：工作台首页/分析页点刷新"无反馈"，用户管理/监控页"有反馈"
- 实证：两页填字→刷新→字清空 = remount 真实发生，机制对全部页面生效；差异在页面内容性质（静态页重挂载像素不变）
- 修复：`AppView.vue` watch `refreshKey` → 一次性 `is-refresh-fade` class（220ms 摘除）+ CSS animation 180ms 淡入；路由切换不触发（负面对照验证）；弃用 `<Transition>` 改 animation 规避 keep-alive out-in 交互风险
- 验证：CDP 实测刷新 60ms class+动画在 / 300ms 摘除 / 切页签零触发；type-check ✓ eslint ✓ layouts 23 用例全绿 ✓

### 6.7 切暗色刷新回亮色（theme 持久化读取格式失配）

- 根因：persist 插件写入 JSON `{"mode":"dark"}`，`readInitialMode` 只比对裸字符串 → 永不命中 → 兜底 'auto' → 亮色系下暗色丢失；legacy key 迁移同款失配
- 修复：`parseStoredMode` 兼容 JSON 对象 / JSON 字符串 / 裸字符串三种历史格式 + 类型守卫
- 验证：浏览器实证（修复前 localStorage 实况 vs 刷新后 data-theme 丢失）；修复后 UI 往返切换 + 刷新恢复暗色（内容区 bg #0b1120）；新增 theme.spec.ts 7 用例，store 全量 33 用例绿

### 6.8 四模式菜单渲染修复（dual 空项 / mixed 缺项 / top 箭头叠字）

- 根因 1（同因两项）：PrimaryNav 直接消费原始顶层节点，`/user` 包装路由无 meta → 空图标空文案项；修复为 resolveSingleChild 提升语义（displayItems），激活态/select 载荷保留 raw 节点防激活态丢失
- 根因 2：top 水平子菜单标题 padding 0 15px 未预留 EP 绝对定位箭头空间（right:20px 宽 12px）→ 右内边距 34px
- 验证：CDP 三模式实测（rail 四项齐全+跳转+激活态 / mixed 顶横排四项+二级侧栏 / top 箭头文案间距 2px）；新增 PrimaryNav.spec.ts 4 用例，layouts 27 用例全绿；经典侧栏无回归

### 6.9 top 布局水平弹层超高撑出 body 滚动条

- 根因：`.vv-app-menu-popper--horizontal` 无 max-height（vertical 弹层已有限高，水平遗漏），demo 60+ 项实测弹层 2334px
- 修复：补 `max-height: calc(100vh - 20px)` + `overflow-y: auto`（overflow: hidden 改 x hidden / y auto）
- 验证：CDP 实测弹层 933px 限高内滚动、docOverflow false

### 6.9-补 top 布局水平弹层双层滚动条（6.9 二次反馈）

- 根因：EP 2.14 把 popper-class 同时复制到外层 el-popper 与内层 .el-menu--popup-container，6.9 的 max-height+overflow 挂在两处 → 双层滚动条
- 修复：限高/滚动收敛内层（&.el-menu--popup-container 限定）
- 验证：扣除边框后精确判定——外层无滚动条、内层单条、docOverflow false；注意 offsetWidth-clientWidth 判定会被 1px 边框误导（误判教训）

### 6.10 样式治理：AppMenu 全面清除 !important（对齐项目规范 §4#13）

- 背景：用户要求检查 default 布局样式不出现 !important——24 处全部集中在 AppMenu.vue
- 根因：EP el-menu 的 background-color/text-color/active-text-color props 内联到每个菜单项，CSS 覆盖只能上 !important
- 修复：① 移除三个 props，改走 EP 官方变量 --el-menu-bg-color/--el-menu-text-color/--el-menu-active-color（容器 + vertical/horizontal 弹层分别定义，弹层 teleport 继承不到容器作用域）；② 剩余冲突改用特异性——.el-menu 内部 0-3-0/0-4-0 压 EP 默认规则，弹层边框三件套 .el-popper 前缀 0-2-0 压 .el-popper.is-light（源码顺序决胜）；③ horizontal 弹层局部主色变量 + 文件底部暗色覆盖不动；用户改的限高 calc(100vh - 300px) 保留
- 验证：grep 声明清零（仅剩注释提及）；CDP 四模式亮暗双主题基色/悬停/激活 computed 实测正确、折叠 48px 居中、弹层单层滚动条、菜单项内联 style 消失；type-check + eslint + layouts 23 用例全绿
- 收尾（同日）：用户将项目其余文件 !important 全部清除（reset.css 3 / PortalHeader 2 / PortalNav 7 / login.scss 13 / XFormSchemaIndex 4，共 29 处），src/ 声明级 !important 清零；两份 2026-07-28 计划文档内嵌片段已同步，CHANGELOG 已记录

### 6.11 折叠弹层过高：vertical 弹层限高对齐水平弹层（用户反馈）

- 根因：`.el-popper.vv-app-menu-popper--vertical` 限高 `calc(100vh - 20px)`，demo 60+ 项实测 933px 近全屏
- 修复：改 `calc(100vh - 300px)`——与 6.9 用户方定值的水平弹层同一偏移，两处弹层限高策略一致
- 验证：CDP 实测 653px（约 14 项可见 + 单层滚动条）、定位视口内、docOverflow false；ESLint 通过
