import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { splitBudgetTotal } from '@/lib/budget-utils'

// Excel data: LIVING_COST_AFTER_LT (同棲後の月額予算)
const MONTHLY_BUDGET_TOTAL = 321500

// Category name → monthly budget amount mapping from Excel
// Maps to default expense_categories seeded by the DB trigger
const CATEGORY_BUDGETS: Record<string, number> = {
  '住宅': 160000,    // 家賃150,000 + 管理費10,000
  '食費': 50000,     // 共有食費
  '水道・光熱費': 10000,   // 電気ガス水道
  '日用品': 5000,    // 共有日用品
  '通信費': 6000,    // REN 携帯+インターネット
  '交通費': 10000,   // REN 5,000 + HIKARU 5,000
  '趣味・娯楽': 50000,     // REN 外食娯楽
  '健康・医療': 5500,    // REN コンタクト
}

// Life events from Excel EVENT sheet
const LIFE_EVENTS = [
  { year: 2026, title: '同棲', category: '住居', amount: 600000, note: '初期費用・引越' },
  { year: 2028, title: '婚約指輪', category: '婚約', amount: 500000, note: 'REN負担' },
  { year: 2029, title: '結婚式', category: '結婚', amount: 2500000, note: '人前式' },
  { year: 2029, title: '新婚旅行', category: '旅行', amount: 1500000, note: 'ヨーロッパ・アジア' },
  { year: 2031, title: '出産', category: '子供', amount: 300000, note: '' },
]

export async function POST() {
  const supabase = await createClient()

  // Verify auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  // Get user's couple
  const { data: profile } = await supabase
    .from('users')
    .select('couple_id')
    .eq('id', user.id)
    .single()

  if (!profile?.couple_id) {
    return NextResponse.json({ error: 'カップル未登録' }, { status: 400 })
  }

  const coupleId = profile.couple_id
  const { data: members } = await supabase
    .from('users')
    .select('id, display_name, email, created_at')
    .eq('couple_id', coupleId)
    .order('created_at', { ascending: true })

  // Get expense categories for this couple
  const { data: categories } = await supabase
    .from('expense_categories')
    .select('*')
    .eq('couple_id', coupleId)

  if (!categories || categories.length === 0) {
    return NextResponse.json({ error: 'カテゴリが見つかりません' }, { status: 400 })
  }

  // Build category name → id map
  const categoryMap = new Map<string, string>()
  for (const cat of categories) {
    categoryMap.set(cat.name, cat.id)
  }

  // Seed budgets for current month + next 11 months (1 year)
  const now = new Date()
  const results = { budgets: 0, budgetCategories: 0, events: 0 }
  const { primary, secondary } = splitBudgetTotal(MONTHLY_BUDGET_TOTAL)
  const rankedMembers = (members || []).slice(0, 2)

  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

    // Upsert budget
    const { data: budget, error: budgetError } = await supabase
      .from('budgets')
      .upsert(
        { couple_id: coupleId, year_month: yearMonth, total_limit: MONTHLY_BUDGET_TOTAL },
        { onConflict: 'couple_id,year_month' }
      )
      .select()
      .single()

    if (budgetError) {
      console.error('Budget upsert error:', budgetError)
      continue
    }
    results.budgets++

    if (rankedMembers.length > 0) {
      const memberRows = rankedMembers.map((member, index) => ({
        budget_id: budget.id,
        user_id: member.id,
        limit_amount: rankedMembers.length === 1 ? MONTHLY_BUDGET_TOTAL : index === 0 ? primary : secondary,
      }))

      const { error: memberLimitError } = await supabase
        .from('budget_member_limits')
        .upsert(memberRows, { onConflict: 'budget_id,user_id' })

      if (memberLimitError) {
        console.error('Budget member limit upsert error:', memberLimitError)
      }
    }

    // Upsert budget categories
    for (const [catName, amount] of Object.entries(CATEGORY_BUDGETS)) {
      const categoryId = categoryMap.get(catName)
      if (!categoryId) continue

      const { error: catError } = await supabase
        .from('budget_categories')
        .upsert(
          {
            budget_id: budget.id,
            category_id: categoryId,
            limit_amount: amount,
            alert_ratio: 0.80,
          },
          { onConflict: 'budget_id,category_id' }
        )

      if (!catError) results.budgetCategories++
    }
  }

  // Seed life events as calendar events
  for (const event of LIFE_EVENTS) {
    const startAt = new Date(event.year, 0, 1).toISOString()

    const { error: eventError } = await supabase
      .from('calendar_events')
      .insert({
        couple_id: coupleId,
        created_by: user.id,
        title: event.title,
        description: `${event.note}\n予算: ¥${event.amount.toLocaleString()}`,
        start_at: startAt,
        all_day: true,
        event_type: 'financial',
        visibility: 'shared',
        linked_amount: event.amount,
        color: '#1E5945',
      })

    if (!eventError) results.events++
  }

  return NextResponse.json({
    success: true,
    message: `予算${results.budgets}ヶ月分、カテゴリ${results.budgetCategories}件、イベント${results.events}件をインポートしました`,
    results,
  })
}
