# Changelog

> **版本口径**（2026-10-15 起）：版本号唯一事实源为 `package.json` 与 git tag；开源首发 **v1.0.0**（仓库添加 MIT LICENSE 后的首个公开版本，以 `pnpm release` 发布的 tag 为准）。历史中 `v3.5` / `v3.6` 等 `v3.x` 段为内部开发期版本叙事，仅作开发历史保留，与现行 semver 无对应关系。fork 后的版本跟进与升级策略见 [docs/36-Fork升级与版本策略.md](docs/36-Fork升级与版本策略.md)。
>
> **维护方式**（2026-10-27 起）：本文件**纯手写维护**（五段式：背景/变更/踩坑/验证/手动验证步骤）——`@release-it/conventional-changelog` 插件已下线，release-it 只做 bump + tag + push，不重写本文件。发版时把「未发布」区标题改为版本段即可（规范见 docs/03 §发版时 CHANGELOG 处理，含弃用原因与回退方法）。

## 未发布

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
