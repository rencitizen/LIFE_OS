import { create } from 'zustand'
import type { User, Couple } from '@/types'

interface AuthState {
  user: User | null
  couple: Couple | null
  partner: User | null
  setUser: (user: User | null) => void
  setCouple: (couple: Couple | null) => void
  setPartner: (partner: User | null) => void
  reset: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  couple: null,
  partner: null,
  setUser: (user) => set({ user }),
  setCouple: (couple) => set({ couple }),
  setPartner: (partner) => set({ partner }),
  reset: () => set({ user: null, couple: null, partner: null }),
}))
