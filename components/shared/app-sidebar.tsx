'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Calendar,
  CheckSquare,
  Heart,
  Home,
  Lightbulb,
  Settings,
  ShoppingCart,
  Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/ui-store'

const navigation = [
  { name: 'ホーム', href: '/home', icon: Home },
  { name: 'カレンダー', href: '/calendar', icon: Calendar },
  { name: 'タスク', href: '/todos', icon: CheckSquare },
  { name: '家計', href: '/finance/dashboard', activePrefix: '/finance', icon: Wallet },
  { name: '買い物', href: '/shopping', icon: ShoppingCart },
  { name: 'やりたいこと', href: '/bucket-list', icon: Heart },
  { name: 'アイデア', href: '/ideas', icon: Lightbulb },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { sidebarOpen, setSidebarOpen } = useUIStore()

  return (
    <>
      {sidebarOpen && (
        <button
          aria-label="メニューを閉じる"
          className="fixed inset-0 z-40 bg-black/15 backdrop-blur-[2px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[224px] transform flex-col border-r border-black/[0.06] bg-white/92 px-3 pb-5 pt-4 text-[#1d1d1f] backdrop-blur-xl transition-transform dark:border-white/10 dark:bg-[#1c1c1e]/94 dark:text-white lg:static lg:z-auto lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <Link href="/home" className="px-3 py-2 text-[15px] font-semibold tracking-tight">
          LIFE OS
        </Link>

        <nav className="mt-5 flex-1 space-y-1">
          {navigation.map((item) => {
            const activePrefix = item.activePrefix ?? item.href
            const active = pathname === item.href || (item.activePrefix ? pathname.startsWith(activePrefix) : false)

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-medium transition-colors',
                  active
                    ? 'bg-black/[0.055] text-black dark:bg-white/10 dark:text-white'
                    : 'text-black/55 hover:bg-black/[0.035] hover:text-black dark:text-white/55 dark:hover:bg-white/[0.06] dark:hover:text-white'
                )}
              >
                <item.icon className="h-[18px] w-[18px] shrink-0 stroke-[1.8]" />
                <span>{item.name}</span>
              </Link>
            )
          })}
        </nav>

        <Link
          href="/settings"
          onClick={() => setSidebarOpen(false)}
          className={cn(
            'flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-medium transition-colors',
            pathname === '/settings'
              ? 'bg-black/[0.055] text-black dark:bg-white/10 dark:text-white'
              : 'text-black/45 hover:bg-black/[0.035] hover:text-black dark:text-white/45 dark:hover:bg-white/[0.06] dark:hover:text-white'
          )}
        >
          <Settings className="h-[18px] w-[18px] stroke-[1.8]" />
          設定
        </Link>
      </aside>
    </>
  )
}
