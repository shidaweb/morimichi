interface CloudflareEnv {
  ASSETS: Fetcher;
  RATE_LIMIT_KV: KVNamespace;
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SITE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  VIEW_HASH_SALT?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  CRON_SECRET?: string;
  SENTRY_DSN?: string;
}

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NEXT_PUBLIC_SUPABASE_URL?: string;
      NEXT_PUBLIC_SITE_URL?: string;
      SUPABASE_ANON_KEY?: string;
      SUPABASE_SERVICE_ROLE_KEY?: string;
      VIEW_HASH_SALT?: string;
      RESEND_API_KEY?: string;
      RESEND_FROM_EMAIL?: string;
      CRON_SECRET?: string;
      SENTRY_DSN?: string;
    }
  }
}

export type { CloudflareEnv };
