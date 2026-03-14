'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/lib/hooks/use-auth'
import { useExpenses, useCreateExpense, useDeleteExpense, useUpdateExpense } from '@/lib/hooks/use-expenses'
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

type BulkExpenseRow = {
  id: string
  amount: string
  description: string
  categoryId: string
}

function createBulkExpenseRow(): BulkExpenseRow {
  return {
    id: crypto.randomUUID(),
    amount: '',
    description: '',
    categoryId: '',
  }
}

function getCategoryLabel(
  categories: Array<{ id: string; name: string; icon: string | null }> | undefined,
  categoryId: string
) {
  if (!categoryId) return null
  const category = categories?.find((item) => item.id === categoryId)
  if (!category) return null
  return `${category.icon || '📦'} ${category.name}`
}

export default function ExpensesPage() {
  const { user, couple } = useAuth()
  const { selectedMonth, setSelectedMonth } = useFinanceStore()
  const defaultExpenseMonth = selectedMonth
  const { data: expenses } = useExpenses(couple?.id, selectedMonth)
  const { data: categories } = useExpenseCategories(couple?.id)
  const createExpense = useCreateExpense()
  const updateExpense = useUpdateExpense()
  const deleteExpense = useDeleteExpense()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [expenseType, setExpenseType] = useState('shared')
  const [paymentMethod, setPaymentMethod] = useState('card')
  const [expenseMonth, setExpenseMonth] = useState(defaultExpenseMonth)
  const [bulkRows, setBulkRows] = useState<BulkExpenseRow[]>([createBulkExpenseRow()])
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'single' | 'bulk'>('single')

  useEffect(() => {
    if (!dialogOpen) {
      setExpenseMonth(defaultExpenseMonth)
      setEditingExpenseId(null)
      setActiveTab('single')
    }
  }, [defaultExpenseMonth, dialogOpen])

  const handleCreate = async () => {
    if (!amount) { toast.error('金額を入力してください'); return }
    if (!expenseMonth) { toast.error('対象月を入力してください'); return }
    if (!user?.id) { toast.error('ログインが必要です'); return }
    if (!couple?.id) { toast.error('先にカップルを作成または参加してください'); return }
    try {
      if (editingExpenseId) {
        await updateExpense.mutateAsync({
          id: editingExpenseId,
          amount: Number(amount),
          description: description || null,
          expense_date: `${expenseMonth}-01`,
          expense_type: expenseType,
          category_id: categoryId || null,
          payment_method: paymentMethod,
        })
      } else {
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
      }
      setAmount('')
      setDescription('')
      setCategoryId('')
      setExpenseType('shared')
      setPaymentMethod('card')
      setExpenseMonth(defaultExpenseMonth)
      setSelectedMonth(expenseMonth)
      setDialogOpen(false)
      toast.success(editingExpenseId ? '支出を更新しました' : '支出を登録しました')
    } catch {
      toast.error(editingExpenseId ? '支出の更新に失敗しました' : '支出の登録に失敗しました')
    }
  }

  const handleBulkCreate = async () => {
    if (!expenseMonth) { toast.error('対象月を入力してください'); return }
    if (!user?.id) { toast.error('ログインが必要です'); return }
    if (!couple?.id) { toast.error('先にカップルを作成または参加してください'); return }

    const activeRows = bulkRows.filter((row) => row.amount || row.description || row.categoryId)

    if (activeRows.length === 0) {
      toast.error('一括登録の行を入力してください')
      return
    }

    const payloads = []
    for (const [index, row] of activeRows.entries()) {
      const parsedAmount = Number(row.amount.replace(/,/g, ''))
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        toast.error(`${index + 1}行目の金額が不正です`)
        return
      }
      payloads.push({
        couple_id: couple.id,
        paid_by: user.id,
        amount: parsedAmount,
        description: row.description || undefined,
        expense_date: `${expenseMonth}-01`,
        expense_type: expenseType,
        category_id: row.categoryId || categoryId || undefined,
        payment_method: paymentMethod,
      })
    }

    try {
      for (const payload of payloads) {
        await createExpense.mutateAsync(payload)
      }
      setBulkRows([createBulkExpenseRow()])
      setExpenseMonth(defaultExpenseMonth)
      setSelectedMonth(expenseMonth)
      setDialogOpen(false)
      toast.success(`${payloads.length}件の支出を登録しました`)
    } catch {
      toast.error('一括登録に失敗しました')
    }
  }

  const updateBulkRow = (rowId: string, updates: Partial<BulkExpenseRow>) => {
    setBulkRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, ...updates } : row))
    )
  }

  const addBulkRow = () => {
    setBulkRows((current) => [...current, createBulkExpenseRow()])
  }

  const removeBulkRow = (rowId: string) => {
    setBulkRows((current) => (
      current.length === 1 ? [createBulkExpenseRow()] : current.filter((row) => row.id !== rowId)
    ))
  }

  const filteredExpenses = expenses?.filter((e) =>
    !searchQuery
      || e.description?.toLowerCase().includes(searchQuery.toLowerCase())
      || (e.expense_categories as { name: string } | null)?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const openEditExpense = (expense: NonNullable<typeof expenses>[number]) => {
    setEditingExpenseId(expense.id)
    setAmount(String(Number(expense.amount) || 0))
    setDescription(expense.description || '')
    setCategoryId(expense.category_id || '')
    setExpenseType(expense.expense_type)
    setPaymentMethod(expense.payment_method || 'card')
    setExpenseMonth(expense.expense_date.slice(0, 7))
    setActiveTab('single')
    setDialogOpen(true)
  }

  const handleDeleteExpense = async () => {
    if (!editingExpenseId) return
    try {
      await deleteExpense.mutateAsync(editingExpenseId)
      setEditingExpenseId(null)
      setAmount('')
      setDescription('')
      setCategoryId('')
      setExpenseType('shared')
      setPaymentMethod('card')
      setDialogOpen(false)
      toast.success('支出を削除しました')
    } catch {
      toast.error('支出の削除に失敗しました')
    }
  }

  const navigateMonth = (direction: number) => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const date = new Date(year, month - 1 + direction, 1)
    setSelectedMonth(format(date, 'yyyy-MM'))
  }

  const [displayYear, displayMonth] = selectedMonth.split('-').map(Number)
  const displayDate = new Date(displayYear, displayMonth - 1, 1)
  const selectedCategoryLabel = getCategoryLabel(categories, categoryId)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">支出</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[100px] text-center">
            {format(displayDate, 'yyyy年M月', { locale: ja })}
          </span>
          <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

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
          <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingExpenseId ? '支出を編集' : '支出を記録'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 overflow-y-auto pr-1">
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
                  <SelectTrigger>
                    <SelectValue placeholder="選択...">
                      {selectedCategoryLabel}
                    </SelectValue>
                  </SelectTrigger>
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

              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'single' | 'bulk')}>
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="single">1件ずつ</TabsTrigger>
                  <TabsTrigger value="bulk" disabled={!!editingExpenseId}>まとめて</TabsTrigger>
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
                      <SelectTrigger>
                        <SelectValue placeholder="選択...">
                          {selectedCategoryLabel}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {categories?.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.icon} {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    {editingExpenseId && (
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={handleDeleteExpense}
                        disabled={deleteExpense.isPending || updateExpense.isPending}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        削除
                      </Button>
                    )}
                    <Button
                      onClick={handleCreate}
                      className="flex-1"
                      disabled={createExpense.isPending || updateExpense.isPending || deleteExpense.isPending}
                    >
                      {editingExpenseId ? '更新' : '登録'}
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="bulk" className="space-y-4 pt-4">
                  <div className="space-y-3">
                    {bulkRows.map((row, index) => (
                      <div key={row.id} className="rounded-lg border p-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{index + 1}件目</p>
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeBulkRow(row.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>金額</Label>
                            <Input
                              type="number"
                              placeholder="0"
                              value={row.amount}
                              onChange={(e) => updateBulkRow(row.id, { amount: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>カテゴリ</Label>
                            <Select value={row.categoryId || undefined} onValueChange={(value) => updateBulkRow(row.id, { categoryId: value || '' })}>
                              <SelectTrigger>
                                <SelectValue placeholder={categoryId ? '上のカテゴリを使う' : '選択...'}>
                                  {getCategoryLabel(categories, row.categoryId)}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {categories?.map((cat) => (
                                  <SelectItem key={cat.id} value={cat.id}>
                                    {cat.icon} {cat.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>説明</Label>
                          <Input
                            placeholder="何に使った？"
                            value={row.description}
                            onChange={(e) => updateBulkRow(row.id, { description: e.target.value })}
                          />
                        </div>
                      </div>
                    ))}
                    <Button type="button" variant="outline" className="w-full" onClick={addBulkRow}>
                      <Plus className="h-4 w-4 mr-1" />
                      行を追加
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      各行でカテゴリをプルダウン選択できます。未選択なら上部のカテゴリを使います。
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
                <CardContent
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => openEditExpense(expense)}
                >
                  <div className="text-xl">{cat?.icon || '📦'}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate flex items-center gap-1">
                      <span>{cat?.name || 'その他'}</span>
                      <Pencil className="h-3 w-3 text-muted-foreground" />
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(expense.expense_date), 'M/d')}
                      {expense.description && ` · ${expense.description}`}
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
