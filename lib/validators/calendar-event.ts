import { z } from 'zod'

export const calendarEventSchema = z.object({
  title: z.string().min(1, 'タイトルを入力してください'),
  description: z.string().optional(),
  start_at: z.string().min(1, '開始日時を入力してください'),
  end_at: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  all_day: z.boolean().default(false),
  visibility: z.enum(['shared', 'private', 'partner_only']).default('shared'),
  event_type: z.enum(['life', 'financial', 'anniversary', 'medical', 'travel']).default('life'),
  is_recurring: z.boolean().default(false),
  recurrence_rule: z.string().optional(),
  location: z.string().optional(),
  linked_amount: z.number().optional(),
}).refine((value) => {
  if (!value.start_date || !value.end_date) return true
  return value.end_date >= value.start_date
}, {
  message: '終了日は開始日以降にしてください',
  path: ['end_date'],
})

export type CalendarEventFormValues = z.infer<typeof calendarEventSchema>
