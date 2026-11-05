# 请求层增量重构 — 实施计划

> 日期：2026-07-22

## 一、阶段拆分

| 阶段 | 任务                              | 产物                                        | 状态 |
| ---- | --------------------------------- | ------------------------------------------- | ---- |
| 0    | 备份 + manifest                   | `.claude/backups/request-layer-2026-07-22/` | ✅   |
| 1    | 新增 `src/api/types/error.ts`     | ApiError + isApiError                       | ✅   |
| 2    | 新增 `src/api/cancel.ts`          | createAbort + withAbort + linkAbort         | ✅   |
| 3    | 新增 `src/api/retry.ts`           | withRetry + isIdempotent                    | ✅   |
| 4    | 新增 `src/api/deduper.ts`         | withDedup + shouldDedup + dedupKey          | ✅   |
| 5    | 改造 `src/api/http.ts`            | token 切换 + 类型强化 + ApiError 归一       | ✅   |
| 6    | 补充 `*.spec.ts` 4 个文件         | 39/39 测试通过                              | ✅   |
| 7    | 更新 CHANGELOG + 新增 specs/plans | 文档归档                                    | ✅   |

## 二、自检结果

```
[1] 需求对齐：用户已确认 3 项关键决策（token / retry / progress），方向无歧义
[2] Edit 范围精准：仅 http.ts 改一处 + 新增 8 个文件，无意外触及 main.ts / modules/*.ts
[3] import 路径：所有 @/ alias 已存在（@/utils/storage、@/enums/httpEnum）
[4] 函数 ≤ 80 行：所有函数最长 38 行（http.ts:onResponseFulfilled）
[5] any 替代：types/error.ts / cancel.ts / retry.ts / deduper.ts 全无 any
[6] 文件 ≤ 400 行：所有新文件 ≤ 110 行，http.ts = 99 行
[7] Hook ≤ 80 行：N/A（本次未涉及 Composable）
[8] @ts-ignore：无
[9] Loading/Error/Empty：N/A（本次为基础设施层）
[10] 异常处理：所有 throw ApiError 带 code/message/url/cause
[11] 50 行变更摘要：本次为整体重构，每个新文件前已给顶部 JSDoc 说明
[12] CHANGELOG：已追加 "Changed" + "Added" 两条
[13] 原需求：参考项目评估 + 增量重构 + 不拷贝原始代码 + 融合社区最佳实践 ✅
[14] 上下游影响：modules/*.ts 零改动（request<T> 签名不变）；mock 不变
[15] git diff：仅限 src/api/ + docs/ + CHANGELOG.md + .claude/backups/
[16] 心智负担：业务侧 API 不变；可选能力（retry/cancel/dedup）按需 import
[17] 手动验证步骤：见 docs/superpowers/specs/2026-07-22-request-layer-eval-design.md §五
```

## 三、回归点

1. **登录流程**：token 现在走 cookie，dev 环境不变，生产环境强制 secure（js-cookie 自动处理）
2. **401 跳转**：业务码 401 与 HTTP 401 都会触发 `Session.remove('token')` + `clearCookies()` + 跳登录页
3. **业务码解包**：`request<T>()` 仍返回 `body.data`，调用方零迁移
4. **错误类型**：原本抛 `Error`，现在抛 `ApiError`。若业务侧有 `err.message.includes(...)` 的判断，需改用 `err instanceof ApiError` + `err.code` / `err.status`

## 四、回退路径

如需回退：

```bash
# 恢复 http.ts
cp .claude/backups/request-layer-2026-07-22/http.ts.bak src/api/http.ts

# 删除新增文件
rm src/api/types/error.ts
rm src/api/cancel.ts src/api/retry.ts src/api/deduper.ts
rm src/api/http.spec.ts src/api/cancel.spec.ts src/api/retry.spec.ts src/api/deduper.spec.ts
```

模块层（`modules/*.ts`）无需回退，因为 `request<T>` 签名未变。
