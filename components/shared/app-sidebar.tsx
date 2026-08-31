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
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/ui-store'

const navigation = [
  { name: 'ホーム', href: '/home', icon: Home },
  { name: 'カレンダー', href: '/calendar', icon: Calendar },
  { name: '買い物', href: '/shopping', icon: ShoppingCart },
  { name: 'タスク', href: '/todos', icon: CheckSquare },
  { name: 'やりたいこと', href: '/bucket-list', icon: Heart },
  { name: '思考・アイデア', href: '/ideas', icon: Lightbulb },
  { name: '家計', href: '/finance/dashboard', activePrefix: '/finance', icon: Wallet },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { sidebarOpen, setSidebarOpen } = useUIStore()

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-[1px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 transform flex-col border-r border-white/8 bg-[#071d42] text-white shadow-2xl transition-transform lg:static lg:z-auto lg:translate-x-0 lg:shadow-none',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center border-b border-white/10 px-5">
          <Link href="/home" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white text-sm font-black text-[#071d42]">
              L
            </div>
            <div>
              <p className="text-sm font-black tracking-[0.16em]">LIFE_OS</p>
              <p className="text-[10px] font-semibold text-white/45">Personal operating system</p>
            </div>
          </Link>
        </div>

        <ScrollArea className="flex-1 py-5">
          <nav className="space-y-1.5 px-3">
            {navigation.map((item) => {
              const activePrefix = item.activePrefix ?? item.href
              const active = pathname === item.href || (item.activePrefix ? pathname.startsWith(activePrefix) : false)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-bold transition-all',
                    active
                      ? 'bg-white text-[#071d42] shadow-sm'
                      : 'text-white/60 hover:bg-white/8 hover:text-white'
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.name}
                </Link>
              )
            })}

            <div className="pt-4">
              <div className="mb-2 px-3 text-[10px] font-black tracking-[0.16em] text-white/30">SYSTEM</div>
              <Link
                href="/settings"
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-bold transition-all',
                  pathname === '/settings'
                    ? 'bg-white text-[#071d42] shadow-sm'
                    : 'text-white/60 hover:bg-white/8 hover:text-white'
                )}
              >
                <Settings className="h-4 w-4" />
                設定
              </Link>
            </div>
          </nav>
        </ScrollArea>
      </aside>
    </>
  )
}
