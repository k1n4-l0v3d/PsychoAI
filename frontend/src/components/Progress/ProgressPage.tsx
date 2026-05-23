import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import api from '../../api/client'
import MoodHeatmap from './MoodHeatmap'

interface DayMood { date: string; avg: number }
interface Badge { id: string; label: string; icon: string }
interface ProgressData {
  mood_chart: DayMood[]
  diary_streak: number
  exercise_streak: number
  badges: Badge[]
}

interface Insight { text: string; trend: 'up' | 'down' | 'neutral' }

const DAY_NAMES = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота']

function computeInsights(chart: DayMood[]): Insight[] {
  if (chart.length < 2) return []
  const insights: Insight[] = []

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const daysDiff = (iso: string) => Math.floor((today.getTime() - new Date(iso).getTime()) / 86400000)

  const thisWeek = chart.filter(d => daysDiff(d.date) < 7)
  const lastWeek = chart.filter(d => { const n = daysDiff(d.date); return n >= 7 && n < 14 })

  if (thisWeek.length >= 2 && lastWeek.length >= 2) {
    const avg = (arr: DayMood[]) => arr.reduce((s, d) => s + d.avg, 0) / arr.length
    const diff = avg(thisWeek) - avg(lastWeek)
    if (Math.abs(diff) >= 0.3) {
      const sign = diff > 0 ? '+' : ''
      insights.push({
        text: `На этой неделе настроение ${diff > 0 ? 'лучше' : 'хуже'}, чем на прошлой ${sign}${diff.toFixed(1)} балла`,
        trend: diff > 0 ? 'up' : 'down',
      })
    } else {
      insights.push({ text: 'Настроение на этой неделе стабильное', trend: 'neutral' })
    }
  }

  const byDay: Record<number, number[]> = {}
  for (const d of chart) {
    const dow = new Date(d.date).getDay()
    if (!byDay[dow]) byDay[dow] = []
    byDay[dow].push(d.avg)
  }
  let bestDay = -1, bestAvg = 0
  for (const [dow, avgs] of Object.entries(byDay)) {
    if (avgs.length < 2) continue
    const avg = avgs.reduce((s, v) => s + v, 0) / avgs.length
    if (avg > bestAvg) { bestAvg = avg; bestDay = Number(dow) }
  }
  if (bestDay >= 0) {
    insights.push({ text: `Лучший день недели — ${DAY_NAMES[bestDay]} (среднее ${bestAvg.toFixed(1)})`, trend: 'neutral' })
  }

  if (chart.length >= 6 && thisWeek.length < 2) {
    const last3avg = chart.slice(-3).reduce((s, d) => s + d.avg, 0) / 3
    const prev3avg = chart.slice(-6, -3).reduce((s, d) => s + d.avg, 0) / 3
    const diff = last3avg - prev3avg
    if (Math.abs(diff) >= 0.5) {
      insights.push({
        text: diff > 0 ? 'Последние дни настроение улучшается 📈' : 'Последние дни настроение снижается 📉',
        trend: diff > 0 ? 'up' : 'down',
      })
    }
  }

  return insights
}

export default function ProgressPage() {
  const { t } = useTranslation()
  const [data, setData] = useState<ProgressData | null>(null)

  useEffect(() => {
    api.get<ProgressData>('/api/progress').then(({ data }) => setData(data))
  }, [])

  if (!data) return <div className="page"><p>...</p></div>

  return (
    <div className="page">
      <h1 className="page-title">{t('progress.title')}</h1>

      <div className="progress-grid">
        <div className="card progress-streaks">
          <div className="streak-item">
            <span className="streak-icon">📔</span>
            <div>
              <div className="streak-value">{data.diary_streak}</div>
              <div className="streak-label">{t('progress.streak')} ({t('nav.diary')})</div>
            </div>
          </div>
          <div className="streak-item">
            <span className="streak-icon">🧘</span>
            <div>
              <div className="streak-value">{data.exercise_streak}</div>
              <div className="streak-label">{t('progress.streak')} ({t('nav.exercises')})</div>
            </div>
          </div>
        </div>

        <div className="card progress-chart-card">
          <h2 className="card-title">{t('progress.moodChart')}</h2>
          {data.mood_chart.length === 0 ? (
            <p className="empty-msg">Нет данных</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.mood_chart}>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                <YAxis domain={[1, 10]} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    color: 'var(--text-primary)',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="avg"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={{ fill: 'var(--accent)', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {(() => {
          const insights = computeInsights(data.mood_chart)
          return insights.length > 0 ? (
            <div className="card mood-insights-card">
              <h2 className="card-title">💡 Инсайты</h2>
              <div className="mood-insights-list">
                {insights.map((ins, i) => (
                  <div key={i} className={`mood-insight mood-insight--${ins.trend}`}>
                    <span className="mood-insight__icon">
                      {ins.trend === 'up' ? '↑' : ins.trend === 'down' ? '↓' : '●'}
                    </span>
                    <span className="mood-insight__text">{ins.text}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null
        })()}

        <div className="card">
          <h2 className="card-title">🗓️ Календарь настроения</h2>
          <MoodHeatmap />
        </div>

        {data.badges.length > 0 && (
          <div className="card progress-badges">
            <h2 className="card-title">{t('progress.badges')}</h2>
            <div className="badges-row">
              {data.badges.map((b) => (
                <div key={b.id} className="badge-item">
                  <span className="badge-icon">{b.icon}</span>
                  <span className="badge-label">{b.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
