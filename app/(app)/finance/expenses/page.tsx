'use client'

import { useMemo, useState } from 'react'
import { addMonths, format } from 'date-fns'
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  WalletCards,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getTodayJstDateKey } from '@/lib/date-utils'
import { FINANCE_SCOPE_LABELS, matchesFinanceScope } from '@/lib/finance/scope'
import { formatYen } from '@/lib/finance/utils'
import { useAuth } from '@/lib/hooks/use-auth'
import { useExpenseCategories } from '@/lib/hooks/use-categories'
import { useCreateManualExpense, useUpdateExpenseWithSplits } from '@/lib/hooks/use-expenses'
import { useCreateTransaction, useTransactions, useUpdateTransaction } from '@/lib/hooks/use-transactions'
import { useFinanceStore } from '@/stores/finance-store'
import type { UnifiedTransaction } from '@/types'
import { toast } from 'sonner'

type SourceFilter = 'all' | 'ai' | 'manual'
type TypeFilter = 'all' | 'expense' | 'income'

const TYPE_FILTER_ITEMS = [
  { value: 'all', label: 'すべて' },
  { value: 'expense', label: '支出' },
  { value: 'income', label: '収入' },
]

const SOURCE_FILTER_ITEMS = [
  { value: 'all', label: '全ての入力元' },
  { value: 'ai', label: 'AI' },
  { value: 'manual', label: 'その他' },
]

const TRANSACTION_TYPE_ITEMS = [
  { value: 'expense', label: '支出' },
  { value: 'income', label: '収入' },
]

const EXPENSE_KIND_ITEMS = [
  { value: 'shared', label: '共有' },
  { value: 'personal', label: '個人' },
]

const PAYMENT_METHOD_ITEMS = [
  { value: 'card', label: 'カード' },
  { value: 'cash', label: '現金' },
  { value: 'transfer', label: '振込' },
]

const INCOME_TYPE_ITEMS = [
  { value: 'salary', label: '給与' },
  { value: 'bonus', label: '賞与' },
  { value: 'freelance', label: '副業' },
  { value: 'other', label: 'その他' },
]

function displayPerson(id: string, user?: { id: string; display_name: string } | null, partner?: { id: string; display_name: string } | null) {
  if (user?.id === id) return user.display_name
  if (partner?.id === id) return partner.display_name
  return 'メンバー'
}

function sourceLabel(source: UnifiedTransaction['source']) {
  if (source === 'ai') return 'AIから登録'
  if (source === 'manual') return '手動'
  if (source === 'moneyforward_screenshot') return '旧インポート'
  if (source === 'ocr') return 'OCR'
  return '自動連携'
}

export default function FinanceHistoryPage() {
  const { user, couple, partner } = useAuth()
  const { selectedMonth, setSelectedMonth, financeScope } = useFinanceStore()
  const { data: transactions } = useTransactions(couple?.id, selectedMonth)
  const { data: categories } = useExpenseCategories(couple?.id)
  const createManualExpense = useCreateManualExpense()
  const updateExpenseWithSplits = useUpdateExpenseWithSplits()
  const createTransaction = useCreateTransaction()
  const updateTransaction = useUpdateTransaction()

  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<UnifiedTransaction | null>(null)

  const [transactionType, setTransactionType] = useState<'income' | 'expense'>('expense')
  const [date, setDate] = useState(getTodayJstDateKey())
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [expenseKind, setExpenseKind] = useState('shared')
  const [settlementTarget, setSettlementTarget] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('card')
  const [incomeType, setIncomeType] = useState('salary')

  const categoryItems = useMemo(
    () => (categories || []).map((category) => ({
      value: category.id,
      label: `${category.icon ? `${category.icon} ` : ''}${category.name}`,
    })),
    [categories]
  )

  const [year, month] = selectedMonth.split('-').map(Number)
  const displayDate = new Date(year, month - 1, 1)

  const filteredTransactions = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase()
    return (transactions || []).filter((transaction) => {
      if (!matchesFinanceScope(financeScope, transaction.ownerId, user?.id, partner?.id)) return false
      if (typeFilter !== 'all' && transaction.transactionType !== typeFilter) return false
      if (sourceFilter === 'ai' && transaction.source !== 'ai') return false
      if (sourceFilter === 'manual' && transaction.source === 'ai') return false
      if (!normalizedSearch) return true
      return [transaction.memo, transaction.category, transaction.type]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch)
    })
  }, [financeScope, partner?.id, searchQuery, sourceFilter, transactions, typeFilter, user?.id])

  const groups = useMemo(() => {
    const grouped = new Map<string, UnifiedTransaction[]>()
    for (const transaction of filteredTransactions) {
      const current = grouped.get(transaction.date) || []
      current.push(transaction)
      grouped.set(transaction.date, current)
    }
    return Array.from(grouped.entries()).sort(([a], [b]) => b.localeCompare(a))
  }, [filteredTransactions])

  const monthExpense = useMemo(
    () => filteredTransactions.filter((row) => row.transactionType === 'expense').reduce((sum, row) => sum + row.amount, 0),
    [filteredTransactions]
  )

  const resetForm = () => {
    setEditingTransaction(null)
    setTransactionType('expense')
    setDate(getTodayJstDateKey())
    setAmount('')
    setMemo('')
    setCategoryId('')
    setExpenseKind('shared')
    setSettlementTarget(false)
    setPaymentMethod('card')
    setIncomeType('salary')
  }

  const openCreateDialog = () => {
    resetForm()
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
    setSettlementTarget(Boolean(transaction.rawExpense?.is_settlement_target))
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
        if (!categoryId) return toast.error('カテゴリを選択してください')
        const resolvedExpenseKind = settlementTarget ? 'shared' : expenseKind

        if (editingTransaction) {
          await updateExpenseWithSplits.mutateAsync({
            userId: user.id,
            expenseId: editingTransaction.id,
            amount: Number(amount),
            expenseDate: date,
            categoryId,
            description: memo || null,
            isSettlementTarget: settlementTarget,
            paymentMethod,
            expenseType: resolvedExpenseKind,
          })
        } else {
          await createManualExpense.mutateAsync({
            userId: user.id,
            paidBy: user.id,
            amount: Number(amount),
            expenseDate: date,
            categoryId,
            description: memo || null,
            isSettlementTarget: settlementTarget,
            paymentMethod,
            expenseType: resolvedExpenseKind,
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
      toast.success(editingTransaction ? '更新しました' : '登録しました')
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存に失敗しました'
      toast.error(message)
    }
  }

  const navigateMonth = (direction: number) => {
    setSelectedMonth(format(addMonths(displayDate, direction), 'yyyy-MM'))
  }

  const isSaving = createManualExpense.isPending || updateExpenseWithSplits.isPending || createTransaction.isPending || updateTransaction.isPending

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">履歴</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {FINANCE_SCOPE_LABELS[financeScope]}の生活ログ。ChatGPTに話した内容がここへ反映されます。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border bg-card p-1">
            <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[88px] text-center text-sm font-semibold">{format(displayDate, 'yyyy/MM')}</span>
            <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={openCreateDialog} className="gap-1.5">
            <Plus className="h-4 w-4" /> 手動入力
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="店名・メモ・カテゴリで検索"
                className="pl-9"
              />
            </div>
            <Select items={TYPE_FILTER_ITEMS} value={typeFilter} onValueChange={(value) => setTypeFilter((value || 'all') as TypeFilter)}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPE_FILTER_ITEMS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select items={SOURCE_FILTER_ITEMS} value={sourceFilter} onValueChange={(value) => setSourceFilter((value || 'all') as SourceFilter)}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SOURCE_FILTER_ITEMS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="mt-4 flex items-center justify-between border-t pt-4 text-sm">
            <span className="text-muted-foreground">表示中 {filteredTransactions.length}件</span>
            <span className="font-semibold">支出合計 {formatYen(monthExpense)}</span>
          </div>
        </CardContent>
      </Card>

      {groups.length > 0 ? (
        <div className="space-y-6">
          {groups.map(([dateKey, items]) => (
            <section key={dateKey} className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold">{dateKey}</h2>
                <span className="text-xs text-muted-foreground">{items.length}件</span>
              </div>

              <Card>
                <CardContent className="divide-y p-0">
                  {items.map((transaction) => {
                    const expense = transaction.rawExpense
                    const isAi = transaction.source === 'ai'
                    const payerName = displayPerson(transaction.ownerId, user, partner)
                    const partnerSplit = expense?.expense_splits?.find((split) => split.user_id === partner?.id)
                    const userSplit = expense?.expense_splits?.find((split) => split.user_id === user?.id)

                    return (
                      <div key={`${transaction.transactionType}-${transaction.id}`} className="group flex items-start gap-3 p-4">
                        <div className="mt-0.5 rounded-full bg-muted p-2">
                          {transaction.transactionType === 'expense'
                            ? <WalletCards className="h-4 w-4" />
                            : <CircleDollarSign className="h-4 w-4" />}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-semibold">
                              {transaction.memo || transaction.category || (transaction.transactionType === 'expense' ? '支出' : '収入')}
                            </p>
                            {isAi && (
                              <Badge variant="outline" className="gap-1 px-1.5 py-0 text-[10px]">
                                <Bot className="h-3 w-3" /> AI
                              </Badge>
                            )}
                            {expense?.is_settlement_target && (
                              <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">精算対象</Badge>
                            )}
                          </div>

                          <p className="mt-1 text-xs text-muted-foreground">
                            {transaction.category} · {transaction.transactionType === 'expense' ? `${payerName}支払い` : `${payerName}受取`} · {sourceLabel(transaction.source)}
                          </p>

                          {expense?.is_settlement_target && (userSplit || partnerSplit) && (
                            <p className="mt-1.5 text-xs text-muted-foreground">
                              負担: {user?.display_name || '自分'} {formatYen(Number(userSplit?.amount || 0))}
                              {' / '}
                              {partner?.display_name || 'パートナー'} {formatYen(Number(partnerSplit?.amount || 0))}
                              {' · '}
                              {expense.expense_splits?.every((split) => split.is_settled) ? '精算済' : '未精算'}
                            </p>
                          )}
                        </div>

                        <div className="shrink-0 text-right">
                          <p className={transaction.transactionType === 'income' ? 'font-bold text-[var(--color-income)]' : 'font-bold'}>
                            {transaction.transactionType === 'income' ? '+' : ''}{formatYen(transaction.amount)}
                          </p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="mt-1 h-8 w-8 text-muted-foreground opacity-70 transition-opacity group-hover:opacity-100"
                            onClick={() => openEditDialog(transaction)}
                            title="修正"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            </section>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <MoreHorizontal className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">該当する履歴はありません</p>
            <p className="mt-1 text-sm text-muted-foreground">ChatGPTで登録した支出もここに表示されます。</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTransaction ? '履歴を修正' : '手動で登録'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>種類</Label>
              <Select
                items={TRANSACTION_TYPE_ITEMS}
                value={transactionType}
                onValueChange={(value) => setTransactionType((value || 'expense') as 'income' | 'expense')}
                disabled={Boolean(editingTransaction)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRANSACTION_TYPE_ITEMS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>日付</Label>
                <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              </div>
              <div>
                <Label>金額</Label>
                <Input type="number" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" />
              </div>
            </div>

            <div>
              <Label>メモ</Label>
              <Input value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="店名や内容" />
            </div>

            {transactionType === 'expense' ? (
              <>
                <div>
                  <Label>カテゴリ</Label>
                  <Select items={categoryItems} value={categoryId} onValueChange={(value) => setCategoryId(value || '')}>
                    <SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger>
                    <SelectContent>
                      {categoryItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>区分</Label>
                    <Select items={EXPENSE_KIND_ITEMS} value={expenseKind} onValueChange={(value) => setExpenseKind(value || 'shared')} disabled={settlementTarget}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EXPENSE_KIND_ITEMS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>支払方法</Label>
                    <Select items={PAYMENT_METHOD_ITEMS} value={paymentMethod} onValueChange={(value) => setPaymentMethod(value || 'card')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHOD_ITEMS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <label className="flex cursor-pointer items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">精算対象</p>
                    <p className="text-xs text-muted-foreground">ONにすると標準負担割合でsplitを作成します</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settlementTarget}
                    onChange={(event) => setSettlementTarget(event.target.checked)}
                    className="h-4 w-4"
                  />
                </label>
              </>
            ) : (
              <div>
                <Label>収入種別</Label>
                <Select items={INCOME_TYPE_ITEMS} value={incomeType} onValueChange={(value) => setIncomeType(value || 'salary')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INCOME_TYPE_ITEMS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button>
              <Button onClick={handleSave} disabled={isSaving}>{isSaving ? '保存中…' : '保存'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
