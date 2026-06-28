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
}

export const TRANSACTION_SOURCE_LABELS: Record<string, string> = {
  manual: '手動',
  ocr: 'OCR',
  moneyforward_screenshot: 'MFスクショ',
  imported: '取り込み',
  ai: 'AI',
  shopping_list: '買い物連携',
  auto: '自動',
}

export const TRANSACTION_TYPE_COLORS: Record<'income' | 'expense', string> = {
  income: '#00A86B',
  expense: '#F2A900',
}

export const UI_ACCENT_COLORS = {
  income: '#00A86B',
  expense: '#F2A900',
  info: '#1E4D8C',
  primary: '#0F2747',
  warning: '#FFC83D',
  muted: '#52606F',
} as const
