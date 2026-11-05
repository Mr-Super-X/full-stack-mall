# syntax=docker/dockerfile:1
#
# 生产镜像（多阶段）：6 app 聚合构建产物 + nginx 静态托管 + /api 反代真实后端。
# 推荐经 docker-compose.prod.yml 使用（注入 API_UPSTREAM）；独立构建：
#   docker build -t vv-web .
#   docker run -d -p 8080:80 -e API_UPSTREAM=http://<backend>:8081 vv-web

########################################################################
# 阶段 1：生产聚合构建（产物 → /app/dist-prod/<app>/）
########################################################################
FROM node:24-alpine AS build
WORKDIR /app

# corepack 按 package.json packageManager 激活 pnpm@12.11.2（engines: >=11 <13）；
# node:24-alpine 对齐 CI（ci.yml/deploy.yml 24.12.0）——单一 major 消双版本测试面
# （2026-10-29 /autoplan Round 3 R3-E9；engines 虽双允许 22/24，双版本无收益）
RUN corepack enable

# .dockerignore 已排除 node_modules / 各 dist / docs / .git，context 为纯源码
COPY . .

# --frozen-lockfile：lockfile 与 manifest 不一致即失败（可复现构建）；
# root preinstall 的 only-allow pnpm 在 corepack 激活后自然通过
RUN pnpm install --frozen-lockfile

# 生产聚合构建：base=/<app>/ + history + remote 菜单 + 真实后端（mock 关闭）。
# 类型门禁不在此重复——CI turbo build 已 build-only → type-check:full（脚本头注）
RUN node --experimental-strip-types scripts/build-prod.ts

########################################################################
# 阶段 2：nginx 托管（静态 + API 反代）
########################################################################
FROM nginx:1.27-alpine

# 官方镜像 entrypoint：/etc/nginx/templates/*.template 经 envsubst 渲染进
# /etc/nginx/conf.d/——仅替换容器 env 已定义变量（compose 注入的 API_UPSTREAM）；
# 模板内 nginx 内置变量（$host/$uri…）不受影响
COPY deploy/nginx.prod.conf.template /etc/nginx/templates/default.conf.template

# 聚合产物：dist-prod/<app>/ → /usr/share/nginx/html/<app>/（alias 路径契约见模板头注）
COPY --from=build /app/dist-prod/ /usr/share/nginx/html/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/portal/ || exit 1
