# PsychAI

Веб-сервис психологической помощи с ИИ-ассистентом.

## Стек

- **Backend:** Go 1.22, chi, pgx, golang-jwt, Redis
- **Frontend:** React 18 + TypeScript, Vite, Framer Motion, Zustand
- **БД:** PostgreSQL 16 + Redis 7
- **LLM:** Groq API (llama-3.3-70b-versatile)
- **Поиск:** Tavily Search API

## Запуск

### 1. Зависимости

Установить: [Docker Desktop](https://www.docker.com/products/docker-desktop/), Go 1.22+, Node 18+

### 2. Конфиг

```bash
cp .env.example .env
# Заполнить GROQ_API_KEY и TAVILY_API_KEY в .env
```

### 3. БД

```bash
docker compose up -d

# Установить golang-migrate
go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest

# Применить миграции
migrate -path backend/db/migrations \
  -database "postgres://psychai:psychai@localhost:5432/psychai?sslmode=disable" up
```

### 4. Backend

```bash
cd backend
# Скопировать .env в backend/
cp ../.env .env
go run ./cmd/server
# Слушает на :8080
```

### 5. Frontend

```bash
cd frontend
npm install
npm run dev
# Открыть http://localhost:5173
```

## API

| Метод | Путь | Описание |
|-------|------|----------|
| POST | /auth/register | Регистрация |
| POST | /auth/login | Вход |
| POST | /auth/refresh | Обновить токен |
| POST | /auth/logout | Выход |
| GET | /api/sessions | Список бесед |
| POST | /api/sessions/{id}/chat | SSE-чат с ИИ |
| GET/POST/PUT/DELETE | /api/diary | Дневник настроения |
| GET | /api/exercises | Упражнения |
| POST | /api/exercises/{slug}/complete | Отметить выполненным |
| GET | /api/resources/search?q=... | Поиск через Tavily |
| GET | /api/progress | Прогресс и стрики |
| GET/PUT | /api/user | Профиль пользователя |

## Переменные окружения

| Переменная | Описание |
|------------|----------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `GROQ_API_KEY` | Ключ Groq API |
| `TAVILY_API_KEY` | Ключ Tavily Search API |
| `JWT_SECRET` | Секрет для JWT (мин. 32 символа) |
| `PORT` | Порт сервера (по умолчанию 8080) |
