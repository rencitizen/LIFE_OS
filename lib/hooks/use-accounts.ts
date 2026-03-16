'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Account } from '@/types'

export interface AccountBalanceSummary {
  assets: number
  liabilities: number
  netWorth: number
  cashLike: number
  investments: number
  accounts: Account[]
}

export function useAccountBalanceSummary(coupleId: string | undefined) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['account-balance-summary', coupleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('couple_id', coupleId!)
        .order('created_at', { ascending: true })
      if (error) throw error

      const accounts = data as Account[]
      let assets = 0
      let liabilities = 0
      let cashLike = 0
      let investments = 0

      for (const account of accounts) {
        const balance = Number(account.balance || 0)
        const type = account.account_type || 'bank'

        if (type === 'credit') {
          liabilities += Math.abs(balance)
          continue
        }

        assets += balance

        if (type === 'investment') {
          investments += balance
        } else {
          cashLike += balance
        }
      }

      return {
        assets,
        liabilities,
        netWorth: assets - liabilities,
        cashLike,
        investments,
        accounts,
      } satisfies AccountBalanceSummary
    },
    enabled: !!coupleId,
  })
}
