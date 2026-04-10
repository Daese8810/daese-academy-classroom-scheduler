#!/usr/bin/env bash
set -euo pipefail

APP_DIR=${APP_DIR:-/opt/daese_academy_app}
DOMAIN=${DOMAIN:-daeseaca.cafe24.com}
REPO_URL=${REPO_URL:-git@github.com:YOUR_GITHUB_ID/daese-academy-classroom-scheduler.git}

if [ ! -d "$APP_DIR/.git" ]; then
  sudo mkdir -p "$(dirname "$APP_DIR")"
  sudo chown -R "$USER":"$USER" "$(dirname "$APP_DIR")"
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"

if [ ! -f .env ]; then
  cp .env.cafe24.example .env
  echo ".env 파일이 생성되었습니다. POSTGRES_PASSWORD 와 DATABASE_URL 을 먼저 수정하세요."
fi

docker compose up -d --build
curl -fsS http://127.0.0.1:3000/api/health || true

echo "앱이 127.0.0.1:3000 에 올라왔는지 확인하세요."
echo "다음 단계: deploy/cafe24/install_nginx_site.sh 실행"
