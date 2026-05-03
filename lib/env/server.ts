import "server-only";

import { getRequiredPublicEnv } from "@/lib/env/public";

export const serverEnv = {
  supabaseUrl: getRequiredPublicEnv("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: getRequiredPublicEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
} as const;
