import type { LifePlanConfig } from '@/types/life-plan'

/**
 * Default life plan data imported from 人生CF (4).xlsx
 */
export const DEFAULT_LIFE_PLAN: LifePlanConfig = {
  assumptions: {
    cashReserveRatio: 0.30,
    defenseMonths: 6,
    returnRate: 0.04,
    nisaAnnualLimit: 400000,
  },

  incomeData: [
    { year: 2026, ren: { gross: 5500000, net: 4200000 }, hikaru: { gross: 3000000, net: 2700000 } },
    { year: 2027, ren: { gross: 7000000, net: 5200000 }, hikaru: { gross: 3500000, net: 3200000 } },
    { year: 2028, ren: { gross: 8000000, net: 5850000 }, hikaru: { gross: 3500000, net: 3200000 } },
    { year: 2029, ren: { gross: 10000000, net: 7200000 }, hikaru: { gross: 3500000, net: 3200000 } },
    { year: 2030, ren: { gross: 10000000, net: 7200000 }, hikaru: { gross: 3500000, net: 3200000 } },
    { year: 2031, ren: { gross: 10000000, net: 7200000 }, hikaru: { gross: 3500000, net: 3200000 } },
  ],

  livingCosts: {
    beforeRen: [
      { type: 'fixed', category: '住居', item: '家賃', monthly: 30000, owner: 'ren' },
      { type: 'fixed', category: '住居', item: '管理費', monthly: 0, owner: 'ren' },
      { type: 'fixed', category: '食費', item: '食費', monthly: 20000, owner: 'ren' },
      { type: 'fixed', category: '光熱', item: '電気ガス水道', monthly: 0, owner: 'ren' },
      { type: 'fixed', category: '日用品', item: '日用品', monthly: 0, owner: 'ren' },
      { type: 'personal', category: '通信', item: '携帯インターネット', monthly: 6000, owner: 'ren' },
      { type: 'personal', category: '交通', item: '交通費', monthly: 5000, owner: 'ren' },
      { type: 'personal', category: '娯楽', item: '外食娯楽', monthly: 50000, owner: 'ren' },
      { type: 'personal', category: 'その他', item: 'エトセ', monthly: 0, owner: 'ren' },
      { type: 'personal', category: '健康', item: 'ジム', monthly: 15000, owner: 'ren' },
      { type: 'personal', category: '健康', item: '眼科コンタクト', monthly: 5500, owner: 'ren' },
    ],
    beforeHikaru: [
      { type: 'fixed', category: '住居', item: '家賃', monthly: 60000, owner: 'hikaru' },
      { type: 'fixed', category: '住居', item: '管理費', monthly: 0, owner: 'hikaru' },
      { type: 'fixed', category: '食費', item: '食費', monthly: 20000, owner: 'hikaru' },
      { type: 'fixed', category: '光熱', item: '電気ガス水道', monthly: 5000, owner: 'hikaru' },
      { type: 'fixed', category: '日用品', item: '日用品', monthly: 5000, owner: 'hikaru' },
      { type: 'personal', category: '通信', item: '通信', monthly: 0, owner: 'hikaru' },
      { type: 'personal', category: '交通', item: '交通費', monthly: 5000, owner: 'hikaru' },
      { type: 'personal', category: '娯楽', item: '外食娯楽', monthly: 15000, owner: 'hikaru' },
      { type: 'personal', category: 'その他', item: 'エトセ', monthly: 0, owner: 'hikaru' },
      { type: 'personal', category: '健康', item: 'ジム', monthly: 10000, owner: 'hikaru' },
    ],
    afterCohabitation: [
      { type: 'fixed', category: '住居', item: '家賃', monthly: 150000, owner: 'shared' },
      { type: 'fixed', category: '住居', item: '管理費', monthly: 10000, owner: 'shared' },
      { type: 'fixed', category: '食費', item: '食費', monthly: 50000, owner: 'shared' },
      { type: 'fixed', category: '光熱', item: '電気ガス水道', monthly: 10000, owner: 'shared' },
      { type: 'fixed', category: '日用品', item: '日用品', monthly: 5000, owner: 'shared' },
      { type: 'personal', category: '通信', item: '携帯インターネット', monthly: 6000, owner: 'ren' },
      { type: 'personal', category: '交通', item: '交通費', monthly: 5000, owner: 'ren' },
      { type: 'personal', category: '娯楽', item: '外食娯楽', monthly: 50000, owner: 'ren' },
      { type: 'personal', category: 'その他', item: 'エトセ', monthly: 0, owner: 'ren' },
      { type: 'personal', category: '健康', item: 'ジム', monthly: 15000, owner: 'ren' },
      { type: 'personal', category: '健康', item: '眼科コンタクト', monthly: 5500, owner: 'ren' },
      { type: 'personal', category: '通信', item: '携帯インターネット', monthly: 0, owner: 'hikaru' },
      { type: 'personal', category: '交通', item: '交通費', monthly: 5000, owner: 'hikaru' },
      { type: 'personal', category: '娯楽', item: '外食娯楽', monthly: 0, owner: 'hikaru' },
      { type: 'personal', category: 'その他', item: 'エトセ', monthly: 0, owner: 'hikaru' },
      { type: 'personal', category: '健康', item: 'ジム', monthly: 10000, owner: 'hikaru' },
    ],
  },

  lifeEvents: [
    { year: 2026, title: '同棲', category: '住居', amount: 600000, renRatio: 0.6087, hikaruRatio: 0.3913, paymentType: 'lump_sum', memo: '初期費用・引越' },
    { year: 2028, title: '婚約指輪', category: '婚約', amount: 500000, renRatio: 1.0, hikaruRatio: 0.0, paymentType: 'lump_sum', memo: 'Ren全額負担' },
    { year: 2029, title: '結婚式', category: '結婚', amount: 2500000, renRatio: 0.6923, hikaruRatio: 0.3077, paymentType: 'lump_sum', memo: '人前式' },
    { year: 2029, title: '新婚旅行', category: '旅行', amount: 1500000, renRatio: 0.6923, hikaruRatio: 0.3077, paymentType: 'lump_sum', memo: 'ヨーロッパ・アジア' },
    { year: 2031, title: '出産', category: '子供', amount: 300000, renRatio: 1.0, hikaruRatio: 0.0, paymentType: 'lump_sum', memo: '' },
  ],

  initialAssets: {
    ren: { cash: 600000, nisa: 0, taxable: 0 },
    hikaru: { cash: 1800000, nisa: 0, taxable: 0 },
  },
}
