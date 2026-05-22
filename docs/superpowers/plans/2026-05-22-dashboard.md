# Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a home dashboard at `/` showing mood stats, recent chat sessions, and quick-launch buttons for exercises and diary.

**Architecture:** Five tasks in order — extend the backend progress endpoint with missing fields, update ChatPage to support session pre-selection via router state, build DashboardPage reusing existing ExerciseTimer/DiaryEntryModal, add CSS, then wire routing + sidebar + i18n.

**Tech Stack:** Go (backend), React + TypeScript + Vite, React Router v6, Framer Motion, Lucide React, existing index.css design system.

---

### Task 1: Extend `/api/progress` with dashboard fields

**Files:**
- Modify: `backend/internal/progress/handler.go`

The current response is missing `mood_avg_week`, `exercises_week`, `diary_count`, `diary_last_at`. Add them.

- [ ] **Step 1: Add new fields to `ProgressData` struct**

In `backend/internal/progress/handler.go`, replace the existing `ProgressData` struct:

```go
type ProgressData struct {
	MoodChart      []DayMood  `json:"mood_chart"`
	MoodAvgWeek    float64    `json:"mood_avg_week"`
	DiaryStreak    int        `json:"diary_streak"`
	ExerciseStreak int        `json:"exercise_streak"`
	ExercisesCount int        `json:"exercises_count"`
	ExercisesWeek  int        `json:"exercises_week"`
	DiaryCount     int        `json:"diary_count"`
	DiaryLastAt    *time.Time `json:"diary_last_at"`
	Badges         []Badge    `json:"badges"`
}
```

- [ ] **Step 2: Query new fields in `Get` handler**

In the `Get` method, after the `moodChart` loop and before the streak calculations, add:

```go
var moodAvgWeek float64
h.db.QueryRow(ctx,
    `SELECT COALESCE(AVG(mood), 0)::FLOAT8 FROM diary_entries
     WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '7 days'`,
    userID).Scan(&moodAvgWeek)

var exercisesWeek int
h.db.QueryRow(ctx,
    `SELECT COUNT(*) FROM user_exercises
     WHERE user_id = $1 AND completed_at >= NOW() - INTERVAL '7 days'`,
    userID).Scan(&exercisesWeek)

var diaryLastAt *time.Time
h.db.QueryRow(ctx,
    `SELECT MAX(created_at) FROM diary_entries WHERE user_id = $1`,
    userID).Scan(&diaryLastAt)
```

- [ ] **Step 3: Include new fields in `respondJSON` call**

Replace the final `respondJSON` call:

```go
respondJSON(w, ProgressData{
    MoodChart:      moodChart,
    MoodAvgWeek:    moodAvgWeek,
    DiaryStreak:    diaryStreak,
    ExerciseStreak: exerciseStreak,
    ExercisesCount: exerciseCount,
    ExercisesWeek:  exercisesWeek,
    DiaryCount:     diaryCount,
    DiaryLastAt:    diaryLastAt,
    Badges:         badges,
})
```

- [ ] **Step 4: Verify it compiles and responds correctly**

```bash
cd backend
go build ./...
```

Expected: no output (clean build).

Then kill and restart the backend:
```bash
# kill whatever is on 8080
lsof -ti :8080 | xargs kill -9 2>/dev/null; sleep 1
go run ./cmd/server/main.go &
sleep 2
# test with curl (replace TOKEN with a real JWT from browser devtools)
curl -s -H "Authorization: Bearer TOKEN" http://localhost:8080/api/progress | python3 -m json.tool
```

Expected: JSON with `mood_avg_week`, `exercises_week`, `diary_count`, `diary_last_at` fields present.

- [ ] **Step 5: Commit**

```bash
cd backend
git add internal/progress/handler.go
git commit -m "feat(progress): add mood_avg_week, exercises_week, diary_count, diary_last_at"
```

---

### Task 2: ChatPage — open specific session from router state

**Files:**
- Modify: `frontend/src/components/Chat/ChatPage.tsx`

When navigating to `/chat` with `{ state: { sessionId: id } }`, pre-select that session.

- [ ] **Step 1: Import `useLocation` in ChatPage**

At the top of `frontend/src/components/Chat/ChatPage.tsx`, add `useLocation` to the react-router-dom import:

```typescript
import { useNavigate, useLocation } from 'react-router-dom'
```

(Note: `useNavigate` is not currently imported — add both. Also add `useNavigate` if not already present, but do NOT add it if a `navigate` variable is already declared another way. Check the file first.)

Actually ChatPage doesn't use `useNavigate` — just add `useLocation`:

```typescript
import { AnimatePresence } from 'framer-motion'
import { useEffect, useState, useRef } from 'react'
import { useLocation } from 'react-router-dom'
// ... rest of imports unchanged
```

- [ ] **Step 2: Read `sessionId` from router state in the sessions load effect**

Replace the existing `useEffect` that loads sessions (the one with `api.get<Session[]>('/api/sessions')`):

```typescript
const location = useLocation()

useEffect(() => {
  api.get<Session[]>('/api/sessions').then(({ data }) => {
    setSessions(data)
    const targetId = (location.state as { sessionId?: string } | null)?.sessionId
    if (targetId && data.find((s) => s.id === targetId)) {
      loadSession(targetId)
    } else if (data.length > 0) {
      loadSession(data[0].id)
    }
  })
}, [])
```

- [ ] **Step 3: Type-check**

```bash
cd frontend
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Chat/ChatPage.tsx
git commit -m "feat(chat): support pre-selecting session via router state"
```

---

### Task 3: DashboardPage component

**Files:**
- Create: `frontend/src/components/Dashboard/DashboardPage.tsx`

- [ ] **Step 1: Create the file with helpers and types**

Create `frontend/src/components/Dashboard/DashboardPage.tsx`:

```typescript
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Plus } from 'lucide-react'
import api from '../../api/client'
import { useAuthStore } from '../../store/authStore'
import ExerciseTimer from '../Exercises/ExerciseTimer'
import DiaryEntryModal from '../Chat/DiaryEntryModal'

interface Session { id: string; title: string; created_at: string }
interface Exercise {
  id: string; slug: string; type: string; title_ru: string; title_en: string
  content: { steps: { ru: string; en: string }[]; cycles?: number; step_durations?: number[] }
  duration_sec: number
}
interface ProgressData {
  mood_avg_week: number
  exercises_count: number
  exercises_week: number
  diary_count: number
  diary_last_at: string | null
  exercise_streak: number
  diary_streak: number
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h >= 5 && h < 12) return 'Доброе утро 👋'
  if (h >= 12 && h < 18) return 'Добрый день 👋'
  if (h >= 18 && h < 23) return 'Добрый вечер 👋'
  return 'Доброй ночи 👋'
}

function formatToday(): string {
  const now = new Date()
  const days = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота']
  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря']
  return `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`
}

function formatSessionDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.setHours(0,0,0,0) - new Date(d).setHours(0,0,0,0)) / 86400000)
  if (diffDays === 0) return `Сегодня, ${d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}`
  if (diffDays === 1) return `Вчера, ${d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}`
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'short' })
}

function formatDiaryLast(iso: string | null): string {
  if (!iso) return 'Ещё нет'
  const diff = Math.floor((new Date().setHours(0,0,0,0) - new Date(iso).setHours(0,0,0,0)) / 86400000)
  if (diff === 0) return 'Сегодня'
  if (diff === 1) return 'Вчера'
  return `${diff} дней назад`
}

const QUICK_ACTIONS = [
  { label: '🧘 Дыхание 4-7-8', slug: 'breathing-478', color: '#6366f1' },
  { label: '🧠 КПТ-техника',   slug: 'cbt-thought-record', color: '#8b5cf6' },
  { label: '🌙 Медитация',     slug: 'sleep-meditation', color: '#06b6d4' },
]
```

- [ ] **Step 2: Add the component body**

Append to the same file:

```typescript
export default function DashboardPage() {
  const navigate = useNavigate()
  const lang = useAuthStore((s) => s.user?.lang || 'ru')
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeExercise, setActiveExercise] = useState<Exercise | null>(null)
  const [showDiary, setShowDiary] = useState(false)

  useEffect(() => {
    api.get<ProgressData>('/api/progress').then(({ data }) => setProgress(data))
    api.get<Session[]>('/api/sessions').then(({ data }) => setSessions(data.slice(0, 3)))
  }, [])

  const openExercise = async (slug: string) => {
    const { data } = await api.get<Exercise>(`/api/exercises/${slug}`)
    setActiveExercise(data)
  }

  const completeExercise = async () => {
    if (!activeExercise) return
    await api.post(`/api/exercises/${activeExercise.slug}/complete`)
    setActiveExercise(null)
  }

  const openNewChat = async () => {
    const { data } = await api.post<Session>('/api/sessions')
    navigate('/chat', { state: { sessionId: data.id } })
  }

  const streak = Math.max(progress?.exercise_streak ?? 0, progress?.diary_streak ?? 0)

  return (
    <div className="dashboard">
      {/* Greeting */}
      <div className="dashboard-greeting">
        <div>
          <div className="dashboard-greeting-title">{getGreeting()}</div>
          <div className="dashboard-greeting-sub">{formatToday()}</div>
        </div>
        {streak > 0 && (
          <div className="dashboard-streak">🔥 {streak} {streak === 1 ? 'день' : streak < 5 ? 'дня' : 'дней'} подряд</div>
        )}
      </div>

      {/* Stat cards */}
      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-label">Настроение / неделя</div>
          <div className="stat-value">
            {progress?.mood_avg_week ? progress.mood_avg_week.toFixed(1) : '–'}
            <span className="stat-value-denom">/10</span>
          </div>
          <div className="stat-sub">средний балл за 7 дней</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Упражнений выполнено</div>
          <div className="stat-value">{progress?.exercises_count !== undefined ? progress.exercises_count : '–'}</div>
          <div className="stat-sub">+{progress?.exercises_week ?? 0} за эту неделю</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Записей в дневнике</div>
          <div className="stat-value">{progress?.diary_count !== undefined ? progress.diary_count : '–'}</div>
          <div className="stat-sub">Последняя: {formatDiaryLast(progress?.diary_last_at ?? null)}</div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="dashboard-bottom">
        {/* Sessions */}
        <div className="sessions-card">
          <div className="sessions-card-header">
            <span className="sessions-card-title">💬 Последние беседы</span>
            <button className="sessions-card-link" onClick={() => navigate('/chat')}>
              Все беседы →
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sessions.length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Бесед пока нет</p>
            )}
            {sessions.map((s) => (
              <div
                key={s.id}
                className="session-row"
                onClick={() => navigate('/chat', { state: { sessionId: s.id } })}
              >
                <div>
                  <div className="session-row-title">{s.title}</div>
                  <div className="session-row-date">{formatSessionDate(s.created_at)}</div>
                </div>
                <span className="session-row-arrow">›</span>
              </div>
            ))}
          </div>
          <button className="sessions-new-btn-dash" onClick={openNewChat}>
            <Plus size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
            Начать новую беседу
          </button>
        </div>

        {/* Quick start */}
        <div className="quickstart-card">
          <div className="quickstart-title">⚡ Быстрый старт</div>
          {QUICK_ACTIONS.map(({ label, slug, color }) => (
            <button
              key={slug}
              className="quickstart-btn"
              style={{ color }}
              onClick={() => openExercise(slug)}
            >
              {label}
            </button>
          ))}
          <button
            className="quickstart-btn"
            style={{ color: '#f59e0b' }}
            onClick={() => setShowDiary(true)}
          >
            📔 Записать в дневник
          </button>
          <button
            className="quickstart-btn"
            style={{ color: '#10b981' }}
            onClick={() => navigate('/library')}
          >
            📚 Найти статьи
          </button>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {activeExercise && (
          <ExerciseTimer
            exercise={activeExercise}
            lang={lang}
            onComplete={completeExercise}
            onClose={() => setActiveExercise(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showDiary && (
          <DiaryEntryModal
            initialText=""
            onSaved={() => setShowDiary(false)}
            onClose={() => setShowDiary(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

```bash
cd frontend
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Dashboard/DashboardPage.tsx
git commit -m "feat(dashboard): add DashboardPage component"
```

---

### Task 4: CSS for dashboard

**Files:**
- Modify: `frontend/src/index.css`

Add after the `.page { ... }` rule (around line 79):

- [ ] **Step 1: Add dashboard CSS classes**

```css
/* Dashboard */
.dashboard { padding: 28px 32px; display: flex; flex-direction: column; gap: 20px; max-width: 1000px }
.dashboard-greeting { display: flex; align-items: center; justify-content: space-between }
.dashboard-greeting-title { font-size: 22px; font-weight: 700; color: var(--text-primary) }
.dashboard-greeting-sub { font-size: 13px; color: var(--text-muted); margin-top: 3px }
.dashboard-streak { background: var(--accent-subtle); border: 1px solid var(--accent); border-radius: 8px; padding: 6px 14px; color: var(--accent); font-size: 13px; font-weight: 500 }
.dashboard-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px }
.stat-card { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 10px; padding: 16px; display: flex; flex-direction: column; gap: 4px }
.stat-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em }
.stat-value { font-size: 30px; font-weight: 700; color: var(--text-primary); line-height: 1.1 }
.stat-value-denom { font-size: 14px; color: var(--text-muted); font-weight: 400 }
.stat-sub { font-size: 12px; color: var(--text-secondary) }
.dashboard-bottom { display: grid; grid-template-columns: 1fr 210px; gap: 12px; align-items: start }
.sessions-card { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 10px; padding: 16px; display: flex; flex-direction: column; gap: 10px }
.sessions-card-header { display: flex; align-items: center; justify-content: space-between }
.sessions-card-title { font-size: 14px; font-weight: 600; color: var(--text-primary) }
.sessions-card-link { font-size: 12px; color: var(--accent); cursor: pointer; background: none; border: none; font-family: inherit; padding: 0 }
.sessions-card-link:hover { text-decoration: underline }
.session-row { display: flex; align-items: center; justify-content: space-between; background: var(--bg-primary); border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; cursor: pointer; transition: border-color 0.15s }
.session-row:hover { border-color: var(--accent) }
.session-row-title { font-size: 13px; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 300px }
.session-row-date { font-size: 11px; color: var(--text-muted); margin-top: 2px }
.session-row-arrow { color: var(--accent); font-size: 20px; flex-shrink: 0 }
.sessions-new-btn-dash { background: none; border: 1px dashed var(--accent); border-radius: 8px; padding: 10px; text-align: center; color: var(--accent); font-size: 13px; cursor: pointer; font-family: inherit; transition: background 0.15s; display: flex; align-items: center; justify-content: center; gap: 4px }
.sessions-new-btn-dash:hover { background: var(--accent-subtle) }
.quickstart-card { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 10px; padding: 16px; display: flex; flex-direction: column; gap: 8px }
.quickstart-title { font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 2px }
.quickstart-btn { background: none; border: 1px solid var(--border); border-radius: 8px; padding: 9px 12px; font-size: 13px; cursor: pointer; font-family: inherit; text-align: left; transition: border-color 0.15s, background 0.15s; width: 100% }
.quickstart-btn:hover { border-color: currentColor; background: var(--accent-subtle) }
```

- [ ] **Step 2: Verify page still looks fine**

Open http://localhost:5173 in the browser. Navigate around existing pages — make sure nothing broke visually.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat(dashboard): add dashboard CSS"
```

---

### Task 5: Wire routing, sidebar, and i18n

**Files:**
- Modify: `frontend/src/pages/AppLayout.tsx`
- Modify: `frontend/src/components/Sidebar/Sidebar.tsx`
- Modify: `frontend/src/i18n/ru.json`
- Modify: `frontend/src/i18n/en.json`

- [ ] **Step 1: Add i18n keys**

In `frontend/src/i18n/ru.json`, add inside `"nav"`:

```json
"home": "Главная",
"homeDesc": "Обзор"
```

In `frontend/src/i18n/en.json`, add inside `"nav"`:

```json
"home": "Home",
"homeDesc": "Overview"
```

- [ ] **Step 2: Add route in AppLayout**

In `frontend/src/pages/AppLayout.tsx`:

1. Import `DashboardPage`:
```typescript
import DashboardPage from '../components/Dashboard/DashboardPage'
```

2. Replace the redirect route:
```typescript
// Remove this:
<Route path="/" element={<Navigate to="/chat" replace />} />
// Add this:
<Route path="/" element={<DashboardPage />} />
```

Also remove the `Navigate` import if it's no longer used anywhere else in the file (check — it was only used for that one route).

- [ ] **Step 3: Add sidebar nav item**

In `frontend/src/components/Sidebar/Sidebar.tsx`:

1. Add `Home` to the lucide import:
```typescript
import {
  Home, MessageCircle, BookOpen, Dumbbell, Library, TrendingUp, Settings, LogOut, Pin, PinOff
} from 'lucide-react'
```

2. Add home to `NAV_ITEMS` as the first entry:
```typescript
const NAV_ITEMS = [
  { to: '/', icon: Home, key: 'home' },
  { to: '/chat', icon: MessageCircle, key: 'chat' },
  { to: '/diary', icon: BookOpen, key: 'diary' },
  { to: '/exercises', icon: Dumbbell, key: 'exercises' },
  { to: '/library', icon: Library, key: 'library' },
  { to: '/progress', icon: TrendingUp, key: 'progress' },
]
```

Note: for the home NavLink, `isActive` from React Router will match `/` for ALL routes because `/` is a prefix of everything. Fix this by using `end` prop:

```tsx
{NAV_ITEMS.map(({ to, icon: Icon, key }) => (
  <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) =>
    `sidebar-item ${isActive ? 'sidebar-item--active' : ''}`
  }>
```

- [ ] **Step 4: Type-check**

```bash
cd frontend
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 5: Smoke test in browser**

1. Open http://localhost:5173 — should land on the dashboard (not chat)
2. Sidebar should show "Главная" as first item, active on `/`
3. Click a session row → should open `/chat` with that session selected
4. Click "Начать новую беседу" → should open `/chat` with a fresh session
5. Click a quick-start exercise → ExerciseTimer modal should open
6. Click "📔 Записать в дневник" → DiaryEntryModal should open
7. Click "📚 Найти статьи" → should navigate to `/library`

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/AppLayout.tsx \
        frontend/src/components/Sidebar/Sidebar.tsx \
        frontend/src/i18n/ru.json \
        frontend/src/i18n/en.json
git commit -m "feat(dashboard): wire routing, sidebar nav item, i18n"
```
