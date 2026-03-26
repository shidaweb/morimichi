"use client";

import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

import { useSupabaseBrowser } from "@/hooks/useSupabaseBrowser";

export function useAuth() {
  const supabase = useSupabaseBrowser();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      return;
    }
    let cancelled = false;

    void supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) {
        setUser(data.user ?? null);
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase]);

  return { user, loading: loading || !supabase };
}
