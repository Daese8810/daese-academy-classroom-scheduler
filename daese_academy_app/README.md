# 대세학원 강의실 공유 예약 보드

대세학원 `대세영어 / 대세국어` 선생님들이 공용으로 사용할 수 있는 실배포용 강의실 예약 웹앱입니다.

## 포함된 기능

- 12개 교사 계정 로그인
- 최초 비밀번호 `1` (추후 변경 가능)
- 관리자 계정: `스텐`
- 30분 단위 예약
- 주간 / 일간 보기
- 6층 / 7층 필터
- 선생님 필터
- 영어과 / 국어과 필터
- 지금 비어 있는 강의실만 보기
- 오늘 남은 빈 시간만 보기
- 내가 예약한 것만 보기
- 매주 반복 예약 (최대 12회)
- 모바일 화면 보기 토글
- 본인 예약 수정 / 취소
- 관리자 전체 수정 / 차단
- 서버/DB 기반 저장
- 중복 예약 방지 (DB 레벨 포함)

## 계정 목록

### 영어과
- 스텐 (관리자)
- 조나단
- 존
- 스테이시
- 다나
- 주디

### 국어과
- 국신
- 국화
- 국보
- 국호
- 국대
- 국짱

초기 비밀번호는 모두 `1` 입니다.

---

## 빠른 배포 방법 (Docker Compose)

### 1) 환경 파일 준비

```bash
cp .env.example .env
```

`.env` 에서 최소한 아래 값은 바꿔 주세요.

```env
POSTGRES_PASSWORD=강력한비밀번호로변경
APP_URL=https://your-domain.example.com
DATABASE_URL=postgresql://daese:강력한비밀번호로변경@db:5432/daese_scheduler
```

### 2) 실행

```bash
docker compose up -d --build
```

### 3) 접속

브라우저에서 아래 주소로 접속합니다.

```text
http://서버주소:3000
```

또는 리버스 프록시(Nginx, Caddy 등) 뒤에 연결해서 HTTPS 도메인으로 운영하세요.

---

## 운영 전 체크리스트

- `POSTGRES_PASSWORD` 강하게 변경
- 외부 공개 시 HTTPS 사용
- `APP_URL` 실제 도메인으로 변경
- 최초 로그인 후 각 선생님 비밀번호 변경 안내
- PostgreSQL 데이터 볼륨 백업 정책 수립

---

## 파일 구조

```text
.
├─ db/
│  └─ init.sql          # 스키마 + 기본 계정 + 기본 강의실 생성
├─ public/
│  ├─ index.html        # 화면
│  └─ app.js            # 클라이언트 로직
├─ server/
│  └─ index.js          # API / 인증 / 예약 로직
├─ Dockerfile
├─ docker-compose.yml
├─ package.json
└─ .env.example
```

---


## 리버스 프록시 예시

- 샘플 설정 파일: `deploy/nginx.conf.sample`
- 실제 운영 시에는 HTTPS 인증서 설정을 추가해서 사용하세요.

---

## 수동 실행 방법 (Docker 없이)

### 1) PostgreSQL 준비

PostgreSQL DB를 만들고 `db/init.sql` 을 실행합니다.

```bash
psql "postgresql://USER:PASSWORD@HOST:5432/DBNAME" -f db/init.sql
```

### 2) 환경 변수 설정

```bash
export PORT=3000
export APP_URL=http://localhost:3000
export DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME
```

### 3) 실행

```bash
npm install
npm start
```

---

## 비고

- 예약 데이터는 PostgreSQL 에 저장됩니다.
- 같은 강의실의 겹치는 시간대 예약은 서버와 DB에서 모두 막습니다.
- 최초 DB 생성 시에만 기본 계정/강의실이 자동으로 들어갑니다.
- 이미 생성된 Docker volume 이 있으면 초기 SQL 이 다시 적용되지 않으니, 완전 초기화가 필요할 때는 volume 을 제거한 뒤 다시 올리세요.

### 완전 초기화 예시

```bash
docker compose down -v
docker compose up -d --build
```


## Cafe24 + GitHub 전용 배포 가이드

- 상세 가이드: `README_CAFE24_GITHUB.md`
- 1회 설치 스크립트: `deploy/cafe24/install_server_ubuntu.sh`
- Nginx 설정 스크립트: `deploy/cafe24/install_nginx_site.sh`
- GitHub Actions 자동배포: `.github/workflows/deploy.yml`
