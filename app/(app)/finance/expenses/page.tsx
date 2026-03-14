'use client'

import { ChangeEvent, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Loader2, Pencil, Plus, Search, Trash2, Upload } from 'lucide-react'
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
import { useCreateCategory, useExpenseCategories } from '@/lib/hooks/use-categories'
import { useCreateTransaction, useDeleteTransaction, useTransactions, useUpdateTransaction } from '@/lib/hooks/use-transactions'
import { useFinanceStore } from '@/stores/finance-store'
import { toast } from 'sonner'
import type { UnifiedTransaction } from '@/types'

const EXPENSE_KIND_LABELS: Record<string, string> = {
  shared: '共有',
  personal: '個人',
  advance: '立替',
  pending_settlement: '精算待ち',
}

type MoneyforwardImportItem = {
  id: string
  category: string
  amount: string
}

const IMPORT_ERROR_MESSAGES: Record<string, string> = {
  missing_file: '画像ファイルを選択してください',
  invalid_file_type: '画像ファイルを選択してください',
  image_too_small: '画像サイズが不足しているため認識できませんでした',
  no_categories_detected: 'カテゴリ金額を認識できませんでした',
  missing_api_key: 'サーバーのAPI設定を確認してください',
  openai_request_failed: 'AI解析でエラーが発生しました',
  empty_model_output: 'AIの出力が空でした。別画像で再度お試しください',
  unknown_import_error: 'カテゴリ金額を認識できませんでした',
}

function normalizeCategoryKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '')
}

function loadImageSize(file: File) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      resolve({ width: image.width, height: image.height })
      URL.revokeObjectURL(objectUrl)
    }

    image.onerror = () => {
      reject(new Error('invalid image'))
      URL.revokeObjectURL(objectUrl)
    }

    image.src = objectUrl
  })
}

export default function TransactionsPage() {
  const { user, couple, partner } = useAuth()
  const { selectedMonth, setSelectedMonth } = useFinanceStore()
  const { data: transactions } = useTransactions(couple?.id, selectedMonth)
  const { data: categories } = useExpenseCategories(couple?.id)
  const createCategory = useCreateCategory()
  const createTransaction = useCreateTransaction()
  const updateTransaction = useUpdateTransaction()
  const deleteTransaction = useDeleteTransaction()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
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

  const [importItems, setImportItems] = useState<MoneyforwardImportItem[]>([])
  const [importMonth, setImportMonth] = useState(selectedMonth)
  const [importError, setImportError] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [isSavingImport, setIsSavingImport] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

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

  const resetImportState = () => {
    setImportItems([])
    setImportMonth(selectedMonth)
    setImportError('')
    setIsImporting(false)
    setIsSavingImport(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const navigateMonth = (direction: number) => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const nextDate = new Date(year, month - 1 + direction, 1)
    setSelectedMonth(format(nextDate, 'yyyy-MM'))
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
    setPaymentMethod(transaction.rawExpense?.payment_method || 'card')
    setIncomeType(transaction.rawIncome?.income_type || 'salary')
    setDialogOpen(true)
  }

  const openImportDialog = () => {
    resetImportState()
    setImportDialogOpen(true)
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

  const handleImportFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setImportItems([])
    setImportError('')

    try {
      const size = await loadImageSize(file)
      if (size.width < 640 || size.height < 640) {
        setImportError('カテゴリ金額を認識できませんでした')
        return
      }
    } catch {
      setImportError('カテゴリ金額を認識できませんでした')
      return
    }

    setIsImporting(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/finance/import-moneyforward', {
        method: 'POST',
        body: formData,
      })
      const payload = await response.json()

      if (!response.ok || !Array.isArray(payload.items) || payload.items.length === 0) {
        setImportError(IMPORT_ERROR_MESSAGES[payload.error_code] || payload.error || 'カテゴリ金額を認識できませんでした')
        return
      }

      setImportItems(
        payload.items.map((item: { category: string; amount: number }) => ({
          id: crypto.randomUUID(),
          category: item.category,
          amount: String(item.amount),
        }))
      )
    } catch {
      setImportError('ネットワークまたはサーバーエラーで取り込みに失敗しました')
    } finally {
      setIsImporting(false)
    }
  }

  const updateImportItem = (id: string, updates: Partial<MoneyforwardImportItem>) => {
    setImportItems((current) => current.map((item) => (item.id === id ? { ...item, ...updates } : item)))
  }

  const removeImportItem = (id: string) => {
    setImportItems((current) => current.filter((item) => item.id !== id))
  }

  const handleSaveImportedTransactions = async () => {
    if (!user?.id || !couple?.id) return toast.error('ペア情報を確認してください')
    if (!importMonth) return toast.error('保存対象月を指定してください')

    const validItems = importItems
      .map((item) => ({
        ...item,
        amountNumber: Number(item.amount),
      }))
      .filter((item) => item.category.trim() && Number.isFinite(item.amountNumber) && item.amountNumber > 0)

    if (validItems.length === 0) {
      return toast.error('保存できるカテゴリ行がありません')
    }

    setIsSavingImport(true)
    try {
      const categoryMap = new Map((categories || []).map((category) => [normalizeCategoryKey(category.name), category]))
      let sortOrderBase = Math.max(0, ...(categories || []).map((category) => category.sort_order || 0))

      for (const item of validItems) {
        const normalizedKey = normalizeCategoryKey(item.category)
        let category = categoryMap.get(normalizedKey)

        if (!category) {
          sortOrderBase += 1
          category = await createCategory.mutateAsync({
            couple_id: couple.id,
            name: item.category.trim(),
            icon: '•',
            color: null,
            sort_order: sortOrderBase,
          })
          categoryMap.set(normalizedKey, category)
        }

        await createTransaction.mutateAsync({
          transactionType: 'expense',
          values: {
            couple_id: couple.id,
            paid_by: user.id,
            amount: item.amountNumber,
            description: 'MF screenshot import',
            expense_date: `${importMonth}-01`,
            expense_type: 'shared',
            category_id: category.id,
            payment_method: null,
            source: 'moneyforward_screenshot',
          },
        })
      }

      setSelectedMonth(importMonth)
      setImportDialogOpen(false)
      resetImportState()
      toast.success(`${validItems.length}件のカテゴリ支出を保存しました`)
    } catch {
      toast.error('保存処理に失敗しました')
    } finally {
      setIsSavingImport(false)
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

      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
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
        <Button size="sm" variant="outline" onClick={openImportDialog}>
          <Upload className="mr-1 h-4 w-4" />
          スクショから取り込み
        </Button>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) resetForm()
          }}
        >
          <DialogTrigger render={<Button size="sm" onClick={openCreateDialog} />}>
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
                          <SelectItem value="shared">共有</SelectItem>
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

      <Dialog
        open={importDialogOpen}
        onOpenChange={(open) => {
          setImportDialogOpen(open)
          if (!open) resetImportState()
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>マネーフォワードのスクショ取り込み</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>対象月</Label>
              <Input type="month" value={importMonth} onChange={(e) => setImportMonth(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                このデータを {importMonth.replace('-', '年')}月として保存しますか？
              </p>
            </div>

            <div className="space-y-2">
              <Label>スクリーンショット</Label>
              <Input ref={fileInputRef} type="file" accept="image/*" onChange={handleImportFileChange} />
              <p className="text-xs text-muted-foreground">
                対応画面はマネーフォワードのカテゴリ別支出一覧画面のみです。
              </p>
            </div>

            {isImporting && (
              <div className="flex items-center gap-2 rounded-lg border p-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                AIでカテゴリ別金額を抽出しています
              </div>
            )}

            {importError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {importError}
              </div>
            )}

            {importItems.length > 0 && (
              <div className="space-y-3">
                <div className="rounded-lg bg-muted/40 p-3 text-sm">
                  AI抽出結果は自動保存されません。カテゴリと金額を確認してから保存してください。
                </div>
                <div className="grid grid-cols-[1fr_140px_auto] gap-2 border-b pb-2 text-xs text-muted-foreground">
                  <span>カテゴリ</span>
                  <span className="text-right">金額</span>
                  <span />
                </div>
                <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                  {importItems.map((item) => (
                    <div key={item.id} className="grid grid-cols-[1fr_140px_auto] items-center gap-2">
                      <Input value={item.category} onChange={(e) => updateImportItem(item.id, { category: e.target.value })} />
                      <Input
                        type="number"
                        className="text-right"
                        value={item.amount}
                        onChange={(e) => updateImportItem(item.id, { amount: e.target.value })}
                      />
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeImportItem(item.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button className="w-full" onClick={handleSaveImportedTransactions} disabled={isSavingImport || createTransaction.isPending || createCategory.isPending}>
                  {isSavingImport && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                  確認して保存
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
