#!/usr/bin/env bash
set -euo pipefail
APP_DIR=${APP_DIR:-/opt/daese_academy_app}
cd "$APP_DIR"
git pull --ff-only
docker compose up -d --build
docker image prune -f >/dev/null 2>&1 || true
echo "최신 코드 반영 완료"
