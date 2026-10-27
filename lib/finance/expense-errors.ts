export function expenseSaveError(error: unknown): string {
  const message = typeof error === 'object' && error !== null && 'message' in error
    ? String(error.message)
    : ''
  if (message.includes('no_active_split_profile_for_date')) {
    return 'この日付の負担割合が未設定です。精算対象をオフにすると支出として保存できます。精算対象にする場合はパートナーの参加と負担割合の設定が必要です。'
  }
  if (message.includes('split_profile_requires_at_least_two_members')) {
    return '精算には2人分の負担割合が必要です。パートナーの参加と設定を確認してください。'
  }
  if (message.includes('split_profile_ratio_must_sum_to_one')) {
    return '負担割合の合計が100%になっていません。設定を確認してください。'
  }
  return message || '保存に失敗しました。入力内容と通信状態を確認してください。'
}
