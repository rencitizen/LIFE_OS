import { createBrowserClient } from '@supabase/ssr'
import { publicEnv } from '@/lib/env/public'
import type { Database } from '@/types/database-live'

export function createClient() {
  return createBrowserClient<Database>(
    publicEnv.supabaseUrl!,
    publicEnv.supabaseAnonKey!
  )
}
