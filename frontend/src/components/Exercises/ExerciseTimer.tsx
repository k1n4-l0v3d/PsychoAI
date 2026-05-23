import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { X, CheckCircle, Play, Pause, RotateCcw } from 'lucide-react'
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

export default function ExerciseTimer({ exercise, lang, onComplete, onClose }: Props) {
  const { t } = useTranslation()
  const steps = exercise.content.steps
  const stepDurations = exercise.content.step_durations
  const totalCycles = exercise.content.cycles ?? 0
  const isBreathing = !!stepDurations && stepDurations.length === steps.length && totalCycles > 0

  const initialTime = isBreathing ? stepDurations[0] : exercise.duration_sec

  const [running, setRunning] = useState(false)
  const [step, setStep] = useState(0)
  const [cycle, setCycle] = useState(1)
  const [timeLeft, setTimeLeft] = useState(initialTime)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!running || done || timeLeft <= 0) return
    const id = setInterval(() => setTimeLeft((t) => t - 1), 1000)
    return () => clearInterval(id)
  }, [running, timeLeft, done])

  // Breathing: advance step/cycle when step timer hits 0
  useEffect(() => {
    if (!isBreathing || done || !running) return
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
        setRunning(false)
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

  const reset = () => {
    setRunning(false)
    setDone(false)
    setStep(0)
    setCycle(1)
    setTimeLeft(initialTime)
  }

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
          <div className="exercise-timer" style={{ opacity: running || done ? 1 : 0.35 }}>{mm}:{ss}</div>
        ) : null}

        {!isBreathing && <div className="exercise-steps">
          {steps.map((s, i) => (
            <div
              key={i}
              className={`exercise-step ${running && i === step ? 'exercise-step--active' : ''} ${i < step ? 'exercise-step--done' : ''}`}
            >
              <span className="step-num">{i + 1}</span>
              <span>{lang === 'ru' ? s.ru : s.en}</span>
            </div>
          ))}
        </div>}

        <div className="exercise-controls">
          {!done ? (
            <>
              <button className="btn-primary exercise-play-btn" onClick={() => setRunning((r) => !r)}>
                {running
                  ? <><Pause size={16} /> Пауза</>
                  : <><Play size={16} /> {timeLeft === initialTime ? 'Старт' : 'Продолжить'}</>
                }
              </button>
              {timeLeft < initialTime && (
                <button className="btn-ghost exercise-reset-btn" onClick={reset}>
                  <RotateCcw size={15} />
                </button>
              )}
            </>
          ) : (
            <button className="btn-primary" onClick={onComplete}>
              <CheckCircle size={16} /> {t('exercises.complete')}
            </button>
          )}
        </div>

        {!done && (
          <button className="btn-ghost" style={{ fontSize: 13 }} onClick={onComplete}>
            <CheckCircle size={14} /> {t('exercises.complete')}
          </button>
        )}
      </motion.div>
    </motion.div>
  )
}
