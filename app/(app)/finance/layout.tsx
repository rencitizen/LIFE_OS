'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { FINANCE_SCOPE_LABELS, type FinanceScope } from '@/lib/finance/scope'
import { useFinanceStore } from '@/stores/finance-store'

const tabs = [
  { name: '概要', href: '/finance/dashboard' },
  { name: '明細', href: '/finance/expenses' },
  { name: '精算', href: '/finance/settlements' },
  { name: '計画', href: '/finance/plan' },
]

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { financeScope, setFinanceScope } = useFinanceStore()
  const showScope = pathname !== '/finance/plan' && pathname !== '/finance/life-plan' && pathname !== '/finance/import'

  return (
    <div className="space-y-7">
      <div className="border-b border-black/[0.06] dark:border-white/[0.08]">
        <div className="flex items-end justify-between gap-4 overflow-x-auto">
          <nav className="flex min-w-max items-center gap-6" aria-label="家計ナビゲーション">
            {tabs.map((tab) => {
              const active = pathname === tab.href || (tab.href === '/finance/plan' && pathname === '/finance/life-plan')
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    'relative pb-3 text-sm transition-colors',
                    active ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground hover:text-foreground'
                  )}
                >
                  {tab.name}
                  {active ? <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-foreground" /> : null}
                </Link>
              )
            })}
          </nav>

          {showScope ? (
            <div className="hidden shrink-0 items-center gap-1 pb-2 md:flex">
              {(['combined', 'mine', 'partner'] as FinanceScope[]).map((scope) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => setFinanceScope(scope)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                    financeScope === scope
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/[0.06]'
                  )}
                >
                  {FINANCE_SCOPE_LABELS[scope]}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {showScope ? (
        <div className="flex items-center gap-1 md:hidden">
          {(['combined', 'mine', 'partner'] as FinanceScope[]).map((scope) => (
            <button
              key={scope}
              type="button"
              onClick={() => setFinanceScope(scope)}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                financeScope === scope
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
              )}
            >
              {FINANCE_SCOPE_LABELS[scope]}
            </button>
          ))}
        </div>
      ) : null}

      {children}
    </div>
  )
}
