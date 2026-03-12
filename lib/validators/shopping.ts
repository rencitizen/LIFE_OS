import { z } from 'zod'

export const shoppingListSchema = z.object({
  name: z.string().min(1, 'リスト名を入力してください'),
  category: z.enum(['food', 'daily', 'other', 'general']).default('general'),
})

export const shoppingItemSchema = z.object({
  name: z.string().min(1, 'アイテム名を入力してください'),
  memo: z.string().optional(),
  quantity: z.number().optional(),
  unit: z.string().optional(),
  estimated_price: z.number().optional(),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
})

export type ShoppingListFormValues = z.infer<typeof shoppingListSchema>
export type ShoppingItemFormValues = z.infer<typeof shoppingItemSchema>
