import { getRateLimitKv } from "@/lib/cloudflare/kv";

export interface RateLimitConfig {
  key: string;
  limit: number;
  windowSeconds: number;
}

export async function checkRateLimit(
  config: RateLimitConfig,
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const kv = await getRateLimitKv();
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / config.windowSeconds);
  const windowKey = `${config.key}:${windowStart}`;

  if (!kv) {
    return {
      allowed: true,
      remaining: config.limit,
      resetAt: (windowStart + 1) * config.windowSeconds,
    };
  }

  const current = parseInt((await kv.get(windowKey)) ?? "0", 10);

  if (current >= config.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: (windowStart + 1) * config.windowSeconds,
    };
  }

  await kv.put(windowKey, String(current + 1), {
    expirationTtl: config.windowSeconds * 2,
  });

  return {
    allowed: true,
    remaining: config.limit - current - 1,
    resetAt: (windowStart + 1) * config.windowSeconds,
  };
}
