'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { FINANCE_SCOPE_LABELS, type FinanceScope } from '@/lib/finance/scope'
import { useFinanceStore } from '@/stores/finance-store'

const tabs = [
  { name: 'レポート', href: '/finance/dashboard' },
  { name: '家計簿', href: '/finance/expenses' },
  { name: '精算', href: '/finance/settlements' },
  { name: '計画', href: '/finance/plan' },
]

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { financeScope, setFinanceScope } = useFinanceStore()
  const showScope = pathname !== '/finance/plan' && pathname !== '/finance/life-plan' && pathname !== '/finance/import'

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 rounded-[22px] border border-slate-200/80 bg-card p-1.5 shadow-[0_6px_24px_rgba(15,23,42,0.05)] md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const active = pathname === tab.href || (tab.href === '/finance/plan' && pathname === '/finance/life-plan')
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'whitespace-nowrap rounded-2xl px-3.5 py-2 text-sm font-bold transition-all md:px-4',
                  active
                    ? 'bg-[#071d42] text-white shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {tab.name}
              </Link>
            )
          })}
        </div>

        {showScope && (
          <div className="hidden shrink-0 items-center rounded-2xl bg-muted/75 p-1 md:flex">
            {(['combined', 'mine', 'partner'] as FinanceScope[]).map((scope) => (
              <Button
                key={scope}
                size="sm"
                variant="ghost"
                className={cn(
                  'h-8 rounded-xl px-3 text-xs font-bold',
                  financeScope === scope && 'bg-background text-[#071d42] shadow-sm hover:bg-background'
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
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-muted/75 p-1 md:hidden">
          {(['combined', 'mine', 'partner'] as FinanceScope[]).map((scope) => (
            <Button
              key={scope}
              size="sm"
              variant="ghost"
              className={cn(
                'rounded-xl text-xs font-bold',
                financeScope === scope && 'bg-background text-[#071d42] shadow-sm hover:bg-background'
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
