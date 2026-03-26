/**
 * Cloudflare Workers では CF-Connecting-IP を優先。
 * ローカルや他ホストでは X-Forwarded-For 等にフォールバック。
 */
export function getClientIp(request: Request): string {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf?.trim()) return cf.trim();

  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }

  const real = request.headers.get("x-real-ip");
  if (real?.trim()) return real.trim();

  return "unknown";
}
