import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Edit2, Trash2, X, Check } from 'lucide-react'
import api from '../../api/client'

interface Entry {
  id: string
  mood: number
  text: string
  tags: string[]
  created_at: string
}

export default function DiaryPage() {
  const { t } = useTranslation()
  const [entries, setEntries] = useState<Entry[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [mood, setMood] = useState(5)
  const [text, setText] = useState('')
  const [tagsInput, setTagsInput] = useState('')

  useEffect(() => {
    api.get<Entry[]>('/api/diary').then(({ data }) => setEntries(data))
  }, [])

  const resetForm = () => {
    setShowForm(false)
    setEditId(null)
    setMood(5)
    setText('')
    setTagsInput('')
  }

  const openEdit = (e: Entry) => {
    setEditId(e.id)
    setMood(e.mood)
    setText(e.text)
    setTagsInput(e.tags.join(', '))
    setShowForm(true)
  }

  const save = async () => {
    const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean)
    if (editId) {
      const { data } = await api.put<Entry>(`/api/diary/${editId}`, { mood, text, tags })
      setEntries((prev) => prev.map((e) => (e.id === editId ? data : e)))
    } else {
      const { data } = await api.post<Entry>('/api/diary', { mood, text, tags })
      setEntries((prev) => [data, ...prev])
    }
    resetForm()
  }

  const remove = async (id: string) => {
    await api.delete(`/api/diary/${id}`)
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  const moodColor = (m: number) => {
    if (m <= 3) return '#ef4444'
    if (m <= 6) return '#f59e0b'
    return '#22c55e'
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">{t('diary.title')}</h1>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={16} /> {t('diary.newEntry')}
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            className="card form-card"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <div className="form-row">
              <label className="form-label">{t('diary.mood')}: {mood}</label>
              <input
                type="range" min={1} max={10} value={mood}
                onChange={(e) => setMood(Number(e.target.value))}
                style={{ accentColor: moodColor(mood) }}
              />
            </div>
            <textarea
              className="form-textarea"
              placeholder={t('diary.text')}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <input
              className="form-input"
              placeholder={t('diary.tags')}
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
            />
            <div className="form-actions">
              <button className="btn-primary" onClick={save}><Check size={16} /> {t('diary.save')}</button>
              <button className="btn-ghost" onClick={resetForm}><X size={16} /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="entries-list">
        {entries.length === 0 && <p className="empty-msg">{t('diary.noEntries')}</p>}
        <AnimatePresence initial={false}>
          {entries.map((e) => (
            <motion.div
              key={e.id}
              className="card entry-card"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              layout
            >
              <div className="entry-header">
                <span className="entry-mood" style={{ color: moodColor(e.mood) }}>
                  {e.mood}/10
                </span>
                <span className="entry-date">
                  {new Date(e.created_at).toLocaleDateString()}
                </span>
                <div className="entry-actions">
                  <button className="icon-btn" onClick={() => openEdit(e)}><Edit2 size={14} /></button>
                  <button className="icon-btn icon-btn--danger" onClick={() => remove(e.id)}><Trash2 size={14} /></button>
                </div>
              </div>
              {e.text && <p className="entry-text">{e.text}</p>}
              {e.tags.length > 0 && (
                <div className="entry-tags">
                  {e.tags.map((tag) => <span key={tag} className="tag">{tag}</span>)}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
