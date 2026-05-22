import { Routes, Route } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import Sidebar from '../components/Sidebar/Sidebar'
import DashboardPage from '../components/Dashboard/DashboardPage'
import ChatPage from '../components/Chat/ChatPage'
import DiaryPage from '../components/Diary/DiaryPage'
import ExercisesPage from '../components/Exercises/ExercisesPage'
import LibraryPage from '../components/Library/LibraryPage'
import ProgressPage from '../components/Progress/ProgressPage'
import SettingsPage from '../pages/SettingsPage'

export default function AppLayout() {
  const location = useLocation()

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="app-main">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ height: '100%' }}
          >
            <Routes location={location}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/diary" element={<DiaryPage />} />
              <Route path="/exercises" element={<ExercisesPage />} />
              <Route path="/library" element={<LibraryPage />} />
              <Route path="/progress" element={<ProgressPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
