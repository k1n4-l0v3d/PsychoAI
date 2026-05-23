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
