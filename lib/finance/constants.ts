export const LIVING_MODES = ['before_cohabiting', 'after_cohabiting'] as const
export type LivingModeOption = (typeof LIVING_MODES)[number]

export const LIVING_MODE_LABELS: Record<LivingModeOption, string> = {
  before_cohabiting: '同棲前',
  after_cohabiting: '同棲後',
}

export const TRANSACTION_TYPES = ['income', 'expense'] as const
export const TRANSACTION_FILTER_LABELS = {
  all: 'すべて',
  income: '収入',
  expense: '支出',
} as const

export const INCOME_TYPE_LABELS: Record<string, string> = {
  salary: '給与',
  bonus: '賞与',
  freelance: '副収入',
  other: 'その他収入',
}

export const EXPENSE_TYPE_LABELS: Record<string, string> = {
  shared: '共通',
  personal: '個人',
  advance: '立替',
  pending_settlement: '精算待ち',
}

export const TRANSACTION_SOURCE_LABELS: Record<string, string> = {
  manual: '手動',
  imported: '取り込み',
  ai: 'AI',
  shopping_list: '買い物連携',
  ocr: 'OCR',
  auto: '自動',
}

export const TRANSACTION_TYPE_COLORS: Record<'income' | 'expense', string> = {
  income: '#22C55E',
  expense: '#F59E0B',
}

export const UI_ACCENT_COLORS = {
  income: '#22C55E',
  expense: '#F59E0B',
  info: '#3B82F6',
  primary: '#1F5C4D',
  muted: '#6B7280',
} as const
