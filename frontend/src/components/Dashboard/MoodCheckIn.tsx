import { useEffect, useState } from 'react'
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
      <div className="mood-checkin__label">
        {saved ? 'Настроение сегодня отмечено' : 'Как вы себя чувствуете сегодня?'}
      </div>
      <div className="mood-checkin__emojis">
        {MOODS.map(({ score, emoji, label }) => (
          <button
            key={score}
            className={`mood-checkin__btn${selected === score ? ' mood-checkin__btn--active' : ''}`}
            onClick={() => handleSelect(score)}
            disabled={loading}
            title={label}
          >
            {emoji}
            <span>{score}</span>
          </button>
        ))}
      </div>
      {saved && <div className="mood-checkin__saved">✓ Настроение сохранено</div>}
    </div>
  )
}
