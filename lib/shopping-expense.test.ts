import { describe, expect, it } from 'vitest'
import { buildShoppingExpenseRecords } from './shopping-expense'

describe('buildShoppingExpenseRecords', () => {
  it('creates expense records from checked shopping items with amounts', () => {
    const items = [
      { id: 'a', name: '牛乳', estimated_price: 240, is_checked: true },
      { id: 'b', name: 'パン', estimated_price: '320', is_checked: true },
      { id: 'c', name: '無料サンプル', estimated_price: 0, is_checked: true },
    ]

    expect(buildShoppingExpenseRecords(items, 'couple-1', 'user-1')).toEqual([
      {
        couple_id: 'couple-1',
        paid_by: 'user-1',
        amount: 240,
        description: '牛乳',
        expense_date: expect.any(String),
        expense_type: 'shared',
        source: 'shopping_list',
        notes: '買い物リストから作成',
        is_fixed: false,
        category_id: null,
      },
      {
        couple_id: 'couple-1',
        paid_by: 'user-1',
        amount: 320,
        description: 'パン',
        expense_date: expect.any(String),
        expense_type: 'shared',
        source: 'shopping_list',
        notes: '買い物リストから作成',
        is_fixed: false,
        category_id: null,
      },
    ])
  })
})
