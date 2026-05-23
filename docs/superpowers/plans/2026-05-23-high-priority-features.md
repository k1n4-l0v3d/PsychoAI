# High Priority Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить трекер настроения на дашборд, тепловую карту настроения в прогресс, и кризисную поддержку в дашборд + сайдбар.

**Architecture:** Новая таблица `mood_entries` с уникальным ограничением по (user_id, entry_date) для upsert одной записи в день. Backend добавляет три эндпоинта в новый пакет `internal/mood`. Frontend — три независимых React-компонента.

**Tech Stack:** Go 1.26, chi router, pgx/v5 (PostgreSQL), React 18 + TypeScript, axios, framer-motion, Vite

---

### Task 1: DB Migration — таблица mood_entries

**Files:**
- Create: `backend/db/migrations/003_mood_entries.up.sql`
- Create: `backend/db/migrations/003_mood_entries.down.sql`

- [ ] **Step 1: Создать up-миграцию**

```sql
-- backend/db/migrations/003_mood_entries.up.sql
CREATE TABLE mood_entries (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score      SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 10),
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, entry_date)
);

CREATE INDEX idx_mood_entries_user_date ON mood_entries(user_id, entry_date);
```

- [ ] **Step 2: Создать down-миграцию**

```sql
-- backend/db/migrations/003_mood_entries.down.sql
DROP TABLE IF EXISTS mood_entries;
```

- [ ] **Step 3: Применить миграцию вручную**

```bash
cd backend
psql $DATABASE_URL -f db/migrations/003_mood_entries.up.sql
```

Ожидаемый вывод: `CREATE TABLE` и `CREATE INDEX`

- [ ] **Step 4: Проверить что таблица создана**

```bash
psql $DATABASE_URL -c "\d mood_entries"
```

Ожидаемый вывод: таблица с колонками id, user_id, score, entry_date, created_at и UNIQUE constraint.

- [ ] **Step 5: Commit**

```bash
git add backend/db/migrations/003_mood_entries.up.sql backend/db/migrations/003_mood_entries.down.sql
git commit -m "feat: add mood_entries migration"
```

---

### Task 2: Backend — mood handler

**Files:**
- Create: `backend/internal/mood/handler.go`

- [ ] **Step 1: Создать файл handler.go**

```go
// backend/internal/mood/handler.go
package mood

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"psychai/internal/auth"
)

type Handler struct {
	db *pgxpool.Pool
}

func NewHandler(db *pgxpool.Pool) *Handler {
	return &Handler{db: db}
}

type MoodEntry struct {
	ID        string    `json:"id"`
	Score     int       `json:"score"`
	CreatedAt time.Time `json:"created_at"`
}

type CalendarDay struct {
	Date  string `json:"date"`
	Score int    `json:"score"`
}

// POST /api/mood — upsert mood for today
func (h *Handler) Upsert(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r)
	var req struct {
		Score int `json:"score"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request", http.StatusBadRequest)
		return
	}
	if req.Score < 1 || req.Score > 10 {
		jsonError(w, "score must be 1-10", http.StatusBadRequest)
		return
	}

	var e MoodEntry
	err := h.db.QueryRow(r.Context(),
		`INSERT INTO mood_entries (user_id, score, entry_date)
		 VALUES ($1, $2, CURRENT_DATE)
		 ON CONFLICT (user_id, entry_date)
		 DO UPDATE SET score = EXCLUDED.score, created_at = NOW()
		 RETURNING id::text, score, created_at`,
		userID, req.Score,
	).Scan(&e.ID, &e.Score, &e.CreatedAt)
	if err != nil {
		jsonError(w, "db error", http.StatusInternalServerError)
		return
	}
	respondJSON(w, e)
}

// GET /api/mood/today — today's entry or null
func (h *Handler) Today(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r)
	var e MoodEntry
	err := h.db.QueryRow(r.Context(),
		`SELECT id::text, score, created_at FROM mood_entries
		 WHERE user_id = $1 AND entry_date = CURRENT_DATE`,
		userID,
	).Scan(&e.ID, &e.Score, &e.CreatedAt)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte("null"))
		return
	}
	respondJSON(w, e)
}

// GET /api/mood/calendar?month=2025-05
func (h *Handler) Calendar(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r)
	month := r.URL.Query().Get("month")
	if month == "" {
		month = time.Now().Format("2006-01")
	}

	rows, err := h.db.Query(r.Context(),
		`SELECT entry_date::TEXT, score FROM mood_entries
		 WHERE user_id = $1 AND TO_CHAR(entry_date, 'YYYY-MM') = $2
		 ORDER BY entry_date ASC`,
		userID, month,
	)
	if err != nil {
		jsonError(w, "db error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var days []CalendarDay
	for rows.Next() {
		var d CalendarDay
		rows.Scan(&d.Date, &d.Score)
		days = append(days, d)
	}
	if days == nil {
		days = []CalendarDay{}
	}
	respondJSON(w, days)
}

func respondJSON(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

func jsonError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
```

- [ ] **Step 2: Скомпилировать**

```bash
cd backend && go build ./...
```

Ожидаемый вывод: нет ошибок.

- [ ] **Step 3: Commit**

```bash
git add backend/internal/mood/handler.go
git commit -m "feat: add mood handler (upsert, today, calendar)"
```

---

### Task 3: Backend — регистрация маршрутов

**Files:**
- Modify: `backend/cmd/server/main.go`

- [ ] **Step 1: Добавить импорт пакета mood**

В секцию импортов `main.go` добавить:

```go
"psychai/internal/mood"
```

Полный блок импортов становится:
```go
import (
	"context"
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"

	"psychai/internal/auth"
	"psychai/internal/chat"
	"psychai/internal/diary"
	"psychai/internal/mood"
	"psychai/internal/progress"
	"psychai/internal/resources"
	"psychai/internal/tools"
)
```

- [ ] **Step 2: Создать handler и зарегистрировать маршруты**

После строки `progressHandler := progress.NewHandler(db)` добавить:
```go
moodHandler := mood.NewHandler(db)
```

В защищённой группе маршрутов (после `r.Get("/api/progress", progressHandler.Get)`) добавить:
```go
r.Post("/api/mood", moodHandler.Upsert)
r.Get("/api/mood/today", moodHandler.Today)
r.Get("/api/mood/calendar", moodHandler.Calendar)
```

- [ ] **Step 3: Скомпилировать и запустить**

```bash
cd backend && go build ./... && echo "OK"
```

Ожидаемый вывод: `OK`

- [ ] **Step 4: Проверить эндпоинты вручную** (нужен валидный JWT в куке)

```bash
# Upsert
curl -s -X POST http://localhost:8080/api/mood \
  -H "Content-Type: application/json" \
  -b "session=<token>" \
  -d '{"score":8}' | jq .

# Today
curl -s http://localhost:8080/api/mood/today -b "session=<token>" | jq .

# Calendar
curl -s "http://localhost:8080/api/mood/calendar?month=2026-05" -b "session=<token>" | jq .
```

- [ ] **Step 5: Commit**

```bash
git add backend/cmd/server/main.go
git commit -m "feat: register mood routes in main"
```

---

### Task 4: Frontend CSS — стили для новых компонентов

**Files:**
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Добавить стили в конец index.css**

```css
/* Mood Check-In */
.mood-checkin { margin-bottom: 0 }
.mood-checkin-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 10px }
.mood-checkin-row { display: flex; justify-content: space-around }
.mood-btn { background: none; border: 1px solid transparent; cursor: pointer; padding: 8px 12px; border-radius: 10px; transition: background 0.15s, border-color 0.15s; display: flex; flex-direction: column; align-items: center; gap: 4px; font-family: inherit }
.mood-btn:hover { background: var(--accent-subtle) }
.mood-btn--active { background: var(--accent-subtle); border-color: var(--accent) }
.mood-btn:disabled { opacity: 0.5; cursor: not-allowed }
.mood-emoji { font-size: 26px; line-height: 1 }
.mood-label { font-size: 10px; color: var(--text-secondary) }
.mood-btn--active .mood-label { color: var(--accent) }

/* Crisis Support */
.crisis-card { border-color: rgba(239, 68, 68, 0.25) !important }
.crisis-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px }
.crisis-dot { width: 8px; height: 8px; background: #ef4444; border-radius: 50%; flex-shrink: 0 }
.crisis-title { font-size: 14px; font-weight: 600 }
.crisis-text { font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 12px }
.crisis-actions { display: flex; gap: 8px }
.crisis-btn-phone { flex: 1; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 8px; padding: 10px; text-align: center; color: #f87171; font-size: 13px; cursor: pointer; font-family: inherit; transition: background 0.15s; text-decoration: none; display: flex; flex-direction: column; align-items: center; gap: 2px }
.crisis-btn-phone:hover { background: rgba(239,68,68,0.18) }
.crisis-btn-chat { flex: 1; background: var(--accent-subtle); border: 1px solid var(--border); border-radius: 8px; padding: 10px; text-align: center; color: var(--accent); font-size: 13px; cursor: pointer; font-family: inherit; transition: all 0.15s }
.crisis-btn-chat:hover { background: var(--accent); color: white }

/* Mood Heatmap */
.heatmap-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px }
.heatmap-month { font-size: 14px; font-weight: 600 }
.heatmap-nav-btn { background: none; border: 1px solid var(--border); border-radius: 6px; padding: 3px 10px; color: var(--accent); font-size: 12px; cursor: pointer; font-family: inherit; transition: all 0.15s }
.heatmap-nav-btn:hover { background: var(--accent-subtle) }
.heatmap-nav-btn:disabled { opacity: 0.3; cursor: not-allowed }
.heatmap-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; text-align: center }
.heatmap-weekday { font-size: 10px; color: var(--text-muted); padding: 2px 0; margin-bottom: 2px }
.heatmap-day { border-radius: 4px; padding: 6px 0; font-size: 11px; transition: opacity 0.15s }
.heatmap-day--empty { background: transparent; color: transparent; pointer-events: none }
.heatmap-day--no-data { background: var(--bg-secondary); color: var(--text-muted) }
.heatmap-day--1 { background: #1e4060; color: #94bcd4 }
.heatmap-day--2 { background: #2a6080; color: #c0dce8 }
.heatmap-day--3 { background: #0891b2; color: #e0f2fe }
.heatmap-day--4 { background: #38bdf8; color: #0d2137; font-weight: 600 }
.heatmap-day--today { box-shadow: 0 0 0 2px var(--accent) }
.heatmap-legend { display: flex; align-items: center; gap: 5px; margin-top: 10px }
.heatmap-legend-label { font-size: 10px; color: var(--text-muted) }
.heatmap-legend-swatch { width: 12px; height: 12px; border-radius: 2px; flex-shrink: 0 }

/* Sidebar crisis button */
.sidebar-item--crisis { color: #f87171 }
.sidebar-item--crisis:hover { background: rgba(239, 68, 68, 0.1) !important; color: #f87171 }
```

- [ ] **Step 2: Проверить в браузере** — перезагрузить localhost:5173, убедиться что нет ошибок CSS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat: add CSS for mood checkin, heatmap, crisis support"
```

---

### Task 5: Frontend — компонент MoodCheckIn

**Files:**
- Create: `frontend/src/components/Dashboard/MoodCheckIn.tsx`
- Modify: `frontend/src/components/Dashboard/DashboardPage.tsx`

- [ ] **Step 1: Создать MoodCheckIn.tsx**

```tsx
// frontend/src/components/Dashboard/MoodCheckIn.tsx
import { useState, useEffect } from 'react'
import api from '../../api/client'

const MOODS = [
  { score: 2, emoji: '😔', label: 'Плохо' },
  { score: 4, emoji: '😐', label: 'Так себе' },
  { score: 6, emoji: '🙂', label: 'Норм' },
  { score: 8, emoji: '😊', label: 'Хорошо' },
  { score: 10, emoji: '😄', label: 'Отлично' },
]

interface TodayMood { id: string; score: number; created_at: string }

export default function MoodCheckIn() {
  const [today, setToday] = useState<TodayMood | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get<TodayMood | null>('/api/mood/today')
      .then(({ data }) => setToday(data))
      .catch(() => {})
  }, [])

  const select = async (score: number) => {
    setSaving(true)
    try {
      const { data } = await api.post<TodayMood>('/api/mood', { score })
      setToday(data)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card mood-checkin">
      <div className="mood-checkin-label">
        {today ? 'Настроение сегодня' : 'Как ты сейчас?'}
      </div>
      <div className="mood-checkin-row">
        {MOODS.map(({ score, emoji, label }) => (
          <button
            key={score}
            className={`mood-btn${today?.score === score ? ' mood-btn--active' : ''}`}
            onClick={() => select(score)}
            disabled={saving}
          >
            <span className="mood-emoji">{emoji}</span>
            <span className="mood-label">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Подключить в DashboardPage.tsx**

Добавить импорт после существующих импортов:
```tsx
import MoodCheckIn from './MoodCheckIn'
```

В JSX найти блок `<div className="dashboard-stats">` и вставить `<MoodCheckIn />` прямо перед ним:
```tsx
<MoodCheckIn />
<div className="dashboard-stats" style={{ perspective: 1000 }}>
```

- [ ] **Step 3: Проверить в браузере**

Открыть http://localhost:5173/ — должна появиться карточка с 5 эмодзи. Кликнуть на один — должен выделиться (активный класс). Перезагрузить страницу — активный эмодзи должен сохраниться (fetched from `/api/mood/today`).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Dashboard/MoodCheckIn.tsx frontend/src/components/Dashboard/DashboardPage.tsx
git commit -m "feat: add MoodCheckIn component to dashboard"
```

---

### Task 6: Frontend — компонент CrisisSupport + Sidebar

**Files:**
- Create: `frontend/src/components/Dashboard/CrisisSupport.tsx`
- Modify: `frontend/src/components/Dashboard/DashboardPage.tsx`
- Modify: `frontend/src/components/Sidebar/Sidebar.tsx`

- [ ] **Step 1: Создать CrisisSupport.tsx**

```tsx
// frontend/src/components/Dashboard/CrisisSupport.tsx
import { useNavigate } from 'react-router-dom'
import api from '../../api/client'

export default function CrisisSupport() {
  const navigate = useNavigate()

  const openChat = async () => {
    try {
      const { data } = await api.post<{ id: string }>('/api/sessions', {})
      navigate('/chat', { state: { sessionId: data.id } })
    } catch {
      navigate('/chat')
    }
  }

  return (
    <div className="card crisis-card">
      <div className="crisis-header">
        <div className="crisis-dot" />
        <div className="crisis-title">Кризисная поддержка</div>
      </div>
      <p className="crisis-text">
        Если тебе сейчас очень тяжело — ты не один. Обратись за помощью.
      </p>
      <div className="crisis-actions">
        <a href="tel:88002000122" className="crisis-btn-phone">
          <span>📞 Телефон доверия</span>
          <span style={{ fontSize: 11, opacity: 0.8 }}>8-800-2000-122</span>
        </a>
        <button className="crisis-btn-chat" onClick={openChat}>
          💬 Поговорить с ИИ
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Добавить CrisisSupport в DashboardPage.tsx**

Добавить импорт:
```tsx
import CrisisSupport from './CrisisSupport'
```

В JSX найти закрывающий тег `</div>` основного `<div className="dashboard">` (самый последний перед `AnimatePresence` блоками) и вставить перед ним:
```tsx
<CrisisSupport />
```

- [ ] **Step 3: Добавить кнопку в Sidebar.tsx**

Добавить импорт `AlertTriangle` из lucide-react в строку импортов:
```tsx
import {
  Home, MessageCircle, BookOpen, Dumbbell, Library, TrendingUp, Settings, LogOut, Pin, PinOff, AlertTriangle
} from 'lucide-react'
```

В `<div className="sidebar-bottom">` добавить кнопку перед кнопкой настроек:
```tsx
<button
  className="sidebar-item sidebar-item--crisis"
  onClick={() => navigate('/')}
  title="Кризисная поддержка"
>
  <AlertTriangle size={20} className="sidebar-icon" />
  <motion.span
    className="sidebar-item-name"
    animate={{ opacity: expanded ? 1 : 0 }}
    transition={{ delay: 0.05 }}
  >
    Нужна помощь
  </motion.span>
</button>
```

- [ ] **Step 4: Проверить в браузере**

- Карточка «Кризисная поддержка» должна появиться внизу дашборда с красной обводкой
- В сайдбаре внизу должна появиться кнопка с треугольником предупреждения
- Клик «Поговорить с ИИ» должен открывать новый чат
- Клик по телефону должен открывать `tel:` ссылку

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Dashboard/CrisisSupport.tsx \
        frontend/src/components/Dashboard/DashboardPage.tsx \
        frontend/src/components/Sidebar/Sidebar.tsx
git commit -m "feat: add CrisisSupport card and sidebar link"
```

---

### Task 7: Frontend — компонент MoodHeatmap

**Files:**
- Create: `frontend/src/components/Progress/MoodHeatmap.tsx`
- Modify: `frontend/src/components/Progress/ProgressPage.tsx`

- [ ] **Step 1: Создать MoodHeatmap.tsx**

```tsx
// frontend/src/components/Progress/MoodHeatmap.tsx
import { useState, useEffect } from 'react'
import api from '../../api/client'

interface CalendarDay { date: string; score: number }

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const MONTH_NAMES = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']

function scoreToLevel(score: number): 1 | 2 | 3 | 4 {
  if (score <= 4) return 1
  if (score <= 6) return 2
  if (score <= 8) return 3
  return 4
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstWeekday(year: number, month: number) {
  const d = new Date(year, month, 1).getDay()
  return d === 0 ? 6 : d - 1 // Mon=0 ... Sun=6
}

export default function MoodHeatmap() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [data, setData] = useState<CalendarDay[]>([])

  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`

  useEffect(() => {
    api.get<CalendarDay[]>('/api/mood/calendar', { params: { month: monthKey } })
      .then(({ data }) => setData(data))
      .catch(() => setData([]))
  }, [monthKey])

  const scoreMap = new Map(data.map(d => [d.date, d.score]))
  const daysInMonth = getDaysInMonth(year, month)
  const firstWeekday = getFirstWeekday(year, month)
  const todayStr = now.toISOString().slice(0, 10)

  const emptyCells = Array(firstWeekday).fill(null)
  const dayCells = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }

  const nextMonth = () => {
    if (year === now.getFullYear() && month === now.getMonth()) return
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth()

  return (
    <div className="card">
      <div className="heatmap-nav">
        <button className="heatmap-nav-btn" onClick={prevMonth}>◀</button>
        <div className="heatmap-month">{MONTH_NAMES[month]} {year}</div>
        <button className="heatmap-nav-btn" onClick={nextMonth} disabled={isCurrentMonth}>▶</button>
      </div>

      <div className="heatmap-grid">
        {WEEKDAYS.map(d => (
          <div key={d} className="heatmap-weekday">{d}</div>
        ))}
        {emptyCells.map((_, i) => (
          <div key={`e-${i}`} className="heatmap-day heatmap-day--empty" />
        ))}
        {dayCells.map(day => {
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const score = scoreMap.get(dateStr)
          const isToday = dateStr === todayStr
          const levelClass = score !== undefined
            ? `heatmap-day--${scoreToLevel(score)}`
            : 'heatmap-day--no-data'
          return (
            <div
              key={dateStr}
              className={`heatmap-day ${levelClass}${isToday ? ' heatmap-day--today' : ''}`}
              title={score !== undefined ? `${day}: ${score}/10` : `${day}: нет записи`}
            >
              {day}
            </div>
          )
        })}
      </div>

      <div className="heatmap-legend">
        <span className="heatmap-legend-label">Плохо</span>
        <div className="heatmap-legend-swatch" style={{ background: '#1e4060' }} />
        <div className="heatmap-legend-swatch" style={{ background: '#2a6080' }} />
        <div className="heatmap-legend-swatch" style={{ background: '#0891b2' }} />
        <div className="heatmap-legend-swatch" style={{ background: '#38bdf8' }} />
        <span className="heatmap-legend-label">Отлично</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Подключить в ProgressPage.tsx**

Добавить импорт:
```tsx
import MoodHeatmap from './MoodHeatmap'
```

В JSX найти `<div className="progress-grid">` и добавить `<MoodHeatmap />` первым дочерним элементом:
```tsx
<div className="progress-grid">
  <MoodHeatmap />
  <div className="card progress-streaks">
```

- [ ] **Step 3: Проверить в браузере**

Открыть http://localhost:5173/progress — должна появиться тепловая карта сверху. Переключать месяцы стрелками. Кнопка ▶ должна быть disabled на текущем месяце. После добавления настроения через MoodCheckIn — обновить страницу прогресса и убедиться что день подсвечен.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Progress/MoodHeatmap.tsx \
        frontend/src/components/Progress/ProgressPage.tsx
git commit -m "feat: add MoodHeatmap to progress page"
```
