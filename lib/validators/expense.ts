import { z } from 'zod'

export const expenseSchema = z.object({
  amount: z.number().positive('金額は正の数で入力してください'),
  description: z.string().optional(),
  expense_date: z.string().min(1, '日付を入力してください'),
  expense_type: z.enum(['personal', 'shared', 'advance', 'pending_settlement']),
  category_id: z.string().uuid().optional(),
  payment_method: z.enum(['cash', 'card', 'transfer']).optional(),
  is_fixed: z.boolean().default(false),
  notes: z.string().optional(),
})

export type ExpenseFormValues = z.infer<typeof expenseSchema>
