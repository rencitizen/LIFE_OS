'use client'

import { LogOut, Menu } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/lib/hooks/use-auth'
import { useUIStore } from '@/stores/ui-store'

const PAGE_TITLES: Array<{ prefix: string; label: string }> = [
  { prefix: '/finance', label: '家計' },
  { prefix: '/calendar', label: 'カレンダー' },
  { prefix: '/shopping', label: '買い物' },
  { prefix: '/todos', label: 'タスク' },
  { prefix: '/bucket-list', label: 'やりたいこと' },
  { prefix: '/ideas', label: '思考・アイデア' },
  { prefix: '/settings', label: '設定' },
  { prefix: '/home', label: 'ホーム' },
]

export function AppHeader() {
  const pathname = usePathname()
  const { toggleSidebar } = useUIStore()
  const { user, partner, signOut } = useAuth()

  const pageTitle = PAGE_TITLES.find((item) => pathname.startsWith(item.prefix))?.label ?? 'LIFE_OS'

  return (
    <header className="relative z-30 flex h-16 shrink-0 items-center justify-between border-b border-white/10 bg-[#071d42] px-4 text-white shadow-[0_8px_24px_rgba(7,29,66,0.14)] lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-xl text-white/80 hover:bg-white/10 hover:text-white lg:hidden"
          onClick={toggleSidebar}
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="min-w-0">
          <p className="text-[10px] font-black tracking-[0.2em] text-white/45">LIFE_OS</p>
          <p className="truncate text-sm font-black tracking-tight text-white">{pageTitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {partner && (
          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-sm sm:flex">
            <Avatar className="h-6 w-6">
              <AvatarImage src={partner.avatar_url || undefined} />
              <AvatarFallback className="bg-white/10 text-[10px] font-bold text-white">
                {partner.display_name[0]}
              </AvatarFallback>
            </Avatar>
            <span className="max-w-24 truncate text-xs font-bold text-white/75">{partner.display_name}</span>
          </div>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon" className="h-10 w-10 rounded-full border border-white/10 bg-white/5 hover:bg-white/10" />}
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.avatar_url || undefined} />
              <AvatarFallback className="bg-white text-[#071d42] font-black">
                {user?.display_name?.[0] || '?'}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56 rounded-2xl border bg-card p-2 shadow-xl">
            <div className="rounded-xl bg-muted/60 px-3 py-2.5">
              <p className="text-sm font-bold">{user?.display_name}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="rounded-xl" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />
              ログアウト
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
