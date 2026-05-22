# PsychAI — Дизайн-спецификация

**Дата:** 2026-05-22  
**Стек:** Go (бэкенд) · React + Framer Motion (фронт) · Groq LLM · Tavily Search  
**Статус:** Approved

---

## 1. Назначение

Веб-сервис психологической помощи с ИИ-ассистентом. Целевая аудитория — любые пользователи, испытывающие стресс, тревогу или эмоциональные трудности. Сервис не заменяет профессиональную терапию и при кризисных сигналах явно рекомендует обратиться к специалисту.

---

## 2. Функциональность

### 2.1 ИИ-чат (главный экран)
- Стриминг ответов через SSE (Server-Sent Events)
- История бесед: каждая сессия хранится отдельно, можно создать новую или открыть старую
- Адаптивная роль ИИ: начинает как эмпатичный слушатель, по ходу разговора предлагает конкретные инструменты
- Chips-предложения: после ответа ИИ появляются кнопки-переходы (например, «🧘 Дыхание 4-7-8», «📔 Записать в дневник»)
- Контекст: в каждый запрос передаются последние 20 сообщений сессии

### 2.2 Дневник настроения
- Запись: оценка настроения 1–10, текст, теги (произвольные)
- Просмотр: календарный вид + список записей
- CRUD: создание, редактирование, удаление

### 2.3 Упражнения
- Типы: дыхательные техники, КПТ-упражнения, медитации с таймером, техники релаксации
- Контент хранится в БД в виде JSON (поддержка пошаговых инструкций)
- История выполненных упражнений

### 2.4 Библиотека
- Кураторский контент (статьи, техники) — пре-сидированные записи в БД, добавляются при инициализации через seed-миграцию
- Поиск внешних ресурсов (статьи, книги) через Tavily API
- Результаты Tavily кэшируются в БД по ключу `(user_id, query)` — повторный запрос с той же строкой возвращает кэш без обращения к API

### 2.5 Трекер прогресса
- График настроения по дням/неделям/месяцам
- Стрики (дни подряд с записью в дневник или выполненным упражнением)
- Достижения (badges)

### 2.6 Авторизация
- Регистрация и вход по email + пароль
- JWT access token (15 мин) + refresh token (30 дней) в httpOnly cookie
- Все роуты кроме `/auth/*` и `/` требуют валидного JWT

### 2.7 Интернационализация
- Языки: русский и английский
- Переключатель в сайдбаре и в настройках
- Язык по умолчанию — из профиля пользователя

---

## 3. Архитектура

### 3.1 Обзор

```
React SPA (Vite + React + Framer Motion)
        │
        │ REST API + SSE
        ▼
Go HTTP Server (chi router)
 ├── auth      — JWT, bcrypt, refresh tokens
 ├── chat      — SSE стриминг, Groq API, chips-анализ
 ├── diary     — CRUD записей настроения
 ├── tools     — упражнения, медитации
 ├── resources — Tavily поиск + кэш
 └── i18n      — переводы
        │
   ┌────┴────┬──────────┬──────────┐
   ▼         ▼          ▼          ▼
PostgreSQL  Redis    Groq API  Tavily API
```

### 3.2 Go-бэкенд — модули

| Модуль | Ответственность |
|--------|----------------|
| `auth` | Регистрация, вход, JWT, refresh |
| `chat` | SSE endpoint, Groq client, chips-анализ ответа |
| `diary` | CRUD diary_entries, mood logs |
| `tools` | Список и детали упражнений, история выполнения |
| `resources` | Tavily запросы, кэширование в БД |
| `i18n` | Хранение и раздача переводов |

### 3.3 Хранилища

- **PostgreSQL** — основная БД (пользователи, сообщения, дневник, упражнения, кэш ресурсов)
- **Redis** — сессии refresh-токенов, rate limiting

### 3.4 Внешние API

- **Groq API** — модель `llama-3.3-70b-versatile`, стриминг через SSE
- **Tavily Search API** — поиск статей и книг по психологии

---

## 4. Модели данных

```sql
users
  id UUID PK, email TEXT UNIQUE, password_hash TEXT,
  lang TEXT DEFAULT 'ru', theme TEXT DEFAULT 'dark', created_at TIMESTAMPTZ

chat_sessions
  id UUID PK, user_id UUID FK, title TEXT, created_at TIMESTAMPTZ

messages
  id UUID PK, session_id UUID FK, role TEXT (user|assistant),
  content TEXT, created_at TIMESTAMPTZ

diary_entries
  id UUID PK, user_id UUID FK, mood SMALLINT (1-10),
  text TEXT, tags TEXT[], created_at TIMESTAMPTZ

exercises
  id UUID PK, slug TEXT UNIQUE, type TEXT (breathing|cbt|meditation|relaxation),
  title_ru TEXT, title_en TEXT, content_json JSONB, duration_sec INT

user_exercises
  id UUID PK, user_id UUID FK, exercise_id UUID FK, completed_at TIMESTAMPTZ

resources
  id UUID PK, user_id UUID FK, query TEXT,
  results_json JSONB, created_at TIMESTAMPTZ
```

---

## 5. ИИ-поведение

### Системный промпт (краткое описание)
- Роль: эмпатичный психологический ассистент
- Запреты: не ставить диагнозы, не давать медицинских рекомендаций
- При кризисных сигналах (суицидальные мысли, острый психоз): обязательная рекомендация обратиться к специалисту или на горячую линию
- Язык ответа: соответствует языку пользователя (ru/en)

### Chips-анализ
Go-бэкенд проверяет текст ответа на ключевые темы и добавляет chips в JSON-ответ:

| Тема | Chip |
|------|------|
| тревога, паника | 🧘 Дыхание 4-7-8 |
| сон, усталость | 🧘 Медитация перед сном |
| негативные мысли | 🧘 КПТ-техника |
| любая тема | 📔 Записать в дневник |
| запрос ресурсов | 📚 Найти статьи |

---

## 6. Дизайн и UX

### 6.1 Темы
- **Тёмная (Спокойная ночь)**: фон `#0a0e1a`/`#0d1b2e`, акцент индиго `#6366f1`/`#818cf8`, frosted glass эффекты
- **Светлая (Мягкий рассвет)**: фон `#fdf6f0`/`#fce7d8`/`#f5f0ff`, акцент фиолетовый `#8b5cf6`/`#a78bfa`
- Переключение темы — в профиле/настройках, сохраняется в `users.theme`

### 6.2 Навигация
- **Сайдбар** (левая панель): иконки разделов шириной 56px по умолчанию
- При наведении плавно расширяется до 200px (Framer Motion, ~200ms ease-out)
- В развёрнутом состоянии: иконка + название раздела + короткое описание
- Активный раздел: вертикальная полоска-акцент слева + подсветка фона
- Вторая панель (только для чата): список бесед с кнопкой «+ Новая беседа»

### 6.3 Анимации (Framer Motion)
- Расширение сайдбара: `width` 56px → 200px, ease-out 200ms
- Fade-in текста в сайдбаре: opacity 0→1 + translateX(-4px→0), задержка 50ms
- Появление чип-предложений: stagger fade-in снизу вверх
- Пузыри чата: fade-in + slide-up при появлении
- Переходы между разделами: cross-fade 150ms
- Все анимации — мягкие, ненавязчивые, не отвлекающие

### 6.4 Типографика
- Шрифт: Inter (latin + cyrillic)
- Размеры: 11–14px для UI, 15–16px для контента чата

---

## 7. API endpoints (основные)

```
POST /auth/register          — регистрация
POST /auth/login             — вход, возвращает JWT + refresh
POST /auth/refresh           — обновление access token
POST /auth/logout            — инвалидация refresh token

GET  /api/sessions           — список бесед пользователя
POST /api/sessions           — создать новую беседу
GET  /api/sessions/:id/messages  — история сообщений
POST /api/sessions/:id/chat  — SSE: отправить сообщение, получить стриминг

GET  /api/diary              — список записей (с пагинацией)
POST /api/diary              — создать запись
PUT  /api/diary/:id          — обновить запись
DELETE /api/diary/:id        — удалить запись

GET  /api/exercises          — список упражнений
GET  /api/exercises/:slug    — детали упражнения
POST /api/exercises/:slug/complete — отметить выполненным

GET  /api/resources/search?q=... — поиск через Tavily (с кэшем)

GET  /api/progress           — данные для трекера прогресса

GET  /api/user               — профиль пользователя
PUT  /api/user               — обновить профиль (lang, theme)
```

---

## 8. Структура проекта

```
/
├── backend/
│   ├── cmd/server/main.go
│   ├── internal/
│   │   ├── auth/
│   │   ├── chat/
│   │   ├── diary/
│   │   ├── tools/
│   │   ├── resources/
│   │   └── i18n/        — системные промпты на ru/en для Groq
│   ├── db/migrations/
│   └── go.mod
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Sidebar/
│   │   │   ├── Chat/
│   │   │   ├── Diary/
│   │   │   ├── Exercises/
│   │   │   ├── Library/
│   │   │   └── Progress/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── store/       (Zustand)
│   │   ├── i18n/        (react-i18next)
│   │   └── themes/
│   ├── index.html
│   └── vite.config.ts
└── docs/
    └── superpowers/specs/
```

---

## 9. Технологический стек

| Слой | Технология |
|------|-----------|
| Frontend фреймворк | React 18 + TypeScript |
| Сборщик | Vite |
| Анимации | Framer Motion |
| Стейт | Zustand |
| HTTP-клиент | Axios + SSE через `EventSource` |
| i18n (фронт) | react-i18next — переводы UI бандлятся с фронтом (`/src/i18n/ru.json`, `en.json`) |
| Backend язык | Go 1.22+ |
| HTTP роутер | chi |
| ORM / SQL | sqlc + pgx |
| Миграции | golang-migrate |
| Auth | JWT (golang-jwt) + bcrypt |
| БД | PostgreSQL 16 |
| Кэш / сессии | Redis 7 |
| LLM | Groq API (llama-3.3-70b-versatile) |
| Поиск ресурсов | Tavily Search API |
