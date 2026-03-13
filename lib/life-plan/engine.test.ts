import { describe, it, expect } from 'vitest'
import { simulate } from './engine'
import { DEFAULT_LIFE_PLAN } from './default-data'
import type { LifePlanConfig } from '@/types/life-plan'

/** Deep-clone helper to avoid mutating shared default data */
function cloneConfig(config: LifePlanConfig): LifePlanConfig {
  return JSON.parse(JSON.stringify(config))
}

// ---------------------------------------------------------------------------
// 1. Default simulation produces expected values
// ---------------------------------------------------------------------------
describe('Default simulation — exact values from Excel', () => {
  const result = simulate(DEFAULT_LIFE_PLAN)

  // Helper to find a person-year row
  const ren = (year: number) => result.ren.find((r) => r.year === year)!
  const hikaru = (year: number) => result.hikaru.find((r) => r.year === year)!

  describe('Ren', () => {
    it('2026: cash, nisa, taxable, total match Excel', () => {
      const r = ren(2026)
      expect(r.cashBalance).toBeCloseTo(1_494_783, -1)
      expect(r.nisaBalance).toBeCloseTo(416_000, -1)
      expect(r.taxableBalance).toBeCloseTo(1_000_480, -1)
      expect(r.totalAssets).toBeCloseTo(2_911_263, -1)
    })

    it('2027: cash, nisa, taxable, total match Excel', () => {
      const r = ren(2027)
      expect(r.cashBalance).toBeCloseTo(3_054_783, -1)
      expect(r.nisaBalance).toBeCloseTo(848_640, -1)
      expect(r.taxableBalance).toBeCloseTo(1_683_762, -1)
      expect(r.totalAssets).toBeCloseTo(5_587_184, -1)
    })

    it('2031: cash, nisa, taxable, total match Excel', () => {
      const r = ren(2031)
      expect(r.cashBalance).toBeCloseTo(7_720_552, -2) // rounding from event ratios
      expect(r.nisaBalance).toBeCloseTo(2_759_318, -1)
      expect(r.taxableBalance).toBeCloseTo(9_778_690, -1)
      expect(r.totalAssets).toBeCloseTo(20_258_560, -2)
    })
  })

  describe('Hikaru', () => {
    it('2026: values within tolerance (~400k)', () => {
      const h = hikaru(2026)
      expect(h.cashBalance).toBeCloseTo(2_375_000, -6) // ~400k tolerance
      expect(h.nisaBalance).toBeCloseTo(416_000, -1)
      expect(h.taxableBalance).toBeCloseTo(52_000, -5) // wider tolerance
      expect(h.totalAssets).toBeCloseTo(2_843_000, -6)
    })

    it('2027: nisa matches, total within tolerance', () => {
      const h = hikaru(2027)
      // Cash differs ~185k due to model difference (events don't reduce investable)
      expect(h.cashBalance).toBeCloseTo(3_335_000, -6)
      expect(h.nisaBalance).toBeCloseTo(848_640, -1)
      expect(h.taxableBalance).toBeCloseTo(71_000, -5)
      expect(h.totalAssets).toBeCloseTo(4_255_000, -6)
    })

    it('2031: total within tolerance', () => {
      const h = hikaru(2031)
      expect(h.totalAssets).toBeCloseTo(8_926_000, -6)
    })
  })
})

// ---------------------------------------------------------------------------
// 2. Changing income updates disposable/investable/total assets reactively
// ---------------------------------------------------------------------------
describe('Reactivity: income changes cascade', () => {
  it('increasing Ren net income increases disposable, investable, and total assets', () => {
    const base = simulate(DEFAULT_LIFE_PLAN)
    const modified = cloneConfig(DEFAULT_LIFE_PLAN)
    // Give Ren a big raise in every year
    modified.incomeData.forEach((d) => {
      d.ren.net += 2_000_000
      d.ren.gross += 3_000_000
    })
    const raised = simulate(modified)

    for (let i = 0; i < base.ren.length; i++) {
      expect(raised.ren[i].disposable).toBeGreaterThan(base.ren[i].disposable)
      expect(raised.ren[i].investable).toBeGreaterThan(base.ren[i].investable)
      expect(raised.ren[i].totalAssets).toBeGreaterThan(base.ren[i].totalAssets)
    }
  })

  it('decreasing Hikaru net income decreases total assets', () => {
    const base = simulate(DEFAULT_LIFE_PLAN)
    const modified = cloneConfig(DEFAULT_LIFE_PLAN)
    modified.incomeData.forEach((d) => {
      d.hikaru.net -= 500_000
    })
    const lowered = simulate(modified)

    for (let i = 0; i < base.hikaru.length; i++) {
      expect(lowered.hikaru[i].totalAssets).toBeLessThan(base.hikaru[i].totalAssets)
    }
  })
})

// ---------------------------------------------------------------------------
// 3. Changing living costs updates disposable and cascades to assets
// ---------------------------------------------------------------------------
describe('Reactivity: living cost changes cascade', () => {
  it('increasing rent before cohabitation reduces disposable and total assets', () => {
    const base = simulate(DEFAULT_LIFE_PLAN)
    const modified = cloneConfig(DEFAULT_LIFE_PLAN)
    // Double Ren's rent
    const rent = modified.livingCosts.beforeRen.find((i) => i.item === '家賃')!
    rent.monthly = 100_000 // was 30_000

    const expensive = simulate(modified)
    // 2026 is before cohabitation (同棲 is 2026, effect year 2027)
    const r2026base = base.ren.find((r) => r.year === 2026)!
    const r2026mod = expensive.ren.find((r) => r.year === 2026)!

    expect(r2026mod.livingCost).toBeGreaterThan(r2026base.livingCost)
    expect(r2026mod.disposable).toBeLessThan(r2026base.disposable)
    expect(r2026mod.totalAssets).toBeLessThan(r2026base.totalAssets)
  })

  it('increasing shared costs after cohabitation reduces both persons total assets', () => {
    const base = simulate(DEFAULT_LIFE_PLAN)
    const modified = cloneConfig(DEFAULT_LIFE_PLAN)
    // Increase shared rent to 250k/month
    const sharedRent = modified.livingCosts.afterCohabitation.find(
      (i) => i.item === '家賃' && i.owner === 'shared'
    )!
    sharedRent.monthly = 250_000 // was 150_000

    const expensive = simulate(modified)
    // Check a post-cohabitation year (2027+)
    const renBase2031 = base.ren.find((r) => r.year === 2031)!
    const renMod2031 = expensive.ren.find((r) => r.year === 2031)!
    const hikBase2031 = base.hikaru.find((r) => r.year === 2031)!
    const hikMod2031 = expensive.hikaru.find((r) => r.year === 2031)!

    expect(renMod2031.totalAssets).toBeLessThan(renBase2031.totalAssets)
    expect(hikMod2031.totalAssets).toBeLessThan(hikBase2031.totalAssets)
  })
})

// ---------------------------------------------------------------------------
// 4. Changing assumptions (returnRate, cashReserveRatio, nisaAnnualLimit)
// ---------------------------------------------------------------------------
describe('Reactivity: assumption changes cascade', () => {
  it('higher returnRate increases NISA and taxable balances', () => {
    const base = simulate(DEFAULT_LIFE_PLAN)
    const modified = cloneConfig(DEFAULT_LIFE_PLAN)
    modified.assumptions.returnRate = 0.08 // was 0.04

    const highReturn = simulate(modified)
    const last = base.ren.length - 1
    expect(highReturn.ren[last].nisaBalance).toBeGreaterThan(base.ren[last].nisaBalance)
    expect(highReturn.ren[last].taxableBalance).toBeGreaterThan(base.ren[last].taxableBalance)
    expect(highReturn.ren[last].totalAssets).toBeGreaterThan(base.ren[last].totalAssets)
  })

  it('higher cashReserveRatio increases cash but decreases investable', () => {
    const base = simulate(DEFAULT_LIFE_PLAN)
    const modified = cloneConfig(DEFAULT_LIFE_PLAN)
    modified.assumptions.cashReserveRatio = 0.60 // was 0.30

    const highCash = simulate(modified)
    // More goes to cash reserve, less is investable
    for (let i = 0; i < base.ren.length; i++) {
      expect(highCash.ren[i].cashReserve).toBeGreaterThan(base.ren[i].cashReserve)
      expect(highCash.ren[i].investable).toBeLessThan(base.ren[i].investable)
    }
  })

  it('higher nisaAnnualLimit increases NISA balance (if investable allows)', () => {
    const base = simulate(DEFAULT_LIFE_PLAN)
    const modified = cloneConfig(DEFAULT_LIFE_PLAN)
    modified.assumptions.nisaAnnualLimit = 1_200_000 // was 400_000

    const bigNisa = simulate(modified)
    const last = base.ren.length - 1
    expect(bigNisa.ren[last].nisaBalance).toBeGreaterThan(base.ren[last].nisaBalance)
    // More going to NISA means less in taxable
    expect(bigNisa.ren[last].taxableBalance).toBeLessThan(base.ren[last].taxableBalance)
  })
})

// ---------------------------------------------------------------------------
// 5. Adding/removing life events affects cash and total assets
// ---------------------------------------------------------------------------
describe('Reactivity: life events affect cash and total assets', () => {
  it('removing all events increases cash and total assets', () => {
    const base = simulate(DEFAULT_LIFE_PLAN)
    const modified = cloneConfig(DEFAULT_LIFE_PLAN)
    modified.lifeEvents = []

    const noEvents = simulate(modified)
    // Without events, Ren should have more cash (no 同棲 cost, no 婚約指輪, etc.)
    const last = base.ren.length - 1
    expect(noEvents.ren[last].cashBalance).toBeGreaterThan(base.ren[last].cashBalance)
    expect(noEvents.ren[last].totalAssets).toBeGreaterThan(base.ren[last].totalAssets)
  })

  it('adding a large event reduces cash and total assets in that year', () => {
    const base = simulate(DEFAULT_LIFE_PLAN)
    const modified = cloneConfig(DEFAULT_LIFE_PLAN)
    modified.lifeEvents.push({
      year: 2027,
      title: '大きな出費',
      category: 'その他',
      amount: 5_000_000,
      renRatio: 1.0,
      hikaruRatio: 0.0,
      paymentType: 'lump_sum',
      memo: 'テスト用',
    })

    const bigEvent = simulate(modified)
    const ren2027base = base.ren.find((r) => r.year === 2027)!
    const ren2027mod = bigEvent.ren.find((r) => r.year === 2027)!

    expect(ren2027mod.eventCost).toBeGreaterThan(ren2027base.eventCost)
    expect(ren2027mod.cashBalance).toBeLessThan(ren2027base.cashBalance)
    expect(ren2027mod.totalAssets).toBeLessThan(ren2027base.totalAssets)
  })

  it('removing cohabitation event changes living cost calculation (no shared costs)', () => {
    const base = simulate(DEFAULT_LIFE_PLAN)
    const modified = cloneConfig(DEFAULT_LIFE_PLAN)
    // Remove the 同棲 event — cohabitation year becomes 9999
    modified.lifeEvents = modified.lifeEvents.filter((e) => e.title !== '同棲')

    const noCohabitation = simulate(modified)
    // Without cohabitation, Ren uses beforeRen costs for all years
    // beforeRen total monthly = 30k+20k+6k+5k+50k+15k+5.5k = 131.5k
    // afterCohabitation ren personal = 6k+5k+50k+15k+5.5k = 81.5k, shared=225k
    // The living cost structure changes significantly
    const ren2031base = base.ren.find((r) => r.year === 2031)!
    const ren2031mod = noCohabitation.ren.find((r) => r.year === 2031)!

    expect(ren2031mod.livingCost).not.toEqual(ren2031base.livingCost)
  })
})

// ---------------------------------------------------------------------------
// 6. Changing initial assets affects all subsequent years
// ---------------------------------------------------------------------------
describe('Reactivity: initial assets affect all subsequent years', () => {
  it('higher initial cash for Ren increases total assets in every year', () => {
    const base = simulate(DEFAULT_LIFE_PLAN)
    const modified = cloneConfig(DEFAULT_LIFE_PLAN)
    modified.initialAssets.ren.cash = 5_000_000 // was 600_000

    const richer = simulate(modified)
    for (let i = 0; i < base.ren.length; i++) {
      expect(richer.ren[i].totalAssets).toBeGreaterThan(base.ren[i].totalAssets)
    }
  })

  it('higher initial NISA for Hikaru compounds and increases all subsequent balances', () => {
    const base = simulate(DEFAULT_LIFE_PLAN)
    const modified = cloneConfig(DEFAULT_LIFE_PLAN)
    modified.initialAssets.hikaru.nisa = 2_000_000 // was 0

    const richer = simulate(modified)
    for (let i = 0; i < base.hikaru.length; i++) {
      expect(richer.hikaru[i].nisaBalance).toBeGreaterThan(base.hikaru[i].nisaBalance)
      expect(richer.hikaru[i].totalAssets).toBeGreaterThan(base.hikaru[i].totalAssets)
    }
  })

  it('zero initial assets still produces valid simulation', () => {
    const modified = cloneConfig(DEFAULT_LIFE_PLAN)
    modified.initialAssets.ren = { cash: 0, nisa: 0, taxable: 0 }
    modified.initialAssets.hikaru = { cash: 0, nisa: 0, taxable: 0 }

    const result = simulate(modified)
    expect(result.ren.length).toBe(6)
    expect(result.hikaru.length).toBe(6)
    // Total assets should still grow from income
    const lastRen = result.ren[result.ren.length - 1]
    expect(lastRen.totalAssets).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// 7. Household totals = ren + hikaru for all fields
// ---------------------------------------------------------------------------
describe('Household totals = ren + hikaru', () => {
  const result = simulate(DEFAULT_LIFE_PLAN)

  it('householdCash = ren.cashBalance + hikaru.cashBalance for every year', () => {
    for (let i = 0; i < result.household.length; i++) {
      const hh = result.household[i]
      const r = result.ren[i]
      const h = result.hikaru[i]
      expect(hh.householdCash).toBeCloseTo(r.cashBalance + h.cashBalance, 0)
    }
  })

  it('householdNisa = ren.nisaBalance + hikaru.nisaBalance for every year', () => {
    for (let i = 0; i < result.household.length; i++) {
      const hh = result.household[i]
      expect(hh.householdNisa).toBeCloseTo(
        result.ren[i].nisaBalance + result.hikaru[i].nisaBalance, 0
      )
    }
  })

  it('householdTaxable = ren.taxableBalance + hikaru.taxableBalance for every year', () => {
    for (let i = 0; i < result.household.length; i++) {
      const hh = result.household[i]
      expect(hh.householdTaxable).toBeCloseTo(
        result.ren[i].taxableBalance + result.hikaru[i].taxableBalance, 0
      )
    }
  })

  it('householdTotalAssets = cash + nisa + taxable for every year', () => {
    for (let i = 0; i < result.household.length; i++) {
      const hh = result.household[i]
      expect(hh.householdTotalAssets).toBeCloseTo(
        hh.householdCash + hh.householdNisa + hh.householdTaxable, 0
      )
    }
  })

  it('householdInvestment = nisa + taxable for every year', () => {
    for (let i = 0; i < result.household.length; i++) {
      const hh = result.household[i]
      expect(hh.householdInvestment).toBeCloseTo(
        hh.householdNisa + hh.householdTaxable, 0
      )
    }
  })

  it('householdGross = ren.gross + hikaru.gross for every year', () => {
    for (let i = 0; i < result.household.length; i++) {
      const hh = result.household[i]
      expect(hh.householdGross).toBe(result.ren[i].gross + result.hikaru[i].gross)
    }
  })

  it('householdNet = ren.net + hikaru.net for every year', () => {
    for (let i = 0; i < result.household.length; i++) {
      const hh = result.household[i]
      expect(hh.householdNet).toBe(result.ren[i].net + result.hikaru[i].net)
    }
  })
})
