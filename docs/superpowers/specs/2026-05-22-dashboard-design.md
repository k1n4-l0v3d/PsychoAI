# Dashboard — Design Spec
Date: 2026-05-22

## Overview

A new home screen (`/`) that gives the user a compact, single-screen overview of their activity. It replaces whatever is currently at the root route (or adds a new route). The page is read-only — all interactions navigate to existing sections or trigger existing modals (exercise timer, diary form, new chat).

## Layout

Vertical stack, full-width, padding 28px 32px (matches `.page`):

```
┌─────────────────────────────────────────────────┐
│ Greeting + streak badge                          │
├──────────┬──────────┬──────────────────────────┤
│ Mood avg │ Exercises│ Diary entries             │
│  (chart) │ (dots)   │ (last date)              │
├──────────┴──────────┴──────────────────────────┤
│ Recent sessions (flex: 1)  │ Quick start (200px)│
└────────────────────────────┴───────────────────┘
```

All blocks are cards (`border-radius: 10px`, dark background, subtle border) consistent with the existing design system.

## Sections

### 1. Greeting bar
- Left: greeting based on current hour + today's date formatted as "День недели, D месяц"
  - 5–11 → "Доброе утро 👋"
  - 12–17 → "Добрый день 👋"
  - 18–22 → "Добрый вечер 👋"
  - 23–4 → "Доброй ночи 👋"
- Right: streak badge — "🔥 N дней подряд" (from `/api/progress`). Hidden if streak = 0.

### 2. Stat cards (3 columns)
All data fetched from a single `GET /api/progress` call (endpoint already exists).

| Card | Value | Secondary |
|------|-------|-----------|
| Настроение / неделя | avg mood (1 decimal) /10 | Mini bar chart — last 7 days mood values |
| Упражнений выполнено | total count | "+N за эту неделю" (last 7 days count) |
| Записей в дневнике | total count | "Последняя: сегодня" / "вчера" / "N дней назад" (diff in calendar days); "Ещё нет" if null |

If no data yet (new user), cards show "–" with a hint "Ещё нет данных".

### 3. Recent sessions
- Fetches `GET /api/sessions` (already exists), shows top 3.
- Each row: session title + created_at formatted as "Сегодня HH:mm / Вчера HH:mm / DD MMM".
- Click → navigate to `/chat` with that session pre-selected (via URL param or state).
- Bottom of block: dashed button "＋ Начать новую беседу" → creates a session and navigates to `/chat`.

### 4. Quick start panel (fixed 200px wide)
Vertical list of action buttons. Each click triggers the same logic already used in ChatPage:
- 🧘 Дыхание 4-7-8 → opens `ExerciseTimer` modal (fetch slug `breathing-478`)
- 🧠 КПТ-техника → opens `ExerciseTimer` modal (slug `cbt-thought-record`)
- 🌙 Медитация → opens `ExerciseTimer` modal (slug `sleep-meditation`)
- 📔 Записать в дневник → opens `DiaryEntryModal` (empty initial text)
- 📚 Найти статьи → navigates to `/library`

`ExerciseTimer` and `DiaryEntryModal` are already built — reuse them as-is.

## Data

Single page load fetches in parallel:
- `GET /api/progress` — mood avg, exercise count, streak (already exists)
- `GET /api/sessions` — last 3 sessions
- `GET /api/diary?page=1` — to count entries and get last entry date

The progress endpoint likely already returns enough; check its response shape before adding fields.

## Backend changes

Check `GET /api/progress` response. If it doesn't include:
- `mood_avg_week` (float)
- `exercises_week` (int — exercises completed in last 7 days)
- `diary_count` (int — total entries)
- `diary_last_at` (timestamp or null)
- `streak` (int — consecutive days with at least one activity)

…add the missing fields. No new endpoint needed.

## Frontend

New file: `src/components/Dashboard/DashboardPage.tsx`

Reuses:
- `ExerciseTimer` from `src/components/Exercises/ExerciseTimer.tsx`
- `DiaryEntryModal` from `src/components/Chat/DiaryEntryModal.tsx`
- `api` from `src/api/client.ts`

New route `/` added to the router. The existing default route (if any) is replaced.
Sidebar nav gets a new item: house icon → `/` (label "Главная" / "Home").

## Navigation to chat with session

`/chat` currently selects the first session on mount. To support "open specific session", pass it via React Router state: `navigate('/chat', { state: { sessionId: id } })`. ChatPage reads `location.state?.sessionId` on mount and selects that session if present.

## CSS

New classes following existing conventions (no CSS frameworks):
- `.dashboard-grid` — 3-column stat row
- `.stat-card` — individual metric card
- `.stat-value` — large number
- `.stat-label` — small uppercase label
- `.mini-chart` — bar chart row inside mood card
- `.sessions-card` — the recent sessions block
- `.session-row` — individual session link
- `.quickstart-card` — the right panel
- `.quickstart-btn` — colored action button

## Out of scope

- Editable widgets or drag-to-reorder
- Push notifications or reminders
- Charts library (use CSS bars only)
- Mobile/responsive layout
