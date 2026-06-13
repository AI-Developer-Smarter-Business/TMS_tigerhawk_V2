// lib/supabase/admin.ts
// Admin client using service role key - for admin-only operations like password resets
import { createClient } from "@supabase/supabase-js"

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY environment variable. " +
      "Add it to your .env.local file (find it in Supabase Dashboard → Settings → API)."
    )
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      // Bypass Next.js fetch caching/patching to avoid "TypeError: fetch failed"
      fetch: (url: RequestInfo | URL, init?: RequestInit) =>
        fetch(url, { ...init, cache: "no-store" }),
    },
  })
}
