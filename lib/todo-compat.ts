export const TODO_COMPAT_COLUMNS = ['start_date', 'end_date', 'task_level', 'parent_todo_id'] as const

export function stripUnsupportedTodoColumns<T extends Record<string, unknown>>(payload: T): T {
  const sanitized = { ...payload } as Record<string, unknown>

  for (const column of TODO_COMPAT_COLUMNS) {
    if (column in sanitized) {
      delete sanitized[column]
    }
  }

  return sanitized as T
}

export function isMissingTodoColumnError(error: unknown): boolean {
  const candidateTexts: string[] = []

  if (typeof error === 'string') {
    candidateTexts.push(error)
  }

  if (error instanceof Error) {
    candidateTexts.push(error.message)
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>
    candidateTexts.push(String(record.message ?? ''))
    candidateTexts.push(String(record.details ?? ''))
    candidateTexts.push(String(record.hint ?? ''))
    candidateTexts.push(String(record.code ?? ''))
  }

  const message = candidateTexts.filter(Boolean).join(' ')
  if (!message) return false

  const normalized = message.toLowerCase()

  return /column .*"?(start_date|end_date|task_level|parent_todo_id)"? .* does not exist/.test(normalized)
    || /missing required column.*(start_date|end_date|task_level|parent_todo_id)/.test(normalized)
    || /relation "todos" does not exist/.test(normalized)
    || /42703/.test(normalized)
}
