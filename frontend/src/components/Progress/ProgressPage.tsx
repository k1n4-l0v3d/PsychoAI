import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import api from '../../api/client'

interface DayMood { date: string; avg: number }
interface Badge { id: string; label: string; icon: string }
interface ProgressData {
  mood_chart: DayMood[]
  diary_streak: number
  exercise_streak: number
  badges: Badge[]
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
