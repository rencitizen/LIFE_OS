'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Home,
  Calendar,
  ShoppingCart,
  CheckSquare,
  Flame,
  Wallet,
  BarChart3,
  Settings,
  Target,
  TrendingUp,
  LineChart,
} from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useUIStore } from '@/stores/ui-store'

const navigation = [
  { name: 'Home', href: '/home', icon: Home },
  { name: 'Calendar', href: '/calendar', icon: Calendar },
  { name: 'Shopping', href: '/shopping', icon: ShoppingCart },
  { name: 'TODO', href: '/todos', icon: CheckSquare },
  { name: 'Habits', href: '/habits', icon: Flame },
]

const financeNavigation = [
  { name: 'Overview', href: '/finance/dashboard', icon: BarChart3 },
  { name: 'Monthly analysis', href: '/finance/analysis', icon: LineChart },
  { name: 'Transactions', href: '/finance/expenses', icon: Wallet },
  { name: 'Budgets', href: '/finance/budgets', icon: Target },
  { name: '5 year plan', href: '/finance/life-plan', icon: TrendingUp },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { sidebarOpen, setSidebarOpen } = useUIStore()

  return (
    <>
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 border-r border-border/80 bg-card/95 transform transition-transform backdrop-blur supports-[backdrop-filter]:bg-card/85 lg:translate-x-0 lg:static lg:z-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-14 items-center border-b px-4">
          <Link href="/home" className="flex items-center gap-2 text-lg font-bold">
            Couple OS
          </Link>
        </div>

        <ScrollArea className="flex-1 py-4">
          <nav className="space-y-1 px-3">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  pathname === item.href
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            ))}

            <div className="pb-2 pt-4">
              <p className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Finance</p>
            </div>

            {financeNavigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  pathname === item.href
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            ))}

            <div className="pt-4">
              <Link
                href="/settings"
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  pathname === '/settings'
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </div>
          </nav>
        </ScrollArea>
      </aside>
    </>
  )
}
