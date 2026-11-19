#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
NETWORK_NAME="mall-deploy-network"
COMMAND="${1:-start}"
if (($# > 0)); then
  shift
fi

fail() {
  printf '错误：%s\n' "$*" >&2
  exit 1
}

usage() {
  printf '用法：bash deploy.sh [start|stop|restart|status|logs] [日志服务名...]\n'
}

command -v docker >/dev/null 2>&1 || fail '未找到 docker，请先安装 Docker 与 Compose 插件。'
docker compose version >/dev/null 2>&1 || fail '当前 Docker 不支持 docker compose。'
[[ -f "$ENV_FILE" ]] || fail '缺少 .env；请先执行 cp .env.example .env。'

compose=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
"${compose[@]}" config --quiet

ensure_network() {
  if ! docker network inspect "$NETWORK_NAME" >/dev/null 2>&1; then
    docker network create "$NETWORK_NAME" >/dev/null
    printf '已创建 Docker 网络：%s\n' "$NETWORK_NAME"
  fi
}

case "$COMMAND" in
  start)
    (($# == 0)) || { usage; exit 2; }
    image_ref="$("${compose[@]}" config --images)"
    if [[ "$image_ref" == *':backup-'* ]]; then
      fail 'backup-* 是只读回滚标签；请先将 IMAGE_TAG 改为 latest 或新的发布标签再构建。'
    fi
    ensure_network
    "${compose[@]}" up -d --build
    "${compose[@]}" ps
    printf '前端地址：http://10.2.161.161:9088/\n'
    ;;
  stop)
    (($# == 0)) || { usage; exit 2; }
    "${compose[@]}" stop
    ;;
  restart)
    (($# == 0)) || { usage; exit 2; }
    "${compose[@]}" restart
    ;;
  status)
    (($# == 0)) || { usage; exit 2; }
    "${compose[@]}" ps
    ;;
  logs)
    "${compose[@]}" logs -f --tail=200 "$@"
    ;;
  *)
    usage
    exit 2
    ;;
esac
