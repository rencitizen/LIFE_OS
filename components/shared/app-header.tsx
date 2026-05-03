'use client'

import { Menu, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useUIStore } from '@/stores/ui-store'
import { useAuth } from '@/lib/hooks/use-auth'

export function AppHeader() {
  const { toggleSidebar } = useUIStore()
  const { user, partner, signOut } = useAuth()

  return (
    <header className="flex h-14 items-center justify-between border-b border-primary/30 bg-background px-4">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={toggleSidebar}>
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex-1" />

      <div className="flex items-center gap-3">
        {partner && (
          <div className="hidden items-center gap-2 rounded-full border border-accent/40 bg-accent/15 px-2.5 py-1 text-sm text-foreground sm:flex">
            <Avatar className="h-6 w-6">
              <AvatarImage src={partner.avatar_url || undefined} />
              <AvatarFallback
                className="text-xs"
                style={{ backgroundColor: 'var(--secondary)', color: 'var(--secondary-foreground)' }}
              >
                {partner.display_name[0]}
              </AvatarFallback>
            </Avatar>
            <span className="font-medium">{partner.display_name}</span>
          </div>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon" className="rounded-full border border-primary/30 bg-primary/10 hover:bg-primary/20" />}
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.avatar_url || undefined} />
              <AvatarFallback
                style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
              >
                {user?.display_name?.[0] || '?'}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="border border-primary/30 bg-background">
            <div className="rounded-md bg-primary/10 px-2 py-1.5">
              <p className="text-sm font-medium text-foreground">{user?.display_name}</p>
              <p className="text-xs text-primary">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />
              ログアウト
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
