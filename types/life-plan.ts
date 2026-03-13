// ============================================
// Life Plan Types — mirrors the Excel model
// ============================================

export interface LifePlanAssumptions {
  cashReserveRatio: number   // キャッシュ確保率 (default 0.30)
  defenseMonths: number      // 目標防衛資金 月数 (default 6)
  returnRate: number         // 想定投資利回り (default 0.04)
  nisaAnnualLimit: number    // NISA年間投入枠 (default 400000)
}

export interface IncomeEntry {
  year: number
  ren: { gross: number; net: number }
  hikaru: { gross: number; net: number }
}

export interface LivingCostItem {
  type: 'fixed' | 'personal'
  category: string
  item: string
  monthly: number
  owner: 'ren' | 'hikaru' | 'shared'
  memo?: string
}

export interface LivingCostTemplates {
  beforeRen: LivingCostItem[]
  beforeHikaru: LivingCostItem[]
  afterCohabitation: LivingCostItem[]
}

export interface LifeEvent {
  year: number
  title: string
  category: string
  amount: number
  renRatio: number
  hikaruRatio: number
  paymentType: 'lump_sum' | 'split'
  memo: string
}

export interface PersonAssets {
  cash: number
  nisa: number
  taxable: number
}

export interface InitialAssets {
  ren: PersonAssets
  hikaru: PersonAssets
}

export interface LifePlanConfig {
  assumptions: LifePlanAssumptions
  incomeData: IncomeEntry[]
  livingCosts: LivingCostTemplates
  lifeEvents: LifeEvent[]
  initialAssets: InitialAssets
}

// Simulation output per person per year
export interface YearlyPersonResult {
  year: number
  age: number
  startAssets: number
  gross: number
  net: number
  livingCost: number
  disposable: number
  eventCost: number
  cashReserve: number
  cashBalance: number
  investable: number
  nisaInvestment: number
  nonNisaInvestment: number
  nisaCumulative: number
  nisaBalance: number
  nisaReturn: number
  cumulativeReturn: number
  taxableInvestment: number
  taxableBalance: number
  totalAssets: number
  assetGrowthRate: number
  cumulativePrincipal: number
}

// Dashboard row (household summary)
export interface YearlyHouseholdResult {
  year: number
  age: number
  renGross: number
  renNet: number
  hikaruGross: number
  hikaruNet: number
  householdGross: number
  householdNet: number
  householdNetMonthly: number
  householdCash: number
  householdNisa: number
  householdTaxable: number
  householdInvestment: number
  householdTotalAssets: number
  cashRatio: number
  assetIncomeRatio: number
}

export interface SimulationResult {
  ren: YearlyPersonResult[]
  hikaru: YearlyPersonResult[]
  household: YearlyHouseholdResult[]
}

// DB row
export interface LifePlanRow {
  id: string
  couple_id: string
  assumptions: LifePlanAssumptions
  income_data: IncomeEntry[]
  living_costs: LivingCostTemplates
  life_events: LifeEvent[]
  initial_assets: InitialAssets
  updated_at: string
  created_at: string
}
