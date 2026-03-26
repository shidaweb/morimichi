export type SortMode = "new" | "replies" | "views";

export type ListCursor =
  | { s: "new"; c: string; i: string }
  | { s: "replies"; r: number; c: string; i: string }
  | { s: "views"; v: number; c: string; i: string };

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function encodeCursor(cursor: ListCursor): string {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(cursor)));
}

export function decodeCursor(raw: string | null | undefined): ListCursor | null {
  if (!raw) return null;
  try {
    const text = new TextDecoder().decode(base64UrlToBytes(raw));
    const j = JSON.parse(text) as unknown;
    if (!j || typeof j !== "object") return null;
    const o = j as Record<string, unknown>;
    if (o.s === "new" && typeof o.c === "string" && typeof o.i === "string") {
      return { s: "new", c: o.c, i: o.i };
    }
    if (
      o.s === "replies" &&
      typeof o.r === "number" &&
      typeof o.c === "string" &&
      typeof o.i === "string"
    ) {
      return { s: "replies", r: o.r, c: o.c, i: o.i };
    }
    if (
      o.s === "views" &&
      typeof o.v === "number" &&
      typeof o.c === "string" &&
      typeof o.i === "string"
    ) {
      return { s: "views", v: o.v, c: o.c, i: o.i };
    }
    return null;
  } catch {
    return null;
  }
}

export function nextCursorFromRow(
  row: {
    id: string;
    created_at: string;
    reply_count: number | null;
    view_count: number | null;
  },
  sort: SortMode,
): ListCursor {
  const c = row.created_at;
  const i = row.id;
  if (sort === "replies") {
    return { s: "replies", r: row.reply_count ?? 0, c, i };
  }
  if (sort === "views") {
    return { s: "views", v: row.view_count ?? 0, c, i };
  }
  return { s: "new", c, i };
}
