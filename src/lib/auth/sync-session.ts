export async function syncAuthCookies(accessToken: string, refreshToken: string) {
  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      access_token: accessToken,
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof err === "object" && err && "error" in err
        ? String((err as { error: string }).error)
        : "session_sync_failed",
    );
  }
}

export async function clearAuthCookies() {
  await fetch("/api/auth/session", { method: "DELETE" });
}
