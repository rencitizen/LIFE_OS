'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Home, Calendar, ShoppingCart, Wallet, Menu, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUIStore } from '@/stores/ui-store'

type BottomTab = {
  name: string
  href: string
  activePrefix?: string
  icon: LucideIcon
}

const tabs: BottomTab[] = [
  { name: 'Home', href: '/home', icon: Home },
  { name: 'Finance', href: '/finance/dashboard', activePrefix: '/finance', icon: Wallet },
  { name: 'Calendar', href: '/calendar', icon: Calendar },
  { name: 'Shopping', href: '/shopping', icon: ShoppingCart },
]

export function BottomNav() {
  const pathname = usePathname()
  const { toggleSidebar, sidebarOpen } = useUIStore()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div className="grid grid-cols-5 items-stretch">
        {tabs.map((tab) => {
          const activePrefix = 'activePrefix' in tab ? tab.activePrefix : tab.href
          const isActive = pathname === tab.href || pathname.startsWith(activePrefix)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex w-full min-h-14 flex-col items-center justify-center gap-1 px-2 py-2 text-[11px]',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <tab.icon className="h-5 w-5" />
              {tab.name}
            </Link>
          )
        })}
        <Button
          type="button"
          variant="ghost"
          onClick={toggleSidebar}
          className={cn(
            'flex w-full min-h-14 flex-col items-center justify-center gap-1 rounded-none px-2 py-2 text-[11px]',
            sidebarOpen ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          <Menu className="h-5 w-5" />
          Menu
        </Button>
      </div>
    </nav>
  )
}
