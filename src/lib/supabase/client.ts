import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

const FALLBACK_SUPABASE_URL = "https://sgzylqvgqfajqmdmgkkp.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnenlscXZncWZhanFtZG1na2twIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1Mjk0NzcsImV4cCI6MjA5MDEwNTQ3N30.5dYOm5V5BptraKLpatq1S4fvqd9_7SRH102MW6LnaK0";

export function createBrowserSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? FALLBACK_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? FALLBACK_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return createClient<Database>(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}
