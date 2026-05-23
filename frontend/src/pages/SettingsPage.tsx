import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import api from '../api/client'

export default function SettingsPage() {
  const { t, i18n } = useTranslation()
  const { user, updateProfile } = useAuthStore()

  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [pwStatus, setPwStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [pwError, setPwError] = useState('')

  const handleLang = async (lang: string) => {
    await updateProfile(lang, user?.theme || 'dark')
    i18n.changeLanguage(lang)
  }

  const handleTheme = async (theme: string) => {
    await updateProfile(user?.lang || 'ru', theme)
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwError('')
    if (pw.next !== pw.confirm) { setPwError('Новые пароли не совпадают'); return }
    if (pw.next.length < 6) { setPwError('Пароль должен быть не менее 6 символов'); return }
    setPwStatus('loading')
    try {
      await api.put('/api/user/password', { current_password: pw.current, new_password: pw.next })
      setPwStatus('success')
      setPw({ current: '', next: '', confirm: '' })
      setTimeout(() => setPwStatus('idle'), 3000)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setPwError(msg === 'current password is incorrect' ? 'Неверный текущий пароль' : 'Ошибка при смене пароля')
      setPwStatus('error')
    }
  }

  return (
    <div className="page">
      <h1 className="page-title">{t('settings.title')}</h1>

      <div className="settings-group">
        <h2 className="settings-label">{t('settings.language')}</h2>
        <div className="settings-row">
          <button
            className={`settings-btn ${user?.lang === 'ru' ? 'settings-btn--active' : ''}`}
            onClick={() => handleLang('ru')}
          >
            Русский
          </button>
          <button
            className={`settings-btn ${user?.lang === 'en' ? 'settings-btn--active' : ''}`}
            onClick={() => handleLang('en')}
          >
            English
          </button>
        </div>
      </div>

      <div className="settings-group">
        <h2 className="settings-label">{t('settings.theme')}</h2>
        <div className="settings-row">
          <button
            className={`settings-btn ${user?.theme === 'dark' ? 'settings-btn--active' : ''}`}
            onClick={() => handleTheme('dark')}
          >
            🌙 {t('settings.dark')}
          </button>
          <button
            className={`settings-btn ${user?.theme === 'light' ? 'settings-btn--active' : ''}`}
            onClick={() => handleTheme('light')}
          >
            ☀️ {t('settings.light')}
          </button>
        </div>
      </div>

      <div className="settings-group">
        <h2 className="settings-label">🔒 Смена пароля</h2>
        <form className="pw-form" onSubmit={handleChangePassword}>
          <div className="form-row">
            <label className="form-label">Текущий пароль</label>
            <input
              type="password"
              className="form-input"
              value={pw.current}
              onChange={e => setPw(p => ({ ...p, current: e.target.value }))}
              autoComplete="current-password"
              required
            />
          </div>
          <div className="form-row">
            <label className="form-label">Новый пароль</label>
            <input
              type="password"
              className="form-input"
              value={pw.next}
              onChange={e => setPw(p => ({ ...p, next: e.target.value }))}
              autoComplete="new-password"
              required
            />
          </div>
          <div className="form-row">
            <label className="form-label">Повторите новый пароль</label>
            <input
              type="password"
              className="form-input"
              value={pw.confirm}
              onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))}
              autoComplete="new-password"
              required
            />
          </div>
          {pwError && <div className="pw-error">{pwError}</div>}
          {pwStatus === 'success' && (
            <div className="pw-success"><CheckCircle size={14} /> Пароль успешно изменён</div>
          )}
          <button
            type="submit"
            className="btn-primary pw-submit"
            disabled={pwStatus === 'loading'}
          >
            {pwStatus === 'loading' ? 'Сохранение...' : 'Сменить пароль'}
          </button>
        </form>
      </div>
    </div>
  )
}
