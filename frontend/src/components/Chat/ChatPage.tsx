import { useEffect, useState, useRef } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { Plus, Send, Pencil, Trash2, Check, X } from 'lucide-react'
import api from '../../api/client'
import MessageBubble from './MessageBubble'
import ChipSuggestions from './ChipSuggestions'
import DiaryEntryModal from './DiaryEntryModal'
import ExerciseTimer from '../Exercises/ExerciseTimer'
import { useAuthStore } from '../../store/authStore'

interface Session { id: string; title: string; created_at: string }
interface Message { id: string; role: 'user' | 'assistant'; content: string; created_at: string }
interface Exercise {
  id: string; slug: string; type: string; title_ru: string; title_en: string
  content: { steps: { ru: string; en: string }[]; cycles?: number; step_durations?: number[] }
  duration_sec: number
}

const CHIP_TO_SLUG: Record<string, string> = {
  'Дыхание 4-7-8': 'breathing-478',
  'Медитация перед сном': 'sleep-meditation',
  'КПТ-техника': 'cbt-thought-record',
  'Коробочное дыхание': 'box-breathing',
  'Прогрессивная релаксация': 'progressive-relaxation',
}

export default function ChatPage() {
  const { t } = useTranslation()
  const lang = useAuthStore((s) => s.user?.lang || 'ru')
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSession, setActiveSession] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [chips, setChips] = useState<string[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [diaryModal, setDiaryModal] = useState<string | null>(null)
  const [activeExercise, setActiveExercise] = useState<Exercise | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  const location = useLocation()

  useEffect(() => {
    api.get<Session[]>('/api/sessions').then(({ data }) => {
      setSessions(data)
      const targetId = (location.state as { sessionId?: string } | null)?.sessionId
      if (targetId && data.find((s) => s.id === targetId)) {
        loadSession(targetId)
      } else if (data.length > 0) {
        loadSession(data[0].id)
      }
    })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  useEffect(() => {
    if (editingId) editInputRef.current?.focus()
  }, [editingId])

  const loadSession = async (id: string) => {
    setActiveSession(id)
    setChips([])
    const { data } = await api.get<Message[]>(`/api/sessions/${id}/messages`)
    setMessages(data)
  }

  const createSession = async (): Promise<Session> => {
    const { data } = await api.post<Session>('/api/sessions')
    setSessions((prev) => [data, ...prev])
    setActiveSession(data.id)
    setMessages([])
    setChips([])
    return data
  }

  const startEdit = (s: Session, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(s.id)
    setEditingTitle(s.title)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditingTitle('')
  }

  const confirmEdit = async (id: string) => {
    const title = editingTitle.trim()
    if (!title) { cancelEdit(); return }
    await api.patch(`/api/sessions/${id}`, { title })
    setSessions((prev) => prev.map((s) => s.id === id ? { ...s, title } : s))
    cancelEdit()
  }

  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await api.delete(`/api/sessions/${id}`)
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id)
      if (activeSession === id) {
        if (next.length > 0) loadSession(next[0].id)
        else { setActiveSession(null); setMessages([]) }
      }
      return next
    })
  }

  const handleChip = async (chip: string) => {
    if (chip.includes('Записать в дневник') || chip.includes('diary')) {
      const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
      setDiaryModal(lastUserMsg?.content ?? '')
      return
    }

    const label = chip.replace(/^\p{Emoji}\s*/u, '').trim()
    const slug = CHIP_TO_SLUG[label]
    if (slug) {
      try {
        const { data } = await api.get<Exercise>(`/api/exercises/${slug}`)
        setActiveExercise(data)
      } catch {}
      return
    }

    sendMessage(chip)
  }

  const sendMessage = async (content: string) => {
    if (!content.trim() || streaming) return
    setInput('')
    setChips([])

    let sessionId = activeSession
    if (!sessionId) {
      const s = await createSession()
      sessionId = s.id
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])
    setStreaming(true)

    const assistantMsg: Message = {
      id: 'streaming',
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, assistantMsg])

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/api/sessions/${sessionId}/chat`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ content }),
        }
      )

      const reader = resp.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        let eventType = 'message'
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (eventType === 'chips') {
              try { setChips(JSON.parse(data)) } catch {}
            } else if (eventType === 'message' || eventType === '') {
              fullText += data.replace(/\\n/g, '\n')
              setMessages((prev) => prev.map((m) =>
                m.id === 'streaming' ? { ...m, content: fullText } : m
              ))
            }
            eventType = 'message'
          } else if (line === '') {
            eventType = 'message'
          }
        }
      }

      setMessages((prev) => prev.map((m) =>
        m.id === 'streaming' ? { ...m, id: Date.now().toString() } : m
      ))
    } finally {
      setStreaming(false)
    }
  }

  return (
    <>
    <AnimatePresence>
      {diaryModal !== null && (
        <DiaryEntryModal
          initialText={diaryModal}
          onSaved={() => { setDiaryModal(null); setChips([]) }}
          onClose={() => setDiaryModal(null)}
        />
      )}
    </AnimatePresence>
    <AnimatePresence>
      {activeExercise && (
        <ExerciseTimer
          exercise={activeExercise}
          lang={lang}
          onComplete={async () => {
            await api.post(`/api/exercises/${activeExercise.slug}/complete`)
            setActiveExercise(null)
          }}
          onClose={() => setActiveExercise(null)}
        />
      )}
    </AnimatePresence>
    <div className="chat-layout">
      <aside className="sessions-panel">
        <button className="sessions-new-btn" onClick={createSession}>
          <Plus size={16} /> {t('chat.newSession')}
        </button>
        <div className="sessions-list">
          {sessions.map((s) => (
            <div
              key={s.id}
              className={`session-item ${s.id === activeSession ? 'session-item--active' : ''}`}
              onClick={() => !editingId && loadSession(s.id)}
            >
              {editingId === s.id ? (
                <div className="session-edit-row" onClick={(e) => e.stopPropagation()}>
                  <input
                    ref={editInputRef}
                    className="session-edit-input"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') confirmEdit(s.id)
                      if (e.key === 'Escape') cancelEdit()
                    }}
                  />
                  <button className="session-action-btn" onClick={() => confirmEdit(s.id)}><Check size={13} /></button>
                  <button className="session-action-btn" onClick={cancelEdit}><X size={13} /></button>
                </div>
              ) : (
                <>
                  <span className="session-title">{s.title}</span>
                  <div className="session-actions">
                    <button className="session-action-btn" onClick={(e) => startEdit(s, e)}><Pencil size={13} /></button>
                    <button className="session-action-btn session-action-btn--danger" onClick={(e) => deleteSession(s.id, e)}><Trash2 size={13} /></button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </aside>

      <div className="chat-main">
        <div className="chat-messages">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
          </AnimatePresence>
          {streaming && messages[messages.length - 1]?.content === '' && (
            <div className="chat-thinking">{t('chat.thinking')}</div>
          )}
          <div ref={bottomRef} />
        </div>

        <ChipSuggestions chips={chips} onChip={handleChip} />

        <form className="chat-input-area" onSubmit={(e) => { e.preventDefault(); sendMessage(input) }}>
          <input
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('chat.placeholder')}
            disabled={streaming}
          />
          <button className="chat-send-btn" type="submit" disabled={streaming || !input.trim()}>
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
    </>
  )
}
