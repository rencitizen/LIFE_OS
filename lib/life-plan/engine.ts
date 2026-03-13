import type {
  LifePlanConfig,
  YearlyPersonResult,
  YearlyHouseholdResult,
  SimulationResult,
  LivingCostItem,
} from '@/types/life-plan'

const BASE_AGE_YEAR = 2001 // Born 2001 → 25 in 2026

/**
 * Calculate living cost for a person in a given year.
 * Before cohabitation: use individual template.
 * After cohabitation: use shared template with income-based ratio.
 */
function calcLivingCost(
  person: 'ren' | 'hikaru',
  year: number,
  config: LifePlanConfig,
  cohabitationYear: number
): number {
  const { livingCosts, incomeData } = config

  if (year < cohabitationYear) {
    // Before cohabitation: individual costs
    const items = person === 'ren' ? livingCosts.beforeRen : livingCosts.beforeHikaru
    return items.reduce((sum, i) => sum + i.monthly, 0) * 12
  }

  // After cohabitation: shared costs split by Ren's first-year income ratio for BOTH people
  // Excel uses the same ratio (Ren's share) as the basis: Ren pays renRatio, Hikaru pays (1 - renRatio)
  const afterItems = livingCosts.afterCohabitation
  const firstYearIncome = incomeData.find((d) => d.year === cohabitationYear)
  const prevYearIncome = incomeData.find((d) => d.year === cohabitationYear - 1)
  const ratioSource = prevYearIncome || firstYearIncome || incomeData[0]

  let renRatio = 0.5
  if (ratioSource) {
    const total = ratioSource.ren.net + ratioSource.hikaru.net
    renRatio = ratioSource.ren.net / total
  }
  // Excel uses renRatio for BOTH people (each person pays shared × renRatio + personal)
  const ratio = renRatio

  const sharedMonthly = afterItems
    .filter((i) => i.owner === 'shared')
    .reduce((sum, i) => sum + i.monthly, 0)
  const personalMonthly = afterItems
    .filter((i) => i.owner === person)
    .reduce((sum, i) => sum + i.monthly, 0)

  return (sharedMonthly * ratio + personalMonthly) * 12
}

/**
 * Get event costs for a person in a given year.
 */
function calcEventCost(
  person: 'ren' | 'hikaru',
  year: number,
  config: LifePlanConfig
): number {
  return config.lifeEvents
    .filter((e) => e.year === year)
    .reduce((sum, e) => {
      const ratio = person === 'ren' ? e.renRatio : e.hikaruRatio
      return sum + e.amount * ratio
    }, 0)
}

/**
 * Find the year of cohabitation event.
 */
function findCohabitationYear(config: LifePlanConfig): number {
  const event = config.lifeEvents.find(
    (e) => e.title === '同棲' || e.category === '住居'
  )
  // Cohabitation takes effect the year AFTER the event (moving year)
  return event ? event.year + 1 : 9999
}

/**
 * Simulate one person's asset trajectory.
 */
function simulatePerson(
  person: 'ren' | 'hikaru',
  config: LifePlanConfig
): YearlyPersonResult[] {
  const { assumptions, incomeData, initialAssets } = config
  const initial = person === 'ren' ? initialAssets.ren : initialAssets.hikaru
  const cohabitationYear = findCohabitationYear(config)

  let cash = initial.cash
  let nisa = initial.nisa
  let taxable = initial.taxable
  let cumulativeNisaInput = 0
  let cumulativeReturn = 0
  let cumulativePrincipal = 0

  const results: YearlyPersonResult[] = []
  const years = incomeData.map((d) => d.year).sort((a, b) => a - b)

  for (const year of years) {
    const income = incomeData.find((d) => d.year === year)
    const personIncome = income ? (person === 'ren' ? income.ren : income.hikaru) : { gross: 0, net: 0 }
    const startAssets = cash + nisa + taxable

    const livingCost = calcLivingCost(person, year, config, cohabitationYear)
    const disposable = personIncome.net - livingCost
    const eventCost = calcEventCost(person, year, config)
    const cashReserve = personIncome.net * assumptions.cashReserveRatio

    // Investable: disposable minus what goes to cash reserve
    const investable = Math.max(0, disposable - cashReserve)

    const nisaLimit = assumptions.nisaAnnualLimit

    // Events come from cash only — investment is never reduced by events
    cash = cash + cashReserve - eventCost

    // NISA gets up to limit, rest goes to taxable
    const nisaInvestment = Math.min(investable, nisaLimit)
    const nonNisaInvestment = Math.max(0, investable - nisaLimit)

    // NISA cumulative
    cumulativeNisaInput += nisaInvestment

    // Investment returns (compound within year)
    const prevNisa = nisa
    nisa = (nisa + nisaInvestment) * (1 + assumptions.returnRate)
    const nisaReturn = nisa - prevNisa - nisaInvestment

    taxable = (taxable + nonNisaInvestment) * (1 + assumptions.returnRate)

    cumulativeReturn += nisaReturn + (taxable - (taxable / (1 + assumptions.returnRate)) - nonNisaInvestment + nonNisaInvestment * assumptions.returnRate / (1 + assumptions.returnRate))
    cumulativePrincipal += investable

    const totalAssets = cash + nisa + taxable
    const assetGrowthRate = startAssets > 0 ? (totalAssets - startAssets) / startAssets : 0

    results.push({
      year,
      age: year - BASE_AGE_YEAR,
      startAssets,
      gross: personIncome.gross,
      net: personIncome.net,
      livingCost,
      disposable,
      eventCost,
      cashReserve,
      cashBalance: cash,
      investable,
      nisaInvestment,
      nonNisaInvestment,
      nisaCumulative: cumulativeNisaInput,
      nisaBalance: nisa,
      nisaReturn,
      cumulativeReturn,
      taxableInvestment: nonNisaInvestment,
      taxableBalance: taxable,
      totalAssets,
      assetGrowthRate,
      cumulativePrincipal,
    })
  }

  return results
}

/**
 * Run full simulation and produce household dashboard.
 */
export function simulate(config: LifePlanConfig): SimulationResult {
  const ren = simulatePerson('ren', config)
  const hikaru = simulatePerson('hikaru', config)

  const household: YearlyHouseholdResult[] = ren.map((r, i) => {
    const h = hikaru[i]
    const householdNet = r.net + h.net
    const householdCash = r.cashBalance + h.cashBalance
    const householdNisa = r.nisaBalance + h.nisaBalance
    const householdTaxable = r.taxableBalance + h.taxableBalance
    const householdInvestment = householdNisa + householdTaxable
    const householdTotalAssets = householdCash + householdInvestment

    return {
      year: r.year,
      age: r.age,
      renGross: r.gross,
      renNet: r.net,
      hikaruGross: h.gross,
      hikaruNet: h.net,
      householdGross: r.gross + h.gross,
      householdNet,
      householdNetMonthly: Math.round(householdNet / 12),
      householdCash,
      householdNisa,
      householdTaxable,
      householdInvestment,
      householdTotalAssets,
      cashRatio: householdTotalAssets > 0 ? householdCash / householdTotalAssets : 0,
      assetIncomeRatio: householdNet > 0 ? householdTotalAssets / householdNet : 0,
    }
  })

  return { ren, hikaru, household }
}

/**
 * Get summary of living costs from a template.
 */
export function summarizeLivingCosts(items: LivingCostItem[]) {
  const shared = items.filter((i) => i.owner === 'shared').reduce((s, i) => s + i.monthly, 0)
  const ren = items.filter((i) => i.owner === 'ren').reduce((s, i) => s + i.monthly, 0)
  const hikaru = items.filter((i) => i.owner === 'hikaru').reduce((s, i) => s + i.monthly, 0)
  return { shared, ren, hikaru, total: shared + ren + hikaru }
}
