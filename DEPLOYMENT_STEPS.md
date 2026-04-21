# 🚀 Deployment Checklist для 89.124.99.30

## 🔗 SSH в сервер

```bash
ssh -i your-key.pem root@89.124.99.30
# или: ssh -p 22 root@89.124.99.30
```

---

## Вариант 1️⃣: Автоматическое развёртывание (РЕКОМЕНДУЕТСЯ)

### Шаг 1: Загрузить скрипт на сервер

```bash
# На вашем компьютере
scp deploy.sh root@89.124.99.30:/root/deploy.sh
ssh root@89.124.99.30 chmod +x /root/deploy.sh
```

### Шаг 2: Запустить скрипт

```bash
ssh root@89.124.99.30 "cd /root && bash deploy.sh"
```

**Выбрать вариант:** `1` (Полная установка)

---

## Вариант 2️⃣: Ручное развёртывание (Пошагово)

### 📦 Установить инфраструктуру

```bash
# 1. Обновить систему
sudo apt update && sudo apt upgrade -y

# 2. Установить Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs npm
node --version

# 3. Установить PostgreSQL
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql

# 4. Установить Redis
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# 5. Установить Nginx
sudo apt install -y nginx
sudo systemctl enable nginx

# 6. Установить PM2 глобально
sudo npm install -g pm2
```

### 🗄️ Настроить БД

```bash
# Подключиться к PostgreSQL
sudo -u postgres psql

# Выполнить в psql:
CREATE USER telegram_user WITH PASSWORD 'your-strong-password';
CREATE DATABASE telegram_monitor OWNER telegram_user;
GRANT ALL PRIVILEGES ON DATABASE telegram_monitor TO telegram_user;
ALTER USER telegram_user CREATEDB;
\q
```

### 📱 Скопировать приложение

```bash
# На вашем компьютере - запустить в папке проекта
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude '.env' . root@89.124.99.30:/home/app/control/

# или просто сжать и залить
zip -r control.zip . -x "node_modules/*" ".git/*"
scp control.zip root@89.124.99.30:/home/app/
ssh root@89.124.99.30 "cd /home/app && unzip control.zip && rm control.zip"
```

### ⚙️ Установить зависимости

```bash
cd /home/app/control
npm install
```

### 🔐 Настроить .env

```bash
cp .env.production.example .env.production

# Отредактировать файл
nano .env.production
```

**Ключевые переменные:**
```
DATABASE_URL="postgresql://telegram_user:YOUR_DB_PASSWORD@localhost:5432/telegram_monitor?schema=public"
JWT_SECRET="$(openssl rand -base64 32)"
DEFAULT_WEBHOOK_SECRET="$(openssl rand -base64 32)"
NODE_ENV=production
WEB_APP_ORIGIN="http://89.124.99.30"
```

### 🏗️ Собрать приложение

```bash
npm run build
```

### 🗄️ Миграции

```bash
npm run db:push
```

### 🚀 Запустить через PM2

```bash
# Создать PM2 конфиг
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'api',
    script: 'dist/apps/api/main.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://telegram_user:PASSWORD@localhost:5432/telegram_monitor?schema=public',
      REDIS_URL: 'redis://localhost:6379',
      PORT: 4000,
    }
  }]
};
EOF

# Запустить
pm2 start ecosystem.config.js
pm2 startup
pm2 save
```

### 🌐 Настроить Nginx

```bash
sudo tee /etc/nginx/sites-available/control << 'EOF'
upstream api_backend {
    server localhost:4000;
    server localhost:4001;
}

server {
    listen 80;
    server_name 89.124.99.30;

    location /api/ {
        proxy_pass http://api_backend/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    location / {
        root /home/app/control/apps/web/dist;
        try_files $uri $uri/ /index.html;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/control /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

---

## ✅ Проверка после развёртывания

```bash
# API здоровье
curl http://89.124.99.30/api/health

# Фронтенд доступен
curl http://89.124.99.30

# БД подключена
psql -U telegram_user -d telegram_monitor -h localhost -c "SELECT 1"

# Redis работает
redis-cli ping

# PM2 процессы
pm2 status

# Логи
pm2 logs api
```

---

## 🔄 Обновление приложения

```bash
cd /home/app/control

# Получить новый код
git pull origin main

# Пересобрать
npm install
npm run build

# Миграции (если есть)
npm run db:push

# Перезапустить
pm2 restart all
```

---

## 🛡️ Безопасность

```bash
# Настроить firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Установить fail2ban
sudo apt install -y fail2ban
sudo systemctl enable fail2ban

# SSL сертификат (Let's Encrypt)
sudo apt install -y certbot python3-certbot-nginx
sudo certbot certonly --nginx -d 89.124.99.30
sudo certbot install --nginx -d 89.124.99.30
sudo systemctl enable certbot.timer
```

---

## 📊 Мониторинг

```bash
# Работающие процессы
pm2 status
pm2 monit

# Логи в реальном времени
pm2 logs api --lines 100

# Использование памяти/CPU
pm2 ps

# Информация о проверке здоровья
curl http://89.124.99.30/api/health | jq
```

---

## 🆘 Решение проблем

| Проблема | Решение |
|----------|--------|
| `Port 4000 уже занят` | `lsof -i :4000` и `kill -9 <PID>` |
| `БД не подключается` | Проверить `DATABASE_URL` в .env и права пользователя |
| `Nginx 404` | Убедиться что `/home/app/control/apps/web/dist` существует |
| `PM2 не стартует` | `pm2 logs api` для ошибок |
| `Webhook не срабатывает` | Проверить `DEFAULT_WEBHOOK_SECRET` совпадает в Telegram |
| `Redis не работает` | `redis-cli ping` и `sudo systemctl restart redis-server` |

---

## 📝 Финальный статус

После развёртывания вы должны иметь:

- ✅ API работает на `http://89.124.99.30/api`
- ✅ Фронтенд доступен на `http://89.124.99.30`
- ✅ PostgreSQL активен с базой `telegram_monitor`
- ✅ Redis кэш работает
- ✅ Nginx reverse proxy настроен
- ✅ PM2 управляет процессами
- ✅ SSL сертификат (опционально)
- ✅ Firewall включён

---

**Все готово! 🚀**
