'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { simulate } from '@/lib/life-plan/engine'
import { DEFAULT_LIFE_PLAN } from '@/lib/life-plan/default-data'
import type { LifePlanConfig, LifePlanRow, SimulationResult } from '@/types/life-plan'

export function useLifePlan(coupleId: string | undefined) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['life-plan', coupleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('life_plans')
        .select('*')
        .eq('couple_id', coupleId!)
        .single()
      if (error && error.code !== 'PGRST116') throw error
      return data as unknown as LifePlanRow | null
    },
    enabled: !!coupleId,
  })
}

/** Extract a LifePlanConfig from the DB row, falling back to defaults. */
export function useLifePlanConfig(coupleId: string | undefined): LifePlanConfig {
  const { data } = useLifePlan(coupleId)

  return useMemo(() => {
    if (!data) return DEFAULT_LIFE_PLAN
    return {
      assumptions: data.assumptions ?? DEFAULT_LIFE_PLAN.assumptions,
      incomeData: data.income_data ?? DEFAULT_LIFE_PLAN.incomeData,
      livingCosts: data.living_costs ?? DEFAULT_LIFE_PLAN.livingCosts,
      lifeEvents: data.life_events ?? DEFAULT_LIFE_PLAN.lifeEvents,
      initialAssets: data.initial_assets ?? DEFAULT_LIFE_PLAN.initialAssets,
    }
  }, [data])
}

/** Run simulation reactively whenever config changes. */
export function useSimulation(config: LifePlanConfig): SimulationResult {
  return useMemo(() => simulate(config), [config])
}

/** Create or update the life plan. */
export function useSaveLifePlan() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      coupleId,
      config,
    }: {
      coupleId: string
      config: LifePlanConfig
    }) => {
      const payload = {
        couple_id: coupleId,
        assumptions: config.assumptions,
        income_data: config.incomeData,
        living_costs: config.livingCosts,
        life_events: config.lifeEvents,
        initial_assets: config.initialAssets,
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from('life_plans')
        .upsert(payload, { onConflict: 'couple_id' })
        .select()
        .single()
      if (error) throw error
      return data as unknown as LifePlanRow
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['life-plan'] })
    },
  })
}

/** Initialize life plan with default Excel data. */
export function useInitLifePlan() {
  const savePlan = useSaveLifePlan()

  return useMutation({
    mutationFn: async (coupleId: string) => {
      return savePlan.mutateAsync({ coupleId, config: DEFAULT_LIFE_PLAN })
    },
  })
}
