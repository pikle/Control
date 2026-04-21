#!/bin/bash

# 🚀 Автоматический скрипт развёртывания на Linux (Ubuntu/Debian)
# Использование: bash deploy.sh

set -e

echo "======================================"
echo "🚀 Deployment Script for Control App"
echo "======================================"
echo ""

# Цвета вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Функции вывода
info() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; exit 1; }

# Проверить root привилегии для некоторых команд
check_root() {
    if [[ $EUID -ne 0 ]]; then
        warn "Некоторые команды требуют sudo"
    fi
}

# Шаг 1: Обновить систему
step_update_system() {
    echo ""
    echo "📦 Шаг 1: Обновление системы..."
    sudo apt update && sudo apt upgrade -y
    info "Система обновлена"
}

# Шаг 2: Установить Node.js
step_install_nodejs() {
    echo ""
    echo "📦 Шаг 2: Установка Node.js..."
    
    if command -v node &> /dev/null; then
        info "Node.js уже установлен: $(node --version)"
    else
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt install -y nodejs
        info "Node.js установлен: $(node --version)"
    fi
}

# Шаг 3: Установить PostgreSQL
step_install_postgres() {
    echo ""
    echo "📦 Шаг 3: Установка PostgreSQL..."
    
    if command -v psql &> /dev/null; then
        info "PostgreSQL уже установлен: $(psql --version)"
    else
        sudo apt install -y postgresql postgresql-contrib
        info "PostgreSQL установлен"
    fi
    
    # Запустить сервис
    sudo systemctl enable postgresql
    sudo systemctl start postgresql
    info "PostgreSQL запущен"
}

# Шаг 4: Установить Redis
step_install_redis() {
    echo ""
    echo "📦 Шаг 4: Установка Redis..."
    
    if command -v redis-server &> /dev/null; then
        info "Redis уже установлен"
    else
        sudo apt install -y redis-server
        info "Redis установлен"
    fi
    
    sudo systemctl enable redis-server
    sudo systemctl start redis-server
    info "Redis запущен"
}

# Шаг 5: Установить Nginx
step_install_nginx() {
    echo ""
    echo "📦 Шаг 5: Установка Nginx..."
    
    if command -v nginx &> /dev/null; then
        info "Nginx уже установлен"
    else
        sudo apt install -y nginx
        info "Nginx установлен"
    fi
    
    sudo systemctl enable nginx
    sudo systemctl start nginx
    info "Nginx запущен"
}

# Шаг 6: Установить PM2
step_install_pm2() {
    echo ""
    echo "📦 Шаг 6: Установка PM2..."
    
    if sudo npm list -g pm2 &> /dev/null; then
        info "PM2 уже установлен"
    else
        sudo npm install -g pm2
        info "PM2 установлен"
    fi
}

# Шаг 7: Настроить БД
step_setup_database() {
    echo ""
    echo "🗄️  Шаг 7: Настройка PostgreSQL..."
    
    # Генерировать случайный пароль
    DB_PASSWORD=$(openssl rand -base64 12)
    echo "Сгенерирован пароль для БД: $DB_PASSWORD"
    
    # Создать пользователя и БД
    sudo -u postgres psql << EOF
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_user WHERE usename = 'telegram_user') THEN
    CREATE USER telegram_user WITH PASSWORD '$DB_PASSWORD';
  END IF;
END
\$\$;

DROP DATABASE IF EXISTS telegram_monitor;
CREATE DATABASE telegram_monitor OWNER telegram_user;
GRANT ALL PRIVILEGES ON DATABASE telegram_monitor TO telegram_user;
ALTER USER telegram_user CREATEDB;
EOF
    
    info "База данных настроена"
    echo "$DB_PASSWORD" > /tmp/db_password.txt
}

# Шаг 8: Установить зависимости приложения
step_install_dependencies() {
    echo ""
    echo "📦 Шаг 8: Установка зависимостей приложения..."
    
    if [ ! -d "node_modules" ]; then
        npm install
        info "Зависимости установлены"
    else
        info "Зависимости уже установлены"
    fi
}

# Шаг 9: Настроить .env
step_setup_env() {
    echo ""
    echo "⚙️  Шаг 9: Настройка переменных окружения..."
    
    if [ ! -f ".env.production" ]; then
        cp .env.example .env.production
        
        # Генерировать секреты
        JWT_SECRET=$(openssl rand -base64 32)
        WEBHOOK_SECRET=$(openssl rand -base64 32)
        DB_PASSWORD=$(cat /tmp/db_password.txt)
        
        # Обновить .env.production
        sed -i "s|DATABASE_URL=.*|DATABASE_URL=\"postgresql://telegram_user:${DB_PASSWORD}@localhost:5432/telegram_monitor?schema=public\"|" .env.production
        sed -i "s|JWT_SECRET=.*|JWT_SECRET=\"${JWT_SECRET}\"|" .env.production
        sed -i "s|DEFAULT_WEBHOOK_SECRET=.*|DEFAULT_WEBHOOK_SECRET=\"${WEBHOOK_SECRET}\"|" .env.production
        sed -i "s|NODE_ENV=.*|NODE_ENV=production|" .env.production
        sed -i "s|WEB_APP_ORIGIN=.*|WEB_APP_ORIGIN=\"http://89.124.99.30\"|" .env.production
        sed -i "s|VITE_API_URL=.*|VITE_API_URL=\"http://89.124.99.30/api\"|" .env.production
        
        info ".env.production создан"
    else
        info ".env.production уже существует"
    fi
    
    # Скопировать в расчётную папку для PM2
    cp .env.production .env.production.pm2
}

# Шаг 10: Выполнить миграции
step_run_migrations() {
    echo ""
    echo "🗄️  Шаг 10: Выполнение миграций БД..."
    
    # Экспортировать переменные окружения, исключая комментарии
    export $(grep -v '^#' .env.production | grep -v '^$' | xargs)
    npm run db:push
    info "Миграции выполнены"
}

# Шаг 11: Собрать приложение
step_build() {
    echo ""
    echo "🏗️  Шаг 11: Сборка приложения..."
    
    npm run build
    info "Приложение собрано"
}

# Шаг 12: Настроить PM2
step_setup_pm2() {
    echo ""
    echo "⚙️  Шаг 12: Настройка PM2..."
    
    DB_PASSWORD=$(cat /tmp/db_password.txt)
    
    cat > ecosystem.config.js << EOF
module.exports = {
  apps: [
    {
      name: 'api',
      script: 'dist/apps/api/main.js',
      cwd: '$(pwd)',
      env: {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://telegram_user:${DB_PASSWORD}@localhost:5432/telegram_monitor?schema=public',
        REDIS_URL: 'redis://localhost:6379',
        PORT: 4000,
        JWT_SECRET: '$(openssl rand -base64 32)',
      },
      instances: 2,
      exec_mode: 'cluster',
      watch: false,
      ignore_watch: ['node_modules', 'dist'],
      merge_logs: true,
      error_file: '${HOME}/logs/api-error.log',
      out_file: '${HOME}/logs/api-out.log',
    },
  ],
};
EOF
    
    mkdir -p ${HOME}/logs
    
    pm2 start ecosystem.config.js
    pm2 startup
    pm2 save
    
    info "PM2 настроен и запущен"
}

# Шаг 13: Настроить Nginx
step_setup_nginx() {
    echo ""
    echo "⚙️  Шаг 13: Настройка Nginx..."
    
    sudo tee /etc/nginx/sites-available/control > /dev/null << 'EOF'
upstream api_backend {
    server localhost:4000;
    server localhost:4001;
}

server {
    listen 80;
    listen [::]:80;
    server_name 89.124.99.30 _;

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

    location /webhook {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        root $(pwd)/apps/web/dist;
        try_files $uri $uri/ /index.html;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
EOF
    
    sudo ln -sf /etc/nginx/sites-available/control /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    
    sudo nginx -t && sudo systemctl restart nginx
    info "Nginx настроен"
}

# Шаг 14: Настроить firewall
step_setup_firewall() {
    echo ""
    echo "🔒 Шаг 14: Настройка Firewall..."
    
    sudo ufw default deny incoming
    sudo ufw default allow outgoing
    sudo ufw allow 22/tcp
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    sudo ufw enable
    
    info "Firewall настроен"
}

# Главная функция
main() {
    check_root
    
    # Перейти в директорию проекта
    cd /home/app/control || error "Не могу найти директорию /home/app/control"
    
    echo ""
    echo "Выбери какие шаги выполнить:"
    echo ""
    echo "1) Полная установка (1-14)"
    echo "2) Только приложение (8-12)"
    echo "3) Только инфраструктура (1-7)"
    echo "4) Только веб-сервер (13-14)"
    echo ""
    read -p "Выбери вариант (1-4): " VARIANT
    
    case $VARIANT in
        1)
            step_update_system
            step_install_nodejs
            step_install_postgres
            step_install_redis
            step_install_nginx
            step_install_pm2
            step_setup_database
            step_install_dependencies
            step_setup_env
            step_run_migrations
            step_build
            step_setup_pm2
            step_setup_nginx
            step_setup_firewall
            ;;
        2)
            step_install_dependencies
            step_setup_env
            step_run_migrations
            step_build
            step_setup_pm2
            ;;
        3)
            step_update_system
            step_install_nodejs
            step_install_postgres
            step_install_redis
            step_install_nginx
            step_install_pm2
            step_setup_database
            ;;
        4)
            step_setup_nginx
            step_setup_firewall
            ;;
        *)
            error "Неверный выбор"
            ;;
    esac
    
    echo ""
    echo "======================================"
    echo "✅ Deployment завершён!"
    echo "======================================"
    echo ""
    echo "📍 Приложение доступно на: http://89.124.99.30"
    echo ""
    echo "📊 Мониторинг PM2: pm2 monit"
    echo "📋 Логи: pm2 logs api"
    echo "🔄 Обновление: git pull && npm run build && pm2 restart all"
    echo ""
    
    # Очистить временные файлы
    rm -f /tmp/db_password.txt
}

main "$@"
