import { z } from 'zod'

export const todoSchema = z.object({
  title: z.string().min(1, 'タイトルを入力してください'),
  description: z.string().optional(),
  due_date: z.string().optional(),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
  assigned_to: z.string().uuid().optional(),
  visibility: z.enum(['shared', 'private']).default('shared'),
  event_id: z.string().uuid().optional(),
  is_recurring: z.boolean().default(false),
  recurrence_rule: z.string().optional(),
})

export type TodoFormValues = z.infer<typeof todoSchema>
