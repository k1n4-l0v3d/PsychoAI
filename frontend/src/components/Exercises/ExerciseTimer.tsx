import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { X, CheckCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface Exercise {
  slug: string
  title_ru: string
  title_en: string
  content: {
    steps: { ru: string; en: string }[]
    cycles?: number
    step_durations?: number[]
  }
  duration_sec: number
}

interface Props {
  exercise: Exercise
  lang: string
  onComplete: () => void
  onClose: () => void
}

export default function ExerciseTimer({ exercise, lang, onComplete, onClose }: Props) {
  const { t } = useTranslation()
  const steps = exercise.content.steps
  const stepDurations = exercise.content.step_durations
  const totalCycles = exercise.content.cycles ?? 0
  const isBreathing = !!stepDurations && stepDurations.length === steps.length && totalCycles > 0

  const [step, setStep] = useState(0)
  const [cycle, setCycle] = useState(1)
  // For breathing: countdown per step. For others: countdown total.
  const [timeLeft, setTimeLeft] = useState(
    isBreathing ? stepDurations[0] : exercise.duration_sec
  )
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (done) return
    if (timeLeft <= 0) return
    const id = setInterval(() => setTimeLeft((t) => t - 1), 1000)
    return () => clearInterval(id)
  }, [timeLeft, done])

  // Breathing: advance step/cycle when step timer hits 0
  useEffect(() => {
    if (!isBreathing || done) return
    if (timeLeft > 0) return

    const nextStep = step + 1
    if (nextStep < steps.length) {
      setStep(nextStep)
      setTimeLeft(stepDurations[nextStep])
    } else {
      const nextCycle = cycle + 1
      if (nextCycle <= totalCycles) {
        setCycle(nextCycle)
        setStep(0)
        setTimeLeft(stepDurations[0])
      } else {
        setDone(true)
      }
    }
  }, [timeLeft])

  // Non-breathing: advance step based on elapsed total time
  useEffect(() => {
    if (isBreathing) return
    const stepDuration = exercise.duration_sec > 0 && steps.length > 0
      ? Math.floor(exercise.duration_sec / steps.length)
      : 0
    if (stepDuration <= 0) return
    const elapsed = exercise.duration_sec - timeLeft
    const newStep = Math.min(Math.floor(elapsed / stepDuration), steps.length - 1)
    setStep(newStep)
  }, [timeLeft])

  const mm = String(Math.floor(timeLeft / 60)).padStart(2, '0')
  const ss = String(timeLeft % 60).padStart(2, '0')

  return (
    <motion.div
      className="overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="card exercise-modal"
        initial={{ scale: 0.95, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 16 }}
      >
        <button className="modal-close" onClick={onClose}><X size={20} /></button>
        <h2 className="exercise-modal-title">
          {lang === 'ru' ? exercise.title_ru : exercise.title_en}
        </h2>

        {isBreathing ? (
          <>
            <div className="exercise-timer">{ss}</div>
            <div className="exercise-cycle-label">
              {lang === 'ru' ? `Цикл ${cycle} из ${totalCycles}` : `Cycle ${cycle} of ${totalCycles}`}
            </div>
          </>
        ) : exercise.duration_sec > 0 ? (
          <div className="exercise-timer">{mm}:{ss}</div>
        ) : null}

        <div className="exercise-steps">
          {steps.map((s, i) => (
            <div
              key={i}
              className={`exercise-step ${i === step ? 'exercise-step--active' : ''} ${i < step ? 'exercise-step--done' : ''}`}
            >
              <span className="step-num">{i + 1}</span>
              <span>{lang === 'ru' ? s.ru : s.en}</span>
            </div>
          ))}
        </div>

        <button className="btn-primary" onClick={onComplete}>
          <CheckCircle size={16} /> {t('exercises.complete')}
        </button>
      </motion.div>
    </motion.div>
  )
}
