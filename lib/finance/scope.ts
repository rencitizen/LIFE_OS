export type FinanceScope = 'combined' | 'mine' | 'partner'

export const FINANCE_SCOPE_LABELS: Record<FinanceScope, string> = {
  combined: 'Combined',
  mine: 'Self',
  partner: 'Partner',
}

export function matchesFinanceScope(
  scope: FinanceScope,
  ownerId: string | null | undefined,
  userId: string | undefined,
  partnerId: string | undefined
) {
  if (scope === 'combined') return true
  if (scope === 'mine') return ownerId === userId
  return ownerId === partnerId
}

export function filterByFinanceScope<T>(
  rows: T[],
  scope: FinanceScope,
  userId: string | undefined,
  partnerId: string | undefined,
  getOwnerId: (row: T) => string | null | undefined
) {
  return rows.filter((row) => matchesFinanceScope(scope, getOwnerId(row), userId, partnerId))
}
