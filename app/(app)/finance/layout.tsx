'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { FINANCE_SCOPE_LABELS, type FinanceScope } from '@/lib/finance/scope'
import { useFinanceStore } from '@/stores/finance-store'

const tabs = [
  { name: '家計', href: '/finance/dashboard' },
  { name: '履歴', href: '/finance/expenses' },
  { name: '精算', href: '/finance/settlements' },
  { name: 'レビュー', href: '/finance/analysis' },
  { name: '計画', href: '/finance/plan' },
  { name: '取込', href: '/finance/import' },
]

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { financeScope, setFinanceScope } = useFinanceStore()
  const showScope = pathname !== '/finance/plan' && pathname !== '/finance/life-plan' && pathname !== '/finance/import'

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-2 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const active = pathname === tab.href || (tab.href === '/finance/plan' && pathname === '/finance/life-plan')
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition-colors md:px-4',
                  active
                    ? 'bg-foreground text-background shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {tab.name}
              </Link>
            )
          })}
        </div>

        {showScope && (
          <div className="hidden shrink-0 items-center rounded-xl bg-muted p-1 md:flex">
            {(['combined', 'mine', 'partner'] as FinanceScope[]).map((scope) => (
              <Button
                key={scope}
                size="sm"
                variant="ghost"
                className={cn(
                  'h-8 rounded-lg px-3 text-xs font-semibold',
                  financeScope === scope && 'bg-background text-foreground shadow-sm hover:bg-background'
                )}
                onClick={() => setFinanceScope(scope)}
              >
                {FINANCE_SCOPE_LABELS[scope]}
              </Button>
            ))}
          </div>
        )}
      </div>

      {showScope && (
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1 md:hidden">
          {(['combined', 'mine', 'partner'] as FinanceScope[]).map((scope) => (
            <Button
              key={scope}
              size="sm"
              variant="ghost"
              className={cn(
                'rounded-lg text-xs font-semibold',
                financeScope === scope && 'bg-background text-foreground shadow-sm hover:bg-background'
              )}
              onClick={() => setFinanceScope(scope)}
            >
              {FINANCE_SCOPE_LABELS[scope]}
            </Button>
          ))}
        </div>
      )}

      {children}
    </div>
  )
}
