'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useLifePlanConfig, useSimulation } from './use-life-plan'
import type { SimulationResult } from '@/types/life-plan'
import type { Expense, Income } from '@/types'

// ---------- Types ----------

export interface MonthlyPlanVsActual {
  /** "2026-01" format */
  month: string
  /** Short label "1月" */
  label: string
  /** Plan: monthly living cost from life plan */
  plannedExpense: number
  /** Actual: sum of expenses from DB */
  actualExpense: number
  /** Deviation: actual - planned (positive = overspent) */
  expenseDeviation: number
  /** Plan: monthly net income from life plan */
  plannedIncome: number
  /** Actual: sum of incomes from DB */
  actualIncome: number
  /** Deviation: actual - planned */
  incomeDeviation: number
  /** Plan: cumulative expenses up to this month */
  cumulativePlannedExpense: number
  /** Actual: cumulative expenses up to this month */
  cumulativeActualExpense: number
  /** Plan: cumulative income up to this month */
  cumulativePlannedIncome: number
  /** Actual: cumulative income up to this month */
  cumulativeActualIncome: number
  /** Plan: cumulative savings (income - expense) */
  cumulativePlannedSavings: number
  /** Actual: cumulative savings */
  cumulativeActualSavings: number
}

export interface YearlyPlanVsActual {
  year: number
  months: MonthlyPlanVsActual[]
  /** Total plan expense for the year */
  plannedAnnualExpense: number
  /** Total actual expense for the year (so far) */
  actualAnnualExpense: number
  /** Plan household net income */
  plannedAnnualIncome: number
  /** Actual household income */
  actualAnnualIncome: number
  /** Plan event costs */
  plannedEventCost: number
  /** Plan total assets at year end */
  plannedTotalAssets: number
  /** Plan cash at year end */
  plannedCash: number
  /** Plan NISA at year end */
  plannedNisa: number
  /** Plan taxable at year end */
  plannedTaxable: number
}

export interface PlanVsActualData {
  currentYear: YearlyPlanVsActual | null
  allYears: YearlyPlanVsActual[]
  simulation: SimulationResult | null
  isLoading: boolean
}

// ---------- Hooks ----------

/**
 * Fetch all expenses for a given year.
 */
function useYearExpenses(coupleId: string | undefined, year: number) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['year-expenses', coupleId, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('amount, expense_date, expense_type, is_fixed')
        .eq('couple_id', coupleId!)
        .gte('expense_date', `${year}-01-01`)
        .lt('expense_date', `${year + 1}-01-01`)
      if (error) throw error
      return data as Pick<Expense, 'amount' | 'expense_date' | 'expense_type' | 'is_fixed'>[]
    },
    enabled: !!coupleId,
  })
}

/**
 * Fetch all incomes for a given year.
 */
function useYearIncomes(coupleId: string | undefined, year: number) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['year-incomes', coupleId, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('incomes')
        .select('amount, income_date, user_id')
        .eq('couple_id', coupleId!)
        .gte('income_date', `${year}-01-01`)
        .lt('income_date', `${year + 1}-01-01`)
      if (error) throw error
      return data as Pick<Income, 'amount' | 'income_date' | 'user_id'>[]
    },
    enabled: !!coupleId,
  })
}

/**
 * Main hook: bridges life plan projections with actual expense/income data.
 */
export function usePlanVsActual(coupleId: string | undefined): PlanVsActualData {
  const now = new Date()
  const currentYear = now.getFullYear()

  const config = useLifePlanConfig(coupleId)
  const simulation = useSimulation(config)
  const { data: expenses, isLoading: loadingExp } = useYearExpenses(coupleId, currentYear)
  const { data: incomes, isLoading: loadingInc } = useYearIncomes(coupleId, currentYear)

  const result = useMemo(() => {
    if (!simulation || !config) {
      return { currentYear: null, allYears: [], simulation: null, isLoading: true }
    }

    const householdYear = simulation.household.find((h) => h.year === currentYear)
    const renYear = simulation.ren.find((r) => r.year === currentYear)
    const hikaruYear = simulation.hikaru.find((h) => h.year === currentYear)

    if (!householdYear || !renYear || !hikaruYear) {
      return { currentYear: null, allYears: [], simulation, isLoading: false }
    }

    // Monthly plan values (divide annual by 12)
    const monthlyPlannedExpense = (renYear.livingCost + hikaruYear.livingCost) / 12
    const monthlyPlannedIncome = householdYear.householdNet / 12

    // Group actual expenses by month
    const expenseByMonth: Record<string, number> = {}
    const incomeByMonth: Record<string, number> = {}

    for (const e of expenses || []) {
      const m = e.expense_date.slice(0, 7) // "2026-03"
      expenseByMonth[m] = (expenseByMonth[m] || 0) + Number(e.amount)
    }

    for (const i of incomes || []) {
      const m = i.income_date.slice(0, 7)
      incomeByMonth[m] = (incomeByMonth[m] || 0) + Number(i.amount)
    }

    // Build monthly rows
    let cumPlannedExp = 0
    let cumActualExp = 0
    let cumPlannedInc = 0
    let cumActualInc = 0

    const months: MonthlyPlanVsActual[] = []
    for (let m = 1; m <= 12; m++) {
      const monthKey = `${currentYear}-${String(m).padStart(2, '0')}`
      const actualExp = expenseByMonth[monthKey] || 0
      const actualInc = incomeByMonth[monthKey] || 0

      cumPlannedExp += monthlyPlannedExpense
      cumActualExp += actualExp
      cumPlannedInc += monthlyPlannedIncome
      cumActualInc += actualInc

      months.push({
        month: monthKey,
        label: `${m}月`,
        plannedExpense: Math.round(monthlyPlannedExpense),
        actualExpense: Math.round(actualExp),
        expenseDeviation: Math.round(actualExp - monthlyPlannedExpense),
        plannedIncome: Math.round(monthlyPlannedIncome),
        actualIncome: Math.round(actualInc),
        incomeDeviation: Math.round(actualInc - monthlyPlannedIncome),
        cumulativePlannedExpense: Math.round(cumPlannedExp),
        cumulativeActualExpense: Math.round(cumActualExp),
        cumulativePlannedIncome: Math.round(cumPlannedInc),
        cumulativeActualIncome: Math.round(cumActualInc),
        cumulativePlannedSavings: Math.round(cumPlannedInc - cumPlannedExp),
        cumulativeActualSavings: Math.round(cumActualInc - cumActualExp),
      })
    }

    const yearData: YearlyPlanVsActual = {
      year: currentYear,
      months,
      plannedAnnualExpense: Math.round(renYear.livingCost + hikaruYear.livingCost),
      actualAnnualExpense: Math.round(cumActualExp),
      plannedAnnualIncome: Math.round(householdYear.householdNet),
      actualAnnualIncome: Math.round(cumActualInc),
      plannedEventCost: Math.round(renYear.eventCost + hikaruYear.eventCost),
      plannedTotalAssets: Math.round(householdYear.householdTotalAssets),
      plannedCash: Math.round(householdYear.householdCash),
      plannedNisa: Math.round(householdYear.householdNisa),
      plannedTaxable: Math.round(householdYear.householdTaxable),
    }

    // Build allYears from simulation for the multi-year chart
    const allYears: YearlyPlanVsActual[] = simulation.household.map((hh, idx) => ({
      year: hh.year,
      months: hh.year === currentYear ? months : [],
      plannedAnnualExpense: Math.round(simulation.ren[idx].livingCost + simulation.hikaru[idx].livingCost),
      actualAnnualExpense: hh.year === currentYear ? Math.round(cumActualExp) : 0,
      plannedAnnualIncome: Math.round(hh.householdNet),
      actualAnnualIncome: hh.year === currentYear ? Math.round(cumActualInc) : 0,
      plannedEventCost: Math.round(simulation.ren[idx].eventCost + simulation.hikaru[idx].eventCost),
      plannedTotalAssets: Math.round(hh.householdTotalAssets),
      plannedCash: Math.round(hh.householdCash),
      plannedNisa: Math.round(hh.householdNisa),
      plannedTaxable: Math.round(hh.householdTaxable),
    }))

    return { currentYear: yearData, allYears, simulation, isLoading: false }
  }, [simulation, config, expenses, incomes, currentYear])

  return { ...result, isLoading: result.isLoading || loadingExp || loadingInc }
}
