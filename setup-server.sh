#!/bin/bash
# First-time server setup for Ubuntu 22.04+
# Run as root: bash setup-server.sh
set -e

APP_DIR="/home/app"
DB_NAME="telegram_monitor"
DB_USER="telegram_user"
DB_PASS="$(openssl rand -hex 16)"

echo "=== 1. System packages ==="
apt-get update -y
apt-get install -y curl git nginx postgresql redis-server ufw

echo "=== 2. Node.js 20 ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
npm install -g pm2 @nestjs/cli

echo "=== 3. PostgreSQL — create DB & user ==="
systemctl start postgresql
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

echo "=== 4. Redis ==="
systemctl enable redis-server
systemctl start redis-server

echo "=== 5. Clone / update repo ==="
if [ ! -d "$APP_DIR/.git" ]; then
  git clone https://github.com/YOUR_USER/YOUR_REPO.git "$APP_DIR"
else
  cd "$APP_DIR" && git pull origin main
fi

echo "=== 6. Write .env ==="
cat > "$APP_DIR/.env" <<EOF
PORT=4000
NODE_ENV=production
DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME?schema=public"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="$(openssl rand -hex 32)"
DEFAULT_WEBHOOK_SECRET="$(openssl rand -hex 32)"
WEB_APP_ORIGIN="http://$(curl -s ifconfig.me)"
VITE_API_URL="http://$(curl -s ifconfig.me)/api"
EOF

echo "=== 7. Install deps & build ==="
cd "$APP_DIR"
npm ci
npm run build -w apps/api
VITE_API_URL="http://$(curl -s ifconfig.me)/api" npm run build -w apps/web

echo "=== 8. DB migrations ==="
cd apps/api && npx prisma migrate deploy && cd ../..

echo "=== 9. PM2 ==="
mkdir -p logs
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup | bash || true

echo "=== 10. Nginx ==="
cp nginx.conf /etc/nginx/sites-available/tbm
ln -sf /etc/nginx/sites-available/tbm /etc/nginx/sites-enabled/tbm
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "=== 11. Firewall ==="
ufw allow OpenSSH
ufw allow 'Nginx HTTP'
ufw --force enable

echo ""
echo "✅ Setup complete!"
echo "   App: http://$(curl -s ifconfig.me)"
echo "   DB password saved to .env — keep it safe!"
