# 📦 Deployment Guide для Linux (Ubuntu/Debian)

## Сервер: 89.124.99.30

---

## 1️⃣ Подготовка сервера

### Шаг 1: Обновить ОС и установить зависимости

```bash
ssh root@89.124.99.30

# Обновить систему
sudo apt update && sudo apt upgrade -y

# Установить Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Установить npm/git
sudo apt install -y git npm

# Установить PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Установить Redis (опционально, для кэша)
sudo apt install -y redis-server

# Установить Nginx (для reverse proxy)
sudo apt install -y nginx

# Проверить версии
node --version  # v20.x.x
npm --version   # 10.x.x
psql --version  # psql 14+
```

### Шаг 2: Настроить PostgreSQL

```bash
# Подключитьcя к PostgreSQL
sudo -u postgres psql

# Создать пользователя и базу
CREATE USER telegram_user WITH PASSWORD 'strong-password-here';
CREATE DATABASE telegram_monitor OWNER telegram_user;
GRANT ALL PRIVILEGES ON DATABASE telegram_monitor TO telegram_user;
ALTER USER telegram_user CREATEDB;
\q

# Проверить подключение
psql -U telegram_user -d telegram_monitor -h localhost
```

### Шаг 3: Настроить Redis

```bash
# Включить автозапуск
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Проверить статус
redis-cli ping  # PONG
```

### Шаг 4: Создать юзера для приложения

```bash
# Создать юзера
sudo useradd -m -s /bin/bash app
sudo usermod -aG sudo app

# Переключиться на app юзера
su - app
```

---

## 2️⃣ Развёртывание приложения

### Шаг 5: Клонировать репозиторий

```bash
cd /home/app
git clone <ваш-git-repo> control
cd control
```

### Шаг 6: Установить зависимости

```bash
npm install
```

### Шаг 7: Настроить переменные окружения

```bash
# Скопировать пример
cp .env.example .env.production

# Отредактировать
nano .env.production
```

**Заменить значения:**
```env
# API
PORT=4000
NODE_ENV=production
DATABASE_URL="postgresql://telegram_user:strong-password-here@localhost:5432/telegram_monitor?schema=public"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="generate-random-32-char-string-here"

# Telegram
DEFAULT_WEBHOOK_SECRET="another-random-secret-32-chars"
WEB_APP_ORIGIN="http://89.124.99.30"

# Frontend
VITE_API_URL="http://89.124.99.30/api"

# AI
GROQ_API_KEY="your-groq-api-key-here"  # Опционально
```

### Шаг 8: Выполнить миграции БД

```bash
# Генерировать Prisma Client
npm run db:migrate

# Проталкивание схемы (если noch не делали)
npm run db:push
```

### Шаг 9: Собрать приложение

```bash
npm run build
```

---

## 3️⃣ Настроить PM2 (мониторинг процессов)

### Установить PM2

```bash
sudo npm install -g pm2
pm2 install pm2-auto-pull  # для автообновления
```

### Создать PM2 конфиг

```bash
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'api',
      script: 'dist/apps/api/main.js',
      cwd: '/home/app/control',
      env: {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://telegram_user:strong-password-here@localhost:5432/telegram_monitor?schema=public',
        REDIS_URL: 'redis://localhost:6379',
        PORT: 4000,
      },
      instances: 2,
      exec_mode: 'cluster',
      watch: false,
      ignore_watch: ['node_modules', 'dist'],
      merge_logs: true,
      error_file: '/home/app/logs/api-error.log',
      out_file: '/home/app/logs/api-out.log',
      uid: 'api',
    },
  ],
};
EOF

# Создать папку для логов
mkdir -p /home/app/logs
```

### Запустить app через PM2

```bash
pm2 start ecosystem.config.js
pm2 startup
pm2 save
```

---

## 4️⃣ Настроить Nginx (reverse proxy + SSL)

### Создать Nginx конфиг

```bash
sudo tee /etc/nginx/sites-available/control << 'EOF'
upstream api_backend {
    server localhost:4000;
    server localhost:4001;  # второе ядро из PM2 cluster
}

server {
    listen 80;
    listen [::]:80;
    server_name 89.124.99.30;

    # API routes
    location /api/ {
        proxy_pass http://api_backend/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Frontend (если деплоим SPA)
    location / {
        root /home/app/control/apps/web/dist;
        try_files $uri $uri/ /index.html;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Webhook для Telegram
    location /webhook {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

# Включить конфиг
sudo ln -s /etc/nginx/sites-available/control /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default 2>/dev/null || true

# Проверить синтаксис
sudo nginx -t

# Перезапустить Nginx
sudo systemctl restart nginx
```

### Добавить SSL (Let's Encrypt)

```bash
# Установить Certbot
sudo apt install -y certbot python3-certbot-nginx

# Получить сертификат (замени домен если есть)
sudo certbot certonly --nginx -d 89.124.99.30

# Обновить Nginx конфиг для HTTPS
sudo certbot install --nginx -d 89.124.99.30

# Автообновление сертификата
sudo systemctl enable certbot.timer
```

---

## 5️⃣ Мониторинг и логи

```bash
# Смотреть логи в реальном времени
pm2 logs api

# Dashboard PM2
pm2 monit

# Перезапуск/остановка
pm2 restart all
pm2 stop all
pm2 delete all
```

---

## ✅ Проверка развёртывания

```bash
# Проверить API
curl http://89.124.99.30/api/health

# Проверить фронтенд
curl http://89.124.99.30

# Проверить БД
psql -U telegram_user -d telegram_monitor -h localhost -c "\dt"

# Проверить Redis
redis-cli ping
```

---

## 🔄 Обновление приложения

```bash
cd /home/app/control

# Pull новый код
git pull origin main

# Переустановить зависимости (если нужно)
npm install

# Пересобрать
npm run build

# Запустить миграции (если есть)
npm run db:migrate

# Перезапустить PM2
pm2 restart all
```

---

## 🛡️ Безопасность

- [ ] Сменить пароли в .env.production
- [ ] Включить firewall: `sudo ufw enable`
- [ ] Закрыть порты кроме 22, 80, 443:
  ```bash
  sudo ufw default deny incoming
  sudo ufw default allow outgoing
  sudo ufw allow 22/tcp
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  sudo ufw enable
  ```
- [ ] Настроить fail2ban для SSH:
  ```bash
  sudo apt install -y fail2ban
  sudo systemctl enable fail2ban
  ```

---

## 📞 Проблемы?

- **Port 4000 уже занят:** `lsof -i :4000` и убить процесс
- **БД не подключается:** Проверить `DATABASE_URL` и права пользователя
- **Nginx не грузит фронтенд:** Убедиться что `npm run build` создал `/dist` папку
- **PM2 не стартует:** `pm2 logs api` для ошибок

---

**Готово! Приложение работает на http://89.124.99.30** 🚀
