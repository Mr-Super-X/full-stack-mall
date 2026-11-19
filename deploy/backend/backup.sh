#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
BACKUP_DIR="${BACKUP_DIR:-$SCRIPT_DIR/backups}"

fail() {
  printf '错误：%s\n' "$*" >&2
  exit 1
}

command -v docker >/dev/null 2>&1 || fail '未找到 docker。'
command -v gzip >/dev/null 2>&1 || fail '未找到 gzip。'
[[ -f "$ENV_FILE" ]] || fail '缺少 .env，无法确认数据库配置。'

compose=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
"${compose[@]}" config --quiet

mysql_container="$("${compose[@]}" ps -q mysql)"
[[ -n "$mysql_container" ]] || fail 'MySQL 容器不存在，请先执行 bash deploy.sh start。'
mysql_status="$(docker inspect --format '{{.State.Status}}' "$mysql_container")"
[[ "$mysql_status" == 'running' ]] || fail 'MySQL 容器未运行，请先启动后端服务。'

timestamp="$(date +%Y%m%d-%H%M%S)"
backup_file="$BACKUP_DIR/mall-$timestamp.sql.gz"
partial_file="$backup_file.partial"
lock_dir="$backup_file.lock"

mkdir -p -- "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
# 原子 mkdir 是同秒备份锁；只有持有锁的进程才能写入或清理临时文件。
if ! mkdir -- "$lock_dir"; then
  fail '同一时间戳的备份正在进行或文件已存在，请稍后重试。'
fi

cleanup() {
  if [[ -f "$partial_file" ]]; then
    rm -f -- "$partial_file"
  fi
  rmdir -- "$lock_dir"
}
trap cleanup EXIT

[[ ! -e "$backup_file" && ! -e "$partial_file" ]] || fail '同一时间戳的备份文件已存在，请稍后重试。'

if ! "${compose[@]}" exec -T mysql sh -c \
  'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --quick --routines --events --triggers --hex-blob --databases "$MYSQL_DATABASE"' \
  | gzip >"$partial_file"; then
  fail '数据库导出失败，本次残缺文件已清理。'
fi

gzip -t "$partial_file" || fail '备份压缩包校验失败。'
mv -- "$partial_file" "$backup_file"
chmod 600 "$backup_file"
printf 'MySQL 备份完成：%s\n' "$backup_file"
