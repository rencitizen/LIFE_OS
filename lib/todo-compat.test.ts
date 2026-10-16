import { describe, expect, it } from 'vitest'
import { isMissingTodoColumnError, stripUnsupportedTodoColumns } from './todo-compat'

describe('todo compatibility helpers', () => {
  it('drops newer todo columns when the legacy schema is used', () => {
    const payload = {
      couple_id: '11111111-1111-4111-8111-111111111111',
      created_by: '22222222-2222-4222-8222-222222222222',
      title: 'Legacy task',
      due_date: '2026-10-20',
      start_date: '2026-10-19',
      end_date: '2026-10-21',
      task_level: 'medium',
      parent_todo_id: null,
    }

    expect(stripUnsupportedTodoColumns(payload)).toEqual({
      couple_id: '11111111-1111-4111-8111-111111111111',
      created_by: '22222222-2222-4222-8222-222222222222',
      title: 'Legacy task',
      due_date: '2026-10-20',
    })
  })

  it('detects schema errors caused by missing todo columns', () => {
    const error = new Error('column "start_date" of relation "todos" does not exist')
    expect(isMissingTodoColumnError(error)).toBe(true)
  })

  it('detects plain object Postgrest errors for missing columns', () => {
    const error = {
      message: 'column "start_date" of relation "todos" does not exist',
      details: 'column "start_date" of relation "todos" does not exist',
      hint: null,
      code: '42703',
    }

    expect(isMissingTodoColumnError(error)).toBe(true)
  })
})
