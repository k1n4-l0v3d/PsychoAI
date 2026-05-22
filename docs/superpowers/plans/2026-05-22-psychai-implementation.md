# PsychAI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Собрать полный веб-сервис психологической помощи с ИИ-чатом, дневником, упражнениями, библиотекой и трекером прогресса.

**Architecture:** Go backend (chi, sqlc, golang-jwt) + React SPA (Vite, Framer Motion, Zustand) + PostgreSQL + Redis. SSE для стриминга от Groq. Tavily для поиска ресурсов с кэшированием в БД.

**Tech Stack:** Go 1.22, chi, sqlc, pgx, golang-migrate, golang-jwt, bcrypt, Redis, Groq API, Tavily API | React 18 + TypeScript, Vite, Framer Motion, Zustand, Axios, react-i18next, EventSource

---

## Task 1: Инфраструктура

**Files:**
- Create: `docker-compose.yml`
- Create: `backend/go.mod`
- Create: `backend/cmd/server/main.go`
- Create: `frontend/` (vite scaffold)

- [ ] Запустить `docker compose up -d` (postgres:16 + redis:7)
  ```yaml
  # docker-compose.yml
  services:
    postgres:
      image: postgres:16
      environment: { POSTGRES_DB: psychai, POSTGRES_USER: psychai, POSTGRES_PASSWORD: psychai }
      ports: ["5432:5432"]
    redis:
      image: redis:7
      ports: ["6379:6379"]
  ```
- [ ] `go mod init psychai` в `backend/`, добавить зависимости:
  ```
  go get github.com/go-chi/chi/v5 github.com/jackc/pgx/v5 github.com/golang-jwt/jwt/v5 golang.org/x/crypto github.com/redis/go-redis/v9
  ```
- [ ] `npm create vite@latest frontend -- --template react-ts` в корне
- [ ] `npm install framer-motion zustand axios react-i18next i18next react-router-dom` в `frontend/`
- [ ] `git init && git add . && git commit -m "chore: project scaffold"`

---

## Task 2: DB Migrations

**Files:**
- Create: `backend/db/migrations/001_init.up.sql`
- Create: `backend/db/migrations/001_init.down.sql`
- Create: `backend/db/migrations/002_seed_exercises.up.sql`

- [ ] Установить `golang-migrate`:
  ```
  go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest
  ```
- [ ] Написать `001_init.up.sql`:
  ```sql
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";

  CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    lang TEXT NOT NULL DEFAULT 'ru',
    theme TEXT NOT NULL DEFAULT 'dark',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Новая беседа',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user','assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE diary_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mood SMALLINT NOT NULL CHECK (mood BETWEEN 1 AND 10),
    text TEXT NOT NULL DEFAULT '',
    tags TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('breathing','cbt','meditation','relaxation')),
    title_ru TEXT NOT NULL,
    title_en TEXT NOT NULL,
    content_json JSONB NOT NULL,
    duration_sec INT NOT NULL DEFAULT 0
  );

  CREATE TABLE user_exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    results_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, query)
  );
  ```
- [ ] Написать `002_seed_exercises.up.sql` с 4+ упражнениями (дыхание 4-7-8, медитация перед сном, КПТ-техника, прогрессивная релаксация):
  ```sql
  INSERT INTO exercises (slug, type, title_ru, title_en, content_json, duration_sec) VALUES
  ('breathing-478', 'breathing', 'Дыхание 4-7-8', 'Breathing 4-7-8',
    '{"steps": [{"ru":"Вдох 4 секунды","en":"Inhale 4 sec"},{"ru":"Задержка 7 секунд","en":"Hold 7 sec"},{"ru":"Выдох 8 секунд","en":"Exhale 8 sec"}], "cycles": 4}',
    76),
  ('sleep-meditation', 'meditation', 'Медитация перед сном', 'Sleep Meditation',
    '{"steps":[{"ru":"Лягте удобно и закройте глаза","en":"Lie comfortably and close eyes"},{"ru":"Сосредоточьтесь на дыхании","en":"Focus on your breath"}]}',
    600),
  ('cbt-thought-record', 'cbt', 'КПТ: запись мыслей', 'CBT: Thought Record',
    '{"steps":[{"ru":"Опишите ситуацию","en":"Describe the situation"},{"ru":"Запишите автоматические мысли","en":"Write automatic thoughts"},{"ru":"Найдите когнитивное искажение","en":"Find cognitive distortion"},{"ru":"Сформулируйте альтернативную мысль","en":"Form an alternative thought"}]}',
    300),
  ('progressive-relaxation', 'relaxation', 'Прогрессивная релаксация', 'Progressive Relaxation',
    '{"steps":[{"ru":"Напрягите ступни на 5 секунд","en":"Tense feet for 5 sec"},{"ru":"Расслабьте","en":"Release"},{"ru":"Напрягите икры","en":"Tense calves"},{"ru":"Расслабьте","en":"Release"}]}',
    480);
  ```
- [ ] `migrate -path backend/db/migrations -database "postgres://psychai:psychai@localhost:5432/psychai?sslmode=disable" up`
- [ ] `git commit -m "feat: db migrations and exercise seeds"`

---

## Task 3: Auth Backend

**Files:**
- Create: `backend/internal/auth/handler.go`
- Create: `backend/internal/auth/service.go`
- Create: `backend/internal/auth/middleware.go`
- Create: `backend/internal/db/queries/users.sql` + sqlc-generated

- [ ] Написать `service.go` — Register (bcrypt hash), Login (compare hash, issue JWT access 15min + refresh 30d в Redis):
  ```go
  // AccessToken: golang-jwt, exp 15min, claim: user_id
  // RefreshToken: uuid stored in Redis key "refresh:<token>" → user_id, TTL 30d
  ```
- [ ] Написать `middleware.go` — JWT middleware для chi:
  ```go
  func AuthMiddleware(secret string) func(http.Handler) http.Handler {
      return func(next http.Handler) http.Handler {
          return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
              cookie, err := r.Cookie("access_token")
              // parse JWT → set ctx user_id → next
          })
      }
  }
  ```
- [ ] Написать `handler.go` — POST /auth/register, /auth/login, /auth/refresh, /auth/logout
- [ ] Написать тест `auth_test.go`: register → login → get JWT → refresh → logout
- [ ] `git commit -m "feat: auth backend (register/login/JWT/refresh)"`

---

## Task 4: Chat Backend (SSE + Groq)

**Files:**
- Create: `backend/internal/chat/handler.go`
- Create: `backend/internal/chat/groq.go`
- Create: `backend/internal/chat/chips.go`
- Create: `backend/internal/i18n/prompts.go`

- [ ] `groq.go` — HTTP client к `https://api.groq.com/openai/v1/chat/completions` с `stream: true`, читать SSE и переслать клиенту:
  ```go
  // Groq stream: читать r.Body построчно, парсить "data: {...}", писать в w через w.Write + flusher.Flush()
  ```
- [ ] `chips.go` — анализ текста ответа, возврат слайса chips:
  ```go
  var chipRules = []struct {
      keywords []string
      chip     string
  }{
      {[]string{"тревог", "паник", "anxiety", "panic"}, "🧘 Дыхание 4-7-8"},
      {[]string{"сон", "усталост", "sleep", "tired"}, "🧘 Медитация перед сном"},
      {[]string{"мысл", "thought", "негатив"}, "🧘 КПТ-техника"},
      {[]string{"статьи", "книг", "resources", "articles"}, "📚 Найти статьи"},
  }
  // всегда добавлять "📔 Записать в дневник"
  ```
- [ ] `handler.go`:
  - `GET /api/sessions` — список бесед
  - `POST /api/sessions` — создать беседу
  - `GET /api/sessions/:id/messages` — история (последние 100)
  - `POST /api/sessions/:id/chat` — SSE endpoint: сохранить сообщение, передать последние 20 в Groq, стримить ответ, сохранить ответ, вернуть chips в последнем SSE-событии `event: chips\ndata: [...]\n\n`
- [ ] `git commit -m "feat: chat SSE backend with Groq streaming and chips"`

---

## Task 5: Diary, Exercises, Resources Backend

**Files:**
- Create: `backend/internal/diary/handler.go`
- Create: `backend/internal/tools/handler.go`
- Create: `backend/internal/resources/handler.go`

- [ ] `diary/handler.go` — CRUD для diary_entries, фильтрация по user_id из JWT ctx
- [ ] `tools/handler.go`:
  - `GET /api/exercises` — список (с фильтром type?)
  - `GET /api/exercises/:slug` — детали
  - `POST /api/exercises/:slug/complete` — INSERT в user_exercises
- [ ] `resources/handler.go` — `GET /api/resources/search?q=`:
  ```go
  // 1. Проверить resources WHERE user_id=$1 AND query=$2
  // 2. Если есть — вернуть results_json
  // 3. Если нет — запрос к Tavily API, сохранить в resources, вернуть
  ```
- [ ] `GET /api/progress` — mood stats (avg по дням), stреaks (consecutive diary/exercise days), простые badges (first_diary, first_exercise, 7_day_streak)
- [ ] `git commit -m "feat: diary, exercises, resources, progress backends"`

---

## Task 6: Backend Wiring (main.go)

**Files:**
- Modify: `backend/cmd/server/main.go`

- [ ] Собрать chi router, подключить все handlers, middleware:
  ```go
  r := chi.NewRouter()
  r.Use(middleware.Logger, middleware.Recoverer, cors.Handler(...))
  r.Post("/auth/register", authH.Register)
  r.Post("/auth/login", authH.Login)
  r.Post("/auth/refresh", authH.Refresh)
  r.Post("/auth/logout", authH.Logout)
  r.Group(func(r chi.Router) {
      r.Use(auth.Middleware(cfg.JWTSecret))
      r.Get("/api/sessions", chatH.ListSessions)
      // ... все остальные роуты
  })
  ```
- [ ] Загрузка конфига из env: `DATABASE_URL`, `REDIS_URL`, `GROQ_API_KEY`, `TAVILY_API_KEY`, `JWT_SECRET`
- [ ] `go build ./cmd/server && ./server` — убедиться что стартует
- [ ] `git commit -m "feat: wire up all routes in main.go"`

---

## Task 7: Frontend — Auth + Layout

**Files:**
- Create: `frontend/src/pages/LoginPage.tsx`
- Create: `frontend/src/pages/RegisterPage.tsx`
- Create: `frontend/src/components/Sidebar/Sidebar.tsx`
- Create: `frontend/src/store/authStore.ts`
- Create: `frontend/src/i18n/ru.json`, `frontend/src/i18n/en.json`

- [ ] `authStore.ts` (Zustand): `{ user, login, logout, register }`; axios interceptor для 401 → refresh
- [ ] LoginPage / RegisterPage: форма email + password, вызов API
- [ ] `Sidebar.tsx` с Framer Motion расширением:
  ```tsx
  const sidebarVariants = {
    collapsed: { width: 56 },
    expanded: { width: 200 },
  }
  // onHoverStart → expanded, onHoverEnd → collapsed
  // transition: { duration: 0.2, ease: "easeOut" }
  ```
- [ ] Секции в сайдбаре: Чат, Дневник, Упражнения, Библиотека, Прогресс + иконки (lucide-react)
- [ ] React Router: `/login`, `/register`, `/` (app layout с sidebar)
- [ ] `git commit -m "feat: frontend auth and sidebar layout"`

---

## Task 8: Frontend — Chat

**Files:**
- Create: `frontend/src/components/Chat/ChatPage.tsx`
- Create: `frontend/src/components/Chat/MessageBubble.tsx`
- Create: `frontend/src/components/Chat/ChipSuggestions.tsx`
- Create: `frontend/src/hooks/useSSEChat.ts`

- [ ] `useSSEChat.ts` — `EventSource` к `/api/sessions/:id/chat` (POST через fetch с `ReadableStream`):
  ```ts
  // fetch с body, читать reader.read() построчно
  // парсить "data: text" → append к currentMessage
  // парсить "event: chips\ndata: [...]" → setChips
  ```
- [ ] `MessageBubble.tsx` с Framer Motion `initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}`
- [ ] `ChipSuggestions.tsx` — stagger fade-in для каждого chip:
  ```tsx
  chips.map((chip, i) => (
    <motion.button key={chip}
      initial={{ opacity:0, y:4 }}
      animate={{ opacity:1, y:0 }}
      transition={{ delay: i * 0.05 }}
    >{chip}</motion.button>
  ))
  ```
- [ ] Панель бесед (левая, рядом с сайдбаром): список + "＋ Новая беседа"
- [ ] `git commit -m "feat: frontend chat with SSE streaming and chips"`

---

## Task 9: Frontend — Diary, Exercises, Library, Progress

**Files:**
- Create: `frontend/src/components/Diary/DiaryPage.tsx`
- Create: `frontend/src/components/Exercises/ExercisesPage.tsx`
- Create: `frontend/src/components/Library/LibraryPage.tsx`
- Create: `frontend/src/components/Progress/ProgressPage.tsx`

- [ ] `DiaryPage`: форма (mood slider 1–10, textarea, tags input), список записей, фильтр по дате
- [ ] `ExercisesPage`: карточки упражнений по типу, детальный вид с пошаговым таймером:
  ```tsx
  // Таймер: useEffect с setInterval, отсчёт duration_sec → 0
  // Кнопка "Отметить выполненным" → POST /api/exercises/:slug/complete
  ```
- [ ] `LibraryPage`: поисковая строка → GET /api/resources/search?q=, карточки результатов; отдельная секция с seed-контентом (пре-загрузка GET /api/exercises)
- [ ] `ProgressPage`: график настроения (recharts или простой SVG), стрики, badges
- [ ] `git commit -m "feat: diary, exercises, library, progress pages"`

---

## Task 10: Темы и i18n

**Files:**
- Create: `frontend/src/themes/dark.ts`, `frontend/src/themes/light.ts`
- Create: `frontend/src/i18n/ru.json`, `frontend/src/i18n/en.json`
- Modify: `frontend/src/store/authStore.ts` — добавить theme, lang

- [ ] Тёмная тема CSS variables:
  ```ts
  // dark.ts
  export const dark = {
    '--bg-primary': '#0a0e1a',
    '--bg-secondary': '#0d1b2e',
    '--accent': '#6366f1',
    '--accent-hover': '#818cf8',
  }
  ```
- [ ] Светлая тема:
  ```ts
  // light.ts
  export const light = {
    '--bg-primary': '#fdf6f0',
    '--bg-secondary': '#fce7d8',
    '--accent': '#8b5cf6',
    '--accent-hover': '#a78bfa',
  }
  ```
- [ ] `i18next` init с `ru.json` / `en.json`, язык из `user.lang`
- [ ] Переключатель темы и языка в настройках профиля → PUT /api/user
- [ ] `git commit -m "feat: themes and i18n"`

---

## Task 11: Финальная полировка

- [ ] Cross-fade переходы между разделами: `<AnimatePresence>` + `motion.div key={location.pathname}`
- [ ] Inter шрифт: `@import` в `index.css`
- [ ] Frosted glass эффект для карточек в тёмной теме: `backdrop-filter: blur(12px)` + `background: rgba(13,27,46,0.7)`
- [ ] Rate limiting на бэкенде (chi middleware + Redis): 100 req/min per user
- [ ] `.env.example` с необходимыми переменными
- [ ] `README.md` с инструкцией запуска
- [ ] `git commit -m "feat: final polish, rate limiting, docs"`
