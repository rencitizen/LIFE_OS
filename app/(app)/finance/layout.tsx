'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const tabs = [
  { name: 'ダッシュボード', href: '/finance/dashboard' },
  { name: '支出', href: '/finance/expenses' },
  { name: '立替・精算', href: '/finance/settlements' },
  { name: '予算', href: '/finance/budgets' },
  { name: 'ライフプラン', href: '/finance/life-plan' },
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
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
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
