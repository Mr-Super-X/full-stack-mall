#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
BACKUP_ROOT="${BACKUP_DIR:-$SCRIPT_DIR/backups}"
BACKUP_TAG=""

fail() {
  printf '错误：%s\n' "$*" >&2
  exit 1
}

command -v docker >/dev/null 2>&1 || fail '未找到 docker。'
command -v gzip >/dev/null 2>&1 || fail '未找到 gzip。'
[[ -f "$ENV_FILE" ]] || fail '缺少 .env，无法确认前端配置。'

compose=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
"${compose[@]}" config --quiet

web_container="$("${compose[@]}" ps -q web)"
[[ -n "$web_container" ]] || fail '前端容器不存在，请先执行 bash deploy.sh start。'
web_status="$(docker inspect --format '{{.State.Status}}' "$web_container")"
[[ "$web_status" == 'running' ]] || fail '前端容器未运行，请先启动服务。'

image_id="$(docker inspect --format '{{.Image}}' "$web_container")"
timestamp="$(date +%Y%m%d-%H%M%S)"
backup_dir="$BACKUP_ROOT/frontend-$timestamp"
partial_dir="$backup_dir.partial"
backup_tag="mall-frontend:backup-$timestamp-$$"

mkdir -p -- "$BACKUP_ROOT"
chmod 700 "$BACKUP_ROOT"
# 原子 mkdir 是同秒备份锁；只有创建成功者才能注册清理钩子。
if ! mkdir -- "$partial_dir"; then
  fail '同一时间戳的备份正在进行，请稍后重试。'
fi

cleanup() {
  if [[ -d "$partial_dir" ]]; then
    rm -rf -- "$partial_dir"
  fi
  if [[ -n "$BACKUP_TAG" ]]; then
    current_tag_id="$(docker image inspect --format '{{.Id}}' "$BACKUP_TAG" 2>/dev/null || true)"
    if [[ "$current_tag_id" == "$image_id" ]]; then
      docker image rm "$BACKUP_TAG" >/dev/null 2>&1 || true
    else
      printf '警告：回滚标签已变化或无法确认，未删除：%s\n' "$BACKUP_TAG" >&2
    fi
  fi
}
trap cleanup EXIT

# 锁前检查可能已过期，持锁后必须重新确认最终目录和标签均不存在。
[[ ! -e "$backup_dir" ]] || fail '最终备份目录已存在，未覆盖。'
if docker image inspect "$backup_tag" >/dev/null 2>&1; then
  fail '回滚镜像标签已存在，请稍后重试；未修改旧标签。'
fi

# 给容器实际使用的 image ID 打独立标签，避免 latest 已变化时备份到错误镜像。
docker tag "$image_id" "$backup_tag"
BACKUP_TAG="$backup_tag"
[[ "$(docker image inspect --format '{{.Id}}' "$backup_tag")" == "$image_id" ]] \
  || fail '新建回滚标签未指向目标镜像，本次备份已取消。'
printf '%s\n' "$backup_tag" >"$partial_dir/image-reference.txt"
cp -- "$SCRIPT_DIR/nginx/default.conf.template" "$partial_dir/default.conf.template"
cp -- "$ENV_FILE" "$partial_dir/.env"

if ! docker image save "$backup_tag" | gzip >"$partial_dir/image.tar.gz"; then
  fail '前端镜像导出失败，本次残缺备份已清理。'
fi
[[ "$(docker image inspect --format '{{.Id}}' "$backup_tag")" == "$image_id" ]] \
  || fail '备份期间回滚标签被改指其他镜像；未删除变化后的标签。'

gzip -t "$partial_dir/image.tar.gz" || fail '前端镜像备份校验失败。'
if ! mv -T -n -- "$partial_dir" "$backup_dir"; then
  fail '发布备份目录失败，本次残缺备份已清理。'
fi
[[ ! -d "$partial_dir" && -f "$backup_dir/image.tar.gz" ]] \
  || fail '最终备份目录已存在，未覆盖既有备份。'
chmod -R go-rwx "$backup_dir"
BACKUP_TAG=""
printf '前端备份完成：%s\n回滚镜像标签见：%s\n' "$backup_dir" "$backup_dir/image-reference.txt"
