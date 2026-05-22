import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from './store/authStore'
import { applyTheme } from './themes'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import AppLayout from './pages/AppLayout'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  return user ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const { i18n } = useTranslation()

  useEffect(() => {
    if (user) {
      applyTheme(user.theme)
      i18n.changeLanguage(user.lang)
    } else {
      applyTheme('dark')
    }
  }, [user?.theme, user?.lang])

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname.split('/')[1]}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        <Routes location={location}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/*"
            element={
              <PrivateRoute>
                <AppLayout />
              </PrivateRoute>
            }
          />
        </Routes>
      </motion.div>
    </AnimatePresence>
  )
}
