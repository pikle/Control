#!/bin/bash

# 🚀 Быстрое восстановление сервера
# Запускать на сервере: bash /home/app/recovery.sh

echo "🔧 Восстановление сервера..."

# Остановить все процессы
echo "🛑 Останавливаю PM2..."
pm2 stop all 2>/dev/null
pm2 delete all 2>/dev/null

# Проверить службы
echo "🔍 Проверяю службы..."
sudo systemctl is-active postgresql && echo "✅ PostgreSQL работает" || echo "❌ PostgreSQL не работает"
sudo systemctl is-active redis-server && echo "✅ Redis работает" || echo "❌ Redis не работает"
sudo systemctl is-active nginx && echo "✅ Nginx работает" || echo "❌ Nginx не работает"

# Перейти в директорию проекта
cd /home/app/control || { echo "❌ Директория не найдена"; exit 1; }

# Переустановить зависимости
echo "📦 Переустанавливаю зависимости..."
npm install

# Собрать проект
echo "🏗️ Собираю проект..."
npm run build

# Запустить PM2
echo "🚀 Запускаю сервер..."
pm2 start ecosystem.config.js

# Проверить статус
sleep 3
pm2 status

# Проверить API
echo "🔍 Проверяю API..."
curl -s http://localhost:4000/health || echo "❌ API не отвечает"

echo "✅ Восстановление завершено!"
echo ""
echo "📊 Статус:"
pm2 status
echo ""
echo "📝 Логи: pm2 logs api"