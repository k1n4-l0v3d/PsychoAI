import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/authStore'

export default function SettingsPage() {
  const { t, i18n } = useTranslation()
  const { user, updateProfile } = useAuthStore()

  const handleLang = async (lang: string) => {
    await updateProfile(lang, user?.theme || 'dark')
    i18n.changeLanguage(lang)
  }

  const handleTheme = async (theme: string) => {
    await updateProfile(user?.lang || 'ru', theme)
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
    </div>
  )
}
