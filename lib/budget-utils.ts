import { summarizeLivingCosts } from '@/lib/life-plan/engine'
import type { Budget, BudgetMemberLimit } from '@/types'
import type { LifePlanConfig, LivingCostItem } from '@/types/life-plan'

// Derived from the existing seeded monthly plan: 321,500 total split into
// 218,457 for the primary member and 103,043 for the partner.
export const PRIMARY_MEMBER_BUDGET_RATIO = 218457 / 321500

export function splitBudgetTotal(total: number) {
  const safeTotal = Math.max(0, Math.round(total))
  const primary = Math.round(safeTotal * PRIMARY_MEMBER_BUDGET_RATIO)
  const secondary = safeTotal - primary
  return { primary, secondary }
}

export function getBudgetLimitTotal(
  budget: Pick<Budget, 'total_limit'> | null | undefined,
  memberLimits?: Array<Pick<BudgetMemberLimit, 'limit_amount'>> | null
) {
  if (memberLimits && memberLimits.length > 0) {
    return memberLimits.reduce((sum, row) => sum + (Number(row.limit_amount) || 0), 0)
  }

  return Number(budget?.total_limit) || 0
}

function findCohabitationYear(config: LifePlanConfig) {
  const event = config.lifeEvents.find(
    (entry) => entry.title === '同棲' || entry.category === '住居'
  )
  return event ? event.year + 1 : 9999
}

function getSharedRatio(config: LifePlanConfig, cohabitationYear: number) {
  const firstYearIncome = config.incomeData.find((entry) => entry.year === cohabitationYear)
  const prevYearIncome = config.incomeData.find((entry) => entry.year === cohabitationYear - 1)
  const ratioSource = prevYearIncome || firstYearIncome || config.incomeData[0]

  if (!ratioSource) return 0.5

  const total = ratioSource.ren.net + ratioSource.hikaru.net
  return total > 0 ? ratioSource.ren.net / total : 0.5
}

export function getLifePlanMonthlyBudget(config: LifePlanConfig, yearMonth: string) {
  const year = Number(yearMonth.slice(0, 4))
  const cohabitationYear = findCohabitationYear(config)

  if (year < cohabitationYear) {
    const ren = summarizeLivingCosts(config.livingCosts.beforeRen).total
    const hikaru = summarizeLivingCosts(config.livingCosts.beforeHikaru).total
    return {
      ren,
      hikaru,
      shared: 0,
      total: ren + hikaru,
    }
  }

  const summary = summarizeLivingCosts(config.livingCosts.afterCohabitation)
  const renRatio = getSharedRatio(config, cohabitationYear)
  const ren = Math.round(summary.shared * renRatio + summary.ren)
  const hikaru = Math.round(summary.shared * (1 - renRatio) + summary.hikaru)

  return {
    ren,
    hikaru,
    shared: summary.shared,
    total: ren + hikaru,
  }
}

function mapLifePlanCategoryToExpenseCategory(item: LivingCostItem) {
  const key = `${item.category}:${item.item}`

  if (key.includes('住居') || key.includes('家賃') || key.includes('管理費')) return '住宅'
  if (key.includes('食費')) return '食費'
  if (key.includes('光熱') || key.includes('電気') || key.includes('水道')) return '水道・光熱費'
  if (key.includes('日用品')) return '日用品'
  if (key.includes('通信') || key.includes('携帯') || key.includes('インターネット')) return '通信費'
  if (key.includes('交通')) return '交通費'
  if (key.includes('娯楽') || key.includes('外食')) return '趣味・娯楽'
  if (key.includes('健康') || key.includes('医療') || key.includes('ジム') || key.includes('コンタクト')) return '健康・医療'
  if (key.includes('衣服') || key.includes('美容')) return '衣服・美容'
  if (key.includes('教育') || key.includes('教養')) return '教養・教育'
  if (key.includes('税') || key.includes('社会保障') || key.includes('保険')) return '税・社会保障'
  if (key.includes('自動車')) return '自動車'
  if (key.includes('旅行') || key.includes('特別')) return '特別な支出'

  return 'その他'
}

export function getLifePlanCategoryBudgetMap(config: LifePlanConfig, yearMonth: string) {
  const year = Number(yearMonth.slice(0, 4))
  const cohabitationYear = findCohabitationYear(config)
  const sourceItems =
    year < cohabitationYear
      ? [...config.livingCosts.beforeRen, ...config.livingCosts.beforeHikaru]
      : config.livingCosts.afterCohabitation

  return sourceItems.reduce<Record<string, number>>((acc, item) => {
    const categoryName = mapLifePlanCategoryToExpenseCategory(item)
    acc[categoryName] = (acc[categoryName] || 0) + Number(item.monthly || 0)
    return acc
  }, {})
}
