'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { FINANCE_SCOPE_LABELS, type FinanceScope } from '@/lib/finance/scope'
import { useFinanceStore } from '@/stores/finance-store'

const tabs = [
  { name: 'Overview', href: '/finance/dashboard' },
  { name: 'Analysis', href: '/finance/analysis' },
  { name: 'Transactions', href: '/finance/expenses' },
  { name: 'Budgets', href: '/finance/budgets' },
  { name: '5 year plan', href: '/finance/life-plan' },
]

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { financeScope, setFinanceScope } = useFinanceStore()

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 overflow-x-auto border-b">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              pathname === tab.href
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.name}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
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

      {children}
    </div>
  )
}
