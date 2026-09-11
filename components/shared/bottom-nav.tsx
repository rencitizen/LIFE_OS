'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Calendar, Home, Menu, ShoppingCart, Wallet, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/ui-store'

type BottomTab = {
  name: string
  href: string
  activePrefix?: string
  icon: LucideIcon
}

const tabs: BottomTab[] = [
  { name: 'ホーム', href: '/home', icon: Home },
  { name: '家計', href: '/finance/dashboard', activePrefix: '/finance', icon: Wallet },
  { name: '予定', href: '/calendar', icon: Calendar },
  { name: '買い物', href: '/shopping', icon: ShoppingCart },
]

export function BottomNav() {
  const pathname = usePathname()
  const { toggleSidebar, sidebarOpen } = useUIStore()

  return (
    <nav className="fixed inset-x-3 bottom-3 z-50 rounded-[22px] border border-black/[0.08] bg-white/88 pb-[env(safe-area-inset-bottom)] shadow-[0_8px_30px_rgba(0,0,0,0.10)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#2c2c2e]/88 lg:hidden">
      <div className="grid grid-cols-5 items-stretch px-1">
        {tabs.map((tab) => {
          const activePrefix = tab.activePrefix ?? tab.href
          const isActive = pathname === tab.href || pathname.startsWith(activePrefix)

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex min-h-[58px] w-full flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 text-[10px] font-medium transition-colors',
                isActive ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              <tab.icon className={cn('h-[19px] w-[19px] stroke-[1.8]', isActive && 'stroke-[2.1]')} />
              {tab.name}
            </Link>
          )
        })}

        <Button
          type="button"
          variant="ghost"
          onClick={toggleSidebar}
          className={cn(
            'flex min-h-[58px] w-full flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 text-[10px] font-medium hover:bg-black/[0.035] dark:hover:bg-white/[0.06]',
            sidebarOpen ? 'text-foreground' : 'text-muted-foreground'
          )}
        >
          <Menu className={cn('h-[19px] w-[19px] stroke-[1.8]', sidebarOpen && 'stroke-[2.1]')} />
          その他
        </Button>
      </div>
    </nav>
  )
}
