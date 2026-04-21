# Telegram Business Monitor

Веб-приложение для мониторинга новых переписок Telegram через функцию **Telegram Business → Chat Bots**.

Система принимает и сохраняет **только новые события после подключения бота**:
- новые сообщения
- редактирование
- реакции
- удаление (если приходит событие)
- медиа/вложения

## Стек

- Frontend: React + TypeScript + Tailwind
- Backend: NestJS (Node.js)
- БД: PostgreSQL (Prisma)
- Кеш: Redis
- Интеграция: Telegram Bot API Webhook

## Структура

- apps/api — NestJS API + webhook + Prisma
- apps/web — React UI (интерфейс в стиле Telegram)
- docker-compose.yml — PostgreSQL/Redis

## Быстрый запуск

1. Установить зависимости:

```bash
npm install
```

2. Поднять PostgreSQL и Redis:

```bash
docker compose up -d
```

3. Создать `.env` на основе `.env.example`.

4. Применить схему БД:

```bash
npm run db:push
```

5. Запустить API и Web (в разных терминалах):

```bash
npm run dev:api
npm run dev:web
```

## Подключение Telegram Business

1. Создайте бота через **BotFather**.
2. В Telegram добавьте бота в **Business → Chat Bots**.
3. В приложении (вкладка Админка) создайте бота: имя + токен.
4. Скопируйте `webhookPath` из списка ботов.
5. Установите webhook в Telegram:

```bash
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://<YOUR_API_HOST>/telegram/webhook/<WEBHOOK_PATH>&secret_token=<WEBHOOK_SECRET>
```

После этого backend начинает принимать **новые** события и сохранять их в PostgreSQL.

## Реализованные модули

- Мониторинг чатов: список, поиск чатов, лента сообщений
- Telegram-like интерфейс: 3 колонки (чаты / сообщения / инфо)
- Глобальный поиск: по тексту, username, user_id, chat_id, дате
- Заметки: привязка к CHAT/USER/MESSAGE
- Кастомные поля: create/update/delete + отображение в правой панели
- Админка:
	- управление ботами
	- управление кастомными полями
	- просмотр пользователей и смена роли
	- лог действий
- Экспорт переписки: `GET /exports/chat/:chatId`

## Основные таблицы (Prisma)

- accounts
- bots
- chats
- users
- messages
- attachments
- notes
- custom_fields
- custom_field_values
- action_logs

## Важные API endpoints

- `POST /telegram/webhook/:webhookPath`
- `GET /chats?accountId=...&q=...`
- `GET /chats/:chatId/messages`
- `GET /chats/:chatId/sidebar`
- `GET /search/global?...`
- `POST /notes`
- `GET /admin/bots`
- `POST /admin/bots`
- `GET /admin/custom-fields/:accountId`
- `POST /admin/custom-fields`
- `PUT /admin/custom-fields/:fieldId`
- `POST /admin/custom-fields/:fieldId/delete`
- `GET /admin/users/:accountId`
- `PUT /admin/users/:userId/role`
- `GET /admin/logs/:accountId`
- `GET /exports/chat/:chatId`

## Примечания

- Для демо используется `accountId = demo-account` (bootstrap выполняется из UI).
- Для production добавьте полноценную авторизацию и secure-хранение токенов ботов.

## GitHub Auto-Deploy (один раз настроить и забыть)

После первичной настройки сервера можно деплоить просто через `git push` в `main`.

### 1) Что важно для сохранения ботов

- Боты хранятся в PostgreSQL (таблица `bots`).
- Текущий workflow использует только `prisma migrate deploy` (без `migrate reset` и без удаления данных).
- Не запускайте повторно `setup-server.sh` на уже рабочем сервере, чтобы не перезаписывать `.env`.

### 2) Секреты в GitHub (Settings → Secrets and variables → Actions)

Обязательные:

- `SSH_HOST` — IP сервера (например, `89.124.99.30`)
- `SSH_USER` — пользователь SSH (например, `root`)
- `VITE_API_URL` — адрес API для сборки фронта (например, `http://89.124.99.30/api`)

И один из вариантов авторизации:

- Рекомендуется: `SSH_PRIVATE_KEY` — приватный ключ для деплоя
- Либо fallback: `SSH_PASSWORD` — пароль SSH

Опционально:

- `APP_DIR` — директория приложения на сервере (по умолчанию `/home/app`)

### 3) Как это работает

- При push в `main` запускается `.github/workflows/deploy.yml`.
- Workflow:
	- ставит зависимости
	- собирает API и Web
	- на сервере делает `git pull --ff-only`
	- применяет миграции `prisma migrate deploy`
	- перезапускает PM2 через `ecosystem.config.js`
	- делает `nginx reload` и `healthcheck`
