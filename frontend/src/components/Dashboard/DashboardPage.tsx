import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
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
  const days = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота']
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
  return `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`
}

function formatSessionDate(iso: string): string {
  const d = new Date(iso)
  const diffDays = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000)
  if (diffDays === 0) return `Сегодня, ${d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}`
  if (diffDays === 1) return `Вчера, ${d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}`
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'short' })
}

function formatDiaryLast(iso: string | null): string {
  if (!iso) return 'Ещё нет'
  const diff = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / 86400000)
  if (diff === 0) return 'Сегодня'
  if (diff === 1) return 'Вчера'
  return `${diff} дней назад`
}

function streakLabel(n: number): string {
  if (n === 1) return 'день'
  if (n >= 2 && n <= 4) return 'дня'
  return 'дней'
}

const SUPPORT_MESSAGES = [
  'Ты справляешься лучше, чем думаешь 💙',
  'Каждый маленький шаг — это уже прогресс',
  'Заботиться о себе — это не слабость, а сила',
  'Сегодня достаточно просто быть собой',
  'Твои чувства важны и заслуживают внимания',
  'Дыши. Ты в безопасности прямо сейчас 🌿',
  'Ты не одинок — мы здесь рядом',
  'Хороший день начинается с доброго отношения к себе',
  'Маленькие победы тоже считаются ⭐',
  'Отдых — это тоже часть пути',
]

const QUICK_ACTIONS = [
  { label: '🧘 Дыхание 4-7-8', slug: 'breathing-478', color: '#6366f1' },
  { label: '🧠 КПТ-техника', slug: 'cbt-thought-record', color: '#8b5cf6' },
  { label: '🌙 Медитация', slug: 'sleep-meditation', color: '#06b6d4' },
]

export default function DashboardPage() {
  const navigate = useNavigate()
  const lang = useAuthStore((s) => s.user?.lang || 'ru')
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeExercise, setActiveExercise] = useState<Exercise | null>(null)
  const [showDiary, setShowDiary] = useState(false)
  const [msgIndex, setMsgIndex] = useState(() => Math.floor(Math.random() * SUPPORT_MESSAGES.length))

  useEffect(() => {
    api.get<ProgressData>('/api/progress').then(({ data }) => setProgress(data))
    api.get<Session[]>('/api/sessions').then(({ data }) => setSessions(data.slice(0, 3)))
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      setMsgIndex((i) => (i + 1) % SUPPORT_MESSAGES.length)
    }, 17000)
    return () => clearInterval(id)
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
      <div className="dashboard-greeting">
        <div className="dashboard-greeting-left">
          <div className="dashboard-greeting-title">{getGreeting()}</div>
          <div className="dashboard-greeting-sub">{formatToday()}</div>
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={msgIndex}
            className="support-message"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.4 }}
          >
            {SUPPORT_MESSAGES[msgIndex]}
          </motion.div>
        </AnimatePresence>
        {streak > 0 && (
          <div className="dashboard-streak">🔥 {streak} {streakLabel(streak)} подряд</div>
        )}
      </div>

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
          <div className="stat-value">
            {progress?.exercises_count !== undefined ? progress.exercises_count : '–'}
          </div>
          <div className="stat-sub">+{progress?.exercises_week ?? 0} за эту неделю</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Записей в дневнике</div>
          <div className="stat-value">
            {progress?.diary_count !== undefined ? progress.diary_count : '–'}
          </div>
          <div className="stat-sub">Последняя: {formatDiaryLast(progress?.diary_last_at ?? null)}</div>
        </div>
      </div>

      <div className="dashboard-bottom">
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
                <div style={{ minWidth: 0 }}>
                  <div className="session-row-title">{s.title}</div>
                  <div className="session-row-date">{formatSessionDate(s.created_at)}</div>
                </div>
                <span className="session-row-arrow">›</span>
              </div>
            ))}
          </div>
          <button className="sessions-new-btn-dash" onClick={openNewChat}>
            <Plus size={14} />
            Начать новую беседу
          </button>
        </div>

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
