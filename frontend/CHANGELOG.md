# Changelog

> **版本口径**（2026-10-15 起）：版本号唯一事实源为 `package.json` 与 git tag；开源首发 **v1.0.0**（仓库添加 MIT LICENSE 后的首个公开版本，以 `pnpm release` 发布的 tag 为准）。历史中 `v3.5` / `v3.6` 等 `v3.x` 段为内部开发期版本叙事，仅作开发历史保留，与现行 semver 无对应关系。fork 后的版本跟进与升级策略见 [docs/36-Fork升级与版本策略.md](docs/36-Fork升级与版本策略.md)。
>
> **维护方式**（2026-10-27 起）：本文件**纯手写维护**（五段式：背景/变更/踩坑/验证/手动验证步骤）——`@release-it/conventional-changelog` 插件已下线，release-it 只做 bump + tag + push，不重写本文件。发版时把「未发布」区标题改为版本段即可（规范见 docs/03 §发版时 CHANGELOG 处理，含弃用原因与回退方法）。

## 未发布

### ✨ Feat | h5 商城搜索全链路升级：首页入口接通 + 联想 + 筛选 + 空结果引导 + 搜索埋点闭环（2026-11-13）

> 背景：h5 商城搜索体验残缺——首页吸顶栏搜索框纯展示无行为、列表页输入逐字符
> 触发请求（无防抖）、无联想/筛选/空结果引导、热搜词为运营常量且无搜索行为回收。

- 首页搜索入口接通：MallTopbar 搜索区改为"伪输入"，点击跳列表页
  `/h5-mall/list?focus=1` 并自动聚焦进入输入态（复用列表页既有搜索面板，
  首页零新增状态机）。
- 输入/提交分离（P0-2）：新增 `submitted` 提交词与输入词解耦，输入过程不发
  列表请求；useProductList 筛选参数变化统一防抖 300ms（首次立即执行，
  onCleanup 清理 timer 防卸载 setState）。
- 搜索联想（P1-3）：后端新增 `GET /mall/search/suggest`（FULLTEXT ngram 命中
  商品名，去重按销量 Top10）；前端新增 useSearchSuggest composable（防抖 300ms
  + 过期响应丢弃 + 失败静默），输入态面板联想列表优先于历史/热搜，命中片段
  `<mark>` 高亮。
- 筛选器（P1-6）：列表接口新增成色（NEW/LIKE_NEW/GOOD/FAIR，EXISTS 规格级匹配）
  与价格区间（HAVING 聚合展示价闭区间，min>max 静默忽略）筛选；非法成色入参
  静默忽略（同 sort 回退风格）；前端排序栏下新增成色 + 价格档位 chips。
- 空结果引导（P1-4）：新增 SearchEmptyTips 组件——前 2 字换词重试建议（CJK
  bigram 命中率高）+ 热销兜底（sales_desc Top4，失败静默）。
- 结果高亮（P1-5）：结果列表商品名按提交词切片 `<mark>` 高亮（大小写不敏感）。
- 搜索埋点闭环（P2-7/8）：后端新增 search_log 表（init.sql）+
  `POST /mall/search/track`（匿名；搜索带 resultCount / 点击带 clickProductId）；
  热搜词接口改为近 7 天有结果词 Top8 动态聚合，不足回退运营常量保证首屏非空；
  前端搜索成功/点击结果自动埋点（失败静默）。
- 全局异常修补：GlobalExceptionHandler 补 ConstraintViolationException /
  HandlerMethodValidationException 分支（方法级参数校验失败显式映射 400 码，
  原走兜底 500 语义）。
- 测试：后端 SearchServiceImplTest 6 例 + SearchControllerTest 5 例；前端
  useProductList.spec 重写（防抖/筛选透传/埋点时机）+ 新增
  useSearchSuggest.spec 5 例。h5 全量 150 测试通过。

> 验证：`mvn test` 全绿；`pnpm -C apps/h5 test` 25 文件 150 例全绿；
> `pnpm -C apps/h5 type-check` 通过。

### 🎨 Style | h5 vant 主色与语义色莫兰迪化（对齐 admin 同构修复）（2026-11-13）

> 背景：排查 h5 端是否存在 admin 同款「语义色高饱和显眼」问题——存在。vant 4 默认
> 鲜绿 #07c160 / 鲜橙 #ff976a / 鲜红 #ee0a24，与 h5 灰阶 + mall 陶土莫兰迪语境冲突；
> 暴露面为 VantTest 验证页语义按钮（全端唯一语义组件使用点）。另两路检查无问题：
> vant 弹层变量挂 :root 天然跟随（无 admin 式容器作用域断层）；`:root:root` 双写
> 特异性机制（2026-10-28 R2-E1）保障覆盖不被 vant 默认 base.css 压平。

- `apps/h5/src/styles/ui-overwrite.scss`：
  - `--van-success/warning/danger-color` 三值替换 vant 默认，复用 DESIGN.md 已登记的
    mall-ok / mall-warn / mall-err（#5e8168 / #97794b / #a96a60），van-button /
    van-tag / toast 等统一跟随；亮暗同值（h5 无布局级暗色 mixin）。
  - 主色 `--van-primary-color` 由鲜橙 #ff6a00 降饱和迭代为莫兰迪亮陶橙 **#c08048**
    （用户三档试色拍板：#a2683f 4.6:1 合规上限 → #b4733f 3.8:1 → #c08048 3.3:1 定稿；
    白字对比低于 WCAG AA 4.5 线，用户裁决接受，h5 demo 场景）。
- DESIGN.md「H5 移动端 h5」节：vant 品牌色与语义色登记；顺带修正残留的
  「AppMenu horizontal 弹层硬编码」过时描述（上轮已删，此处漏改）。

> 验证：浏览器实测 VantTest 页三按钮——主色亮陶橙 #c08048、success 灰绿 #5e8168、
> danger 陶红 #a96a60，与 mall 族状态色同源。

> 手动验证步骤：`pnpm -C apps/h5 dev` → /h5-demo/vant-test（或网关 :8080/h5/）
> 看三按钮并置效果。

### 🔧 Chore | lint:log 脚本：lint 输出落盘回显，规避终端渲染吞输出（2026-11-13）

> 背景：部分终端（PowerShell + ConPTY）下原生子进程直接写 TTY 的输出会被
> 渲染层吞掉/清屏；「重定向到文件再 cat」的输出路径稳定可见。

- 新增 scripts/lint-log.mjs：spawn `pnpm run lint`（stderr 经 shell 的 2>&1 并入
  stdout 单一管道，保证落盘顺序 = 真实输出时序），输出写入 lint.log
  （.gitignore 的 *.log 已覆盖）后回显终端，退出码原样透传。
- 根 package.json 注册 `lint:log`。

> 验证：Analysis.vue 带 1 警告时 `pnpm lint:log` exit=1，终端回显完整问题列表
> 且与 lint.log 内容一致。

### ✨ Feat | AI 架构遵循治理三件套：选型速查 docs/50 + prefer-wrapped-component 提醒规则 + 选型申请工序（2026-11-12）

> 背景：全栈项目以本仓库为前端底座时，AI 做"加页面"类需求不消费 packages/ui
> 既有封装，退回 EP 原始组件重复实现——现有机械防线只有 useRouter/axios 两条
> no-restricted-imports，"该用封装却用原始组件"的语义违规零成本。

- 新增 docs/50-页面开发组件选型速查.md：场景→首选封装→避免写法正面决策表
  （样板指向 demo 站点真实示例 + 各组件使用指南）+ 合法例外清单 + 选型申请
  需求模板 + 交付自检清单；配套登记根 AGENTS.md 速查节 / docs/AGENTS.md 篇数 /
  check-doc-currency 文档预算 50→51。
- 新增 local/prefer-wrapped-component（warn 级）：扫业务目录 .vue 模板的
  el-table/el-form/el-dialog（含 PascalCase）与 ElMessageBox.confirm/alert/prompt
  裸调，提示对应 @vv/ui 封装；豁免 demo 教学 / packages/ui 内部 / spec / test-utils。
  实现走 vue-eslint-parser@10 的 services.defineTemplateBodyVisitor（v10 起
  parseForESLint 不再返回 visitorKeys，且签名移除 context 第一参）；设计稿见
  docs/superpowers/specs/2026-11-12-prefer-wrapped-component-design.md。
- 选型申请工序（docs/50 §4）：向 AI 提"加页面"需求先要求输出组件选型说明、
  确认后再编码——违规拦截从事后 review 前移到事前。

> 验证：`node --test scripts/eslint-rules/prefer-wrapped-component.spec.mjs` 16/16 通过；
> `pnpm check:doc-currency` 14 项全过。

> 手动验证步骤：任一对 AI 提"在 admin 新增 X 列表页"，观察其是否先给选型说明。
> lint 脚本 `--max-warnings 0` 下 warn 即阻断：存量债 3 文件（admin user/List、
> workbench/Monitor、auth LoginForm）已集中豁免于
> `app/prefer-wrapped-component-legacy-exempt` block，`pnpm lint` 保持绿；
> 新增代码违规即时报错阻断，改造立项时同步移除豁免行。

### 🎨 Style | admin EP 语义色莫兰迪低饱和化（success / warning / danger）（2026-11-12）

> 背景：用户反馈 el-tag 颜色太显眼——EP 默认鲜绿 #67c23a / 鲜橙 #e6a23c /
> 鲜红 #f56c6c 与 admin 莫兰迪主题（亮色紫 / 暗色雾霾蓝）冲突。根因是
> `default-layout-ep-light/dark` 两个 mixin 只覆盖 primary + 中性色，语义色
> 走全局 EP 默认值。用户裁决改动范围为「admin 语义色体系化」：经布局 mixin
> 单点覆盖，tag / 按钮 / 消息 / 表单校验等全部 EP 语义组件统一跟随，仅影响 admin。

- `default-tokens.scss` 两 mixin 各增 success / warning / danger 三色 × 5 灯阶：
  亮色复用 DESIGN.md 已登记的 mall 族状态色（#5e8168 / #97794b / #a96a60），
  暗态压暗降饱和（#6e8a72 / #a68a5e / #a67b72）；灯阶按 EP `color.mix(色, white, N%)`
  公式经 `sass:color` 计算（与全局 el-light-variants 同算法，不手算字面量）；
  info 本就中性灰不动。
- DESIGN.md「中后台亮色 / 暗色」两表登记 + frontmatter 增补 6 项镜像。
- 全局 theme-vars.scss 与其余 5 端语义色不受影响（就近原则，docs/49 §5）。

> 验证：浏览器实测 Monitor.vue 状态 tag 与语义按钮亮 / 暗双态——亮色灰绿 / 灰褐 /
> 陶红，暗色压暗三档，文字在 light-9 底上对比 ≥ 4.5:1。

> 手动验证步骤：`pnpm -C apps/admin dev` → 监控页（/workbench/monitor）看「正常 /
> 积压告警」tag 灰绿 / 陶红；顶栏切暗色看压暗三档；顺带看任意 danger 按钮同步变陶红。

### 🐛 Fix | admin teleport 弹层主题色修复：品牌色注入改 var() 引用链（2026-11-12）

> 背景：admin default 布局下，日期时间选择器面板（及所有 teleport 到 body 的弹层）
> 未被布局主题色覆盖——亮色莫兰迪紫 / 暗色雾霾蓝在弹层上回落 EP 默认蓝 #409eff，
> 与容器内组件（按钮 / 输入框 focus）视觉割裂。
>
> 根因：`injectBrandColor` 把 `VITE_BRAND_COLOR` 以**内联样式**双写
> `--color-primary` + `--el-color-primary`。内联优先级高于一切选择器，
> admin `[data-layout='default']` 布局级 EP 变量映射（teleport 弹层的唯一主题来源）
> 中的 `--el-color-primary` 被压死；灯色阶未被双写仍生效——弹层呈现
> 「#409eff 主色 + 布局灯阶」的蓝紫混搭。

- `packages/ui/src/styles/element-overwrite/theme-vars.scss`：`:root` 的
  `--el-color-primary` 由编译期字面量改为 `var(--color-primary, #409eff)` 引用；
  灯色阶保持编译期 `color.mix` 字面量（mix 无法运行时计算，品牌换肤灯阶不联动的
  局限不变）。
- `packages/shared/src/app-bootstrap.ts`：`injectBrandColor` 停止双写内联
  `--el-color-primary`，只内联 `--color-primary` 单一变量；JSDoc 记录根因。
- `app-bootstrap.spec.ts`：回归锁语义反转——锁「不双写内联」，防引用链方案被回退。
- 机制收益：布局选择器 `[data-layout='default']` 与 `:root` 引用规则同特异性、
  源码顺序更后，以字面量直接胜出——date-picker / select / cascader / time-picker
  等全部 teleport 弹层统一跟随布局主题，无需逐组件 popper-class 补丁。
- 同步面：README VITE_BRAND_COLOR 描述、docs/06 三层覆盖关系图与 Q4、
  DESIGN.md「已知边界」段（原「其余全局弹层不单独处理」裁决作废）。

> 踩坑：CSS 内联样式优先级高于一切选择器——「JS 内联变量 + 样式表变量映射」
> 双轨设计必须审查内联是否会压死后加载的映射规则；var() 引用链让注入与覆盖
> 解耦，是布局级主题与全局品牌色共存的可扩展形态。

> 验证：packages/shared 52 文件 548 测试全绿；浏览器实测 admin 亮 / 暗双态
> date-picker 面板选中色（亮 `#6a6180` / 暗 `#8fa6bc`）、select 弹层变量、
> 布局作用域外品牌色链路（摘除 data-layout 模拟 portal 场景）`#409eff` 不回退。

> 手动验证步骤：① `pnpm -C apps/admin dev` 开分析页表单日期时间选择器，
> 亮色选中圆点为莫兰迪紫；② 顶栏切暗色，面板变雾霾蓝；③ 其它 app（如 portal）
> 弹层主色仍为全局品牌色 `#409eff`。

### ♻️ Chore | admin 弹层主题冗余样式清理（2026-11-12）

> 背景：上一项「弹层主题色修复」使 `html[data-layout='default']` 变量映射成为
> teleport 弹层的唯一主题通道，此前为绕过同一根因打的三处补丁沦为同值同生命周期的
> 冗余代码，且其中 AppMenu 硬编码自带注释承认的「改 mixin 时须同步此处」漂移负担。

- `layouts/default/index.vue`：删除「teleport 弹层补丁」整段（`.vv-default-header-popper` /
  `.vv-context-menu-popper` 的亮 / 暗 / 跟随系统三组 mixin 重放，26 行）——弹层变量
  经 data-layout 映射继承，补丁与映射完全重复。
- `layouts/default/components/AppMenu.vue`：删除 horizontal 弹层三处局部硬编码
  （亮色 `--el-color-primary/light-9` 2 行 + 暗色段 4 行 + 跟随系统段 6 行及过时注释）
  ——2026-11-03 暗色改雾霾蓝时此处硬编码遗漏致漂移的漂移源一并消除。
- `UserInfo.vue` / `LocaleDropdown.vue`：删除死类名绑定
  `popper-class="vv-default-header-popper"`（对应补丁段已删，类名无任何样式消费；
  两组件 style 块确认无该类选择器）。
- `default-tokens.scss` 头注「已知偏差」段同步改写（弹层不再「仍用全局主色」）。
- `ContextMenu.vue` 保留不动：`.vv-context-menu-popper` 仍有真实布局样式消费
  （菜单项图标 flex 间距），非冗余。

> 验证：删除后弹层变量唯一来源为 data-layout 映射（单一事实源）；浏览器实测
> header 用户菜单 / 语言下拉 / 页签右键菜单 / 折叠侧栏菜单弹层 / top 布局 horizontal
> 菜单弹层，亮暗双态主题色均正确。

### ✨ Feat | h5-mall Tabbar 重构为 Trampoline Tabbar 凹槽抛球交互动画（2026-11-05）

> 背景：按 `apps/h5/design/tabbar-animation-spec.md`（v2.0）将商城底部 tabbar 从静态
> flex 列表重构为逐帧重建面板的抛球动画——点击 tab 时面板顶边如蹦床鼓起把球抛出，
> 抛物线飞行落入目标凹槽、弹簧回弹、新图标浮入球心。spec 骨架为纯 vanilla JS，
> 本次重写为 Vue 3 组件 + 纯函数引擎三层架构。

- 新增 `composables/trampoline-geometry.ts`：凹槽剖面 dentAt（圆弧等隙包裹 + 三次
  Hermite 过渡肩）、基础边 + 顶角融化、boxBlur（模糊只碰凹槽/鼓包分量，§5.3 圆角
  保护）、每帧 path d 生成、球体变形（飞行拉伸/落地压扁）。
- 新增 `composables/trampoline-engine.ts`：idle/ride/flight/dock 相位机 + 三弹簧
  半隐式欧拉 + 抛物线末速度接力（§6.5 防落地顿挫）+ 图标浮入/浮出补间 +
  instantSelect（reduced-motion 降级）。
- 新增 `composables/useTrampolineTabbar.ts`（编排）+ `use-trampoline-loop.ts`
  （rAF 启停，settled 自动停循环）+ `use-trampoline-fit.ts`（362 坐标系 scale 适配）。
- 重写 `components/MallTabbar.vue`：v-model 受控（点击零延迟反馈 + watch 防回环）、
  SVG sprite 图标粘球心、标签 pop（节点重建重放 keyframes，免 reflow hack）、
  购物袋角标保留（用户裁决）、matchMedia reduced-motion 动态降级（用户裁决）。
- 坐标系适配（关键坑）：动画几何锁定 spec 362×88 设计稿坐标，渲染层 JS scale 适配
  容器宽——组件 `<style>` 禁写几何 px（postcss-pxtorem 会转 rem 与 JS scale 双重缩放），
  全部几何尺寸 JS 内联；views/index.vue padding-bottom 212 → 307 稿 px。
- 测试 +47（geometry/engine/loop/tabbar 四份 spec）：凹槽对称与间隙、顶角保护、
  全相位流转、速度接力公式、追加抛掷、原地小跳、收敛归位、rAF 停循环、v-model 同步。
- 浏览器实测修复 2 处：①球 transform 经 `:style` 数组字符串项绑定时被 Vue
  parseStringStyle 错误解析（丢 transform），改为对象 `{ transform }` 绑定；
  ②选中按钮 `z-index:30` 创建层叠上下文，内部图标 z=50 无法越过球（z=45）——
  active 按钮整体提升至 50，球内图标可见（stacking context 陷阱）。
- 闪动修复（连拍逐帧定位）：点击后面板 SVG 消失 1~3 帧——根因是面板 path 每帧
  重建 + svg 常驻 `filter: drop-shadow()`，动画启动时 Chrome 反复创建/丢弃 filter
  合成层；svg 加 `will-change: filter` 预建稳定合成层后消失不再出现（对照实验：
  移除 filter 不消失 / 保留 filter 必现 / will-change 根治）。另给 buildPanelPath
  加 NaN 防御（偶发非法帧沿用上一帧合法 path，含 NaN 的 d 会被 SVG 整元素丢弃，
  回归测试锁定）。

验证：h5 单测 63/63、type-check 零错误、ESLint 零告警；槽位映射已登记 DESIGN.md
「H5 商城 h5-mall」节；playwright 真实浏览器逐帧断言初始落点/点击切换/追加抛/
原地小跳四场景 + 三轮连拍确认点击后面板持续可见。

手动验证步骤：① `pnpm -C apps/h5 dev` 打开 /h5-mall；② 点击「分类」观察球被抛入
目标凹槽回弹、图标浮入球心；③ 飞行中快速连点「我的」验证追加抛掷；④ 点当前 tab
验证原地小跳；⑤ 系统开启"减弱动态效果"后刷新，切换应瞬时完成无动画。

### 🔧 Fix | 分片上传二轮生产可用审查：READY_WITH_NITS 全项清零（2026-11-05）

> 背景：第二轮独立 code-reviewer 按生产可用标准审查——前轮 7 项修复全部验证无回归；
> 新发现 2 MEDIUM + 3 LOW 全项修复。另主线程自查补上续传进度补偿、stageProgress
> 归零、listener 异常隔离 3 项（审查前先行修复并纳入本轮验证）。

- 主线程自查 3 项（二轮审查前修复）：①init 已收分片补偿 tracker.markDone——刷新
  续传进度从断点续起（此前从 0 重涨）；②hashing 完成 stageProgress 归零——checking
  不残留 100%；③emit listener 异常隔离——订阅者抛错经 console.error 记录后
  不打断上传（观察者不得反噬主体）。
- 二轮新发现修复：MEDIUM①ApiUpload 暂停/失败态补「取消并清理」按钮——引擎
  paused/error 态 cancel+服务端 DELETE 语义页面可达；MEDIUM②prod 版
  prodUploadSessions 补 GC（30min 过期 + 64 上限，与 dev 版 gcSessions 同口径，
  createdAt 字段补齐）；LOW①worker-hasher 预检 signal.aborted（addEventListener
  对已 abort 信号不再触发会悬挂，与 defaultFileHasher 的 throwIfAborted 对称）；
  LOW②uploader 默认 chunkSize 复用 DEFAULT_CHUNK_SIZE 常量；LOW③空文件
  （fileSize=0）error 态进度恒 0（tracker「空任务=1」防 NaN 语义不外泄）。
- 回归用例 +5：续传进度补偿（8/11 断言）、hashing 进度实时 + checking 归零
  （initGate 冻结窗口）、listener 异常隔离（健康订阅者照常收 done）、空文件进度、
  worker-hasher 预检 abort。

验证：shared upload 37/37、shared/docs/mock 三包 type-check、ESLint 全过；
二轮审查结论 READY_WITH_NITS → 修复后无遗留项。

### 📖 Docs | 新增分片上传后端接口指导 BACKEND.md（2026-11-05）

> 背景：分片功能交付后缺一份给后端的协作契约——口头/聊天传达协议易漂移，
> 文档与引擎同目录收敛为单一事实源，目标是后端「拿过来不用思考就能实现」。

- `packages/shared/src/api/upload/BACKEND.md`：心智模型 → 通用约定（envelope /
  错误分类语义 / 分片编号与 ETag 定义 / 认证）→ 四接口完整规格（TS 类型 +
  校验清单表 + 幂等语义）→ 会话状态机与生命周期 → 实现路线（内存版对照
  mock 源码 / 生产版按存储选型）→ 8 步 curl 联调验收清单 → 待业务拍板项。
- 互链：`types.ts` 的 UploadAdapter JSDoc 与 `mock/upload.ts` 头注各加
  `@see` 指向文档（契约 ↔ 参考实现双向可达）。
- 文档不耗 docs/ 根目录预算（包内文档，check:doc-currency 不锁定）。

### 🔧 Fix | 分片上传独立审查修复：7 项缺陷 + doneParts 实时性缺陷（2026-11-05）

> 背景：code-reviewer 独立审查 REQUEST_CHANGES（CRITICAL 1 + HIGH 1 + MEDIUM 2 +
> LOW 3），全部修复并回归；修复过程中另发现 1 项演示层可见的实时性缺陷。

- **[CRITICAL] uploader.spec.ts 类型名 typo**：`UploaderAdapter` → `UploadAdapter`（types.ts
  无此导出）——vitest 运行时擦除 import type 故 26 测全绿，tsc 必挂；
  教训：单测绿 ≠ 类型绿，shared 包验证矩阵必须含自身 type-check（此前只跑了 mock 侧）。
- **[HIGH] pause/cancel 在 checking/merging 阶段终态落错**：axios 1.18 对 abort 恒
  reject CanceledError（不透传 signal.reason），http.ts 归一为 ApiError{canceled:true}——
  init/complete 在途时 instanceof 判空误落 error，cancel 还漏 cleanupRemote。
  修复：catch 双路判定（err 或 ctrl.signal.reason 任一为 UploadPaused/UploadCancelledError）；
  补 init/complete 在途 pause/cancel 共 3 条回归用例（fake adapter 的 gate 经
  Promise.race 模拟 axios 取消形态）。
- **[MEDIUM] paused/error 进度跳变**：currentProgress 回退 stageProgress（worker
  hasher 恒 1 → 暂停后错显 100%）。修复：paused/error 返回 tracker.progress；
  补「paused 进度不回退」用例（8/11 断言）。
- **[MEDIUM] cancel() 从 paused/error 态不调 adapter.abort**：无在途请求分支只翻
  状态；顺带补 done 态守卫（done 后 cancel 不翻 cancelled 不清理）。
- **[LOW] ×3**：①uploader 的 chunkSize 归一单源（normalizeChunkSize 导出，
  init 协议值与 planChunks 切片边界共用 floor 值，fractional 配置防分裂 +
  归一回归用例）；②retry.ts 业务码形态 4xx 不重试（mockjs 恒 HTTP 200 场景的
  409 确定性冲突不再被重试，对齐 HTTP 形态语义）；③mock complete 的客户端断连
  标志（clientGone，头注「断连放弃写结果」对齐实现）。
- **审查外自查发现：doneParts 批量提交致分片格全程灰色**——runMissingParts 返回后
  才一次性填充 doneParts（runConcurrent 全部 settle 才返回），ApiUpload 分片格
  依赖 doneParts 渲染，真实 demo 中格子最后一刻才全绿。修复：onPartDone 回调
  单分片确认即提交；「paused 进度不回退」用例的 waitFor 前置条件
  （doneParts=[0]）恰好暴露此缺陷。

验证：shared 全量 543/543（52 文件，含新增 6 条审查回归）、shared/docs/mock
三包 type-check、ESLint 全过。

### ♻️ Refactor | Worker 哈希两件套下沉 shared：admin 等 app 开箱即用大文件上传（2026-11-05）

> 背景：初版把 hash.worker.ts / worker-hasher.ts 放在 docs demo 的 examples/ 下，
> app 复用需手动复制——违背 shared 层复用定位。本次把通用件迁回引擎同目录，
> 消费方（任意 app）两行接入，mock-adapter 因是 mock 后端专属仍留 examples。

- `git mv` 迁移：`examples/upload/hash.worker.ts` + `worker-hasher.ts` →
  `packages/shared/src/api/upload/`（历史保留）；包内 import 收敛相对路径
  （`./types`，同 concurrent.ts 先例）；hash.worker.ts 头注补「仅允许
  `new Worker(new URL(...))` 引用」的构建约定（裸 import 不触发 vite worker 插件）。
- `hash-wasm` 依赖转移：docs dependencies 移除 → shared peerDependencies
  （对齐 axios 形态，pnpm auto-install-peers 使各 app 零配置获得）。
- `worker-hasher.spec.ts` 新增 4 条（jsdom stub Worker 全局）：
  done 路径 resolve + terminate + 摘 abort 监听；error 路径 reject + terminate；
  abort 路径 reject signal.reason（pause/cancel 终态透传）；构造参数 module 类型断言。
- ApiUpload.vue 改 `@api/upload/worker-hasher`；api-demos-api.ts 的 hashFile
  文案更新为「引擎自带 createWorkerHasher()」。

验证：shared 单测 26/26（含新 4 条）、docs type-check:full、ESLint、
docs build-only（vite 把包内 worker 打包为独立 chunk，跨包消费路径实证）全过。

admin 接入形态：
`createUploader({ adapter: 自家后端实现, hashFile: createWorkerHasher() })`
——adapter 是唯一必写项（对接后端协议），引擎/分片规划/进度/Worker 哈希均开箱。

### ✨ Feat | shared 新增分片上传引擎（upload/）+ mock 演示服务 + docs 演示页 ApiUpload（2026-11-05）

> 背景：runConcurrent（并发闸门）落地后，分片上传是其典型场景但缺端到端演示；
> 本次按引擎 / mock 服务 / 演示三层建完整大文件分片上传流程，覆盖状态机、断点续传、
> 暂停/取消、字节级进度、失败重试全要素。

- **引擎层** `packages/shared/src/api/upload/`（业务无关，与 concurrent/retry 同域）：
  - `types.ts`：状态机 idle/hashing/checking/uploading/merging/done/error/cancelled/paused；
    `UploadAdapter` 契约（init/uploadPart/complete/abort 四方法，后端可替换）；
    `UploaderConfig`/`UploaderSnapshot`（快照订阅）。
  - `uploader.ts` `createUploader(config)`：hash→init→并发传缺失分片→complete 编排；
    paused/error 后 upload() 重入安全（服务端 init 按 fileHash 幂等，已收分片自动跳过）；
    pause/cancel 共用 AbortController（abort reason 区分终态），运行期间重入抛错。
  - `chunk.ts` `planChunks`：分片规划纯函数（partNumber 从 0 起，末片允许不足）。
  - `progress.ts` `UploadProgressTracker`：字节级进度（进行中分片已传计入分子），
    覆盖式更新天然支持重试清零；`hash.ts` 默认 hasher（主线程 WebCrypto，可注入覆盖）。
    （Worker 版 hasher 与引擎同域提供——见下方 Refactor 条目，本条交付时曾暂放
    demo examples，现已下沉。）
  - 单测 22 条（chunk/progress/uploader）：状态机序列、续传只补缺失、
    complete 收全量升序 meta、失败不中断、pause/cancel 语义、重入守卫。
- **mock 服务层** `packages/mock/src/upload.ts`（dev 版 rawResponse）+ `mockProdServer.ts`
  内联 `prodUploadMocks`（两处手工对齐，同 net-tools 先例）：
  - 四接口：`POST /uploads/init`（fileHash 幂等复用 = 断点续传）、
    `PUT /uploads/:id/parts/:n`（编号/大小校验；同编号内容一致返同 ETag = 幂等重传，
    不一致 409）、`POST /uploads/:id/complete`（齐全校验 + 模拟合并延迟，重复 complete
    幂等返既有 fileUrl）、`DELETE /uploads/:id`（幂等清理）；session 30min 过期 + 64 上限 GC。
  - `_utils.ts` 新增 `readRawBody`（二进制 body）；`respondAfter` 提升共享（net-tools 复用）。
  - 已知限制（prod）：mockjs XHR 劫持承载不了二进制 body，字节级完整性/内容幂等校验
    prod 豁免（ETag 退化为固定派生），状态机/齐全校验/会话复用保留。
- **演示层** `apps/docs`：`examples/ApiUpload.vue`（全流程演示页：生成 32MB 测试文件、
  分片大小/并发可配、状态标签、字节级进度、分片格、暂停/继续/取消、失败分片重试、
  断点续传步骤说明）；`examples/upload/mock-adapter.ts`（UploadAdapter 实现，经
  @api/http 发真实 XHR，onUploadProgress 接 axios 上传进度——mock 后端专属，
  对接真实后端时替换此项）；`api-demos-api.ts` 追加 `uploadApiItems`；
  `sidebar-groups.ts` CN_NAMES 补中文名（归「网络基建 API」组）。
  新依赖 `hash-wasm@^4.12.0`（catalog 登记；经 Refactor 条目转移至 shared peer）。

> 踩坑：① el-option 在 vue-tsc 3.3 + EP 2.14 模板检查下 props 类型解析失败
> （`__epPropKey` 泄漏，全仓无先例），分片大小改 el-radio-button 绕开；
> ② exactOptionalPropertyTypes 下 `signal`/`status`/`description` 显式传 undefined
> 均 TS2379，统一改条件展开或空字符串兜底；③ upload() 重入守卫若 `return doUpload()`
> 后接 finally，finally 同步执行导致守卫形同虚设——必须 async IIFE 包住再赋值；
> ④ mock parseUploadUrl 正则不覆盖 `/complete` 后缀——「URL 非法」假阴性让 32 分片
> 全部传完后的合并请求 400（2026-11-05 用户实测暴露）：URL 形态穷举必须含每个
> 已注册路由的实际请求形态，单测/mock 验收要 curl 全矩阵而非抽样
> （本次矩阵：init/PUT×N/complete/幂等 complete/续传 init/DELETE 全绿后才交付）。

验证：shared 单测 22/22、docs type-check:full、mock type-check、
改动文件 ESLint、sidebar 单测 7/7 全过；mock 服务经 curl 全矩阵实测——
init 新建 / PUT 分片（ETag 正确）/ 幂等重传（同内容同 ETag）/ complete
（齐全校验 + 合并延迟 + fileUrl）/ complete 幂等 / 断点续传（同 fileHash
复用会话 + uploadedParts 含 ETag）/ DELETE 清理。

手动验证：`pnpm -C apps/docs dev` 打开「网络基建 API → ApiUpload」——生成 32MB 文件
点开始：状态走完哈希→查询→上传→合并→完成，Network 面板可见 init + N×PUT + complete
真实请求；中途刷新页面重选同文件，进度从断点续起（服务端已收分片跳过）；
暂停后继续只补缺失；取消后服务端任务被 DELETE 清理。gh-pages（prod）流程可跑通
但无延迟瀑布与字节级进度（mockjs 限制，页面有 alert 说明）。
