import { createBrowserClient } from '@supabase/ssr'
import { publicEnv } from '@/lib/env/public'

/**
 * Browser client intentionally remains inference-compatible with legacy hooks.
 * The current production schema is tracked in types/database-live.ts and new
 * operational hooks use typed application aliases. A full generated-schema
 * cutover can happen incrementally without blocking runtime safety, which is
 * enforced by RPCs and RLS.
 */
export function createClient() {
  return createBrowserClient(
    publicEnv.supabaseUrl!,
    publicEnv.supabaseAnonKey!
  )
}
