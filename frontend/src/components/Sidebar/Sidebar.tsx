import { motion } from 'framer-motion'
import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Home, MessageCircle, BookOpen, Dumbbell, Library, TrendingUp, Settings, LogOut, Pin, PinOff
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useNavigate } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/', icon: Home, key: 'home' },
  { to: '/chat', icon: MessageCircle, key: 'chat' },
  { to: '/diary', icon: BookOpen, key: 'diary' },
  { to: '/exercises', icon: Dumbbell, key: 'exercises' },
  { to: '/library', icon: Library, key: 'library' },
  { to: '/progress', icon: TrendingUp, key: 'progress' },
]

export default function Sidebar() {
  const { t } = useTranslation()
  const [hovered, setHovered] = useState(false)
  const [pinned, setPinned] = useState(() => localStorage.getItem('sidebar-pinned') === 'true')
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  const expanded = pinned || hovered

  const togglePin = (e: React.MouseEvent) => {
    e.preventDefault()
    const next = !pinned
    setPinned(next)
    localStorage.setItem('sidebar-pinned', String(next))
  }

  return (
    <motion.nav
      className="sidebar"
      animate={{ width: expanded ? 200 : 56 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      onHoverStart={() => !pinned && setHovered(true)}
      onHoverEnd={() => !pinned && setHovered(false)}
    >
      <NavLink to="/" className="sidebar-logo" style={{ textDecoration: 'none' }}>
        <span className="sidebar-logo-icon">🧠</span>
        <motion.span
          className="sidebar-logo-text"
          animate={{ opacity: expanded ? 1 : 0, x: expanded ? 0 : -4 }}
          transition={{ delay: 0.05 }}
        >
          ПомогAI
        </motion.span>
        <motion.button
          className="sidebar-pin-btn"
          onClick={togglePin}
          animate={{ opacity: expanded ? 1 : 0 }}
          transition={{ delay: 0.05 }}
          title={pinned ? 'Открепить' : 'Закрепить'}
        >
          {pinned ? <PinOff size={14} /> : <Pin size={14} />}
        </motion.button>
      </NavLink>

      <div className="sidebar-nav">
        {NAV_ITEMS.map(({ to, icon: Icon, key }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) =>
            `sidebar-item ${isActive ? 'sidebar-item--active' : ''}`
          }>
            <Icon size={20} className="sidebar-icon" />
            <motion.div
              className="sidebar-item-text"
              animate={{ opacity: expanded ? 1 : 0, x: expanded ? 0 : -4 }}
              transition={{ delay: 0.05 }}
            >
              <span className="sidebar-item-name">{t(`nav.${key}`)}</span>
              <span className="sidebar-item-desc">{t(`nav.${key}Desc`)}</span>
            </motion.div>
          </NavLink>
        ))}
      </div>

      <div className="sidebar-bottom">
        <NavLink to="/settings" className={({ isActive }) =>
          `sidebar-item ${isActive ? 'sidebar-item--active' : ''}`
        }>
          <Settings size={20} className="sidebar-icon" />
          <motion.span
            className="sidebar-item-name"
            animate={{ opacity: expanded ? 1 : 0 }}
            transition={{ delay: 0.05 }}
          >
            {t('settings.title')}
          </motion.span>
        </NavLink>
        <button
          className="sidebar-item sidebar-item--logout"
          onClick={async () => { await logout(); navigate('/login') }}
        >
          <LogOut size={20} className="sidebar-icon" />
          <motion.span
            className="sidebar-item-name"
            animate={{ opacity: expanded ? 1 : 0 }}
            transition={{ delay: 0.05 }}
          >
            {t('settings.logout')}
          </motion.span>
        </button>
      </div>
    </motion.nav>
  )
}
