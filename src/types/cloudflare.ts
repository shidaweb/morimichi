/// <reference types="@cloudflare/workers-types" />

/**
 * Cloudflare Worker bindings aligned with wrangler.toml.
 * Runtime values come from `getCloudflareContext().env`.
 */
export interface MorimichiWorkerEnv {
  ASSETS: Fetcher;
  RATE_LIMIT_KV: KVNamespace;
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SITE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  RESEND_API_KEY?: string;
  SENTRY_DSN?: string;
}
