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
  { prefix: '/ideas', label: 'アイデア' },
  { prefix: '/settings', label: '設定' },
  { prefix: '/home', label: 'ホーム' },
]

export function AppHeader() {
  const pathname = usePathname()
  const { toggleSidebar } = useUIStore()
  const { user, signOut } = useAuth()

  const pageTitle = PAGE_TITLES.find((item) => pathname.startsWith(item.prefix))?.label ?? 'LIFE OS'

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-black/[0.055] bg-white/80 px-4 backdrop-blur-2xl dark:border-white/10 dark:bg-[#1c1c1e]/80 lg:px-7">
      <div className="flex min-w-0 items-center gap-2.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-full text-foreground/70 hover:bg-black/[0.05] dark:hover:bg-white/10 lg:hidden"
          onClick={toggleSidebar}
        >
          <Menu className="h-5 w-5 stroke-[1.8]" />
        </Button>
        <h1 className="truncate text-[17px] font-semibold tracking-[-0.02em] text-foreground">{pageTitle}</h1>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon" className="h-9 w-9 rounded-full p-0 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]" />}
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.avatar_url || undefined} />
            <AvatarFallback className="bg-black/[0.06] text-xs font-semibold text-foreground dark:bg-white/10">
              {user?.display_name?.[0] || '?'}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56 rounded-2xl border-black/[0.08] bg-white/95 p-2 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-[#2c2c2e]/95">
          <div className="px-3 py-2">
            <p className="text-sm font-medium">{user?.display_name}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="rounded-xl" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            ログアウト
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
