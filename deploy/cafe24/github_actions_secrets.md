# GitHub Actions 시크릿

리포지토리 Settings → Secrets and variables → Actions 에 아래 값을 추가하세요.

- `SERVER_HOST` : 서버 IP 또는 도메인
- `SERVER_USER` : root
- `SERVER_PORT` : 22
- `SERVER_SSH_KEY` : 서버 접속용 개인키 내용 전체
- `SERVER_APP_DIR` : /opt/daese_academy_app

서버 쪽에는 공개키를 `~/.ssh/authorized_keys` 에 넣어 두면 됩니다.
