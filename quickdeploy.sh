#!/bin/bash
# Quick deploy script — run on server to apply code updates
# Usage: bash quickdeploy.sh
set -e

SERVER_DIR="/home/app"
cd "$SERVER_DIR"

echo "▶ Pulling latest changes from git..."
git pull origin main

echo "▶ Installing dependencies..."
npm ci

echo "▶ Building API..."
npm run build -w apps/api

echo "▶ Building Frontend..."
VITE_API_URL="$(grep VITE_API_URL .env | cut -d= -f2 | tr -d '\"')" npm run build -w apps/web

echo "▶ Running DB migrations..."
cd apps/api && npx prisma migrate deploy && cd ../..

echo "▶ Restarting API with PM2..."
pm2 restart api --update-env || pm2 start ecosystem.config.js --env production
pm2 save

echo "▶ Reloading Nginx..."
nginx -t && systemctl reload nginx

echo "✅ Deploy complete! Server: http://$(curl -s ifconfig.me)"
