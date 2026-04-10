# 대세학원 강의실 예약 보드 — Cafe24 + GitHub 실배포 가이드

이 가이드는 아래 환경을 기준으로 작성했습니다.

- 서버: Cafe24 SSD 가상서버 일반형
- 도메인: `daeseaca.cafe24.com`
- Git 저장소: GitHub
- 운영 구조: **GitHub(소스) + Cafe24 VPS(실서비스) + PostgreSQL(예약 DB)**

## 추천 이유

이번 앱은 아래 기능이 핵심입니다.

- 12개 선생님 로그인
- 최초 비밀번호 1, 이후 변경
- 관리자 1명(스텐)
- 30분 단위 예약
- 빈 시간 예약 / 본인 수정 취소 / 관리자 차단
- 매주 반복 예약
- 같은 강의실 같은 시간대 중복 금지

이 구조는 **서버 + PostgreSQL** 이 가장 단순하고 안정적입니다.

## 서버 배포 순서

### 1) GitHub 리포지토리 만들기

예시 리포지토리 이름

```text
daese-academy-classroom-scheduler
```

그 다음 이 프로젝트 파일 전체를 GitHub에 올립니다.

### 2) 서버 접속

```bash
ssh root@114.207.245.171
```

### 3) 최소 Git 설치 후 프로젝트 clone

```bash
apt-get update
apt-get install -y git
cd /opt
git clone git@github.com:YOUR_GITHUB_ID/daese-academy-classroom-scheduler.git daese_academy_app
cd /opt/daese_academy_app
```

### 4) 기본 패키지 설치

```bash
bash deploy/cafe24/install_server_ubuntu.sh
```

> 이 스크립트는 Docker, Compose plugin, Git, Nginx, UFW 를 설치합니다.

### 5) 환경 파일 생성

```bash
cp .env.cafe24.example .env
nano .env
```

아래 항목은 꼭 바꾸세요.

- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- 필요 시 `APP_URL`

### 6) 앱 실행

```bash
docker compose up -d --build
```

상태 확인

```bash
docker compose ps
curl http://127.0.0.1:3000/api/health
```

### 7) Nginx 연결

```bash
bash deploy/cafe24/install_nginx_site.sh
```

브라우저에서 먼저 아래 주소가 열리는지 확인합니다.

```text
http://daeseaca.cafe24.com
```

### 8) HTTPS 적용

Nginx 가 먼저 80번 포트에서 잘 열려야 합니다.

그 다음 Certbot 으로 HTTPS 를 붙입니다.

예시:

```bash
sudo apt-get update
sudo apt-get install -y snapd
sudo snap install core; sudo snap refresh core
sudo snap install --classic certbot
sudo ln -sf /snap/bin/certbot /usr/bin/certbot
sudo certbot --nginx -d daeseaca.cafe24.com
```

적용 후 접속 주소

```text
https://daeseaca.cafe24.com
```

## GitHub Actions 자동배포

파일은 이미 들어 있습니다.

```text
.github/workflows/deploy.yml
```

리포지토리 시크릿은 `deploy/cafe24/github_actions_secrets.md` 를 보면 됩니다.

자동배포 방식은 다음과 같습니다.

1. GitHub main 브랜치에 push
2. GitHub Actions 가 서버에 SSH 접속
3. 서버에서 `git pull`
4. `docker compose up -d --build`

## 운영 메모

- DB 포트는 외부에 열지 않도록 compose 를 수정해 두었습니다.
- 앱 포트도 `127.0.0.1:3000` 으로만 바인딩되어 Nginx 뒤에서만 노출됩니다.
- 최초 로그인 후 선생님들에게 비밀번호 변경을 안내하세요.
- 완전 초기화가 필요하면 `docker compose down -v` 후 다시 올리면 됩니다.

## 자주 쓰는 명령

```bash
# 상태 보기
docker compose ps

# 로그 보기
docker compose logs -f app

# 재배포
bash deploy/cafe24/renew_and_restart.sh

# 완전 초기화
docker compose down -v
docker compose up -d --build
```
