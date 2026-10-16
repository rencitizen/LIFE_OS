export type ShoppingExpenseRecordInput = {
  id: string
  name: string
  estimated_price?: number | string | null
  is_checked?: boolean
}

export function buildShoppingExpenseRecords(
  items: ShoppingExpenseRecordInput[],
  coupleId: string,
  paidBy: string,
  expenseDate = new Date().toISOString().slice(0, 10)
) {
  const seen = new Set<string>()

  return items
    .filter((item) => !!item.name && (item.is_checked ?? true) && Number(item.estimated_price ?? 0) > 0)
    .filter((item) => {
      const key = item.id || `${item.name}-${String(item.estimated_price ?? '')}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map((item) => ({
      couple_id: coupleId,
      paid_by: paidBy,
      amount: Number(item.estimated_price ?? 0),
      description: item.name,
      expense_date: expenseDate,
      expense_type: 'shared',
      source: 'shopping_list',
      notes: '買い物リストから作成',
      is_fixed: false,
      category_id: null,
    }))
}
