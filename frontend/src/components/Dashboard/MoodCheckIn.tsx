import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../../api/client'

const MOODS = [
  { score: 1, emoji: '😣', label: 'Плохо' },
  { score: 2, emoji: '😔', label: 'Грустно' },
  { score: 3, emoji: '😕', label: 'Тяжело' },
  { score: 4, emoji: '😐', label: 'Так себе' },
  { score: 5, emoji: '🙂', label: 'Норм' },
  { score: 6, emoji: '😊', label: 'Хорошо' },
  { score: 7, emoji: '😄', label: 'Отлично' },
  { score: 8, emoji: '😁', label: 'Здорово' },
  { score: 9, emoji: '🤩', label: 'Супер' },
  { score: 10, emoji: '🥳', label: 'Прекрасно' },
]

export default function MoodCheckIn() {
  const [selected, setSelected] = useState<number | null>(null)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get<{ score: number } | null>('/api/mood/today').then(({ data }) => {
      if (data) {
        setSelected(data.score)
        setSaved(true)
      }
    }).catch(() => {})
  }, [])

  const handleSelect = async (score: number) => {
    if (loading) return
    setSelected(score)
    setLoading(true)
    try {
      await api.post('/api/mood', { score })
      setSaved(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mood-checkin">
      <AnimatePresence mode="wait">
        <motion.div
          key={saved ? 'saved' : 'prompt'}
          className="mood-checkin__label"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.2 }}
        >
          {saved ? 'Настроение сегодня отмечено' : 'Как вы себя чувствуете сегодня?'}
        </motion.div>
      </AnimatePresence>
      <div className="mood-checkin__emojis">
        {MOODS.map(({ score, emoji, label }) => {
          const isActive = selected === score
          return (
            <motion.button
              key={score}
              className={`mood-checkin__btn${isActive ? ' mood-checkin__btn--active' : ''}`}
              onClick={() => handleSelect(score)}
              disabled={loading}
              title={label}
              whileHover={{ scale: 1.12, y: -3 }}
              whileTap={{ scale: 0.9 }}
              animate={isActive ? { scale: 1.1, y: -3 } : { scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              <motion.span
                animate={isActive ? { fontSize: '24px' } : { fontSize: '20px' }}
                transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                style={{ display: 'block', lineHeight: 1 }}
              >
                {emoji}
              </motion.span>
              <span>{score}</span>
            </motion.button>
          )
        })}
      </div>
      <AnimatePresence>
        {saved && (
          <motion.div
            className="mood-checkin__saved"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            ✓ Настроение сохранено
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
