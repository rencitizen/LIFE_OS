'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/lib/hooks/use-auth'
import { useExpenses, useCreateExpense } from '@/lib/hooks/use-expenses'
import { useExpenseCategories } from '@/lib/hooks/use-categories'
import { useFinanceStore } from '@/stores/finance-store'

const expenseTypeLabels: Record<string, string> = {
  personal: '個人',
  shared: '共有',
  advance: '立替',
  pending_settlement: '精算待ち',
}

const expenseTypeBadgeColors: Record<string, string> = {
  personal: 'bg-gray-100 text-gray-700',
  shared: 'bg-blue-100 text-blue-700',
  advance: 'bg-yellow-100 text-yellow-700',
  pending_settlement: 'bg-red-100 text-red-700',
}

export default function ExpensesPage() {
  const { user, couple } = useAuth()
  const { selectedMonth } = useFinanceStore()
  const { data: expenses } = useExpenses(couple?.id, selectedMonth)
  const { data: categories } = useExpenseCategories(couple?.id)
  const createExpense = useCreateExpense()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [expenseType, setExpenseType] = useState('shared')
  const [paymentMethod, setPaymentMethod] = useState('card')

  const handleCreate = async () => {
    if (!amount || !couple?.id || !user?.id) return
    await createExpense.mutateAsync({
      couple_id: couple.id,
      paid_by: user.id,
      amount: Number(amount),
      description: description || undefined,
      expense_date: format(new Date(), 'yyyy-MM-dd'),
      expense_type: expenseType,
      category_id: categoryId || undefined,
      payment_method: paymentMethod,
    })
    setAmount('')
    setDescription('')
    setDialogOpen(false)
  }

  const filteredExpenses = expenses?.filter((e) =>
    !searchQuery || e.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="支出を検索..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={<Button size="sm" />}
          >
            <Plus className="h-4 w-4 mr-1" />
            支出登録
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>支出を記録</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>金額</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>説明</Label>
                <Input
                  placeholder="何に使った？"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>カテゴリ</Label>
                <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? '')}>
                  <SelectTrigger><SelectValue placeholder="選択..." /></SelectTrigger>
                  <SelectContent>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.icon} {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>区分</Label>
                  <Select value={expenseType} onValueChange={(v) => v && setExpenseType(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="shared">共有</SelectItem>
                      <SelectItem value="personal">個人</SelectItem>
                      <SelectItem value="advance">立替</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>支払方法</Label>
                  <Select value={paymentMethod} onValueChange={(v) => v && setPaymentMethod(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="card">カード</SelectItem>
                      <SelectItem value="cash">現金</SelectItem>
                      <SelectItem value="transfer">振込</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleCreate} className="w-full" disabled={createExpense.isPending}>
                登録
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {filteredExpenses && filteredExpenses.length > 0 ? (
          filteredExpenses.map((expense) => {
            const cat = expense.expense_categories as { name: string; icon: string | null; color: string | null } | null
            return (
              <Card key={expense.id}>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="text-xl">{cat?.icon || '📦'}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {expense.description || cat?.name || '支出'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(expense.expense_date), 'M/d')}
                      {expense.payment_method && ` · ${expense.payment_method}`}
                    </p>
                  </div>
                  <Badge className={expenseTypeBadgeColors[expense.expense_type] || ''}>
                    {expenseTypeLabels[expense.expense_type]}
                  </Badge>
                  <span className="font-bold text-sm">¥{Number(expense.amount).toLocaleString()}</span>
                </CardContent>
              </Card>
            )
          })
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-sm text-muted-foreground">支出データがありません</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
