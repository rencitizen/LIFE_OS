import { summarizeLivingCosts } from '@/lib/life-plan/engine'
import type { Budget, BudgetMemberLimit } from '@/types'
import type { LifePlanConfig } from '@/types/life-plan'

// Derived from the existing seeded monthly plan: 321,500 total split into
// 218,457 for the primary member and 103,043 for the partner.
export const PRIMARY_MEMBER_BUDGET_RATIO = 218457 / 321500

export function splitBudgetTotal(total: number) {
  const safeTotal = Math.max(0, Math.round(total))
  const primary = Math.round(safeTotal * PRIMARY_MEMBER_BUDGET_RATIO)
  const secondary = safeTotal - primary
  return { primary, secondary }
}

export function getBudgetLimitTotal(
  budget: Pick<Budget, 'total_limit'> | null | undefined,
  memberLimits?: Array<Pick<BudgetMemberLimit, 'limit_amount'>> | null
) {
  if (memberLimits && memberLimits.length > 0) {
    return memberLimits.reduce((sum, row) => sum + (Number(row.limit_amount) || 0), 0)
  }

  return Number(budget?.total_limit) || 0
}

function findCohabitationYear(config: LifePlanConfig) {
  const event = config.lifeEvents.find(
    (entry) => entry.title === '同棲' || entry.category === '住居'
  )
  return event ? event.year + 1 : 9999
}

function getSharedRatio(config: LifePlanConfig, cohabitationYear: number) {
  const firstYearIncome = config.incomeData.find((entry) => entry.year === cohabitationYear)
  const prevYearIncome = config.incomeData.find((entry) => entry.year === cohabitationYear - 1)
  const ratioSource = prevYearIncome || firstYearIncome || config.incomeData[0]

  if (!ratioSource) return 0.5

  const total = ratioSource.ren.net + ratioSource.hikaru.net
  return total > 0 ? ratioSource.ren.net / total : 0.5
}

export function getLifePlanMonthlyBudget(config: LifePlanConfig, yearMonth: string) {
  const year = Number(yearMonth.slice(0, 4))
  const cohabitationYear = findCohabitationYear(config)

  if (year < cohabitationYear) {
    const ren = summarizeLivingCosts(config.livingCosts.beforeRen).total
    const hikaru = summarizeLivingCosts(config.livingCosts.beforeHikaru).total
    return {
      ren,
      hikaru,
      shared: 0,
      total: ren + hikaru,
    }
  }

  const summary = summarizeLivingCosts(config.livingCosts.afterCohabitation)
  const renRatio = getSharedRatio(config, cohabitationYear)
  const ren = Math.round(summary.shared * renRatio + summary.ren)
  const hikaru = Math.round(summary.shared * (1 - renRatio) + summary.hikaru)

  return {
    ren,
    hikaru,
    shared: summary.shared,
    total: ren + hikaru,
  }
}
