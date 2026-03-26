"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

let browserClient: SupabaseClient<Database> | null = null;

function getBrowserClient(): SupabaseClient<Database> | null {
  if (typeof window === "undefined") {
    return null;
  }
  if (!browserClient) {
    browserClient = createBrowserSupabaseClient();
  }
  return browserClient;
}

export function useSupabaseBrowser(): SupabaseClient<Database> | null {
  return useSyncExternalStore(
    () => () => {},
    getBrowserClient,
    () => null,
  );
}
