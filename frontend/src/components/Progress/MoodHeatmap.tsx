import { useEffect, useState } from 'react'
import api from '../../api/client'

interface CalendarDay { date: string; score: number }

const SCORE_COLORS = [
  '', // 0 unused
  '#ef4444', // 1
  '#f97316', // 2
  '#f97316', // 3
  '#eab308', // 4
  '#eab308', // 5
  '#84cc16', // 6
  '#22c55e', // 7
  '#22c55e', // 8
  '#10b981', // 9
  '#10b981', // 10
]

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const MONTHS_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstWeekday(year: number, month: number): number {
  // Monday = 0
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1
}

export default function MoodHeatmap() {
  const [current, setCurrent] = useState(() => new Date())
  const [days, setDays] = useState<CalendarDay[]>([])
  const today = new Date()

  const monthKey = getMonthKey(current)

  useEffect(() => {
    api.get<CalendarDay[]>(`/api/mood/calendar?month=${monthKey}`)
      .then(({ data }) => setDays(data))
      .catch(() => setDays([]))
  }, [monthKey])

  const scoreMap = new Map(days.map((d) => [d.date, d.score]))

  const year = current.getFullYear()
  const month = current.getMonth()
  const daysCount = getDaysInMonth(year, month)
  const firstWeekday = getFirstWeekday(year, month)

  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysCount }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const prevMonth = () => setCurrent((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  const nextMonth = () => setCurrent((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
  const canGoNext = getMonthKey(current) < getMonthKey(today)

  return (
    <div className="mood-heatmap">
      <div className="mood-heatmap__nav">
        <button className="mood-heatmap__nav-btn" onClick={prevMonth}>‹</button>
        <span className="mood-heatmap__month">{MONTHS_RU[month]} {year}</span>
        <button className="mood-heatmap__nav-btn" onClick={nextMonth} disabled={!canGoNext}
          style={{ opacity: canGoNext ? 1 : 0.3 }}>›</button>
      </div>

      <div className="mood-heatmap__weekdays">
        {WEEKDAYS.map((d) => (
          <div key={d} className="mood-heatmap__weekday">{d}</div>
        ))}
      </div>

      <div className="mood-heatmap__grid">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} className="mood-heatmap__cell mood-heatmap__cell--empty" />
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const score = scoreMap.get(dateStr)
          const isToday =
            today.getDate() === day && today.getMonth() === month && today.getFullYear() === year
          return (
            <div
              key={i}
              className={`mood-heatmap__cell${isToday ? ' mood-heatmap__cell--today' : ''}`}
              style={score ? { background: SCORE_COLORS[score] } : undefined}
              data-score={score ?? undefined}
              title={score ? `${dateStr}: ${score}/10` : dateStr}
            />
          )
        })}
      </div>

      <div className="mood-heatmap__legend">
        <span className="mood-heatmap__legend-label">Плохо</span>
        <div className="mood-heatmap__legend-cells">
          {[1, 3, 5, 7, 10].map((s) => (
            <div key={s} className="mood-heatmap__legend-cell" style={{ background: SCORE_COLORS[s] }} />
          ))}
        </div>
        <span className="mood-heatmap__legend-label">Отлично</span>
      </div>
    </div>
  )
}
