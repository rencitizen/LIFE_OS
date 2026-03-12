import { z } from 'zod'

export const budgetSchema = z.object({
  year_month: z.string().regex(/^\d{4}-\d{2}$/, 'YYYY-MM形式で入力してください'),
  total_limit: z.number().positive('予算は正の数で入力してください'),
})

export const budgetCategorySchema = z.object({
  category_id: z.string().uuid(),
  limit_amount: z.number().positive(),
  alert_ratio: z.number().min(0).max(1).default(0.8),
})

export type BudgetFormValues = z.infer<typeof budgetSchema>
export type BudgetCategoryFormValues = z.infer<typeof budgetCategorySchema>
