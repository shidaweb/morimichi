/// <reference types="@cloudflare/workers-types" />

import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function getRateLimitKv(): Promise<KVNamespace | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const kv = (env as { RATE_LIMIT_KV?: KVNamespace }).RATE_LIMIT_KV;
    return kv ?? null;
  } catch {
    return null;
  }
}
