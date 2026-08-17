'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { FINANCE_SCOPE_LABELS, type FinanceScope } from '@/lib/finance/scope'
import { useFinanceStore } from '@/stores/finance-store'

const tabs = [
  { name: '現在', href: '/finance/dashboard' },
  { name: '計画', href: '/finance/plan' },
  { name: '履歴', href: '/finance/expenses' },
  { name: '分析', href: '/finance/analysis' },
]

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { financeScope, setFinanceScope } = useFinanceStore()
  const showScope = pathname !== '/finance/plan' && pathname !== '/finance/life-plan'

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 border-b">
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors md:px-4',
                pathname === tab.href || (tab.href === '/finance/plan' && pathname === '/finance/life-plan')
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.name}
            </Link>
          ))}
        </div>

        {showScope && (
          <div className="hidden shrink-0 items-center rounded-lg border bg-background p-0.5 md:flex">
            {(['combined', 'mine', 'partner'] as FinanceScope[]).map((scope) => (
              <Button
                key={scope}
                size="sm"
                variant="ghost"
                className={cn(
                  'h-7 rounded-md px-2.5 text-xs',
                  financeScope === scope && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground'
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
        <div className="flex items-center gap-1 md:hidden">
          {(['combined', 'mine', 'partner'] as FinanceScope[]).map((scope) => (
            <Button
              key={scope}
              size="sm"
              variant={financeScope === scope ? 'default' : 'outline'}
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
