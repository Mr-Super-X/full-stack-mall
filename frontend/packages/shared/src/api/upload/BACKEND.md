# 分片上传后端接口指导

> 本文档是前端分片上传引擎（本目录 `packages/shared/src/api/upload/`）的后端协作契约，
> 目标是「拿过来不用思考就能实现」。前端引擎、状态机与 demo 页
> （`apps/docs` ApiUpload）已按本文语义完成并通过验收；后端按本文实现后，
> 前端只需替换 adapter 四方法中的 URL 与认证头，**引擎与 UI 零改动**。
>
> 参考实现：`packages/mock/src/upload.ts` 是一份可运行的完整实现（Node 版，
> 含全部校验、幂等语义与会话管理），实现时可直接对照或拷贝改造。
> 文中 TypeScript interface 摘录自 `types.ts`（单一事实源，冲突以代码为准）。

## 0. 心智模型（先读这个）

- **文件以内容哈希为唯一标识**：客户端对整文件算 SHA-256 作为 `fileHash`，
  同名不同内容 / 同名同内容由此区分。
- **会话（uploadId）是断点续传的事实源**：客户端不持久任何分片状态，
  刷新 / 断线 / 换设备后重新 init，服务端返回已收分片，客户端只补缺失。
- **分片独立传输、独立失败、独立重试**：单分片失败不影响其他分片；
  失败分片由客户端自动重试（带退避），重试耗尽后客户端会再次 init 续传。
- **合并是唯一的事务点**：complete 校验齐全后才生成最终文件。
- **暂停 ≠ 取消**：暂停只中止客户端在途请求，服务端 session 保留可续传；
  取消额外发 DELETE 要求服务端清理。

## 1. 通用约定

### 1.1 响应 Envelope（硬契约，不可偏离）

所有接口返回统一 JSON：

```json
{ "code": 200, "message": "ok", "data": {} }
```

- `code === 200`：成功，`data` 为对应载荷；
- `code !== 200`：业务错误，`message` 为用户可读文案，`data` 通常为 null
  （409 齐全校验错误时 `data` 带 `missing` 数组，见 2.3）。

### 1.2 错误分类语义（客户端重试策略直接依赖，必须遵守）

| code 区间 | 语义     | 客户端行为               | 典型场景                                   |
| --------- | -------- | ------------------------ | ------------------------------------------ |
| 400       | 参数非法 | **不重试**（确定性失败） | 缺字段、大小不符、编号越界                 |
| 404       | 不存在   | **不重试**               | uploadId 不存在 / 已合并清理               |
| 409       | 冲突     | **不重试**               | 同哈希元数据冲突、分片内容冲突、分片未齐全 |
| 5xx       | 服务端错 | 可重试（指数退避）       | 拼接总长不符、内部异常                     |

> 约定来源：前端 `withRetry` 默认策略——4xx 确定性失败不重试，5xx / 网络错误重试。
> 若后端把确定性失败返回成 5xx，会造成无谓重传；把瞬时错误返回成 4xx，会直接失败。

### 1.3 分片编号与大小（硬约定）

| 项          | 约定                                                                  |
| ----------- | --------------------------------------------------------------------- |
| partNumber  | **从 0 开始**，连续编号 `[0, totalChunks)`                            |
| 末片        | 允许不足 chunkSize，大小 = `fileSize - chunkSize × (totalChunks - 1)` |
| totalChunks | 必须等于 `Math.ceil(fileSize / chunkSize)`（init 时服务端强校验）     |
| ETag        | 服务端对**分片字节内容**计算的指纹（见 1.4），不是时间戳 / 随机数     |

### 1.4 ETag 定义

- 要求：同一分片字节 → 同一 ETag；不同字节 → 不同 ETag（概率意义下）。
- 推荐实现：`SHA-1(分片字节)` 的 base64url 取前 24 字符（非安全场景够用，快）；
  生产可换 MD5 / xxHash64，**只要满足上面的同内容同值性质**，算法可自由替换。
- 用途：① 幂等重传判定（2.2）；② complete 时客户端提交、服务端可与已存指纹交叉核对。

### 1.5 认证

前端经统一 HTTP 客户端（axios，`withCredentials: true`）透传 Cookie（HttpOnly）
或 `Authorization` 头——**服务端按既有鉴权体系校验即可，接口层无需特殊处理**。
生产建议：uploadId 使用 UUID v4（不可遍历），parts / complete / DELETE 必须校验
session 归属当前用户（防水平越权操作他人 uploadId）。

## 2. 接口规格

### 2.1 初始化上传会话 — `POST /uploads/init`

**请求**

```ts
interface InitUploadInput {
  fileName: string // 原始文件名（用于合并后生成下载名）
  fileSize: number // 文件总字节数（正数）
  fileHash: string // 整文件 SHA-256 十六进制（64 字符）
  chunkSize: number // 分片字节数（正整数）
  totalChunks: number // 分片总数 = ceil(fileSize / chunkSize)
}
```

```json
{
  "fileName": "report.xlsx",
  "fileSize": 10485760,
  "fileHash": "ba7816bf…",
  "chunkSize": 1048576,
  "totalChunks": 10
}
```

**成功响应（200）**

```ts
interface InitUploadResult {
  uploadId: string
  uploadedParts: Array<{ partNumber: number; etag: string }> // 已收分片，按编号升序
}
```

```json
{
  "code": 200,
  "message": "ok",
  "data": {
    "uploadId": "up-…",
    "uploadedParts": [{ "partNumber": 0, "etag": "O3H0P_MPSxW1zYXdnpXrx-hO" }]
  }
}
```

**幂等语义（核心，必须实现）**

- 存在 `fileHash` 相同且状态为 active 的会话 → **直接复用**：
  返回该会话的 uploadId 与已收分片列表（这就是断点续传）。
- 复用前校验元数据（fileSize / chunkSize / totalChunks）一致性——不一致返 409。
- 不存在 → 新建会话返回空 uploadedParts。

**服务端校验清单**

| 校验项                                      | 不满足时 |
| ------------------------------------------- | -------- |
| fileName / fileHash 非空字符串              | 400      |
| fileSize 正数且有限                         | 400      |
| chunkSize 正数且有限                        | 400      |
| totalChunks 为整数且 = ceil(size/chunkSize) | 400      |

### 2.2 上传分片 — `PUT /uploads/{uploadId}/parts/{partNumber}`

**请求**：body 为**原始二进制**（`Content-Type: application/octet-stream`），
即该分片的字节内容。**不要 JSON 包装、不要 base64**（体积膨胀 33%）。

**成功响应（200）**

```json
{ "code": 200, "message": "ok", "data": { "partNumber": 0, "etag": "O3H0P_MPSxW1zYXdnpXrx-hO" } }
```

**幂等语义（重试安全，必须实现）**

- 该编号**首次**上传：存字节、算 ETag、返回。
- 该编号**已存在**且新内容 ETag **与已存一致** → 丢弃新字节，
  返回已存 ETag（HTTP 200，message 可标注「幂等重传」）。**客户端重试依赖此语义**。
- 该编号已存在且 ETag **不一致** → 409（内容冲突：说明客户端重试时文件被改，
  该会话已不可信，客户端会整体重来）。

**服务端校验清单**

| 校验项                                                       | 不满足时 |
| ------------------------------------------------------------ | -------- |
| 会话存在且状态 active（completed 后拒绝写入）                | 404      |
| partNumber 为整数且 ∈ `[0, totalChunks)`                     | 400      |
| body 字节数恰为期望大小（非末片 = chunkSize；末片 = 尾剩余） | 400      |

> 期望大小公式：`expected = partNumber < totalChunks - 1 ? chunkSize : fileSize - chunkSize × (totalChunks - 1)`

### 2.3 合并分片 — `POST /uploads/{uploadId}/complete`

**请求**

```ts
interface CompleteUploadInput {
  parts: Array<{ partNumber: number; etag: string }> // 全部分片，按编号升序
}
```

> 分片数上千时可协商简化为只传编号数组（ETag 服务端自有）；
> 默认形态保持与前端引擎契约一致，无需协商即可联调。

**成功响应（200）**

```ts
interface CompleteUploadResult {
  fileUrl: string // 最终文件访问地址或标识
  fileId: string // 服务端文件 ID（可用 uploadId 充当）
  size: number // 合并后总字节数（= fileSize）
}
```

**服务端校验清单（按顺序执行）**

| 校验项                                       | 不满足时                             |
| -------------------------------------------- | ------------------------------------ |
| 会话存在                                     | 404                                  |
| **齐全校验**：编号 `[0, totalChunks)` 全覆盖 | 409，data 附 `{ missing: number[] }` |
| 完整性校验：拼接总长 = fileSize              | 500（兜底；单片大小已在 PUT 时校验） |

**幂等语义**：已 completed 的会话再次 complete → 直接返回既有
`{ fileUrl, fileId, size }`（HTTP 200），不报错、不重复合并。
客户端在合并结果回包丢失时会主动重试，依赖此语义。

**合并实现要求（生产）**：流式拼接落盘，**不要整读内存**；
若底层是对象存储（S3 / OSS），用其 Compose / CompleteMultipartUpload API
做服务端零拷贝合并，不落应用服务器磁盘。

### 2.4 取消/清理 — `DELETE /uploads/{uploadId}`

**成功响应（200）**

```json
{ "code": 200, "message": "已清理", "data": null }
```

- 删除会话及其已收分片；**幂等**——uploadId 不存在也返回 200
  （客户端取消语义不依赖服务端是否真有残留）。

## 3. 会话状态机与生命周期

```
            POST init                PUT parts/N               POST complete
              │                        │                         │
   ┌──────────▼──────────┐   ┌────────▼───────┐        ┌───────▼────────┐
   │  active（可续传）   │   │ 逐片累积        │        │  校验齐全       │
   │  · 幂等复用入口     │   │ · 幂等重传     │        │  → completed    │
   │  · 拒绝重复 complete│   │ · 内容冲突 409 │        │  · 重复 complete│
   └──────────┬──────────┘   └────────────────┘        │    幂等返结果   │
              │                                          └───────┬────────┘
              └────────────── DELETE ────────────────────────────│
                            （active 直接删除；completed 删除不影响已交付 fileUrl）
```

**生命周期要求**：active 会话必须有过期时间（建议 24h～7d 按业务定），
由定时任务清理孤儿会话及其临时分片。客户端不感知 TTL——过期后 init 会新建会话，
客户端从 0 重传（协议层面天然容错）。

## 4. 实现路线

**阶段一（联调用，半天）**：内存版。直接对照/拷贝
`packages/mock/src/upload.ts`（Node + Map 存 Buffer，含本文全部校验与幂等），
换掉存储层即可。此版本已通过前端 demo 全链路验收。

**阶段二（生产，按存储选型）**：

| 存储形态        | 分片存哪                   | 合并方式                          | 注意点                     |
| --------------- | -------------------------- | --------------------------------- | -------------------------- |
| 本地磁盘        | 临时目录 `uploadId/part-N` | 流式拼接读片写目标文件            | 清理任务要连临时目录一起删 |
| 对象存储 S3/OSS | 同 bucket 的 temp 前缀     | Compose / CompleteMultipartUpload | 零拷贝，应用服务器零带宽   |
| 数据库 BLOB     | 不推荐（GB 级不适用）      | —                                 | 分片上传场景应走文件存储   |

通用生产要求：uploadId 用 UUID v4 + 归属校验（§1.5）；写操作记录审计日志；
合并失败的会话标记可重试（complete 幂等天然支持客户端重发）。

## 5. 联调验收清单（curl 可直接执行）

假设服务地址 `http://localhost:8080`，前缀 `/api`（按部署调整）：

```bash
# ① 初始化（期望 200 + uploadId + 空 uploadedParts）
curl -s -X POST http://localhost:8080/api/uploads/init \
  -H 'Content-Type: application/json' \
  -d '{"fileName":"t.bin","fileSize":10485760,"fileHash":"test-hash-001","chunkSize":1048576,"totalChunks":10}'

# ② 上传分片 0（期望 200 + etag；重复执行同内容，期望同 etag 且不报错）
curl -s -X PUT http://localhost:8080/api/uploads/<uploadId>/parts/0 \
  -H 'Content-Type: application/octet-stream' --data-binary @part0.bin

# ③ 断点续传验证：同 fileHash 再 init（期望复用同一 uploadId，uploadedParts 含已传分片）
curl -s -X POST http://localhost:8080/api/uploads/init \
  -H 'Content-Type: application/json' \
  -d '{"fileName":"t.bin","fileSize":10485760,"fileHash":"test-hash-001","chunkSize":1048576,"totalChunks":10}'

# ④ 补传剩余 9 片后合并（期望 200 + fileUrl）
curl -s -X POST http://localhost:8080/api/uploads/<uploadId>/complete \
  -H 'Content-Type: application/json' \
  -d '{"parts":[{"partNumber":0,"etag":"<etag-0>"}, … ]}'

# ⑤ 合并幂等：重复 ④（期望直接返同一 fileUrl，message 可标注已完成）
# ⑥ 齐全校验：新会话只传 1 片就 complete（期望 409 + data.missing 含缺失编号）
# ⑦ 取消清理：DELETE /api/uploads/<uploadId>（期望 200；再次 DELETE 仍 200）
# ⑧ 负向：PUT parts/99（期望 400 越界）；PUT parts/0 大小不符（期望 400）
```

前端联调：把 `apps/docs/src/modules/demo/examples/upload/mock-adapter.ts` 的
URL 前缀从 `/demo-upload` 改为真实路径、确认认证 Cookie/头可达，
打开 ApiUpload demo 页按页面内「断点续传验证步骤」走一遍即完成端到端验收。

## 6. 待业务拍板项（不阻塞开发，上线前定）

| 议题           | 备选                              | 影响面                           |
| -------------- | --------------------------------- | -------------------------------- |
| 秒传           | init 命中已完成文件直接返 fileUrl | init 响应加一个可选字段          |
| 单文件上限     | 如 2GB / 5GB / 不限               | init 校验 + 前端配置             |
| 分片大小上下限 | 常见 100KB ~ 5MB                  | init 校验                        |
| 会话 TTL       | 24h ~ 7d                          | 清理任务周期                     |
| 完成通知       | 合并完成推消息（异步业务链）      | complete 响应之外的 webhook/消息 |
