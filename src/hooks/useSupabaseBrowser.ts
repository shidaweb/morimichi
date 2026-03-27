"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

let browserClient: SupabaseClient<Database> | null = null;
let initFailed = false;

function getBrowserClient(): SupabaseClient<Database> | null {
  if (typeof window === "undefined") {
    return null;
  }
  if (initFailed) {
    return null;
  }
  if (!browserClient) {
    try {
      browserClient = createBrowserSupabaseClient();
    } catch (error) {
      // Do not crash the whole app on client bootstrap.
      initFailed = true;
      console.error("Failed to initialize Supabase browser client", error);
      return null;
    }
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
