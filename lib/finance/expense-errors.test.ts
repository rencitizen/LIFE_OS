import { describe, expect, it } from 'vitest'
import { expenseSaveError } from './expense-errors'

describe('expenseSaveError', () => {
  it('explains how to save when a split profile is missing (plain RPC error object)', () => {
    const result = expenseSaveError({ message: 'no_active_split_profile_for_date: 2026-10-27', code: 'P0001' })
    expect(result).toContain('精算対象をオフ')
    expect(result).toContain('負担割合')
  })
  it('preserves messages from errors that are not Error instances', () => {
    expect(expenseSaveError({ message: '通信エラー' })).toBe('通信エラー')
  })
  it('handles missing partner allocations and invalid ratios', () => {
    expect(expenseSaveError(new Error('split_profile_requires_at_least_two_members'))).toContain('2人分')
    expect(expenseSaveError({ message: 'split_profile_ratio_must_sum_to_one' })).toContain('100%')
  })
  it('provides a fallback for an unknown failure', () => {
    expect(expenseSaveError(null)).toContain('保存に失敗')
  })
})
