# Medium Priority UX Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить три UX-улучшения: пустые состояния-онбординг на дашборде, in-app напоминания и анимированный круг дыхания.

**Architecture:** Все изменения — фронтенд-only, кроме одной DB-миграции которая добавляет `step_durations` в дыхательные упражнения (без неё флаг `isBreathing` в `ExerciseTimer` никогда не активируется). Новые компоненты (`ReminderBanner`) следуют паттернам существующих компонентов дашборда.

**Tech Stack:** React 18, TypeScript, framer-motion, lucide-react, CSS custom properties, PostgreSQL (jsonb update).

---

## Файловая структура

| Файл | Действие | Ответственность |
|------|----------|----------------|
| `backend/db/migrations/004_breathing_step_durations.up.sql` | Создать | Добавить `step_durations` в JSON дыхательных упражнений |
| `backend/db/migrations/004_breathing_step_durations.down.sql` | Создать | Откат миграции |
| `frontend/src/index.css` | Изменить | CSS для empty-state, reminder-banner, breathing-circle |
| `frontend/src/components/Dashboard/DashboardPage.tsx` | Изменить | Пустые состояния + hasMoodToday state + ReminderBanner |
| `frontend/src/components/Dashboard/ReminderBanner.tsx` | Создать | In-app напоминания |
| `frontend/src/components/Exercises/ExerciseTimer.tsx` | Изменить | BreathingCircle вместо цифрового таймера |

---

## Task 1: DB-миграция — добавить step_durations

**Files:**
- Create: `backend/db/migrations/004_breathing_step_durations.up.sql`
- Create: `backend/db/migrations/004_breathing_step_durations.down.sql`

Без `step_durations` в JSON флаг `isBreathing` в `ExerciseTimer.tsx` равен `false` для всех упражнений (`!!stepDurations` → `false`), поэтому анимированный круг никогда не появится.

- [ ] **Шаг 1: Создать up-миграцию**

```sql
-- backend/db/migrations/004_breathing_step_durations.up.sql
UPDATE exercises
SET content = content || '{"step_durations": [4, 7, 8]}'::jsonb
WHERE slug = 'breathing-478';

UPDATE exercises
SET content = content || '{"step_durations": [4, 4, 4, 4]}'::jsonb
WHERE slug = 'box-breathing';
```

- [ ] **Шаг 2: Создать down-миграцию**

```sql
-- backend/db/migrations/004_breathing_step_durations.down.sql
UPDATE exercises
SET content = content - 'step_durations'
WHERE slug IN ('breathing-478', 'box-breathing');
```

- [ ] **Шаг 3: Применить миграцию**

```bash
PGPASSWORD=psychai psql "postgresql://psychai@127.0.0.1:5433/psychai" \
  -f backend/db/migrations/004_breathing_step_durations.up.sql
```

Ожидаемый вывод:
```
UPDATE 1
UPDATE 1
```

- [ ] **Шаг 4: Проверить результат**

```bash
PGPASSWORD=psychai psql "postgresql://psychai@127.0.0.1:5433/psychai" \
  -c "SELECT slug, content->'step_durations' AS step_durations FROM exercises WHERE type='breathing';"
```

Ожидаемый вывод:
```
     slug      | step_durations
---------------+----------------
 breathing-478 | [4, 7, 8]
 box-breathing | [4, 4, 4, 4]
```

- [ ] **Шаг 5: Коммит**

```bash
git add backend/db/migrations/004_breathing_step_durations.up.sql \
        backend/db/migrations/004_breathing_step_durations.down.sql
git commit -m "feat: add step_durations to breathing exercises"
```

---

## Task 2: CSS для трёх фич

**Files:**
- Modify: `frontend/src/index.css` (добавить в конец файла, перед `/* scrollbar */`)

- [ ] **Шаг 1: Добавить CSS**

Найти строку `::-webkit-scrollbar { width: 6px }` и вставить ПЕРЕД ней:

```css
/* Empty states (onboarding) */
.empty-state {
  display: flex; flex-direction: column; align-items: center;
  gap: 8px; padding: 24px 16px; text-align: center;
}
.empty-state__icon { font-size: 32px; line-height: 1 }
.empty-state__title { font-size: 14px; font-weight: 600; color: var(--text-primary) }
.empty-state__desc { font-size: 13px; color: var(--text-secondary); line-height: 1.5; max-width: 240px }
.empty-state__btn {
  margin-top: 4px; background: var(--accent); color: white; border: none;
  border-radius: 8px; padding: 8px 16px; font-size: 13px; font-weight: 500;
  cursor: pointer; font-family: inherit; transition: opacity 0.15s;
}
.empty-state__btn:hover { opacity: 0.85 }
.onboarding-hint {
  font-size: 12px; color: var(--text-secondary); background: var(--accent-subtle);
  border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px;
  margin-bottom: 4px; line-height: 1.5;
}

/* Reminder Banner */
.reminder-banner {
  display: flex; align-items: center; gap: 10px;
  background: var(--bg-card); border: 1px solid var(--border);
  backdrop-filter: var(--blur); border-radius: 12px;
  padding: 12px 14px; margin-bottom: 4px;
}
.reminder-banner__text { flex: 1; font-size: 13px; color: var(--text-primary); line-height: 1.4 }
.reminder-banner__action {
  background: var(--accent-subtle); border: 1px solid var(--border);
  color: var(--accent); border-radius: 7px; padding: 5px 12px;
  font-size: 12px; font-weight: 500; cursor: pointer; font-family: inherit;
  white-space: nowrap; transition: background 0.15s;
}
.reminder-banner__action:hover { background: var(--accent); color: white }
.reminder-banner__close {
  background: none; border: none; color: var(--text-muted); cursor: pointer;
  padding: 4px; display: flex; align-items: center; flex-shrink: 0;
  transition: color 0.15s;
}
.reminder-banner__close:hover { color: var(--text-primary) }

/* Breathing Circle */
.breathing-circle {
  width: 200px; height: 200px; border-radius: 50%;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 4px; margin: 8px auto; border: 2px solid transparent;
  transition: border-color 0.3s;
}
.breathing-circle--inhale { border-color: rgba(56, 189, 248, 0.5) }
.breathing-circle--hold   { border-color: rgba(139, 92, 246, 0.5) }
.breathing-circle--exhale { border-color: rgba(34, 197, 94, 0.4) }
.breathing-circle__timer {
  font-size: 48px; font-weight: 700; color: var(--text-primary); line-height: 1;
}
.breathing-circle__phase {
  font-size: 14px; font-weight: 500; color: var(--text-secondary);
}
.breathing-circle__cycle {
  font-size: 12px; color: var(--text-muted); margin-top: 2px;
}
```

- [ ] **Шаг 2: Проверить что файл сохранился без ошибок**

```bash
grep -c "empty-state\|reminder-banner\|breathing-circle" frontend/src/index.css
```

Ожидаемый вывод: `16` (или больше — по количеству совпадений классов)

- [ ] **Шаг 3: Коммит**

```bash
git add frontend/src/index.css
git commit -m "feat: add CSS for empty states, reminder banner, and breathing circle"
```

---

## Task 3: Пустые состояния в DashboardPage

**Files:**
- Modify: `frontend/src/components/Dashboard/DashboardPage.tsx`

- [ ] **Шаг 1: Добавить hasMoodToday state и onboarding-логику**

В секцию `useState`/`useEffect` добавить после строки `const [msgIndex, setMsgIndex] = ...`:

```tsx
const [hasMoodToday, setHasMoodToday] = useState(false)
const [onboardingDone, setOnboardingDone] = useState(
  () => !!localStorage.getItem('onboarding_done')
)
```

В существующий `useEffect` (строка `api.get<ProgressData>('/api/progress')...`) добавить третий запрос:

```tsx
useEffect(() => {
  api.get<ProgressData>('/api/progress').then(({ data }) => setProgress(data))
  api.get<Session[]>('/api/sessions').then(({ data }) => setSessions(data.slice(0, 3)))
  api.get<{ score: number } | null>('/api/mood/today')
    .then(({ data }) => setHasMoodToday(!!data))
    .catch(() => {})
}, [])
```

- [ ] **Шаг 2: Добавить useEffect для сброса onboarding-флага**

После существующих `useEffect`, добавить:

```tsx
useEffect(() => {
  if (onboardingDone) return
  const isNew =
    sessions.length === 0 &&
    (progress?.diary_count ?? 0) === 0 &&
    (progress?.exercises_count ?? 0) === 0
  if (!isNew && progress !== null) {
    localStorage.setItem('onboarding_done', '1')
    setOnboardingDone(true)
  }
}, [progress, sessions])
```

- [ ] **Шаг 3: Заменить пустое состояние в карточке бесед**

Найти:
```tsx
{sessions.length === 0 && (
  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Бесед пока нет</p>
)}
```

Заменить на:
```tsx
{sessions.length === 0 && (
  <div className="empty-state">
    <div className="empty-state__icon">💬</div>
    <div className="empty-state__title">Поговорите с ИИ-психологом</div>
    <div className="empty-state__desc">Он поможет разобраться в чувствах и найти опору</div>
    <button className="empty-state__btn" onClick={openNewChat}>
      Начать первую беседу →
    </button>
  </div>
)}
```

- [ ] **Шаг 4: Обновить stat-card настроения**

Найти:
```tsx
<TiltCard className="stat-card">
  <div className="stat-label">Настроение / неделя</div>
  <div className="stat-value">
    {progress?.mood_avg_week ? progress.mood_avg_week.toFixed(1) : '–'}
    <span className="stat-value-denom">/10</span>
  </div>
  <div className="stat-sub">средний балл за 7 дней</div>
</TiltCard>
```

Заменить на:
```tsx
<TiltCard className="stat-card">
  <div className="stat-label">Настроение / неделя</div>
  <div className="stat-value">
    {progress?.mood_avg_week ? progress.mood_avg_week.toFixed(1) : '–'}
    {progress?.mood_avg_week ? <span className="stat-value-denom">/10</span> : null}
  </div>
  <div className="stat-sub">
    {progress && !progress.mood_avg_week
      ? '↓ Отметьте настроение ниже'
      : 'средний балл за 7 дней'}
  </div>
</TiltCard>
```

- [ ] **Шаг 5: Добавить onboarding-подсказку в quickstart-карточку**

Найти:
```tsx
<TiltCard className="quickstart-card" intensity={3}>
  <div className="quickstart-title">⚡ Быстрый старт</div>
```

Заменить на:
```tsx
<TiltCard className="quickstart-card" intensity={3}>
  <div className="quickstart-title">⚡ Быстрый старт</div>
  {!onboardingDone && (
    <div className="onboarding-hint">
      👋 Добро пожаловать! Попробуйте одно упражнение или начните беседу с ИИ — это займёт пару минут.
    </div>
  )}
```

- [ ] **Шаг 6: Убедиться что TypeScript не ругается**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -E "error|DashboardPage"
```

Ожидаемый вывод: пусто (нет ошибок)

- [ ] **Шаг 7: Коммит**

```bash
git add frontend/src/components/Dashboard/DashboardPage.tsx
git commit -m "feat: add empty states and onboarding hints to dashboard"
```

---

## Task 4: ReminderBanner компонент

**Files:**
- Create: `frontend/src/components/Dashboard/ReminderBanner.tsx`
- Modify: `frontend/src/components/Dashboard/DashboardPage.tsx`

- [ ] **Шаг 1: Создать ReminderBanner.tsx**

```tsx
// frontend/src/components/Dashboard/ReminderBanner.tsx
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

interface ProgressData {
  exercises_count: number
  exercises_week: number
  diary_count: number
  diary_last_at: string | null
}

interface Props {
  progress: ProgressData | null
  hasMoodToday: boolean
  onOpenDiary: () => void
  onStartExercise: (slug: string) => void
  onScrollToMood: () => void
}

interface Reminder {
  text: string
  actionLabel: string
  actionType: 'diary' | 'exercise' | 'mood'
}

function daysSince(iso: string | null): number {
  if (!iso) return Infinity
  return Math.floor(
    (new Date().setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / 86400000
  )
}

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function computeReminder(p: ProgressData, hasMoodToday: boolean): Reminder | null {
  if (p.diary_count > 0 && daysSince(p.diary_last_at) >= 2) {
    return {
      text: '📔 Вы давно не писали в дневник — как вы сейчас?',
      actionLabel: 'Написать',
      actionType: 'diary',
    }
  }
  if (p.exercises_count > 0 && p.exercises_week === 0) {
    return {
      text: '🧘 Небольшая практика поможет — попробуйте дыхание 4-7-8',
      actionLabel: 'Начать',
      actionType: 'exercise',
    }
  }
  if (!hasMoodToday && new Date().getHours() >= 12) {
    return {
      text: '🌡️ Не забудьте отметить настроение сегодня',
      actionLabel: 'Отметить',
      actionType: 'mood',
    }
  }
  return null
}

export default function ReminderBanner({ progress, hasMoodToday, onOpenDiary, onStartExercise, onScrollToMood }: Props) {
  const [visible, setVisible] = useState(false)

  const reminder = progress ? computeReminder(progress, hasMoodToday) : null

  useEffect(() => {
    if (!reminder) return
    if (localStorage.getItem('reminder_dismissed') === getTodayKey()) return
    const id = setTimeout(() => setVisible(true), 1500)
    return () => clearTimeout(id)
  }, [!!reminder])

  useEffect(() => {
    if (!visible) return
    const id = setTimeout(() => setVisible(false), 8000)
    return () => clearTimeout(id)
  }, [visible])

  const dismiss = () => {
    setVisible(false)
    localStorage.setItem('reminder_dismissed', getTodayKey())
  }

  const handleAction = () => {
    if (!reminder) return
    if (reminder.actionType === 'diary') onOpenDiary()
    if (reminder.actionType === 'exercise') onStartExercise('breathing-478')
    if (reminder.actionType === 'mood') onScrollToMood()
    dismiss()
  }

  if (!reminder) return null

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="reminder-banner"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
        >
          <span className="reminder-banner__text">{reminder.text}</span>
          <button className="reminder-banner__action" onClick={handleAction}>
            {reminder.actionLabel}
          </button>
          <button className="reminder-banner__close" onClick={dismiss} aria-label="Закрыть">
            <X size={14} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Шаг 2: Интегрировать ReminderBanner в DashboardPage.tsx**

Добавить импорт после строки `import CrisisSupport from './CrisisSupport'`:
```tsx
import ReminderBanner from './ReminderBanner'
```

Добавить `moodRef` для скролла к трекеру. Найти строку:
```tsx
const [hasMoodToday, setHasMoodToday] = useState(false)
```
Добавить после неё:
```tsx
const moodRef = useRef<HTMLDivElement>(null)
```

Добавить импорт `useRef` в первую строку файла (уже есть `useEffect, useState`, добавить `useRef`):
```tsx
import { useEffect, useRef, useState } from 'react'
```

Добавить `ref` к карточке трекера настроения. Найти:
```tsx
<TiltCard className="card" intensity={2} style={{ padding: '20px 24px' }}>
  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: 'var(--text-primary)' }}>
    🌡️ Трекер настроения
  </div>
```
Заменить на:
```tsx
<div ref={moodRef}>
<TiltCard className="card" intensity={2} style={{ padding: '20px 24px' }}>
  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: 'var(--text-primary)' }}>
    🌡️ Трекер настроения
  </div>
```
И закрыть `</div>` после закрывающего `</TiltCard>` этой карточки:
```tsx
</TiltCard>
</div>
```

Вставить `<ReminderBanner>` между `dashboard-greeting` и `dashboard-stats`. Найти:
```tsx
      <div className="dashboard-stats" style={{ perspective: 800 }}>
```
Вставить ПЕРЕД этой строкой:
```tsx
      <ReminderBanner
        progress={progress}
        hasMoodToday={hasMoodToday}
        onOpenDiary={() => setShowDiary(true)}
        onStartExercise={openExercise}
        onScrollToMood={() => moodRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
      />
```

- [ ] **Шаг 3: Проверить TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -E "error|ReminderBanner|DashboardPage"
```

Ожидаемый вывод: пусто

- [ ] **Шаг 4: Коммит**

```bash
git add frontend/src/components/Dashboard/ReminderBanner.tsx \
        frontend/src/components/Dashboard/DashboardPage.tsx
git commit -m "feat: add ReminderBanner with in-app reminders"
```

---

## Task 5: BreathingCircle в ExerciseTimer

**Files:**
- Modify: `frontend/src/components/Exercises/ExerciseTimer.tsx`

- [ ] **Шаг 1: Добавить вспомогательные функции и inline-компонент**

Найти строку `export default function ExerciseTimer(...)` и вставить ПЕРЕД ней:

```tsx
type BreathPhase = 'inhale' | 'hold' | 'exhale'

function getBreathPhase(stepRu: string): BreathPhase {
  const t = stepRu.toLowerCase()
  if (t.includes('вдох') || t.includes('inhale')) return 'inhale'
  if (t.includes('задерж') || t.includes('hold')) return 'hold'
  return 'exhale'
}

const PHASE_LABELS: Record<BreathPhase, string> = {
  inhale: 'Вдох',
  hold: 'Задержка',
  exhale: 'Выдох',
}

const PHASE_BACKGROUNDS: Record<BreathPhase, string> = {
  inhale: 'rgba(56, 189, 248, 0.15)',
  hold: 'rgba(139, 92, 246, 0.15)',
  exhale: 'rgba(34, 197, 94, 0.12)',
}

const PHASE_SCALES: Record<BreathPhase, number> = {
  inhale: 1.35,
  hold: 1.35,
  exhale: 1.0,
}

interface BreathingCircleProps {
  running: boolean
  done: boolean
  step: number
  cycle: number
  totalCycles: number
  timeLeft: number
  stepDurations: number[]
  steps: { ru: string; en: string }[]
}

function BreathingCircle({ running, done, step, cycle, totalCycles, timeLeft, stepDurations, steps }: BreathingCircleProps) {
  const phase = getBreathPhase(steps[step].ru)
  const isActive = running || done
  const scale = isActive ? PHASE_SCALES[phase] : 1.0
  const background = isActive ? PHASE_BACKGROUNDS[phase] : 'rgba(128,128,128,0.08)'
  const duration = stepDurations[step] ?? 4

  return (
    <motion.div
      className={`breathing-circle breathing-circle--${phase}`}
      animate={{ scale, background }}
      transition={{ duration, ease: 'easeInOut' }}
      style={{ opacity: isActive ? 1 : 0.4 }}
    >
      <div className="breathing-circle__timer">{String(timeLeft).padStart(2, '0')}</div>
      {isActive && !done && (
        <div className="breathing-circle__phase">{PHASE_LABELS[phase]}</div>
      )}
      {done && <div className="breathing-circle__phase">Готово ✓</div>}
      <div className="breathing-circle__cycle">
        {done ? '' : `Цикл ${cycle} из ${totalCycles}`}
      </div>
    </motion.div>
  )
}
```

- [ ] **Шаг 2: Заменить старый рендер breathing-секции**

Найти:
```tsx
        {isBreathing ? (
          <>
            <div className="exercise-timer" style={{ opacity: running || done ? 1 : 0.35 }}>{ss}</div>
            <div className="exercise-cycle-label">
              {lang === 'ru' ? `Цикл ${cycle} из ${totalCycles}` : `Cycle ${cycle} of ${totalCycles}`}
            </div>
          </>
        ) : exercise.duration_sec > 0 ? (
```

Заменить на:
```tsx
        {isBreathing ? (
          <BreathingCircle
            running={running}
            done={done}
            step={step}
            cycle={cycle}
            totalCycles={totalCycles}
            timeLeft={timeLeft}
            stepDurations={stepDurations!}
            steps={steps}
          />
        ) : exercise.duration_sec > 0 ? (
```

- [ ] **Шаг 3: Скрыть список шагов для дыхательных упражнений**

Для дыхательных упражнений список шагов теперь избыточен — информация о фазе показывается в круге. Найти:

```tsx
        <div className="exercise-steps">
          {steps.map((s, i) => (
```

Заменить на:
```tsx
        {!isBreathing && <div className="exercise-steps">
          {steps.map((s, i) => (
```

И закрывающий тег:
```tsx
        </div>
```
который закрывает `exercise-steps` — заменить на:
```tsx
        </div>}
```

- [ ] **Шаг 4: Проверить TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -E "error|ExerciseTimer"
```

Ожидаемый вывод: пусто

- [ ] **Шаг 5: Проверить в браузере**

1. Убедиться что бэкенд запущен: `curl -s http://localhost:8080/auth/login -X POST | head -1`
2. Открыть `http://localhost:5173`
3. Зайти на дашборд → Быстрый старт → нажать "🧘 Дыхание 4-7-8"
4. Должен появиться анимированный круг вместо цифрового таймера
5. Нажать "Старт" — круг должен расширяться (вдох), менять цвет (задержка), сжиматься (выдох)

- [ ] **Шаг 6: Коммит**

```bash
git add frontend/src/components/Exercises/ExerciseTimer.tsx
git commit -m "feat: add animated breathing circle to ExerciseTimer"
```
