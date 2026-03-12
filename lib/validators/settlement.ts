import { z } from 'zod'

export const settlementSchema = z.object({
  to_user: z.string().uuid('精算相手を選択してください'),
  amount: z.number().positive('金額は正の数で入力してください'),
  memo: z.string().optional(),
})

export type SettlementFormValues = z.infer<typeof settlementSchema>
