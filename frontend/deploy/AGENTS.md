<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-11-02 | Updated: 2026-11-02 -->

# deploy

## 用途

生产部署配置。`nginx.prod.conf.template` 是生产网关模板：nginx 静态托管 6 个 app 产物（`/<app>/` 前缀 + history SPA fallback）、`/api/` 反代 `${API_UPSTREAM}`（SSE 关缓冲）、根路径 302 到 `/portal/`、未匹配 404。模板由 nginx 官方镜像 entrypoint（envsubst）渲染，路径语义与 dev 网关 `scripts/node-gateway.ts` 逐条对齐。

## 子目录

无。

## 依赖

### 内部依赖

- 根 `Dockerfile` + `docker-compose.prod.yml`：生产镜像构建与编排；`scripts/build-prod.ts` 产出 `dist-prod/<app>/` 静态产物供模板挂载。
- `scripts/node-gateway.ts`：dev 网关，本模板的路径语义对照基准——任一侧改动须双侧同步。

### 外部依赖

- nginx 官方镜像的 envsubst 模板机制（20-envsubst-on-templates.sh）：仅容器 env 已定义的变量（此处仅 `API_UPSTREAM`）被渲染，nginx 内置变量不受影响。

## 给 AI 代理的规则

### 在本目录工作

- 路径 / 端口 / 落点语义改动必须与 dev 网关同步修改，保持双侧一致。
- 安全响应头（CSP / X-Frame-Options 等）在 server 块与带 hash 资产的 location 内双写——nginx `add_header` 不跨层继承，漏写会导致静态产物丢头。
- 不在模板中手写环境特定值；环境差异一律经容器 env（`API_UPSTREAM`）注入。

### 测试要求

- `pnpm build:prod` 产出后经 `docker-compose.prod.yml` 本地起栈验证路由、反代与安全头。

### 常见模式

- 带内容哈希的 vite assets 长缓存（30d immutable）且不做 SPA 回退；普通路径 `try_files` 回退各 app 的 index.html。

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
