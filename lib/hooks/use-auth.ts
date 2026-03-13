'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { useQuery } from '@tanstack/react-query'
import type { User, Couple } from '@/types'

export function useAuth() {
  const supabase = createClient()
  const router = useRouter()
  const { setUser, setCouple, setPartner, reset } = useAuthStore()

  const { data: profile, isLoading } = useQuery({
    queryKey: ['auth-profile'],
    queryFn: async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return null

      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single()
      return data as unknown as User | null
    },
  })

  const { data: coupleData } = useQuery({
    queryKey: ['auth-couple', profile?.couple_id],
    queryFn: async () => {
      if (!profile?.couple_id) return null
      const { data } = await supabase
        .from('couples')
        .select('*')
        .eq('id', profile.couple_id)
        .single()
      return data as unknown as Couple | null
    },
    enabled: !!profile?.couple_id,
  })

  const { data: partnerData } = useQuery({
    queryKey: ['auth-partner', profile?.couple_id, profile?.id],
    queryFn: async () => {
      if (!profile?.couple_id) return null
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('couple_id', profile.couple_id)
        .neq('id', profile.id)
        .single()
      return (data as unknown as User) || null
    },
    enabled: !!profile?.couple_id,
  })

  // Sync to store for components that read from store directly
  useEffect(() => {
    if (profile) setUser(profile)
    if (coupleData) setCouple(coupleData)
    if (partnerData) setPartner(partnerData)
  }, [profile, coupleData, partnerData, setUser, setCouple, setPartner])

  const signOut = async () => {
    await supabase.auth.signOut()
    reset()
    router.push('/login')
  }

  // Return query data directly (not store) to avoid useEffect sync lag
  return {
    user: profile ?? null,
    couple: coupleData ?? null,
    partner: partnerData ?? null,
    isLoading,
    signOut,
  }
}
