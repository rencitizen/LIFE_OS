'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Home, Calendar, ShoppingCart, CheckSquare, Wallet } from 'lucide-react'

const tabs = [
  { name: 'ホーム', href: '/home', icon: Home },
  { name: 'カレンダー', href: '/calendar', icon: Calendar },
  { name: '買い物', href: '/shopping', icon: ShoppingCart },
  { name: 'TODO', href: '/todos', icon: CheckSquare },
  { name: '家計', href: '/finance/dashboard', icon: Wallet },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card lg:hidden">
      <div className="flex items-center justify-around">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href || (tab.href !== '/home' && pathname.startsWith(tab.href))
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-2 text-xs',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <tab.icon className="h-5 w-5" />
              {tab.name}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
