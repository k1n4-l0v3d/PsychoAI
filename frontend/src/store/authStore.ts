import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../api/client'

export interface User {
  id: string
  email: string
  lang: 'ru' | 'en'
  theme: 'dark' | 'light'
}

interface AuthState {
  user: User | null
  setUser: (user: User | null) => void
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  updateProfile: (lang: string, theme: string) => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      setUser: (user) => set({ user }),

      login: async (email, password) => {
        const { data } = await api.post<User>('/auth/login', { email, password })
        set({ user: data })
      },

      register: async (email, password) => {
        const { data } = await api.post<User>('/auth/register', { email, password })
        set({ user: data })
      },

      logout: async () => {
        await api.post('/auth/logout')
        set({ user: null })
      },

      updateProfile: async (lang, theme) => {
        await api.put('/api/user', { lang, theme })
        const user = get().user
        if (user) set({ user: { ...user, lang: lang as 'ru' | 'en', theme: theme as 'dark' | 'light' } })
      },
    }),
    { name: 'auth-storage', partialize: (s) => ({ user: s.user }) }
  )
)
