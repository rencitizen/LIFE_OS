'use client'

import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { INCOME_TYPE_LABELS, TRANSACTION_FILTER_LABELS, TRANSACTION_SOURCE_LABELS, UI_ACCENT_COLORS } from '@/lib/finance/constants'
import { formatYen } from '@/lib/finance/utils'
import { useAuth } from '@/lib/hooks/use-auth'
import { useExpenseCategories } from '@/lib/hooks/use-categories'
import { useCreateTransaction, useDeleteTransaction, useTransactions, useUpdateTransaction } from '@/lib/hooks/use-transactions'
import { useFinanceStore } from '@/stores/finance-store'
import { toast } from 'sonner'
import type { UnifiedTransaction } from '@/types'

const EXPENSE_KIND_LABELS: Record<string, string> = {
  shared: '共通',
  personal: '個人',
  advance: '立替',
  pending_settlement: '精算待ち',
}

export default function TransactionsPage() {
  const { user, couple, partner } = useAuth()
  const { selectedMonth, setSelectedMonth } = useFinanceStore()
  const { data: transactions } = useTransactions(couple?.id, selectedMonth)
  const { data: categories } = useExpenseCategories(couple?.id)
  const createTransaction = useCreateTransaction()
  const updateTransaction = useUpdateTransaction()
  const deleteTransaction = useDeleteTransaction()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all')
  const [editingTransaction, setEditingTransaction] = useState<UnifiedTransaction | null>(null)

  const [transactionType, setTransactionType] = useState<'income' | 'expense'>('expense')
  const [date, setDate] = useState('')
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [expenseKind, setExpenseKind] = useState('shared')
  const [paymentMethod, setPaymentMethod] = useState('card')
  const [incomeType, setIncomeType] = useState('salary')

  const resetForm = () => {
    setEditingTransaction(null)
    setTransactionType('expense')
    setDate(`${selectedMonth}-01`)
    setAmount('')
    setMemo('')
    setCategoryId('')
    setExpenseKind('shared')
    setPaymentMethod('card')
    setIncomeType('salary')
  }

  const navigateMonth = (direction: number) => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const nextDate = new Date(year, month - 1 + direction, 1)
    setSelectedMonth(format(nextDate, 'yyyy-MM'))
  }

  const openCreateDialog = () => {
    setEditingTransaction(null)
    setTransactionType('expense')
    setDate(`${selectedMonth}-01`)
    setAmount('')
    setMemo('')
    setCategoryId('')
    setExpenseKind('shared')
    setPaymentMethod('card')
    setIncomeType('salary')
    setDialogOpen(true)
  }

  const openEditDialog = (transaction: UnifiedTransaction) => {
    setEditingTransaction(transaction)
    setTransactionType(transaction.transactionType)
    setDate(transaction.date)
    setAmount(String(transaction.amount))
    setMemo(transaction.memo)
    setCategoryId(transaction.rawExpense?.category_id || '')
    setExpenseKind(transaction.rawExpense?.expense_type || 'shared')
    setPaymentMethod(transaction.rawExpense?.payment_method || 'card')
    setIncomeType(transaction.rawIncome?.income_type || 'salary')
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!user?.id || !couple?.id) return toast.error('ペア情報を確認してください')
    if (!date) return toast.error('日付を入力してください')
    if (!amount || Number(amount) <= 0) return toast.error('金額を入力してください')

    try {
      if (transactionType === 'expense') {
        if (editingTransaction) {
          await updateTransaction.mutateAsync({
            transactionType: 'expense',
            values: {
              id: editingTransaction.id,
              amount: Number(amount),
              description: memo || null,
              expense_date: date,
              expense_type: expenseKind,
              category_id: categoryId || null,
              payment_method: paymentMethod,
            },
          })
        } else {
          await createTransaction.mutateAsync({
            transactionType: 'expense',
            values: {
              couple_id: couple.id,
              paid_by: user.id,
              amount: Number(amount),
              description: memo || null,
              expense_date: date,
              expense_type: expenseKind,
              category_id: categoryId || null,
              payment_method: paymentMethod,
              source: 'manual',
            },
          })
        }
      } else {
        if (editingTransaction) {
          await updateTransaction.mutateAsync({
            transactionType: 'income',
            values: {
              id: editingTransaction.id,
              amount: Number(amount),
              description: memo || null,
              income_date: date,
              income_type: incomeType,
            },
          })
        } else {
          await createTransaction.mutateAsync({
            transactionType: 'income',
            values: {
              couple_id: couple.id,
              user_id: user.id,
              amount: Number(amount),
              description: memo || null,
              income_date: date,
              income_type: incomeType,
            },
          })
        }
      }

      setSelectedMonth(date.slice(0, 7))
      setDialogOpen(false)
      toast.success(editingTransaction ? '取引を更新しました' : '取引を追加しました')
    } catch {
      toast.error(editingTransaction ? '取引の更新に失敗しました' : '取引の追加に失敗しました')
    }
  }

  const handleDelete = async () => {
    if (!editingTransaction) return
    try {
      await deleteTransaction.mutateAsync(editingTransaction)
      setDialogOpen(false)
      toast.success('取引を削除しました')
    } catch {
      toast.error('取引の削除に失敗しました')
    }
  }

  const filteredTransactions = useMemo(() => {
    return (transactions || []).filter((transaction) => {
      const matchesFilter = filter === 'all' || transaction.transactionType === filter
      const text = `${transaction.category} ${transaction.memo} ${transaction.type}`.toLowerCase()
      const matchesSearch = !searchQuery || text.includes(searchQuery.toLowerCase())
      return matchesFilter && matchesSearch
    })
  }, [filter, searchQuery, transactions])

  const [displayYear, displayMonth] = selectedMonth.split('-').map(Number)
  const displayDate = new Date(displayYear, displayMonth - 1, 1)

  const monthSummary = useMemo(() => {
    return filteredTransactions.reduce(
      (acc, transaction) => {
        if (transaction.transactionType === 'income') acc.income += transaction.amount
        else acc.expense += transaction.amount
        return acc
      },
      { income: 0, expense: 0 }
    )
  }, [filteredTransactions])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">収入・支出</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[120px] text-center text-sm font-medium">
            {format(displayDate, 'yyyy年M月', { locale: ja })}
          </span>
          <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="カテゴリやメモで検索" className="pl-9" />
        </div>
        <div className="flex rounded-lg border bg-background p-1">
          {(['all', 'income', 'expense'] as const).map((value) => (
            <Button key={value} size="sm" variant={filter === value ? 'default' : 'ghost'} onClick={() => setFilter(value)}>
              {TRANSACTION_FILTER_LABELS[value]}
            </Button>
          ))}
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) resetForm()
          }}
        >
          <DialogTrigger
            render={<Button size="sm" onClick={openCreateDialog} />}
          >
            <Plus className="mr-1 h-4 w-4" />
            取引を追加
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTransaction ? '取引を編集' : '取引を追加'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>取引種別</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant={transactionType === 'expense' ? 'default' : 'outline'} onClick={() => setTransactionType('expense')}>
                    支出
                  </Button>
                  <Button variant={transactionType === 'income' ? 'default' : 'outline'} onClick={() => setTransactionType('income')}>
                    収入
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>日付</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>金額</Label>
                <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
              </div>

              {transactionType === 'expense' ? (
                <>
                  <div className="space-y-2">
                    <Label>カテゴリ</Label>
                    <Select value={categoryId || undefined} onValueChange={(value) => setCategoryId(value || '')}>
                      <SelectTrigger><SelectValue placeholder="選択してください" /></SelectTrigger>
                      <SelectContent>
                        {categories?.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.icon} {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>支出区分</Label>
                      <Select value={expenseKind} onValueChange={(value) => setExpenseKind(value ?? 'shared')}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="shared">共通</SelectItem>
                          <SelectItem value="personal">個人</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>支払方法</Label>
                      <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value ?? 'card')}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="card">カード</SelectItem>
                          <SelectItem value="cash">現金</SelectItem>
                          <SelectItem value="transfer">振込</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label>収入項目</Label>
                  <Select value={incomeType} onValueChange={(value) => setIncomeType(value ?? 'salary')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(INCOME_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>メモ</Label>
                <Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="任意" />
              </div>

              <div className="flex gap-2">
                {editingTransaction && (
                  <Button type="button" variant="outline" className="flex-1" onClick={handleDelete}>
                    <Trash2 className="mr-1 h-4 w-4" />
                    削除
                  </Button>
                )}
                <Button className="flex-1" onClick={handleSave} disabled={createTransaction.isPending || updateTransaction.isPending || deleteTransaction.isPending}>
                  {editingTransaction ? '更新' : '保存'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">収入合計</p>
            <p className="mt-1 text-xl font-semibold text-[var(--color-income)]">{formatYen(monthSummary.income)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">支出合計</p>
            <p className="mt-1 text-xl font-semibold text-[var(--color-expense)]">{formatYen(monthSummary.expense)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">差額</p>
            <p className={`mt-1 text-xl font-semibold ${monthSummary.income - monthSummary.expense >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {formatYen(monthSummary.income - monthSummary.expense)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        {filteredTransactions.length > 0 ? (
          filteredTransactions.map((transaction) => (
            <Card key={`${transaction.transactionType}-${transaction.id}`}>
              <CardContent className="cursor-pointer p-4 transition-colors hover:bg-muted/30" onClick={() => openEditDialog(transaction)}>
                <div className="flex items-start gap-3">
                  <div
                    className="mt-1 h-9 w-9 rounded-full"
                    style={{
                      backgroundColor: transaction.transactionType === 'income' ? `${UI_ACCENT_COLORS.income}20` : `${UI_ACCENT_COLORS.expense}20`,
                      color: transaction.transactionType === 'income' ? UI_ACCENT_COLORS.income : UI_ACCENT_COLORS.expense,
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">
                        {transaction.transactionType === 'income'
                          ? INCOME_TYPE_LABELS[transaction.type] || transaction.type
                          : transaction.category}
                      </p>
                      <Pencil className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(transaction.date), 'M/d', { locale: ja })}
                      {transaction.memo ? ` ・ ${transaction.memo}` : ''}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {transaction.transactionType === 'income' ? '収入' : '支出'}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {transaction.transactionType === 'expense'
                          ? EXPENSE_KIND_LABELS[transaction.type] || transaction.type
                          : INCOME_TYPE_LABELS[transaction.type] || transaction.type}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {TRANSACTION_SOURCE_LABELS[transaction.source] || transaction.source}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${transaction.transactionType === 'income' ? 'text-[var(--color-income)]' : 'text-[var(--color-expense)]'}`}>
                      {transaction.transactionType === 'income' ? '+' : '-'}{formatYen(transaction.amount).replace('¥', '')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {transaction.ownerId === user?.id ? user.display_name : partner?.display_name || 'パートナー'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              該当する取引はありません
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
