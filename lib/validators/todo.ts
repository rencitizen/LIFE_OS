import { z } from 'zod'

export const todoSchema = z.object({
  title: z.string().min(1, 'タイトルを入力してください'),
  description: z.string().optional(),
  due_date: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  parent_todo_id: z.string().uuid().optional(),
  task_level: z.enum(['large', 'medium', 'small']).default('small'),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
  assigned_to: z.string().uuid().optional(),
  visibility: z.enum(['shared', 'private']).default('shared'),
  event_id: z.string().uuid().optional(),
  is_recurring: z.boolean().default(false),
  recurrence_rule: z.string().optional(),
}).refine((value) => {
  if (!value.start_date || !value.end_date) return true
  return value.end_date >= value.start_date
}, {
  message: '終了日は開始日以降にしてください',
  path: ['end_date'],
})

export type TodoFormValues = z.infer<typeof todoSchema>
