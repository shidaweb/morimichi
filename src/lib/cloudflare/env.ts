import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function getEnv() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const e = env as Record<string, string | undefined>;
    return {
      SUPABASE_URL:
        e.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      SUPABASE_ANON_KEY:
        e.SUPABASE_ANON_KEY ??
        process.env.SUPABASE_ANON_KEY ??
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
        "",
      SUPABASE_SERVICE_ROLE_KEY:
        e.SUPABASE_SERVICE_ROLE_KEY ??
        process.env.SUPABASE_SERVICE_ROLE_KEY ??
        "",
      RESEND_API_KEY:
        e.RESEND_API_KEY ?? process.env.RESEND_API_KEY ?? undefined,
      SENTRY_DSN: e.SENTRY_DSN ?? process.env.SENTRY_DSN ?? undefined,
    };
  } catch {
    return {
      SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      SUPABASE_ANON_KEY:
        process.env.SUPABASE_ANON_KEY ??
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
        "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      SENTRY_DSN: process.env.SENTRY_DSN,
    };
  }
}
