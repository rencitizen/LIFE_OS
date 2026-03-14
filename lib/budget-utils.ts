import type { Budget, BudgetMemberLimit } from '@/types'

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
