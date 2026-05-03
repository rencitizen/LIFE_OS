'use client'

import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { useFinanceStore } from '@/stores/finance-store'
import { useQuery } from '@tanstack/react-query'
import type { User, Couple } from '@/types'
import type { User as AuthUser } from '@supabase/supabase-js'

function toFallbackProfile(authUser: AuthUser): User {
  return {
    id: authUser.id,
    couple_id: null,
    display_name:
      (typeof authUser.user_metadata?.display_name === 'string' && authUser.user_metadata.display_name) ||
      (typeof authUser.user_metadata?.full_name === 'string' && authUser.user_metadata.full_name) ||
      authUser.email?.split('@')[0] ||
      'User',
    avatar_url:
      typeof authUser.user_metadata?.avatar_url === 'string' ? authUser.user_metadata.avatar_url : null,
    email: authUser.email ?? null,
    color: '#105666',
    role: 'partner',
    created_at: authUser.created_at ?? '',
  }
}

export function useAuth() {
  const supabase = createClient()
  const router = useRouter()
  const { setUser, setCouple, setPartner, reset } = useAuthStore()
  const setLivingMode = useFinanceStore((state) => state.setLivingMode)

  const { data: authUser, isLoading: isAuthLoading } = useQuery({
    queryKey: ['auth-user'],
    queryFn: async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      return authUser
    },
  })

  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: ['auth-profile', authUser?.id],
    queryFn: async () => {
      if (!authUser) return null
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle()
      if (error) throw error
      return data as unknown as User | null
    },
    enabled: !!authUser,
  })

  const fallbackUser = useMemo(
    () => (authUser ? toFallbackProfile(authUser) : null),
    [authUser]
  )
  const resolvedUser = profile ?? fallbackUser
  const isLoading = isAuthLoading || isProfileLoading

  const { data: coupleData } = useQuery({
    queryKey: ['auth-couple', resolvedUser?.couple_id],
    queryFn: async () => {
      if (!resolvedUser?.couple_id) return null
      const { data, error } = await supabase
        .from('couples')
        .select('*')
        .eq('id', resolvedUser.couple_id)
        .maybeSingle()
      if (error) throw error
      return data as unknown as Couple | null
    },
    enabled: !!resolvedUser?.couple_id,
  })

  const { data: partnerData } = useQuery({
    queryKey: ['auth-partner', resolvedUser?.couple_id, resolvedUser?.id],
    queryFn: async () => {
      if (!resolvedUser?.couple_id) return null
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('couple_id', resolvedUser.couple_id)
        .neq('id', resolvedUser.id)
        .maybeSingle()
      if (error) throw error
      return (data as unknown as User) || null
    },
    enabled: !!resolvedUser?.couple_id,
  })

  // Sync to store for components that read from store directly
  useEffect(() => {
    setUser(resolvedUser)
    setCouple(coupleData ?? null)
    setPartner(partnerData ?? null)
    if (coupleData?.living_mode === 'before_cohabiting' || coupleData?.living_mode === 'after_cohabiting') {
      setLivingMode(coupleData.living_mode)
    }
  }, [resolvedUser, coupleData, partnerData, setUser, setCouple, setPartner, setLivingMode])

  const signOut = async () => {
    await supabase.auth.signOut()
    reset()
    router.push('/login')
  }

  // Return query data directly (not store) to avoid useEffect sync lag
  return {
    user: resolvedUser,
    couple: coupleData ?? null,
    partner: partnerData ?? null,
    isLoading,
    signOut,
  }
}
