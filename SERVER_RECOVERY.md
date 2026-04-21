# 🚨 ВОССТАНОВЛЕНИЕ СЕРВЕРА

## Проблема: API сервер не отвечает (ERR_CONNECTION_REFUSED)

### Шаг 1: Восстановить SSH доступ
```bash
# Если SSH заблокирован - подождать 10-15 минут
# Или использовать другой терминал/компьютер
# Или связаться с хостинг-провайдером
```

### Шаг 2: Проверить статус сервера
```bash
ssh root@89.124.99.30

# Проверить PM2
pm2 status
pm2 logs api --lines 20

# Проверить процессы
ps aux | grep node
ps aux | grep pm2

# Проверить порты
netstat -tlnp | grep 4000
```

### Шаг 3: Перезапустить службы
```bash
# Остановить PM2
pm2 stop all
pm2 delete all

# Проверить БД
sudo systemctl status postgresql

# Проверить Redis
sudo systemctl status redis-server

# Проверить Nginx
sudo systemctl status nginx
```

### Шаг 4: Обновить код
```bash
cd /home/app/control

# Создать бэкап
cp -r . ../control-backup

# Обновить код (если есть архив)
# scp control-update.tar.gz root@89.124.99.30:/home/app/
cd /home/app
tar -xzf control-update.tar.gz -C control --strip-components=1
cd control

# Переустановить зависимости
npm install

# Собрать
npm run build
```

### Шаг 5: Запустить сервер
```bash
# Запустить PM2
pm2 start ecosystem.config.js
pm2 startup
pm2 save

# Проверить
pm2 status
curl http://localhost:4000/health
curl http://89.124.99.30/api/health
```

### Шаг 6: Проверить логи
```bash
pm2 logs api --lines 50
tail -f /home/app/logs/api-error.log
tail -f /home/app/logs/api-out.log
```

---

## 🔍 Возможные причины проблемы:

1. **Ошибка в новом коде** (telegram-analytics.service.ts)
2. **Проблема с зависимостями** после обновления
3. **База данных** не отвечает
4. **PM2** упал из-за OOM
5. **Файловые права** изменились

---

## 🛠️ Быстрое восстановление:

```bash
# На сервере
cd /home/app/control
pm2 stop all
pm2 delete all
npm run build
pm2 start ecosystem.config.js
pm2 logs api
```

---

## 📞 Если ничего не помогает:

1. Проверить логи systemd: `journalctl -u pm2-root -n 50`
2. Проверить память: `free -h`
3. Проверить диск: `df -h`
4. Перезагрузить сервер: `reboot`

---

**После восстановления проверь:**
- ✅ `curl http://89.124.99.30/api/health` → `{"status":"ok"}`
- ✅ `pm2 status` → online
- ✅ Фронтенд работает: http://89.124.99.30