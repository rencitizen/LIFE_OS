'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const tabs = [
  { name: '概要', href: '/finance/dashboard' },
  { name: '月次実績', href: '/finance/analysis' },
  { name: '収入・支出入力', href: '/finance/expenses' },
  { name: '予算', href: '/finance/budgets' },
  { name: '5年計画', href: '/finance/life-plan' },
]

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

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
      {children}
    </div>
  )
}
