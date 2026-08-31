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
  { name: 'カレンダー', href: '/calendar', icon: Calendar },
  { name: '買い物', href: '/shopping', icon: ShoppingCart },
]

export function BottomNav() {
  const pathname = usePathname()
  const { toggleSidebar, sidebarOpen } = useUIStore()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#071d42]/98 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_rgba(7,29,66,0.18)] backdrop-blur lg:hidden">
      <div className="grid grid-cols-5 items-stretch">
        {tabs.map((tab) => {
          const activePrefix = tab.activePrefix ?? tab.href
          const isActive = pathname === tab.href || pathname.startsWith(activePrefix)

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'relative flex min-h-16 w-full flex-col items-center justify-center gap-1 px-2 py-2 text-[10px] font-bold transition-colors',
                isActive ? 'text-white' : 'text-white/45'
              )}
            >
              {isActive && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-sky-400" />}
              <tab.icon className={cn('h-5 w-5', isActive && 'text-sky-300')} />
              {tab.name}
            </Link>
          )
        })}

        <Button
          type="button"
          variant="ghost"
          onClick={toggleSidebar}
          className={cn(
            'relative flex min-h-16 w-full flex-col items-center justify-center gap-1 rounded-none px-2 py-2 text-[10px] font-bold hover:bg-white/5 hover:text-white',
            sidebarOpen ? 'text-white' : 'text-white/45'
          )}
        >
          {sidebarOpen && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-sky-400" />}
          <Menu className={cn('h-5 w-5', sidebarOpen && 'text-sky-300')} />
          メニュー
        </Button>
      </div>
    </nav>
  )
}
