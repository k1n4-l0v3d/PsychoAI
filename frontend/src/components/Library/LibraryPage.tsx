import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Search, ExternalLink } from 'lucide-react'
import api from '../../api/client'

interface Result {
  title: string
  url: string
  content: string
  score: number
}

export default function LibraryPage() {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const search = async () => {
    if (!query.trim()) return
    setLoading(true)
    setSearched(true)
    try {
      const { data } = await api.get<Result[]>('/api/resources/search', { params: { q: query } })
      setResults(data)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <h1 className="page-title">{t('library.title')}</h1>

      <div className="search-row">
        <input
          className="search-input"
          placeholder={t('library.search')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
        />
        <button className="btn-primary" onClick={search} disabled={loading}>
          <Search size={16} /> {loading ? '...' : t('library.searchBtn')}
        </button>
      </div>

      {searched && results.length === 0 && !loading && (
        <p className="empty-msg">{t('library.noResults')}</p>
      )}

      <div className="results-grid">
        {results.map((r, i) => (
          <motion.a
            key={r.url}
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
            className="card result-card"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <div className="result-header">
              <h3 className="result-title">{r.title}</h3>
              <ExternalLink size={14} className="result-icon" />
            </div>
            <p className="result-content">{r.content.slice(0, 200)}...</p>
          </motion.a>
        ))}
      </div>
    </div>
  )
}
