#!/usr/bin/env bash
set -euo pipefail
DOMAIN=${DOMAIN:-daeseaca.cafe24.com}
CONF_PATH="/etc/nginx/sites-available/${DOMAIN}.conf"

sudo tee "$CONF_PATH" >/dev/null <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

sudo ln -sf "$CONF_PATH" "/etc/nginx/sites-enabled/${DOMAIN}.conf"
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

echo "Nginx 프록시 설정이 적용되었습니다."
echo "이제 브라우저에서 http://${DOMAIN} 확인 후 HTTPS를 붙이세요."
