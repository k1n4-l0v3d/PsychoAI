import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { Play } from 'lucide-react'
import api from '../../api/client'
import { useAuthStore } from '../../store/authStore'
import ExerciseTimer from './ExerciseTimer'

interface Exercise {
  id: string
  slug: string
  type: string
  title_ru: string
  title_en: string
  content: { steps: { ru: string; en: string }[]; cycles?: number; description_ru?: string; description_en?: string }
  duration_sec: number
}

const TYPE_COLORS: Record<string, string> = {
  breathing: '#6366f1',
  cbt: '#8b5cf6',
  meditation: '#06b6d4',
  relaxation: '#10b981',
}

export default function ExercisesPage() {
  const { t } = useTranslation()
  const lang = useAuthStore((s) => s.user?.lang || 'ru')
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [active, setActive] = useState<Exercise | null>(null)
  const [filter, setFilter] = useState<string>('')

  useEffect(() => {
    api.get<Exercise[]>('/api/exercises').then(({ data }) => setExercises(data))
  }, [])

  const types = [...new Set(exercises.map((e) => e.type))]
  const filtered = filter ? exercises.filter((e) => e.type === filter) : exercises

  const complete = async (slug: string) => {
    await api.post(`/api/exercises/${slug}/complete`)
    setActive(null)
  }

  return (
    <div className="page">
      <h1 className="page-title">{t('exercises.title')}</h1>

      <div className="filter-row">
        <button
          className={`filter-btn ${!filter ? 'filter-btn--active' : ''}`}
          onClick={() => setFilter('')}
        >
          Все
        </button>
        {types.map((type) => (
          <button
            key={type}
            className={`filter-btn ${filter === type ? 'filter-btn--active' : ''}`}
            onClick={() => setFilter(type)}
          >
            {t(`exercises.types.${type}`)}
          </button>
        ))}
      </div>

      <div className="exercises-grid">
        {filtered.map((ex) => (
          <motion.div
            key={ex.id}
            className="card exercise-card"
            whileHover={{ y: -2 }}
            transition={{ duration: 0.15 }}
          >
            <div className="exercise-type-badge" style={{ background: TYPE_COLORS[ex.type] + '22', color: TYPE_COLORS[ex.type] }}>
              {t(`exercises.types.${ex.type}`)}
            </div>
            <h3 className="exercise-title">
              {lang === 'ru' ? ex.title_ru : ex.title_en}
            </h3>
            {(ex.content.description_ru || ex.content.description_en) && (
              <p className="exercise-desc">
                {lang === 'ru' ? ex.content.description_ru : ex.content.description_en}
              </p>
            )}
            {ex.duration_sec > 0 && (
              <span className="exercise-duration">{Math.ceil(ex.duration_sec / 60)} мин</span>
            )}
            <button
              className="btn-primary exercise-start-btn"
              onClick={() => setActive(ex)}
            >
              <Play size={14} /> {t('exercises.start')}
            </button>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {active && (
          <ExerciseTimer
            exercise={active}
            lang={lang}
            onComplete={() => complete(active.slug)}
            onClose={() => setActive(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
