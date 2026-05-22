import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '../../api/client'

interface Props {
  initialText: string
  onSaved: () => void
  onClose: () => void
}

const moodColor = (m: number) => m <= 3 ? '#ef4444' : m <= 6 ? '#f59e0b' : '#22c55e'

export default function DiaryEntryModal({ initialText, onSaved, onClose }: Props) {
  const { t } = useTranslation()
  const [mood, setMood] = useState(5)
  const [text, setText] = useState(initialText)
  const [tagsInput, setTagsInput] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!text.trim()) return
    setSaving(true)
    try {
      const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean)
      await api.post('/api/diary', { mood, text, tags })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      className="overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="card diary-modal"
        initial={{ scale: 0.95, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 16 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="diary-modal-header">
          <h2 className="diary-modal-title">{t('diary.newEntry')}</h2>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="form-row">
          <label className="form-label">{t('diary.mood')}: <strong style={{ color: moodColor(mood) }}>{mood}/10</strong></label>
          <input
            type="range" min={1} max={10} value={mood}
            onChange={(e) => setMood(Number(e.target.value))}
            style={{ accentColor: moodColor(mood), width: '100%' }}
          />
        </div>

        <textarea
          className="form-textarea"
          placeholder={t('diary.text')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          autoFocus
        />

        <input
          className="form-input"
          placeholder={t('diary.tags')}
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
        />

        <div className="form-actions">
          <button className="btn-primary" onClick={save} disabled={saving || !text.trim()}>
            <Check size={16} /> {t('diary.save')}
          </button>
          <button className="btn-ghost" onClick={onClose}><X size={16} /></button>
        </div>
      </motion.div>
    </motion.div>
  )
}
