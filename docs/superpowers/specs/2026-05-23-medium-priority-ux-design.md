# Medium Priority UX Features — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Улучшить UX для новых пользователей и повысить вовлечённость через три независимых улучшения: пустые состояния на дашборде, in-app напоминания и анимацию дыхательных упражнений.

**Stack:** React + TypeScript, framer-motion, zustand, CSS custom properties, Go backend (chi, pgx).

---

## Фича 1: Онбординг через пустые состояния

### Цель
Новый пользователь видит пустые карточки и не понимает с чего начать. Заменяем пустоту на приглашения к действию прямо внутри существующих карточек дашборда.

### Логика определения "новый пользователь"
Данные уже загружаются из `GET /api/progress`. Поля для проверки:
- `sessions.length === 0` — нет бесед
- `progress.diary_count === 0` — нет записей в дневнике
- `progress.exercises_count === 0` — нет выполненных упражнений
- `progress.mood_avg_week === 0` — нет оценок настроения

Флаг `onboarding_done` в `localStorage` — скрывает приветственный заголовок "С чего начать?" после первого выполненного действия (любого из вышеперечисленных).

### Изменения в DashboardPage.tsx

**Карточка "Последние беседы"** (`sessions-card`):
- Сейчас: `<p>Бесед пока нет</p>` — серый текст
- Новое пустое состояние:
  ```
  [💬 иконка]
  Поговорите с ИИ-психологом
  Он поможет разобраться в чувствах и найти опору
  [кнопка: Начать первую беседу →]
  ```
  Кнопка вызывает существующий `openNewChat()`.

**Карточка статистики "Настроение / неделя"**:
- Если `mood_avg_week === 0`: вместо `–` показываем текст `"Ещё не отмечено"` + подсказку `"↓ Отметьте настроение ниже"`

**Приветственный заголовок "С чего начать?"** (новый блок в `quickstart-card`):
- Показывается если `!localStorage.getItem('onboarding_done')`
- Исчезает (и флаг проставляется) когда `progress.exercises_count > 0 || progress.diary_count > 0 || sessions.length > 0`
- Текст: `"👋 С чего начать? Попробуйте одно из упражнений ниже или начните беседу с ИИ"`
- Анимация появления: `framer-motion` fade-in

### Файлы
- Изменить: `frontend/src/components/Dashboard/DashboardPage.tsx`
- Добавить CSS: `frontend/src/index.css` (классы `.empty-state`, `.empty-state__icon`, `.empty-state__title`, `.empty-state__desc`)

---

## Фича 2: In-app напоминания

### Цель
При открытии дашборда показывать один контекстный баннер если пользователь давно не делал что-то полезное.

### Компонент: `ReminderBanner.tsx`
Расположение: `frontend/src/components/Dashboard/ReminderBanner.tsx`

**Props:**
```ts
interface Props {
  progress: ProgressData | null
  hasMoodToday: boolean
}
```

**Логика выбора напоминания (приоритет сверху вниз):**

| Приоритет | Условие | Текст | Действие |
|-----------|---------|-------|----------|
| 1 | `diary_last_at` — 2+ дней назад или `null` и `diary_count > 0` | "📔 Вы давно не писали в дневник — как вы сейчас?" | Открывает `DiaryEntryModal` |
| 2 | `exercises_week === 0` и `exercises_count > 0` | "🧘 Небольшая практика поможет — попробуйте дыхание 4-7-8" | Запускает упражнение `breathing-478` |
| 3 | `!hasMoodToday` и `new Date().getHours() >= 12` | "🌡️ Не забудьте отметить настроение сегодня" | Скролл к трекеру настроения |

Напоминание показывается только если хотя бы одно условие выполнено.

**Подавление повторных показов:**
- Ключ `reminder_dismissed` в `localStorage` хранит дату последнего закрытия (`YYYY-MM-DD`)
- Если дата совпадает с сегодняшней — баннер не показывается
- При закрытии баннера записывается сегодняшняя дата

**Анимация:**
- Появляется через 1500ms после монтирования компонента (`setTimeout` + `useState`)
- `framer-motion`: `initial={{ opacity: 0, y: -8 }}` → `animate={{ opacity: 1, y: 0 }}`
- Автоматически скрывается через 8 секунд
- Кнопка закрытия `×` — немедленное скрытие

**Интеграция в DashboardPage.tsx:**
- Вставляется между `.dashboard-greeting` и `.dashboard-stats`
- `hasMoodToday` — новый state, загружается `GET /api/mood/today` (уже есть в `MoodCheckIn`, но нужен и здесь на уровне дашборда)
- Колбэки для действий (`onOpenDiary`, `onStartExercise`) передаются из `DashboardPage`

### CSS
Добавить в `index.css`: классы `.reminder-banner`, `.reminder-banner__text`, `.reminder-banner__action`, `.reminder-banner__close`

---

## Фича 3: Анимация дыхания

### Цель
Заменить цифровой таймер в дыхательных упражнениях на пульсирующий круг с текстом фазы.

### Изменения в ExerciseTimer.tsx

**Определение фазы по тексту шага:**
```ts
function getBreathPhase(stepText: string): 'inhale' | 'hold' | 'exhale' {
  const t = stepText.toLowerCase()
  if (t.includes('вдох') || t.includes('inhale')) return 'inhale'
  if (t.includes('задерж') || t.includes('hold')) return 'hold'
  return 'exhale'
}
```

**Компонент `BreathingCircle` (inline в ExerciseTimer.tsx):**
- Размер: 200×200px
- Структура: внешний `motion.div` (круг-фон) + внутренний div с текстом фазы и таймером
- Фаза определяется из `steps[step].ru` текущего шага

**Анимация `motion.div`:**
```ts
const phaseAnimations = {
  inhale:  { scale: 1.35, background: 'rgba(56, 189, 248, 0.25)' },
  hold:    { scale: 1.35, background: 'rgba(139, 92, 246, 0.25)' },
  exhale:  { scale: 1.0,  background: 'rgba(34, 197, 94, 0.2)'  },
}
// transition: { duration: stepDurations[step], ease: 'easeInOut' }
```

Длительность перехода = `stepDurations[step]` — анимация точно синхронизирована с таймером.

**Состояние до старта:** `opacity: 0.4`, `scale: 1.0`, нейтральный цвет.

**Текст внутри круга:**
- Крупная цифра таймера (`ss`)
- Под ней — название фазы на русском: "Вдох" / "Задержка" / "Выдох"
- Под ней — `Цикл N из M`

**Замена в JSX:** блок `isBreathing` в render-секции — убираем `<div className="exercise-timer">` и `<div className="exercise-cycle-label">`, вставляем `<BreathingCircle>`.

### CSS
Добавить в `index.css`: классы `.breathing-circle`, `.breathing-circle__timer`, `.breathing-circle__phase`, `.breathing-circle__cycle`

---

## Порядок реализации

1. CSS для всех трёх фич (один коммит)
2. Пустые состояния в `DashboardPage.tsx`
3. `ReminderBanner.tsx` + интеграция в `DashboardPage.tsx`
4. `BreathingCircle` в `ExerciseTimer.tsx`
