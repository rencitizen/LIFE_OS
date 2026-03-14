'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/lib/hooks/use-auth'
import { useExpenses, useCreateExpense } from '@/lib/hooks/use-expenses'
import { useExpenseCategories } from '@/lib/hooks/use-categories'
import { useFinanceStore } from '@/stores/finance-store'
import { toast } from 'sonner'

const expenseTypeLabels: Record<string, string> = {
  personal: '個人',
  shared: '共有',
  advance: '立替',
  pending_settlement: '精算待ち',
}

const expenseTypeBadgeColors: Record<string, string> = {
  personal: 'bg-muted text-muted-foreground',
  shared: 'bg-[#85B59B]/10 text-[#1E5945]',
  advance: 'bg-[#85B59B]/20 text-[#1E5945]',
  pending_settlement: 'bg-destructive/10 text-destructive',
}

export default function ExpensesPage() {
  const { user, couple } = useAuth()
  const { selectedMonth } = useFinanceStore()
  const defaultExpenseMonth = selectedMonth
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
  const [expenseMonth, setExpenseMonth] = useState(defaultExpenseMonth)
  const [bulkInput, setBulkInput] = useState('')

  useEffect(() => {
    if (!dialogOpen) {
      setExpenseMonth(defaultExpenseMonth)
    }
  }, [defaultExpenseMonth, dialogOpen])

  const handleCreate = async () => {
    if (!amount) { toast.error('金額を入力してください'); return }
    if (!expenseMonth) { toast.error('対象月を入力してください'); return }
    if (!user?.id) { toast.error('ログインが必要です'); return }
    if (!couple?.id) { toast.error('先にカップルを作成または参加してください'); return }
    try {
      await createExpense.mutateAsync({
        couple_id: couple.id,
        paid_by: user.id,
        amount: Number(amount),
        description: description || undefined,
        expense_date: `${expenseMonth}-01`,
        expense_type: expenseType,
        category_id: categoryId || undefined,
        payment_method: paymentMethod,
      })
      setAmount('')
      setDescription('')
      setCategoryId('')
      setExpenseType('shared')
      setPaymentMethod('card')
      setExpenseMonth(defaultExpenseMonth)
      setDialogOpen(false)
      toast.success('支出を登録しました')
    } catch {
      toast.error('支出の登録に失敗しました')
    }
  }

  const handleBulkCreate = async () => {
    if (!expenseMonth) { toast.error('対象月を入力してください'); return }
    if (!user?.id) { toast.error('ログインが必要です'); return }
    if (!couple?.id) { toast.error('先にカップルを作成または参加してください'); return }

    const lines = bulkInput
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    if (lines.length === 0) {
      toast.error('一括入力欄にデータを入れてください')
      return
    }

    const categoryMap = new Map(
      (categories || []).map((category) => [category.name.trim().toLowerCase(), category.id])
    )

    const payloads = []
    for (const [index, line] of lines.entries()) {
      const parts = line.split(',').map((part) => part.trim())
      if (parts.length < 2) {
        toast.error(`${index + 1}行目の形式が違います`)
        return
      }

      const parsedAmount = Number(parts[0].replace(/,/g, ''))
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        toast.error(`${index + 1}行目の金額が不正です`)
        return
      }

      const descriptionValue = parts[1]
      const categoryName = parts[2]?.toLowerCase()
      const matchedCategoryId = categoryName ? categoryMap.get(categoryName) : undefined

      if (categoryName && !matchedCategoryId) {
        toast.error(`${index + 1}行目のカテゴリが見つかりません`)
        return
      }

      payloads.push({
        couple_id: couple.id,
        paid_by: user.id,
        amount: parsedAmount,
        description: descriptionValue || undefined,
        expense_date: `${expenseMonth}-01`,
        expense_type: expenseType,
        category_id: matchedCategoryId,
        payment_method: paymentMethod,
      })
    }

    try {
      for (const payload of payloads) {
        await createExpense.mutateAsync(payload)
      }
      setBulkInput('')
      setExpenseMonth(defaultExpenseMonth)
      setDialogOpen(false)
      toast.success(`${payloads.length}件の支出を登録しました`)
    } catch {
      toast.error('一括登録に失敗しました')
    }
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
                <Label>対象月</Label>
                <Input
                  type="month"
                  value={expenseMonth}
                  onChange={(e) => setExpenseMonth(e.target.value)}
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

              <Tabs defaultValue="single">
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="single">1件ずつ</TabsTrigger>
                  <TabsTrigger value="bulk">まとめて</TabsTrigger>
                </TabsList>

                <TabsContent value="single" className="space-y-4 pt-4">
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
                  <Button onClick={handleCreate} className="w-full" disabled={createExpense.isPending}>
                    登録
                  </Button>
                </TabsContent>

                <TabsContent value="bulk" className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>一括入力</Label>
                    <Textarea
                      rows={8}
                      placeholder={'1200, コーヒー, 食費\n8500, ドラッグストア, 日用品\n15000, 電車代, 交通費'}
                      value={bulkInput}
                      onChange={(e) => setBulkInput(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      1行に `金額, 説明, カテゴリ名`。カテゴリ名は省略可です。
                    </p>
                  </div>
                  <Button onClick={handleBulkCreate} className="w-full" disabled={createExpense.isPending}>
                    まとめて登録
                  </Button>
                </TabsContent>
              </Tabs>
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
