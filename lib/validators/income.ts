import { z } from 'zod'

export const incomeSchema = z.object({
  amount: z.number().positive('金額は正の数で入力してください'),
  income_type: z.enum(['salary', 'bonus', 'freelance', 'other']).default('salary'),
  description: z.string().optional(),
  income_date: z.string().min(1, '日付を入力してください'),
  is_fixed: z.boolean().default(true),
})

export type IncomeFormValues = z.infer<typeof incomeSchema>
