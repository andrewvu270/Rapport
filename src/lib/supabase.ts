import { createBrowserClient } from '@supabase/ssr'

/**
 * Browser-side Supabase client
 * Uses public anon key and respects RLS policies
 * Safe to use in client components and browser context
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
